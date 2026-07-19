/* My List — the viewer watchlist as a poster grid. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var el = STU.dom.el, C = STU.components;
    STU.screens = STU.screens || {};

    STU.screens.mylist = {
        render: function (ctx) {
            var node = el("div");
            var nav = C.sideNav("mylist", function (id) { if (id !== "mylist") ctx.replace(id); });
            node.appendChild(nav.node);

            var page = el("div", { class: "page" });
            var head = el("div", { style: "position:absolute;top:0;left:var(--nav-w);right:0;padding:56px 96px 6px;z-index:2;", html: "<div style='font-size:52px;font-weight:800;'>My List</div>" });
            page.appendChild(head);
            var grid = el("div", { class: "grid", style: "position:absolute;top:150px;left:0;right:0;bottom:0;" });
            page.appendChild(grid);
            node.appendChild(page);

            grid.appendChild(el("div", { class: "center-fill" }, [el("div", { class: "spinner" })]));

            function load() {
                STU.API.fetchWatchlist().then(function (items) {
                    STU.dom.clear(grid);
                    if (!items.length) {
                        grid.appendChild(el("div", { class: "empty", style: "position:static;margin:120px auto;" }, [
                            el("div", { class: "big", html: "&#9733;" }),
                            el("div", { class: "t", text: "Your list is empty" }),
                            el("div", { class: "s", text: "Add titles with the + button on any detail page." })
                        ]));
                        return;
                    }
                    items.forEach(function (it) {
                        grid.appendChild(C.posterCard(it, { onSelect: function (x) { ctx.navigate("detail", { id: x.id, seed: x }); } }));
                    });
                    setTimeout(function () { STU.focus.focusFirst(".card"); }, 60);
                }).catch(function (err) {
                    STU.dom.clear(grid);
                    grid.appendChild(el("div", { class: "empty", style: "position:static;margin:120px auto;" }, [
                        el("div", { class: "t", text: "Could not load My List" }),
                        el("div", { class: "s", text: (err && err.message) || "" })
                    ]));
                });
            }

            function onKey(name) {
                if (name === "Back" || name === "Exit") { ctx.replace("home"); return; }
                if (name === "Up" || name === "Down" || name === "Left" || name === "Right") STU.focus.move(name);
                else if (name === "Enter") STU.focus.enter();
            }

            load();
            return { node: node, onKey: onKey, initialFocus: function () {}, destroy: function () {} };
        }
    };
})();
