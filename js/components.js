/* Reusable renderers: fallback images, poster cards, content rows, hero, side nav. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var el = STU.dom.el, esc = STU.dom.esc, typeLabel = STU.dom.typeLabel;

    /* Set a background image that tries each candidate URL until one loads.
       On total failure, shows a titled fallback panel. */
    function backdropInto(node, urls, title) {
        urls = (urls || []).slice();
        function tryNext() {
            if (!urls.length) {
                node.classList.add("has-fallback");
                var fb = el("div", { class: "fallback", text: title || "Story Time" });
                node.appendChild(fb);
                return;
            }
            var url = urls.shift();
            var img = new Image();
            img.onload = function () { node.style.backgroundImage = "url('" + url + "')"; };
            img.onerror = tryNext;
            img.src = url;
        }
        tryNext();
    }

    function posterUrls(item, wide) {
        return STU.mediaUrl.candidates({
            posterUrl: item.posterUrl, backdropUrl: item.backdropUrl,
            videoUrl: item.videoUrl, preferBackdrop: !!wide
        });
    }

    /* Standard portrait poster card. */
    function posterCard(item, opts) {
        opts = opts || {};
        var card = el("div", { class: "card focusable", tabindex: "-1" });
        var art = el("div", { class: "art" });
        card.appendChild(art);
        backdropInto(art, posterUrls(item, false), item.title);
        card.appendChild(el("div", { class: "grad" }));
        if (opts.rank) card.appendChild(el("div", { class: "rank", text: String(opts.rank) }));
        var cap = el("div", { class: "cap" });
        cap.appendChild(el("div", { class: "t", text: item.title }));
        if (item.category) cap.appendChild(el("div", { class: "s", text: item.category }));
        card.appendChild(cap);
        card.__onEnter = function () { if (opts.onSelect) opts.onSelect(item); };
        return card;
    }

    /* Landscape continue-watching card with progress bar. */
    function wideCard(item, opts) {
        opts = opts || {};
        var card = el("div", { class: "card wide focusable", tabindex: "-1" });
        var art = el("div", { class: "art" });
        card.appendChild(art);
        backdropInto(art, posterUrls(item, true), item.title);
        card.appendChild(el("div", { class: "grad" }));
        card.appendChild(el("div", { class: "play-badge", html: "&#9654;" }));
        var pct = item.progressPercent != null ? item.progressPercent :
            (item.durationSeconds ? Math.round((item.positionSeconds || 0) / item.durationSeconds * 100) : 0);
        pct = Math.max(0, Math.min(100, pct));
        var prog = el("div", { class: "progress" });
        prog.appendChild(el("i", { style: "width:" + pct + "%" }));
        card.appendChild(prog);
        var cap = el("div", { class: "cap" });
        cap.appendChild(el("div", { class: "t", text: item.title }));
        card.appendChild(cap);
        card.__onEnter = function () { if (opts.onSelect) opts.onSelect(item); };
        return card;
    }

    /* A horizontal content row. cardFn(item) -> element. */
    function row(title, items, opts) {
        opts = opts || {};
        var wrap = el("div", { class: "row" });
        var titleEl = el("div", { class: "row-title" }, [document.createTextNode(title)]);
        if (opts.chevron) titleEl.appendChild(el("span", { class: "chev", html: "&#8250;" }));
        wrap.appendChild(titleEl);
        var clip = el("div", { class: "row-rail-clip" });
        var rail = el("div", { class: "row-rail" });
        items.forEach(function (item, i) {
            var mk = opts.card || posterCard;
            var card = mk(item, {
                onSelect: opts.onSelect,
                rank: opts.ranked ? i + 1 : null
            });
            rail.appendChild(card);
        });
        clip.appendChild(rail);
        wrap.appendChild(clip);
        return wrap;
    }

    /* Hero carousel. Returns { node, focusEls } where focusEls are the play/info buttons. */
    function hero(items, opts) {
        opts = opts || {};
        var node = el("div", { class: "hero" });
        var slides = [];
        items.forEach(function (item, i) {
            var slide = el("div", { class: "hero-slide" + (i === 0 ? " on" : "") });
            var bg = el("div", { class: "bg" });
            slide.appendChild(bg);
            backdropInto(bg, STU.mediaUrl.candidates({
                posterUrl: item.posterUrl, backdropUrl: item.backdropUrl,
                videoUrl: item.videoUrl, preferBackdrop: true
            }), item.title);
            slide.appendChild(el("div", { class: "scrim" }));
            slides.push(slide);
            node.appendChild(slide);
        });

        var content = el("div", { class: "hero-content" });
        var badge = el("div", { class: "hero-badge", text: "Featured" });
        var titleEl = el("div", { class: "hero-title" });
        var metaEl = el("div", { class: "hero-meta" });
        var descEl = el("div", { class: "hero-desc" });
        content.appendChild(badge);
        content.appendChild(titleEl);
        content.appendChild(metaEl);
        content.appendChild(descEl);

        var playBtn = el("div", { class: "btn primary focusable", tabindex: "-1",
            html: "<span class='ico'>&#9654;</span> Play" });
        var infoBtn = el("div", { class: "btn focusable", tabindex: "-1",
            html: "<span class='ico'>&#8505;</span> More Info" });
        var actions = el("div", { class: "hero-actions" }, [playBtn, infoBtn]);
        content.appendChild(actions);
        node.appendChild(content);

        var dots = el("div", { class: "hero-dots" });
        items.forEach(function (_, i) { dots.appendChild(el("i", { class: i === 0 ? "on" : "" })); });
        node.appendChild(dots);

        var idx = 0;
        function render() {
            var item = items[idx];
            titleEl.textContent = item.title;
            var parts = [typeLabel(item.type), item.category, item.year].filter(Boolean);
            metaEl.textContent = parts.join("  •  ");
            descEl.textContent = item.description || "";
            slides.forEach(function (s, i) { s.className = "hero-slide" + (i === idx ? " on" : ""); });
            var ds = dots.children;
            for (var i = 0; i < ds.length; i++) ds[i].className = (i === idx ? "on" : "");
        }
        function go(n) { idx = (n + items.length) % items.length; render(); }
        render();

        playBtn.__onEnter = function () { if (opts.onPlay) opts.onPlay(items[idx]); };
        infoBtn.__onEnter = function () { if (opts.onOpen) opts.onOpen(items[idx]); };

        // Left/Right on the hero buttons also rotates when at the edge handled by row nav;
        // provide an explicit rotate via override on playBtn edges is complex — use a timer.
        var timer = null;
        function start() { stop(); if (items.length > 1) timer = setInterval(function () { go(idx + 1); }, STU.config.heroRotateMs); }
        function stop() { if (timer) { clearInterval(timer); timer = null; } }
        start();

        return { node: node, play: playBtn, info: infoBtn, next: function () { go(idx + 1); }, prev: function () { go(idx - 1); }, stop: stop, start: start };
    }

    /* Persistent left side navigation. */
    var NAV_ITEMS = [
        { id: "home", label: "Home", ico: "&#9750;" },
        { id: "search", label: "Search", ico: "&#128269;" },
        { id: "mylist", label: "My List", ico: "&#9733;" },
        { id: "account", label: "Account", ico: "&#128100;" }
    ];

    function sideNav(activeId, onSelect) {
        var nav = el("nav", { class: "sidenav" });
        var logo = el("div", { class: "nav-logo" }, [
            el("img", { class: "mark-img", src: "img/mark.png", alt: "ST" }),
            el("img", { class: "word-img", src: "img/logo.png", alt: "Story Time" })
        ]);
        nav.appendChild(logo);
        var els = {};
        NAV_ITEMS.forEach(function (it) {
            var item = el("div", {
                class: "nav-item focusable" + (it.id === activeId ? " active" : ""),
                tabindex: "-1"
            }, [
                el("span", { class: "ico", html: it.ico }),
                el("span", { class: "label", text: it.label })
            ]);
            item.__onEnter = function () { if (onSelect) onSelect(it.id); };
            item.__onFocus = function () { nav.classList.add("open"); };
            item.__onBlurNav = function () { nav.classList.remove("open"); };
            els[it.id] = item;
            nav.appendChild(item);
        });
        // collapse when focus leaves nav
        nav.__collapse = function () { nav.classList.remove("open"); };
        nav.__expand = function () { nav.classList.add("open"); };
        return { node: nav, items: els };
    }

    STU.components = {
        backdropInto: backdropInto, posterCard: posterCard, wideCard: wideCard,
        row: row, hero: hero, sideNav: sideNav, posterUrls: posterUrls
    };
})();
