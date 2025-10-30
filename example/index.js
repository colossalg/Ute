import van from "../ute.js";
const { button, canvas, div, h1, h2, hr } = van.tags;

import { ShapeTypes, createShape } from "./shapes.js";

const TypeButton = ({ onclick, active }, ...children) => {
    return button({
        onclick,
        class: `type-button ${active ? "active" : ""}`,
    }, ...children);
};

const TypeControl = (type) => {
    // All 4 need to re-render on change of type state as the
    // "active" class will need to be updated. As a result,
    // the buttons don't need direct access to the state
    // for fine grained bindings, this lambda will serve
    // for binding.
    return () => {
        return div({ class: "type-control" },
            TypeButton({
                onclick: () => type.val = ShapeTypes.line,
                active: type.val === ShapeTypes.line,
            }, "Line"),
            TypeButton({
                onclick: () => type.val = ShapeTypes.stroke,
                active: type.val === ShapeTypes.stroke,
            }, "Stroke"),
            TypeButton({
                onclick: () => type.val = ShapeTypes.circle,
                active: type.val === ShapeTypes.circle,
            }, "Circle"),
            TypeButton({
                onclick: () => type.val = ShapeTypes.rectangle,
                active: type.val === ShapeTypes.rectangle,
            }, "Rectangle"),
        );
    };
};

const WidthControl = (width) => {
    const clamp = (min, max, val) => Math.max(min, Math.min(max, val));
    return div({ class: "width-control" },
        h2("Width: ", width),
        div(
            button({ onclick: () => { width.val = clamp(1, 32, width.val + 1) } }, "+"),
            button({ onclick: () => { width.val = clamp(1, 32, width.val - 1) } }, "-"),
        )
    )
};

const ColorSwatch = ({ color, setColor }) => {
    const dom = div({
        class: "color-swatch",
        onclick: () => setColor(color),
    });
    dom.style.background = color;
    return dom;
};

const ColorRow = ({ base, setColor }) => {
    return div({ class: "row" },
        ColorSwatch({ setColor, color: `hsl(from ${base} h s calc(2/4*l))` }),
        ColorSwatch({ setColor, color: `hsl(from ${base} h s calc(3/4*l))` }),
        ColorSwatch({ setColor, color: base }),
        ColorSwatch({ setColor, color: `hsl(from ${base} h s calc(5/4*l))` }),
        ColorSwatch({ setColor, color: `hsl(from ${base} h s calc(6/4*l))` }),
    );
};

const ColorControl = (color) => {
    const setColor = (newColor) => { color.val = newColor };
    return div({ class: "color-control" },
        div({ class: "row" },
            h2("Color: "),
            () => ColorSwatch({ setColor, color: color.val }),
        ),
        // Be a bit more picky regarding the white/grey/black.
        div({ class: "row" },
            ColorSwatch({ setColor, color: "#FFF" }),
            ColorSwatch({ setColor, color: "#CCC" }),
            ColorSwatch({ setColor, color: "#888" }),
            ColorSwatch({ setColor, color: "#444" }),
            ColorSwatch({ setColor, color: "#000" }),
        ),
        ColorRow({ setColor, base: "red" }),
        ColorRow({ setColor, base: "blue" }),
        ColorRow({ setColor, base: "green" }),
        ColorRow({ setColor, base: "yellow" }),
    )
};

const ToolBar = (currTool) => {
    return div({ class: "tool-bar" },
        TypeControl(currTool.type),
        hr(),
        WidthControl(currTool.width),
        hr(),
        ColorControl(currTool.color),
    );
};

const SketchPad = ({ width, height, startShape }) => {
    const prevShapes = van.state([]);
    const currShape = van.state(null);

    const handleMouseDown = (e) => { currShape.val = startShape(e.offsetX, e.offsetY) };
    const handleMouseMove = (e) => {
        if (currShape.val !== null) {
            currShape.val = currShape.val.mouseMove(e.offsetX, e.offsetY);
        }
    };
    const handleMouseUp = () => {
        prevShapes.val = [...prevShapes.val, currShape.val];
        currShape.val = null;
    };

    return div(() => {
        const sketchPad = canvas({
            class: "sketch-pad",
            width,
            height,
            onmousedown: handleMouseDown,
            onmousemove: handleMouseMove,
            onmouseup: handleMouseUp,
        });
        const ctx = sketchPad.getContext("2d");
        [...prevShapes.val, currShape.val]
            .filter(shape => shape)
            .forEach(shape => shape.draw(ctx));
        return sketchPad;
    });
};

const App = () => {
    const currTool = {
        type: van.state(ShapeTypes.line),
        width: van.state(1),
        color: van.state("black"),
    };

    const startShape = (x, y) => {
        return createShape(
            currTool.type.val,
            currTool.width.val,
            currTool.color.val,
            x,
            y
        );
    };

    return (
        div({ class: "center" },
            div({ class: "border" },
                div({ class: "layout" },
                    h1({ class: "title" }, "Sketch Pad"),
                    ToolBar(currTool),
                    SketchPad({
                        width:  800,
                        height: 600,
                        startShape,
                    }),
                ),
            ),
        )
    );
};

const root = document.querySelector("#root");
van.add(root, App());