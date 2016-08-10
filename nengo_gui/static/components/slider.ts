/**
 * A slider object with 1+ handles to adjust Node values
 *
 * @constructor
 * @param {DOMElement} parent - the element to add this component to
 * @param {SimControl} sim - the simulation controller
 * @param {dict} args - a set of constructor arguments (see Component)
 * @param {int} args.n_sliders - the number of sliders to show
 *
 * Slider constructor is called by python server when a user requests a slider
 * or when the config file is making sliders. Server request is handled in
 * netgraph.js {.on_message} function.
 */

import "./slider.css";
import { Component } from "./component";
import { DataStore } from "../datastore";
import * as menu from "../menu";
import SliderControl from "./slidercontrol";

export default class Slider extends Component {

    constructor(parent, viewport, sim, args) {
        super(parent, viewport, args);
        var self = this;
        this.sim = sim;

        // Check if user is filling in a number into a slider
        this.filling_slider_value = false;
        this.n_sliders = args.n_sliders;

        this.data_store = null;

        this.notify_msgs = [];
        // TODO: get rid of the immediate parameter once the websocket delay
        //       fix is merged in (#160)
        this.immediate_notify = true;

        this.set_axes_geometry(this.width, this.height);

        this.minHeight = 40;

        this.group = document.createElement('div');
        this.group.style.height = this.slider_height;
        this.group.style.marginTop = this.ax_top;
        this.group.style.whiteSpace = 'nowrap';
        this.group.position = 'relative';
        this.div.appendChild(this.group);

        // Make the sliders
        // The value to use when releasing from user control
        this.reset_value = args.start_value;
        // The value to use when restarting the simulation from beginning
        this.start_value = args.start_value;

        this.sliders = [];
        for (var i = 0; i < args.n_sliders; i++) {
            // Creating a SliderControl object for every slider handle required
            var slider = new SliderControl(args.min_value, args.max_value);
            slider.container.style.width = (100 / args.n_sliders) + '%';
            slider.display_value(args.start_value[i]);
            slider.index = i;
            slider.fixed = false;

            slider.on('change', function(event) {
                event.target.fixed = true;
                self.send_value(event.target.index, event.value);
            }).on('changestart', function(event) {
                menu.hide_any();
                for (var i in this.sliders) {
                    if (this.sliders[i] !== event.target) {
                        this.sliders[i].deactivate_type_mode();
                    }
                }
            });

            this.group.appendChild(slider.container);
            this.sliders.push(slider);
        }

        // Call schedule_update whenever the time is adjusted in the SimControl
        this.sim.div.addEventListener('adjust_time', function(e) {
            self.schedule_update();
        }, false);

        this.sim.div.addEventListener('sim_reset', function(e) {
            self.on_sim_reset();
        }, false);

        this.on_resize(this.get_screen_width(), this.get_screen_height());
    };

    set_axes_geometry(width, height) {
        this.width = width;
        this.height = height;
        var scale = parseFloat($('#main').css('font-size'));
        this.border_size = 1;
        this.ax_top = 1.75 * scale;
        this.slider_height = this.height - this.ax_top;
    };

    send_value(slider_index, value) {
        console.assert(typeof slider_index == 'number');
        console.assert(typeof value == 'number');

        if (this.immediate_notify) {
            this.ws.send(slider_index + ',' + value);
        } else {
            this.notify(slider_index + ',' + value);
        }
        this.sim.time_slider.jump_to_end();
    };

    on_sim_reset(event) {
        // Release slider position and reset it
        for (var i = 0; i < this.sliders.length; i++) {
            this.notify('' + i + ',reset');
            this.sliders[i].display_value(this.start_value[i]);
            this.sliders[i].fixed = false;
        }
    };

    /**
     * Receive new line data from the server.
     */
    on_message(event) {
        var data = new Float32Array(event.data);
        if (this.data_store === null) {
            this.data_store = new DataStore(this.sliders.length, this.sim, 0);
        }
        this.reset_value = [];
        for (var i = 0; i < this.sliders.length; i++) {
            this.reset_value.push(data[i + 1]);

            if (this.sliders[i].fixed) {
                data[i + 1] = this.sliders[i].value;
            }
        }
        this.data_store.push(data);

        this.schedule_update();
    };

    /**
     * Update visual display based when component is resized.
     */
    on_resize(width, height) {
        console.assert(typeof width == 'number');
        console.assert(typeof height == 'number');

        if (width < this.minWidth) {
            width = this.minWidth;
        }
        if (height < this.minHeight) {
            height = this.minHeight;
        };

        this.set_axes_geometry(width, height);

        this.group.style.height = height - this.ax_top - 2 * this.border_size;
        this.group.style.marginTop = this.ax_top;

        var N = this.sliders.length;
        for (var i in this.sliders) {
            this.sliders[i].on_resize();
        }

        this.label.style.width = this.width;
        this.div.style.width = this.width;
        this.div.style.height = this.height;
    };

    generate_menu() {
        var self = this;
        var items = [];
        items.push(['Set range...', function() {
            self.set_range();
        }]);
        items.push(['Set value...', function() {
            self.user_value();
        }]);
        items.push(['Reset value', function() {
            self.user_reset_value();
        }]);

        // Add the parent's menu items to this
        // TODO: is this really the best way to call the parent's generate_menu()?
        return $.merge(items, Component.prototype.generate_menu.call(this));
    };

