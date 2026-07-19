/* Screen router + global app state.
 * Each screen module exposes: render(ctx) -> { node, onKey, initialFocus?, destroy? }.
 * ctx = { navigate, replace, back, app }. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var appEl = null;

    var app = {
        session: null,
        activeProfile: null,
        subscription: null,
        needsPaymentAttention: function () {
            var s = app.subscription && app.subscription.status;
            if (!s) return false;
            return ["PAST_DUE", "CANCELED", "CANCELLED", "EXPIRED"].indexOf(String(s).toUpperCase()) >= 0;
        }
    };

    var stack = [];  // [{ name, params, inst }]

    function screenModule(name) {
        var m = STU.screens && STU.screens[name];
        if (!m) throw new Error("Unknown screen: " + name);
        return m;
    }

    function ctxFor() {
        return {
            app: app,
            navigate: navigate,
            replace: replace,
            back: back
        };
    }

    function mountInstance(name, params) {
        var inst = screenModule(name).render(ctxFor(), params || {});
        inst.__name = name;
        inst.__params = params || {};
        inst.node.classList.add("screen");
        appEl.appendChild(inst.node);
        // enter transition
        // force reflow then add enter class
        void inst.node.offsetWidth;
        inst.node.classList.add("screen-enter");
        STU.focus.setScope(inst.node);
        STU.keys.push(inst.onKey);
        if (inst.initialFocus) {
            // allow layout to settle
            setTimeout(function () { try { inst.initialFocus(); } catch (e) {} }, 40);
        }
        return inst;
    }

    function unmount(entry, exit) {
        if (!entry) return;
        var inst = entry.inst;
        STU.keys.pop(inst.onKey);
        if (inst.destroy) { try { inst.destroy(); } catch (e) {} }
        var node = inst.node;
        if (exit) {
            node.classList.remove("screen-enter");
            node.classList.add("screen-exit");
            setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 260);
        } else if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }

    /* Push a new screen on top of the stack. */
    function navigate(name, params) {
        var top = stack[stack.length - 1];
        if (top) unmount(top, true);
        var inst = mountInstance(name, params);
        stack.push({ name: name, params: params || {}, inst: inst });
    }

    /* Replace the entire stack with a single screen (used for auth flow jumps). */
    function replace(name, params) {
        while (stack.length) unmount(stack.pop(), false);
        var inst = mountInstance(name, params);
        stack.push({ name: name, params: params || {}, inst: inst });
    }

    /* Pop back to the previous screen. Returns false if nothing to pop. */
    function back() {
        if (stack.length <= 1) return false;
        var top = stack.pop();
        unmount(top, true);
        var prev = stack[stack.length - 1];
        // Re-mount previous fresh so focus/state is restored cleanly.
        var params = prev.params;
        var name = prev.name;
        unmount(prev, false);
        stack.pop();
        var inst = mountInstance(name, params);
        stack.push({ name: name, params: params, inst: inst });
        return true;
    }

    STU.router = {
        app: app,
        init: function () { appEl = document.getElementById("app"); },
        navigate: navigate,
        replace: replace,
        back: back,
        current: function () { return stack.length ? stack[stack.length - 1].name : null; }
    };
})();
