/* Geometric spatial-navigation engine for D-pad focus.
 * Focusable elements carry class "focusable". The engine picks the best
 * neighbour in the pressed direction using on-screen geometry, applies the
 * "focused" class, scrolls rails/pages so the target is visible, and fires
 * a "click" on Enter. Fully pointer-free (built for TV remotes). */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});

    var current = null;         // currently focused element
    var container = null;       // scope to search within (a screen root)

    function rect(elm) {
        var r = elm.getBoundingClientRect();
        return { l: r.left, r: r.right, t: r.top, b: r.bottom,
                 cx: r.left + r.width / 2, cy: r.top + r.height / 2,
                 w: r.width, h: r.height };
    }

    function visible(elm) {
        if (elm.classList.contains("focus-skip")) return false;
        if (elm.offsetParent === null && elm.getClientRects().length === 0) return false;
        var r = elm.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
    }

    function candidates() {
        var scope = container || document.getElementById("app");
        var list = scope.querySelectorAll(".focusable");
        var out = [];
        for (var i = 0; i < list.length; i++) if (visible(list[i])) out.push(list[i]);
        return out;
    }

    /* Score a candidate for movement in `dir` from `from`. Lower = better. */
    function score(from, cand, dir) {
        var a = rect(from), b = rect(cand);
        var primary, secondary, aligned;

        if (dir === "Left" || dir === "Right") {
            primary = dir === "Right" ? (b.l - a.r) : (a.l - b.r);
            // require the candidate to actually be on that side
            if (dir === "Right" && b.cx <= a.cx) return Infinity;
            if (dir === "Left" && b.cx >= a.cx) return Infinity;
            secondary = Math.abs(b.cy - a.cy);
            aligned = (b.t < a.b && b.b > a.t);
        } else {
            primary = dir === "Down" ? (b.t - a.b) : (a.t - b.b);
            if (dir === "Down" && b.cy <= a.cy) return Infinity;
            if (dir === "Up" && b.cy >= a.cy) return Infinity;
            secondary = Math.abs(b.cx - a.cx);
            aligned = (b.l < a.r && b.r > a.l);
        }

        var gap = primary < 0 ? primary * 0.35 : primary; // small overlap tolerated
        var penalty = aligned ? 0 : secondary * 0.6;
        return Math.abs(gap) + secondary * 1.0 + penalty;
    }

    function setFocus(elm, opts) {
        if (!elm) return;
        if (current && current !== elm) current.classList.remove("focused");
        current = elm;
        elm.classList.add("focused");
        // Auto-collapse the side nav when focus leaves it.
        var scope = container || document.getElementById("app");
        var nav = scope.querySelector(".sidenav");
        if (nav) {
            if (closest(elm, ".sidenav")) nav.classList.add("open");
            else nav.classList.remove("open");
        }
        ensureVisible(elm, opts);
        if (elm.__onFocus) elm.__onFocus(elm);
    }

    function move(dir) {
        if (!current) {
            var all = candidates();
            if (all.length) setFocus(all[0]);
            return;
        }
        // Allow an element to override movement (e.g. rows, timeline scrubbing).
        if (current.__navOverride && current.__navOverride(dir) === true) return;

        var best = null, bestScore = Infinity;
        var cands = candidates();
        for (var i = 0; i < cands.length; i++) {
            if (cands[i] === current) continue;
            var s = score(current, cands[i], dir);
            if (s < bestScore) { bestScore = s; best = cands[i]; }
        }
        if (best) setFocus(best);
    }

    /* Scroll the nearest rail (horizontal) and page/track (vertical) to reveal elm. */
    function ensureVisible(elm) {
        // Horizontal rail
        var rail = closest(elm, ".row-rail");
        if (rail) {
            var clip = rail.parentElement; // .row-rail-clip
            var er = elm.getBoundingClientRect();
            var cr = clip.getBoundingClientRect();
            var cur = currentTranslateX(rail);
            var pad = 96;
            if (er.right > cr.right - pad) cur -= (er.right - (cr.right - pad));
            else if (er.left < cr.left + pad) cur += ((cr.left + pad) - er.left);
            if (cur > 0) cur = 0;
            rail.style.transform = "translateX(" + cur + "px)";
        }

        // Vertical tracks (home rows, detail body)
        var track = closest(elm, ".rows-track") || closest(elm, ".detail-track") ||
                    closest(elm, ".hero") /* keep hero in view via its own track */;
        var vtrack = closest(elm, ".rows-track") || closest(elm, ".detail-track");
        if (vtrack) {
            var scroller = vtrack.parentElement;
            var er2 = elm.getBoundingClientRect();
            var sr = scroller.getBoundingClientRect();
            var curY = currentTranslateY(vtrack);
            var topPad = 160, botPad = 160;
            if (er2.bottom > sr.bottom - botPad) curY -= (er2.bottom - (sr.bottom - botPad));
            else if (er2.top < sr.top + topPad) curY += ((sr.top + topPad) - er2.top);
            if (curY > 0) curY = 0;
            vtrack.style.transform = "translateY(" + curY + "px)";
        }

        // Grid (search / my list) — scroll the overflow:hidden grid via scrollTop
        var grid = closest(elm, ".grid");
        if (grid) {
            var er3 = elm.getBoundingClientRect();
            var gr = grid.getBoundingClientRect();
            var pad2 = 40;
            if (er3.bottom > gr.bottom - pad2) {
                grid.scrollTop += (er3.bottom - (gr.bottom - pad2));
            } else if (er3.top < gr.top + pad2) {
                grid.scrollTop -= ((gr.top + pad2) - er3.top);
            }
        }
    }

    function currentTranslateX(node) {
        var m = /translateX\((-?[\d.]+)px\)/.exec(node.style.transform || "");
        if (m) return parseFloat(m[1]);
        var m2 = /matrix\(([^)]+)\)/.exec(getComputedStyle(node).transform || "");
        return m2 ? parseFloat(m2[1].split(",")[4]) : 0;
    }
    function currentTranslateY(node) {
        var m = /translateY\((-?[\d.]+)px\)/.exec(node.style.transform || "");
        if (m) return parseFloat(m[1]);
        var m2 = /matrix\(([^)]+)\)/.exec(getComputedStyle(node).transform || "");
        return m2 ? parseFloat(m2[1].split(",")[5]) : 0;
    }

    function closest(elm, sel) {
        var n = elm;
        while (n && n.nodeType === 1) {
            if (n.matches && n.matches(sel)) return n;
            n = n.parentElement;
        }
        return null;
    }

    function enter() {
        if (!current) return;
        if (current.__onEnter) { current.__onEnter(current); return; }
        current.click();
    }

    STU.focus = {
        setScope: function (node) { container = node; },
        clear: function () { if (current) current.classList.remove("focused"); current = null; },
        move: move,
        enter: enter,
        set: setFocus,
        current: function () { return current; },
        /* focus first matching element (or first focusable) */
        focusFirst: function (sel) {
            var scope = container || document.getElementById("app");
            var elm = sel ? scope.querySelector(sel) : scope.querySelector(".focusable");
            if (elm) setFocus(elm);
            return elm;
        },
        ensureVisible: ensureVisible
    };
})();
