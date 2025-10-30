// Type checking helpers
const isFunction = v => v !== undefined && v !== null && Object.getPrototypeOf(v) === Function.prototype;
const isObject = v => v !== undefined && v !== null && Object.getPrototypeOf(v) === Object.prototype;
const isState = v => v !== undefined && v !== null && Object.getPrototypeOf(v) === State.prototype;

/**
 * Class representing a state.
 * 
 * States wrap a value, and act as a proxy for tracking the use of this value.
 * This usage is recorded via the corresponding tracker singletons.
 * @see dependencyTracker
 * @see changedStatesArray
 * @see derivedStatesArray
 * 
 * States store their related bindings and listeners so we can update
 * the DOM and any states derived from this one accordingly when this
 * state's value is changed.
 * @see Binding
 * @see Listener
 */
class State {
  constructor(initVal = undefined) {
    this.rawVal = initVal;
    this._oldVal = initVal;
    this._bindings = [];
    this._listeners = [];
  }

  get val() {
    dependencyTracker.addGetter(this);
    return this.rawVal;
  }

  get oldVal() {
    dependencyTracker.addGetter(this);
    return this._oldVal;
  }

  set val(newVal) {
    dependencyTracker.addSetter(this);
    if (this.rawVal !== newVal) {
      this.rawVal = newVal;
      if (this._bindings.length > 0 || this._listeners.length > 0) {
        // Ignored if not currently tracking derived states.
        derivedStatesTracker.add(this);
        changedStatesTracker.add(this);
      } else {
        this._oldVal = newVal;
      }
    }
  }

  removeDisconnected() {
    this._bindings = this._bindings.filter(b => b._dom?.isConnected);
    this._listeners = this._listeners.filter(l => l._dom?.isConnected);
  }
}

/**
 * Class representing a binding.
 * 
 * Bindings ultimately connect states to the DOM, and facilitate
 * the mechanisms propagating state changes to the DOM.
 *
 * The states themselves store which bindings are dependent upon them.
 * @see State
 */
class Binding {
  constructor(f) {
    this._f = f;
    this._dom = undefined;
  }
}

/**
 * Class representing a listener.
 * 
 * Listeners ultimately connect states to each other, and facilitate
 * the mechanisms propagating state changes to other (derived) states.
 * 
 * The states themselves store which listeners are dependent upon them.
 * @see State
 */
class Listener {
  constructor(f, s, dom) {
    this._f = f;
    this._s = s;
    this._dom = dom;
    // Ignored if we're not currently tracking dependencies.
    dependencyTracker.addNewDerived(this);
  }
}

/**
 * Immutable singleton for garbage collection.
 */
const addStateToGc = (() => {
  const states = new Set();
  const collect = () => {
    states.forEach(s => s.removeDisconnected());
    states.clear();
  };
  return s => {
    if (states.size === 0) {
      const gcCycleInMs = 1000;
      setTimeout(collect, gcCycleInMs);
    }
    states.add(s);
  };
})();

/**
 * Immutable singleton for tracking usage of state.
 *   - Calls to a state's getters.
 *   - Calls to a state's setters.
 *   - Creation of new derived states.
 * 
 * This allows building the graph of dependencies between states,
 * other states, and the DOM. This graph of dependencies provides
 * the reactivity upon state change.
 */
const dependencyTracker = (() => {
  const usageStack = [];
  return Object.freeze({
    start: () => { usageStack.push(new DependencyCollection()) },
    stop: () => {
      if (usageStack.length > 0) {
        usageStack.pop();
      }
    },
    getUsage: () => {
      if (usageStack.length > 0) {
        return usageStack[usageStack.length - 1];
      } else {
        return null;
      }
    },
    addGetter: s => {
      if (usageStack.length > 0) {
        usageStack[usageStack.length - 1]._getters.add(s);
      }
    },
    addSetter: s => {
      if (usageStack.length > 0) {
        usageStack[usageStack.length - 1]._setters.add(s);
      }
    },
    addNewDerived: s => {
      if (usageStack.length > 0) {
        usageStack[usageStack.length - 1]._newDerives.add(s);
      }
    },
  });
})();

