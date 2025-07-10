class Line {
    constructor(start, end, color, weight) {
        this.start = start;
        this.end = end;
        this.color = color;
        this.weight = weight;
    }

    display() {
        push();
        stroke(this.color);
        strokeWeight(this.weight);
        line(this.start.x, this.start.y, this.end.x, this.end.y); // Draw line from start to end
        pop();
    }
}

export default Line;