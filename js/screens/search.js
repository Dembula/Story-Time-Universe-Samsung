/* Search — on-screen keyboard (focus-engine keys) + live results grid. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var el = STU.dom.el, C = STU.components;
    STU.screens = STU.screens || {};

    var ROWS = ["ABCDEFG".split(""), "HIJKLMN".split(""), "OPQRSTU".split(""), "VWXYZ".split(""), "1234567890".split("")];

    STU.screens.search = {
        render: function (ctx) {
            var query = "", debounce = null;

            var node = el("div");
            var nav = C.sideNav("search", function (id) { if (id !== "search") ctx.replace(id); });
            node.appendChild(nav.node);

            var page = el("div", { class: "page" });
            var wrap = el("div", { style: "position:absolute;top:0;right:0;bottom:0;left:var(--nav-w);display:flex;" });

            // Left: keyboard column
            var kbCol = el("div", { style: "width:560px;padding:60px 40px 0 20px;" });
            var qbox = el("div", { class: "field", style: "margin-bottom:26px;height:80px;" }, [
                el("span", { class: "ico", html: "&#128269;" }),
                (function () { qEl = el("span", { class: "val placeholder", text: "Search titles, genres\u2026" }); return qEl; })()
            ]);
            var qEl;
            kbCol.appendChild(qbox);

            ROWS.forEach(function (row) {
                var r = el("div", { style: "display:flex;gap:12px;margin-bottom:12px;" });
                row.forEach(function (ch) {
                    var k = el("div", { class: "key focusable", tabindex: "-1", text: ch });
                    k.__onEnter = function () { type(ch.toLowerCase()); };
                    r.appendChild(k);
                });
                kbCol.appendChild(r);
            });
            var ctrlRow = el("div", { style: "display:flex;gap:12px;margin-top:8px;" });
            var spaceK = el("div", { class: "key wide focusable", tabindex: "-1", text: "Space" });
            spaceK.__onEnter = function () { type(" "); };
            var delK = el("div", { class: "key focusable", tabindex: "-1", html: "&#9003; Del" });
            delK.__onEnter = function () { query = query.slice(0, -1); renderQ(); run(); };
            var clrK = el("div", { class: "key focusable", tabindex: "-1", text: "Clear" });
            clrK.__onEnter = function () { query = ""; renderQ(); results.length = 0; renderResults([]); };
            ctrlRow.appendChild(spaceK); ctrlRow.appendChild(delK); ctrlRow.appendChild(clrK);
            kbCol.appendChild(ctrlRow);
            wrap.appendChild(kbCol);

            // Right: results grid
            var resCol = el("div", { style: "flex:1;position:relative;" });
            var grid = el("div", { class: "grid", style: "position:absolute;inset:0;overflow:hidden;" });
            resCol.appendChild(grid);
            wrap.appendChild(resCol);

            page.appendChild(wrap);
            node.appendChild(page);

            var results = [];

            function renderQ() {
                if (!query) { qEl.className = "val placeholder"; qEl.textContent = "Search titles, genres\u2026"; }
                else { qEl.className = "val"; qEl.textContent = query; }
            }
            function type(ch) { query += ch; renderQ(); run(); }

            function run() {
                if (debounce) clearTimeout(debounce);
                debounce = setTimeout(function () {
                    var q = query.trim();
                    if (q.length < 2) { renderResults([]); return; }
                    STU.API.search(q).then(function (list) {
                        results = list || [];
                        renderResults(results);
                    });
                }, 320);
            }

            function renderResults(list) {
                STU.dom.clear(grid);
                if (!list.length) {
                    grid.appendChild(el("div", { class: "empty", style: "position:static;margin-top:120px" }, [
                        el("div", { class: "big", html: "&#128269;" }),
                        el("div", { class: "t", text: query.trim().length < 2 ? "Search Story Time" : "No results" }),
                        el("div", { class: "s", text: query.trim().length < 2 ? "Type at least 2 characters." : "Try another title or genre." })
                    ]));
                    return;
                }
                list.forEach(function (item) {
                    grid.appendChild(C.posterCard(item, { onSelect: function (it) { ctx.navigate("detail", { id: it.id, seed: it }); } }));
                });
            }

            function onKey(name) {
                if (name === "Back" || name === "Exit") { ctx.replace("home"); return; }
                if (name === "Up" || name === "Down" || name === "Left" || name === "Right") STU.focus.move(name);
                else if (name === "Enter") STU.focus.enter();
            }

            renderQ(); renderResults([]);

            return {
                node: node,
                onKey: onKey,
                initialFocus: function () { STU.focus.focusFirst(".key"); },
                destroy: function () { if (debounce) clearTimeout(debounce); }
            };
        }
    };
})();
