const ShapeTypes = Object.freeze({
    line: "LINE",
    stroke: "STROKE",
    circle: "CIRCLE",
    rectangle: "RECTANGLE",
});

const createShape = (type, width, color, x, y) => {
    switch (type) {
        case ShapeTypes.line:
            return new Line(
                width,
                color,
                { x, y },       // Point 1
                { x, y }        // Point 2
            );
        case ShapeTypes.stroke:
            return new Stroke(
                width,
                color,
                [{ x, y }]      // Points
            );
        case ShapeTypes.circle:
            return new Circle(
                width,
                color,
                { x, y },       // Center
                0               // Radius
            );
        case ShapeTypes.rectangle: 
            return new Rectangle(
                width,
                color,
                { x, y },       // Start
                { x: 0, y: 0 }  // Size
            );
    }
};

class Shape {
    constructor(width, color) {
        this.width = width;
        this.color = color;
    }

    draw(ctx) {
        ctx.lineWidth = this.width;
        ctx.strokeStyle = this.color;
    }
}

class Line extends Shape {
    constructor(width, color, point1, point2) {
        super(width, color);
        this.point1 = point1;
        this.point2 = point2;
    }

    draw(ctx) {
        super.draw(ctx);
        ctx.beginPath();
        ctx.moveTo(this.point1.x, this.point1.y);
        ctx.lineTo(this.point2.x, this.point2.y);
        ctx.stroke();
    }

    mouseMove(x, y) {
        return new Line(this.width, this.color, this.point1, { x, y });
    }
}

class Stroke extends Shape {
    constructor(width, color, points) {
        super(width, color);
        this.points = points;
    }

    draw(ctx) {
        super.draw(ctx);
        ctx.beginPath();
        ctx.moveTo(
            this.points[0].x,
            this.points[0].y);
        for (let i = 0; i < this.points.length; ++i) {
            ctx.lineTo(
                this.points[i].x,
                this.points[i].y);
        }
        ctx.stroke();
    }

    mouseMove(x, y) {
        return new Stroke(this.width, this.color, [...this.points, { x, y }]);
    }
}

class Circle extends Shape {
    constructor(width, color, center, radius) {
        super(width, color);
        this.center = center;
        this.radius = radius;
    }

    draw(ctx) {
        super.draw(ctx);
        ctx.beginPath();
        ctx.arc(
            this.center.x,
            this.center.y,
            this.radius,
            0,
            2 * Math.PI);
        ctx.stroke();
    }

    mouseMove(x, y) {
        const newRadius = Math.sqrt(
            Math.pow(this.center.x - x, 2) +
            Math.pow(this.center.y - y, 2));
        return new Circle(this.width, this.color, this.center, newRadius);
    }
}

class Rectangle extends Shape {
    constructor(width, color, start, size) {
        super(width, color);
        this.start = start;
        this.size = size;
    }

    draw(ctx) {
        super.draw(ctx);
        ctx.beginPath();
        ctx.rect(
            this.start.x,
            this.start.y,
            this.size.x,
            this.size.y);
        ctx.stroke();
    }

    mouseMove(x, y) {
        const newSize = {
            x: x - this.start.x,
            y: y - this.start.y,
        };
        return new Rectangle(this.width, this.color, this.start, newSize);
    }
}

export {
    ShapeTypes,
    createShape,
}