/* Content detail — play/trailer, synopsis, episodes, cast & crew, related. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var el = STU.dom.el, C = STU.components, D = STU.dom;
    STU.screens = STU.screens || {};

    STU.screens.detail = {
        render: function (ctx, params) {
            var id = params.id, seed = params.seed || {};
            var detail = null, crew = [], related = [], inWatchlist = false, wlBusy = false;

            var node = el("div", { class: "detail" });
            var scroll = el("div", { class: "detail-scroll" });
            var trackEl = el("div", { class: "detail-track" });
            scroll.appendChild(trackEl);
            node.appendChild(scroll);

            trackEl.appendChild(el("div", { class: "center-fill" }, [el("div", { class: "spinner" })]));

            function heroUrls(d) {
                var s = d || seed;
                var back = STU.mediaUrl.candidates({ posterUrl: s.posterUrl, backdropUrl: s.backdropUrl, videoUrl: s.videoUrl, preferBackdrop: true });
                return back.length ? back : STU.mediaUrl.candidates({ posterUrl: s.posterUrl, backdropUrl: s.backdropUrl, videoUrl: s.videoUrl });
            }

            function episodeInfos() {
                if (!detail || !detail.seasons) return [];
                var out = [];
                detail.seasons.forEach(function (season) {
                    var sn = season.seasonNumber || 1;
                    (season.episodes || []).forEach(function (ep) {
                        var en = ep.episodeNumber || (out.length + 1);
                        out.push({ episodeId: ep.id, title: ep.title || ("Episode " + en),
                            episodeLabel: "S" + sn + " E" + en, thumbnailUrl: ep.thumbnailUrl, durationSeconds: ep.duration });
                    });
                });
                return out;
            }

            function playFilm() {
                var eps = episodeInfos();
                var firstEp = detail && detail.seasons && detail.seasons[0] && detail.seasons[0].episodes && detail.seasons[0].episodes[0];
                STU.player.open({
                    contentId: id, title: (detail && detail.title) || seed.title,
                    episodeId: firstEp ? firstEp.id : null, episodes: eps, onClose: function () {}
                });
            }
            function playEpisode(episodeId) {
                STU.player.open({
                    contentId: id, title: (detail && detail.title) || seed.title,
                    episodeId: episodeId, episodes: episodeInfos(), onClose: function () {}
                });
            }
            function playTrailer() {
                STU.player.open({ contentId: id, title: (detail && detail.title) || seed.title, isTrailer: true, onClose: function () {} });
            }

            function toggleWatchlist(btn) {
                if (wlBusy) return; wlBusy = true;
                STU.API.updateWatchlist(id, !inWatchlist).then(function () {
                    inWatchlist = !inWatchlist; wlBusy = false;
                    btn.innerHTML = "<span class='ico'>" + (inWatchlist ? "&#10003;" : "+") + "</span>";
                    D.toast(inWatchlist ? "Added to My List" : "Removed from My List");
                }).catch(function (err) { wlBusy = false; D.toast((err && err.message) || "Could not update My List", true); });
            }

            function metaLine(d) {
                var parts = [];
                var t = (d && d.type) || seed.type; if (t) parts.push(D.typeLabel(t));
                var cat = (d && d.category) || seed.category; if (cat) parts.push(cat);
                var yr = (d && d.year) || seed.year; if (yr) parts.push(String(yr));
                var rt = d && D.runtimeLabel(d.duration); if (rt) parts.push(rt);
                if (d && d.ageRating) parts.push(d.ageRating);
                if (d && d.creator && d.creator.name) parts.push("By " + d.creator.name);
                return parts.join("  \u00b7  ");
            }

            function build() {
                D.clear(trackEl);
                var d = detail || seed;

                // Hero
                var hero = el("div", { class: "detail-hero" });
                var bg = el("div", { class: "bg" });
                hero.appendChild(bg);
                C.backdropInto(bg, heroUrls(detail), d.title);
                hero.appendChild(el("div", { class: "scrim" }));
                var info = el("div", { class: "info" });
                info.appendChild(el("div", { class: "title", text: d.title }));
                var ml = metaLine(detail);
                if (ml) info.appendChild(el("div", { class: "meta", text: ml }));
                if (detail && detail.ratingStats && (detail.ratingStats.count || 0) > 0) {
                    info.appendChild(el("div", { class: "rating" }, [
                        el("span", { class: "star", html: "&#9733;" }),
                        el("span", { text: (detail.ratingStats.average || 0).toFixed(1) }),
                        el("span", { class: "muted", text: " (" + detail.ratingStats.count + ")" })
                    ]));
                }
                var actions = el("div", { class: "actions" });
                var playBtn = el("div", { class: "btn primary focusable", tabindex: "-1", html: "<span class='ico'>&#9654;</span> Play" });
                playBtn.__onEnter = playFilm;
                actions.appendChild(playBtn);

                var hasTrailer = detail && detail.trailerUrl && String(detail.trailerUrl).trim();
                if (hasTrailer) {
                    var tb = el("div", { class: "btn focusable", tabindex: "-1", html: "<span class='ico'>&#127916;</span> Trailer" });
                    tb.__onEnter = playTrailer;
                    actions.appendChild(tb);
                }
                var wl = el("div", { class: "btn round focusable", tabindex: "-1", html: "<span class='ico'>" + (inWatchlist ? "&#10003;" : "+") + "</span>" });
                wl.__onEnter = function () { toggleWatchlist(wl); };
                actions.appendChild(wl);
                info.appendChild(actions);
                hero.appendChild(info);
                trackEl.appendChild(hero);

                // Body
                var body = el("div", { class: "detail-body" });

                var synopsis = (detail && detail.description) || seed.description;
                if (synopsis && synopsis.trim()) {
                    body.appendChild(section("", el("div", { class: "synopsis", text: synopsis.trim() })));
                }

                // Trailer card
                if (hasTrailer) {
                    var trWrap = el("div", { class: "trailer-rail" });
                    var trCard = el("div", { class: "trailer-card focusable", tabindex: "-1" });
                    C.backdropInto(trCard, heroUrls(detail), d.title);
                    trCard.appendChild(el("div", { class: "scrim" }));
                    trCard.appendChild(el("div", { class: "pi", html: "&#9654;" }));
                    trCard.appendChild(el("div", { class: "lbl", text: "Official Trailer" }));
                    trCard.__onEnter = playTrailer;
                    trWrap.appendChild(trCard);
                    body.appendChild(section("Trailers", trWrap));
                }

                // Episodes
                if (detail && detail.seasons && detail.seasons.length) {
                    var epWrap = el("div");
                    detail.seasons.forEach(function (season) {
                        epWrap.appendChild(el("div", { class: "season-label", text: "Season " + (season.seasonNumber || 1) }));
                        (season.episodes || []).forEach(function (ep) {
                            var row = el("div", { class: "ep-row focusable", tabindex: "-1" });
                            var thumb = el("div", { class: "thumb" });
                            C.backdropInto(thumb, STU.mediaUrl.candidates({ posterUrl: ep.thumbnailUrl, videoUrl: ep.videoUrl, preferBackdrop: true }), ep.title || "Episode");
                            thumb.appendChild(el("div", { class: "pi", html: "&#9654;" }));
                            row.appendChild(thumb);
                            var b = el("div", { class: "body" });
                            b.appendChild(el("div", { class: "et", text: (ep.episodeNumber || "") + ". " + (ep.title || "Episode") }));
                            if (ep.description) b.appendChild(el("div", { class: "ed", text: ep.description }));
                            if (ep.duration) b.appendChild(el("div", { class: "edur", text: ep.duration + " min" }));
                            row.appendChild(b);
                            (function (eid) { row.__onEnter = function () { playEpisode(eid); }; })(ep.id);
                            epWrap.appendChild(row);
                        });
                    });
                    body.appendChild(section("Episodes", epWrap));
                }

                // Cast & crew
                if (crew.length) {
                    var castRail = el("div", { class: "cast-rail" });
                    crew.forEach(function (m) {
                        var c = el("div", { class: "cast focusable", tabindex: "-1" });
                        var ph = el("div", { class: "ph", style: "background:linear-gradient(135deg," + D.colorFor(m.id) + ",rgba(255,147,31,0.7))" });
                        ph.textContent = D.initials(m.name);
                        c.appendChild(ph);
                        c.appendChild(el("div", { class: "cn", text: m.name }));
                        c.appendChild(el("div", { class: "cr", text: m.role || "Crew" }));
                        c.__onEnter = function () { D.toast(m.name + (m.role ? " \u2014 " + m.role : "")); };
                        castRail.appendChild(c);
                    });
                    body.appendChild(section("Cast & Crew", castRail));
                }

                // Related
                if (related.length) {
                    var relRail = el("div", { class: "row-rail-clip", style: "padding-left:0" });
                    var rail = el("div", { class: "row-rail", style: "padding-left:0" });
                    related.forEach(function (it) {
                        rail.appendChild(C.posterCard(it, { onSelect: function (x) { ctx.navigate("detail", { id: x.id, seed: x }); } }));
                    });
                    relRail.appendChild(rail);
                    body.appendChild(section("More Like This", relRail));
                }

                trackEl.appendChild(body);
                setTimeout(function () { STU.focus.set(playBtn); }, 60);
            }

            function section(title, content) {
                var s = el("div", { class: "detail-section" });
                if (title) s.appendChild(el("div", { class: "h", text: title }));
                s.appendChild(content);
                return s;
            }

            function load() {
                STU.API.fetchContentDetail(id).then(function (d) {
                    detail = d;
                    build();
                    STU.API.fetchCrew(id).then(function (c) { crew = c || []; build(); });
                    STU.API.fetchRelated(id, d.category, d.type, 12).then(function (r) { related = r || []; build(); });
                    STU.API.fetchWatchlist().then(function (list) {
                        inWatchlist = (list || []).some(function (x) { return x.id === id; });
                        build();
                    }).catch(function () {});
                }).catch(function (err) {
                    D.clear(trackEl);
                    trackEl.appendChild(el("div", { class: "empty" }, [
                        el("div", { class: "t", text: "Could not load this title" }),
                        el("div", { class: "s", text: (err && err.message) || "" })
                    ]));
                });
            }

            function onKey(name) {
                if (name === "Back" || name === "Exit") { if (!ctx.back()) ctx.replace("home"); return; }
                if (name === "Up" || name === "Down" || name === "Left" || name === "Right") STU.focus.move(name);
                else if (name === "Enter") STU.focus.enter();
            }

            load();
            return { node: node, onKey: onKey, initialFocus: function () {}, destroy: function () {} };
        }
    };
})();
