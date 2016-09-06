/**
 * 2d axes set with the horizontal axis being a time axis.
 *
 * Called by a specific component when it requires an axes set (with the
 * x-axis showing current model time).
 *
 * @constructor
 * @param {DOMElement} parent - the element to add this component to
 * @param {dict} args - A set of constructor arguments (see Axes2D)
 */

import * as $ from "jquery";

import Axes2D from "./2d_axes";

export default class TimeAxes extends Axes2D {
    axis_time_end;
    axis_time_start;
    display_time;

    constructor(parent, args) {
        super(parent, args);
        this.display_time = args.display_time;

        this.axis_x.ticks(0);

        this.axis_time_end = this.svg.append("text")
            .text("Time: NULL")
            .attr("class", "graph_text unselectable")[0][0];
        this.axis_time_start = this.svg.append("text")
            .text("Time: NULL")
            .attr("class", "graph_text unselectable")[0][0];

        if (this.display_time === false) {
            this.axis_time_start.setAttribute("display", "none");
            this.axis_time_end.setAttribute("display", "none");
        }
    }

    set_time_range(start, end) {
        this.scale_x.domain([start, end]);
        this.axis_time_start.textContent = start.toFixed(3);
        this.axis_time_end.textContent = end.toFixed(3);
        this.axis_x_g.call(this.axis_x);
    }

    on_resize(width, height) {
        Axes2D.prototype.on_resize.call(this, width, height);

        const scale = parseFloat($("#main").css("font-size"));
        const suppression_width = 6 * scale;
        const text_offset = 1.2 * scale;

        if (width < suppression_width || this.display_time === false) {
            this.axis_time_start.setAttribute("display", "none");
        } else {
            this.axis_time_start.setAttribute("display", "block");
        }

        this.axis_time_start.setAttribute("x", this.ax_left - text_offset);
        this.axis_time_start.setAttribute("y", this.ax_bottom + text_offset);
        this.axis_time_end.setAttribute("x", this.ax_right - text_offset);
        this.axis_time_end.setAttribute("y", this.ax_bottom + text_offset);
    }
}
