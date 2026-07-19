/* Home — hero carousel + Continue Watching, Trending and per-type rows.
 * Mirrors the production browse landing. Uses the spatial focus engine. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var el = STU.dom.el, C = STU.components;
    STU.screens = STU.screens || {};

    function buildNav(ctx, activeId) {
        var nav = C.sideNav(activeId, function (id) {
            if (id === activeId) return;
            ctx.replace(id);
        });
        return nav;
    }

    STU.screens.home = {
        render: function (ctx) {
            var node = el("div", { class: "home-screen" });
            var nav = buildNav(ctx, "home");
            node.appendChild(nav.node);

            var page = el("div", { class: "page" });
            var scroll = el("div", { class: "rows-scroll" });
            var track = el("div", { class: "rows-track" });
            scroll.appendChild(track);
            page.appendChild(scroll);
            node.appendChild(page);

            var loading = el("div", { class: "center-fill" }, [el("div", { class: "spinner" })]);
            track.appendChild(loading);

            var heroCtl = null;

            function openDetail(item) { ctx.navigate("detail", { id: item.id, seed: item }); }
            function play(item) {
                STU.player.open({ contentId: item.id, title: item.title, onClose: function () {} });
            }

            function build(data) {
                STU.dom.clear(track);

                if (data.featured.length) {
                    heroCtl = C.hero(data.featured, { onPlay: play, onOpen: openDetail });
                    track.appendChild(heroCtl.node);
                }

                if (data.continueWatching.length) {
                    track.appendChild(C.row("Continue Watching", data.continueWatching, {
                        card: C.wideCard, chevron: true,
                        onSelect: function (it) { play(it); }
                    }));
                }
                if (data.trending.length) {
                    track.appendChild(C.row("Trending Now", data.trending, { ranked: true, onSelect: openDetail }));
                }
                data.rows.forEach(function (r) {
                    if (r.items.length) track.appendChild(C.row(r.title, r.items, { onSelect: openDetail }));
                });

                if (!data.featured.length && !data.trending.length && !data.rows.some(function (r) { return r.items.length; })) {
                    track.appendChild(emptyState("Nothing to watch yet", "New titles appear here as creators publish."));
                }

                setTimeout(function () {
                    if (heroCtl) STU.focus.set(heroCtl.play);
                    else STU.focus.focusFirst(".card");
                }, 60);
            }

            function emptyState(t, s) {
                return el("div", { class: "empty" }, [
                    el("div", { class: "big", html: "&#127909;" }),
                    el("div", { class: "t", text: t }),
                    el("div", { class: "s", text: s })
                ]);
            }

            function load() {
                var featured = STU.API.fetchContent({ featured: true, limit: 8 }).catch(function () { return []; });
                var trending = STU.API.fetchContent({ limit: 24 }).catch(function () { return []; });
                var cw = STU.API.fetchContinueWatching();
                var rowDefs = STU.catalogue.homeRows;
                var rowPromises = rowDefs.map(function (def) {
                    return STU.API.fetchRow(def, 16).then(function (items) { return { title: def.title, items: items || [] }; });
                });

                Promise.all([featured, trending, cw, Promise.all(rowPromises)]).then(function (res) {
                    var f = res[0], t = res[1], c = res[2], rows = res[3];
                    build({
                        featured: f.length ? f : t.slice(0, 5),
                        trending: t,
                        continueWatching: c,
                        rows: rows
                    });
                }).catch(function (err) {
                    STU.dom.clear(track);
                    track.appendChild(emptyState("Could not load the catalogue", (err && err.message) || "Try again."));
                });
            }

            function onKey(name) {
                if (name === "Back" || name === "Exit") { ctx.replace("profiles"); return; }
                if (name === "Up" || name === "Down" || name === "Left" || name === "Right") STU.focus.move(name);
                else if (name === "Enter") STU.focus.enter();
            }

            load();

            return {
                node: node,
                onKey: onKey,
                initialFocus: function () {},
                destroy: function () { if (heroCtl) heroCtl.stop(); }
            };
        }
    };
})();
