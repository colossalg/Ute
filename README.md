UteJS
=====

Ute is a minimal JavaScript framework for creating UIs using only pure JavaScript and the DOM.

Ute is essentially a refactoring of VanJS aimed to make the code more digestable at a glance.

Here is the code required for the typical counter example:

```JavaScript
import ute from "./ute.js";
const { button, div, p } = ute.tags;

const Counter = () => {
  const count = ute.state(0);
  return div(
    p("Counter: ", count),
    button({ onclick: () => count.val++ }, "Click Me!"),
  );
};

const root = document.querySelector("#root");
ute.add(root, Counter());
```

Under the hood, Ute will track the use of state and know to update the DOM accordingly to changes.

The underlying mechanics are inherited from VanJS, and are quite similar to MobX's reactive model.

View the VanJS docs for more information. https://vanjs.org/

The comments in the source too may offer some quick insights without having to delve too deep.

## Running the Example

The easiest way to get the example running is via the Python HTTP server (to dodge CORS issues with the file paths):
```bash
cd <repo-root>
python -m http.server 8080
```

Then navigate to http://localhost:8080/example, and all should work.

## What's with the name?

VanJS gets its name from how it allows creation of UIs using vanilla JavaScript.

When I picture it, however, I picture a vehicle.

Here in Australia, what would be referred to as a "pickup" is called a ute, short for utility vehicle.
