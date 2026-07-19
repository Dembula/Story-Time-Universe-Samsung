/* Splash — branded entrance while we resolve the session. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var el = STU.dom.el;
    STU.screens = STU.screens || {};

    STU.screens.splash = {
        render: function (ctx) {
            var node = el("div", { class: "splash" }, [
                el("img", { class: "brand-logo", src: "img/logo.png", alt: "Story Time" }),
                el("div", { class: "wordmark", text: "Universe" }),
                el("div", { class: "tagline", text: "Home of Independent Creators" }),
                el("div", { class: "bar" }, [el("i")])
            ]);
            return {
                node: node,
                onKey: function () {},
                destroy: function () {}
            };
        }
    };
})();