/**
 * Helper class for tracking the usage of state.
 */
class DependencyCollection {
  constructor() {
    this._getters = new Set();
    this._setters = new Set();
    this._newDerives = new Set();
  }
}

/**
 * Immutable singleton for tracking changes to ALL states.
 * 
 * Used to trigger and perform updates to other (derived) states and the DOM.
 */
const changedStatesTracker = (() => {
  const changed = new Set();
  return Object.freeze({
    add: s => {
      if (changed.size === 0) {
        queueMicrotask(updateDoms);
      }
      changed.add(s);
    },
    // Value could have been flipped back, make sure it truly is changed.
    getArray: () => [...changed].filter(s => s.rawVal !== s._oldVal),
    clear: () => { changed.clear() },
  });
})();

/**
 * Immutable singleton for tracking DERIVED states.
 *
 * Derived state and changed state are similar but not quite equivalent.
 * Derived state is state which has changed in response to other states
 * changing (not users input, etc.).
 * 
 * Used to perform iterative recalculation of all (derived) state during
 * an update, and determine when the state has stabilised.
 */
const derivedStatesTracker = (() => {
  let derived = new Set();
  let track = false;
  return Object.freeze({
    start: () => {
      derived = new Set(changedStatesTracker.getArray());
      track = true;
    },
    stop: () => {
      derived.clear();
      track = false;
    },
    add: s => {
      if (track) {
        derived.add(s);
      }
    },
    // Value could have been flipped back, make sure it truly is changed.
    getArray: () => [...derived].filter(s => s.rawVal !== s._oldVal),
    clear: () => { derived.clear() },
  });
})();

/**
 * Create a binding.
 * @see Binding
 */
const bind = (f, dom = undefined) => {
  const binding = new Binding(f);

  dependencyTracker.start();
  try {
    binding._dom =  (dom); // Fallback.
    binding._dom = f(dom); // Could throw.
  } catch (e) {
    // TODO - Inherited from VanJS, doesn't seem like the most
    // robust error handling strategy, should reconsider.
    console.error(e);
  }
  if (!(binding._dom ?? document).nodeType) {
    binding._dom = new Text(binding._dom);
  }
  const dependencies = dependencyTracker.getUsage();
  dependencyTracker.stop();

  [...dependencies._getters]
    .filter(dep => !dependencies._setters.has(dep))
    .forEach(dep => {
      dep._bindings.push(binding);
      addStateToGc(dep);
    });
  
  dependencies._newDerives
    .forEach(dep => dep._dom = binding._dom);

  return binding._dom;
}

/**
 * Create a listener.
 * @see Listener
 */
const derive = (f, s = (new State()), dom = undefined) => {
  const alwaysConnectedDom = Object.freeze({ isConnected: true });
  const listener = new Listener(f, s, dom ?? alwaysConnectedDom);
  
  dependencyTracker.start();
  try {
    s.val = f(s.rawVal); // Could throw.
  } catch (e) {
    // TODO - Inherited from VanJS, doesn't seem like the most
    // robust error handling strategy, should reconsider.
    console.error(e);
  }
  const dependencies = dependencyTracker.getUsage();
  dependencyTracker.stop();
  
  [...dependencies._getters]
    .filter(dep => !dependencies._setters.has(dep))
    .forEach(dep => {
      dep._listeners.push(listener);
      addStateToGc(dep);
    });

  return s;
}

/**
 * Adds a set of children to a DOM node.
 * If a child is a function or state, the appropriate binding will be created.
 */
const add = (dom, ...children) => {
  children
    .flat(Infinity)
    .filter(c => c)
    .map(c => {
      if (isFunction(c)) return bind(c);
      if (isState(c)) return bind(() => c.val);
      return c;
    })
    .filter(c => c)
    .forEach(c => dom.append(c));
  return dom;
}

/**
 * Helper to get a setter function for a given property "key" on a dom node.  
 */
