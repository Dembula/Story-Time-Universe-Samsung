/* Tiny DOM + formatting helpers used across screens. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});

    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                if (k === "class") node.className = attrs[k];
                else if (k === "text") node.textContent = attrs[k];
                else if (k === "html") node.innerHTML = attrs[k];
                else if (k === "style") node.setAttribute("style", attrs[k]);
                else if (k.indexOf("data-") === 0) node.setAttribute(k, attrs[k]);
                else if (k === "bg") node.style.backgroundImage = "url('" + attrs[k] + "')";
                else node[k] = attrs[k];
            });
        }
        if (children != null) {
            (Array.isArray(children) ? children : [children]).forEach(function (c) {
                if (c == null) return;
                node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
            });
        }
        return node;
    }

    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

    var toastTimer = null;
    function toast(message, isError) {
        var t = document.getElementById("toast");
        t.textContent = message;
        t.className = "toast show" + (isError ? " error" : "");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.className = "toast hidden"; }, 4200);
    }

    function fmtTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) seconds = 0;
        var total = Math.round(seconds);
        var h = Math.floor(total / 3600);
        var m = Math.floor((total % 3600) / 60);
        var s = total % 60;
        function pad(n) { return (n < 10 ? "0" : "") + n; }
        if (h > 0) return h + ":" + pad(m) + ":" + pad(s);
        return m + ":" + pad(s);
    }

    function runtimeLabel(mins) {
        if (!mins || mins <= 0) return null;
        var h = Math.floor(mins / 60), m = mins % 60;
        return h > 0 ? (h + "h " + m + "m") : (m + " min");
    }

    function typeLabel(type) {
        if (!type) return "";
        return String(type).replace(/_/g, " ").replace(/\w\S*/g, function (w) {
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        });
    }

    function initials(name) {
        if (!name) return "?";
        var parts = String(name).trim().split(/\s+/).slice(0, 2);
        var chars = parts.map(function (p) { return p.charAt(0); }).join("");
        return (chars || name.charAt(0)).toUpperCase();
    }

    var PROFILE_COLORS = [
        "#3372f2", "#f2bf26", "#40b38c", "#e64d59", "#a666e6", "#f28c33"
    ];
    function colorFor(id) {
        var h = 0, s = String(id || "x");
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
        return PROFILE_COLORS[h % PROFILE_COLORS.length];
    }

    STU.dom = { el: el, esc: esc, clear: clear, toast: toast, fmtTime: fmtTime,
        runtimeLabel: runtimeLabel, typeLabel: typeLabel, initials: initials, colorFor: colorFor };
})();