    /**
     * Report an event back to the server.
     */
    notify(info) {
        this.notify_msgs.push(info);

        // Only send one message at a time
        // TODO: find a better way to figure out when it's safe to send
        // another message, rather than just waiting 1ms....
        if (this.notify_msgs.length == 1) {
            var self = this;
            window.setTimeout(function() {
                self.send_notify_msg();
            }, 50);
        }
    };

    /**
     * Send exactly one message back to server.
     *
     * Also schedule the next message to be sent, if any.
     */
    send_notify_msg() {
        var msg = this.notify_msgs[0];
        this.ws.send(msg);
        if (this.notify_msgs.length > 1) {
            var self = this;
            window.setTimeout(function() {
                self.send_notify_msg();
            }, 50);
        }
        this.notify_msgs.splice(0, 1);
    };

    update() {
        // Let the data store clear out old values
        if (this.data_store !== null) {
            this.data_store.update();

            var data = this.data_store.get_last_data();

            for (var i = 0; i < this.sliders.length; i++) {
                if (!this.data_store.is_at_end() || !this.sliders[i].fixed) {
                    this.sliders[i].display_value(data[i]);
                }
            }
        }
    };

    user_value() {
        var self = this;

        // First build the prompt string
        var prompt_string = '';
        for (var i = 0; i < this.sliders.length; i++) {
            prompt_string = prompt_string + this.sliders[i].value.toFixed(2);
            if (i != this.sliders.length - 1) {
                prompt_string = prompt_string + ", ";
            }
        }
        self.sim.modal.title('Set slider value(s)...');
        self.sim.modal.single_input_body(prompt_string, 'New value(s)');
        self.sim.modal.footer('ok_cancel', function(e) {
            var new_value = $('#singleInput').val();
            var modal = $('#myModalForm').data('bs.validator');

            modal.validate();
            if (modal.hasErrors() || modal.isIncomplete()) {
                return;
            }
            self.immediate_notify = false;
            if (new_value !== null) {
                new_value = new_value.split(',');
                // Update the sliders one at a time
                for (var i = 0; i < self.sliders.length; i++) {
                    self.sliders[i].fixed = true;
                    self.sliders[i].set_value(parseFloat(new_value[i]));
                }
            }
            self.immediate_notify = true;
            $('#OK').attr('data-dismiss', 'modal');
        });

        var $form = $('#myModalForm').validator({
            custom: {
                my_validator: function($item) {
                    var nums = $item.val().split(',');
                    if (nums.length != self.sliders.length) {
                        return false;
                    }
                    for (var i = 0; i < nums.length; i++) {
                        if (!$.isNumeric(nums[i])) {
                            return false;
                        }
                    }
                    return true;
                }
            },
        });

        $('#singleInput').attr('data-error', 'Input should be one ' +
                               'comma-separated numerical value for each slider.');
        self.sim.modal.show();
    };

    user_reset_value() {
        for (var i = 0; i < this.sliders.length; i++) {
            this.notify('' + i + ',reset');

            this.sliders[i].set_value(this.reset_value[i]);
            this.sliders[i].fixed = false;
        }
    };

    set_range() {
        var range = this.sliders[0].scale.domain();
        var self = this;
        self.sim.modal.title('Set slider range...');
        self.sim.modal.single_input_body([range[1], range[0]], 'New range');
        self.sim.modal.footer('ok_cancel', function(e) {
            var new_range = $('#singleInput').val();
            var modal = $('#myModalForm').data('bs.validator');

            modal.validate();
            if (modal.hasErrors() || modal.isIncomplete()) {
                return;
            }
            if (new_range !== null) {
                new_range = new_range.split(',');
                var min = parseFloat(new_range[0]);
                var max = parseFloat(new_range[1]);
                for (var i in self.sliders) {
                    self.sliders[i].set_range(min, max);
                }
                self.save_layout();
            }
            $('#OK').attr('data-dismiss', 'modal');
        });
        var $form = $('#myModalForm').validator({
            custom: {
                my_validator: function($item) {
                    var nums = $item.val().split(',');
                    var valid = false;
                    if ($.isNumeric(nums[0]) && $.isNumeric(nums[1])) {
                        if (Number(nums[0]) < Number(nums[1])) {
                            // Two numbers, 1st less than 2nd
                            valid = true;
                        }
                    }
                    return (nums.length == 2 && valid);
                }
            },
        });

        $('#singleInput').attr('data-error', 'Input should be in the ' +
                               'form "<min>,<max>".');
        self.sim.modal.show();
    };

    layout_info() {
        var info = Component.prototype.layout_info.call(this);
        info.width = info.width;
        info.min_value = this.sliders[0].scale.domain()[1];
        info.max_value = this.sliders[0].scale.domain()[0];
        return info;
    };

    update_layout(config) {
        // FIXME: this has to be backwards to work. Something fishy must be going on
        for (var i in this.sliders) {
            this.sliders[i].set_range(config.min_value, config.max_value);
        }
        Component.prototype.update_layout.call(this, config);
    };

}