const getDomKeySetter = (dom, key) => {
  if (key.startsWith("on")) {
    return (newVal, oldVal) => {
      const event = key.slice(2);
      dom.removeEventListener(event, oldVal);
      dom.addEventListener(event, newVal);
    };
  } else {
    const getPropDesc = prototype => {
      if (!prototype) {
        return;
      }
      return Object.getOwnPropertyDescriptor(prototype, key)
        ?? getPropDesc(Object.getPrototypeOf(prototype));
    }
    return getPropDesc(Object.getPrototypeOf(dom))?.set?.bind(dom)
      ?? dom.setAttribute.bind(dom, key);
  }
}

/**
 * Creates a DOM node with the corresponding namespace/name.
 * ...args has the following format:
 *   - (Optional at 0) - object containing:
 *     - The props for the DOM node (class, etc.).
 *     - The event handlers for the DOM node (onclick, onchange etc.).
 *       (These be prefixed with "on" to distinguish them from props).
 *   - (Rest) - The children for the DOM node.
 */
const tag = (namespace, name, ...args) => {
  // Coerce the args into the format expected.
  // If the first arg is an object, then it is assumed to be the props
  // for the tag being constructed, the remaining args are the children.
  // If the props are not present, then make an empty dummy object for them.
  let toUnpack = args;
  if (toUnpack.length === 0 || !isObject(toUnpack[0])) {
    toUnpack = [{}, ...toUnpack];
  }
  const [{is, ...props}, ...children] = toUnpack;

  const dom = namespace
    ? document.createElementNS(namespace, name, {is})
    : document.createElement(name, {is});

  for (let [key, val] of Object.entries(props)) {
    const setter = getDomKeySetter(dom, key);
    if (!key.startsWith("on") && isFunction(val)) {
      val = derive(val);
    }
    if (isState(val)) {
      bind(() => {
        setter(val.val, val._oldVal);
        return dom;
      });
    } else {
      setter(val);
    }
  }

  return add(dom, children);
}

// Proxy magic for exports.
const handler = namespace => ({ get: (_, name) => tag.bind(undefined, namespace, name) });
const tags = new Proxy(ns => new Proxy(tag, handler(ns)), handler());

const replaceOrRemoveDom = (oldDom, newDom) => {
  if (!newDom) {
    oldDom.remove();
  } else if (newDom !== oldDom) {
    oldDom.replaceWith(newDom);
  }
};

const removeDisconnectedAndGetAllListeners = states => {
  states.forEach(s => s.removeDisconnected());
  return new Set(states.flatMap(s => s._listeners));
}

const removeDisconnectedAndGetAllBindings = states => {
  states.forEach(s => s.removeDisconnected());
  return new Set(states.flatMap(s => s._bindings));
}

/**
 * Update the listeners.
 *
 * This means iterating until either a max number of iterations
 * is hit, or all the (derived) states become stable.
 * 
 * i.e. re-running them does not result in further changed states.
 */
const updateListeners = () => {
  derivedStatesTracker.start();
  let iter = 0;
  while (iter++ < 100) {
    const derivedStatesArray = derivedStatesTracker.getArray();
    derivedStatesTracker.clear();
    const listeners = removeDisconnectedAndGetAllListeners(derivedStatesArray);
    if (listeners.length === 0) {
      break;
    }
    for (const l of listeners) {
      derive(l._f, l._s, l._dom);
      l._dom = undefined;
    }
  }
  derivedStatesTracker.stop();
};

/**
 * Update the bindings.
 *
 * i.e. re-run all binding functions, and update the DOM with the results.
 */
const updateBindings = () => {
  const changedStatesArray = changedStatesTracker.getArray();
  changedStatesTracker.clear();
  const bindings = removeDisconnectedAndGetAllBindings(changedStatesArray);
  for (const b of bindings) {
    replaceOrRemoveDom(b._dom, bind(b._f, b._dom));
    b._dom = undefined;
  }
  for (let s of changedStatesArray) {
    s._oldVal = s.rawVal;
  }
};

const updateDoms = () => {
  updateListeners();
  updateBindings();
};

export default {
  tags,
  add,
  state: v => new State(v),
  derive,
}
