/* Samsung TV remote key-code map + a single global keydown dispatcher.
 * Screens register a handler; the active handler receives named key events.
 *
 * CRITICAL: when a real <input>/<textarea> is focused (system IME), we must NOT
 * steal Backspace/Space/digits or call preventDefault — that crashes or bricks
 * typing on Tizen 8–10 Smart Remotes. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});

    var CODES = {
        13: "Enter",
        37: "Left", 38: "Up", 39: "Right", 40: "Down",
        10009: "Back",
        10182: "Exit",
        415: "Play", 19: "Pause", 10252: "PlayPause", 413: "Stop",
        412: "Rewind", 417: "Forward",
        10232: "Prev", 10233: "Next",
        403: "Red", 404: "Green", 405: "Yellow", 406: "Blue",
        457: "Info",
        48: "0", 49: "1", 50: "2", 51: "3", 52: "4",
        53: "5", 54: "6", 55: "7", 56: "8", 57: "9"
    };

    // Desktop-preview only — never treat Space/Backspace as TV keys while typing.
    var PREVIEW = {
        13: "Enter", 37: "Left", 38: "Up", 39: "Right", 40: "Down",
        27: "Back"
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

    function isTypingTarget(target) {
        if (!target || !target.tagName) return false;
        var tag = String(target.tagName).toUpperCase();
        if (tag !== "INPUT" && tag !== "TEXTAREA") return false;
        if (target.disabled || target.readOnly) return false;
        return true;
    }

    function onKeyDown(e) {
        var code = e.keyCode;
        var typing = isTypingTarget(e.target);

        if (typing) {
            /* Let the system IME / keyboard deliver characters freely. */
            var navWhileTyping = CODES[code];
            if (navWhileTyping === "Up" || navWhileTyping === "Down" ||
                navWhileTyping === "Back" || navWhileTyping === "Exit" ||
                navWhileTyping === "Enter") {
                /* Hand TV chrome to the screen; do not block Backspace (8) or Space (32). */
                if (STU.input) STU.input.setDpad();
                var ht = active();
                if (ht) {
                    if (navWhileTyping !== "Enter") e.preventDefault();
                    ht(navWhileTyping, code, e);
                }
            }
            return;
        }

        var name = CODES[code] || PREVIEW[code];
        /* Desktop preview: Backspace as Back only when NOT typing. */
        if (!name && code === 8) name = "Back";
        if (!name && code === 32) name = "Enter";
        if (!name) return;

        e.preventDefault();
        if (STU.input) STU.input.setDpad();
        var h = active();
        if (h) {
            try { h(name, code, e); }
            catch (err) {
                if (STU.dom && STU.dom.toast) STU.dom.toast((err && err.message) || "Key error", true);
            }
        }
    }

    document.addEventListener("keydown", onKeyDown, true);

    STU.keys = { CODES: CODES, push: push, pop: pop, active: active };
})();
