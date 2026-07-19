/* Samsung TV remote key-code map + a single global keydown dispatcher.
 * Screens register a handler; the active handler receives named key events. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});

    var CODES = {
        13: "Enter", 32: "Enter",
        37: "Left", 38: "Up", 39: "Right", 40: "Down",
        10009: "Back", 8: "Back",     // 8 = browser backspace (preview)
        10182: "Exit",
        415: "Play", 19: "Pause", 10252: "PlayPause", 413: "Stop",
        412: "Rewind", 417: "Forward",
        10232: "Prev", 10233: "Next",
        403: "Red", 404: "Green", 405: "Yellow", 406: "Blue",
        457: "Info",
        48: "0", 49: "1", 50: "2", 51: "3", 52: "4",
        53: "5", 54: "6", 55: "7", 56: "8", 57: "9"
    };

    // Desktop-preview fallbacks for keyboards without a TV remote.
    var PREVIEW = {
        13: "Enter", 37: "Left", 38: "Up", 39: "Right", 40: "Down",
        27: "Back", 8: "Back", 32: "PlayPause"
    };

    var stack = [];   // handler stack; top of stack is active

    function push(handler) { stack.push(handler); }
    function pop(handler) {
        if (handler) {
            var i = stack.lastIndexOf(handler);
            if (i >= 0) stack.splice(i, 1);
        } else {
            stack.pop();
        }
    }
    function active() { return stack.length ? stack[stack.length - 1] : null; }

    function onKeyDown(e) {
        var code = e.keyCode;
        var name = CODES[code] || PREVIEW[code];
        if (!name) return;
        e.preventDefault();
        // A remote key means the user put the air-mouse down: leave pointer mode.
        if (STU.input) STU.input.setDpad();
        var h = active();
        if (h) h(name, code, e);
    }

    document.addEventListener("keydown", onKeyDown);

    STU.keys = { CODES: CODES, push: push, pop: pop, active: active };
})();
