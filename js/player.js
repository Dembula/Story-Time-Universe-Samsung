/* Story Time Universe media player.
 * HTML5 HLS video (carries the webview session cookies to story-time.online),
 * with a custom control skin (D-pad or pointer): back + title that fade out, a
 * gradient timeline (no default white bar), resume/save progress, subtitles,
 * and episode "Up Next". AVPlay is used automatically when available and the
 * source is not cookie-gated. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var el = STU.dom.el, fmtTime = STU.dom.fmtTime, cfg = STU.config, API = STU.API;

    var root = null, video = null, controls = null;
    var state = null;

    function open(req) {
        root = document.getElementById("player-root");
        STU.dom.clear(root);
        root.classList.remove("hidden");

        state = {
            req: req,
            contentId: req.contentId,
            title: req.title || "",
            episodeId: req.episodeId || null,
            isTrailer: !!req.isTrailer,
            episodes: req.episodes || [],
            onClose: req.onClose,
            focusIndex: 2,          // default = play button
            controlsVisible: true,
            hideTimer: null,
            saveTimer: null,
            lastSaved: 0,
            watched: 0,
            duration: 0,
            ended: false,
            nextUpTimer: null,
            resumeAt: 0,
            seekFeedbackTimer: null
        };

        buildDom();
        STU.keys.push(onKey);
        loadAndPlay();
    }

    function buildDom() {
        video = el("video", { class: "av", playsinline: true, autoplay: false });
        video.setAttribute("webkit-playsinline", "true");
        // Cookie sessions need credentialed media; Bearer/JWT playback is header-based
        // and `crossorigin=use-credentials` breaks HLS on Tizen (no CORS cookies).
        if (!(STU.API && STU.API.getAccessToken && STU.API.getAccessToken())) {
            video.setAttribute("crossorigin", "use-credentials");
        }
        root.appendChild(video);

        // Status (loading / error)
        state.status = el("div", { class: "player-status" });
        state.status.appendChild(el("div", { class: "spinner" }));
        state.statusMsg = el("div", { class: "msg", text: state.isTrailer ? "Loading trailer\u2026" : "Loading\u2026" });
        state.status.appendChild(state.statusMsg);
        root.appendChild(state.status);

        // Subtitles line
        state.subs = el("div", { class: "pl-subs" });
        root.appendChild(state.subs);

        // Controls group (fades)
        controls = el("div", { class: "controls" });
        controls.appendChild(el("div", { class: "top-scrim" }));
        controls.appendChild(el("div", { class: "bottom-scrim" }));

        // Top: back + title
        var top = el("div", { class: "pl-top" });
        state.back = el("div", { class: "pl-back", html: "&#8592;" });
        top.appendChild(state.back);
        var titleWrap = el("div", { class: "pl-title" });
        if (state.isTrailer) titleWrap.appendChild(el("span", { class: "kicker", text: "Trailer" }));
        titleWrap.appendChild(document.createTextNode(state.title));
        top.appendChild(titleWrap);
        controls.appendChild(top);

        // Center transport
        var center = el("div", { class: "pl-center" });
        state.skipBack = el("div", { class: "pl-skip", html: "&#8630;<span class='n'>10</span>" });
        state.play = el("div", { class: "pl-play", html: "&#9654;" });
        state.skipFwd = el("div", { class: "pl-skip", html: "&#8631;<span class='n'>10</span>" });
        center.appendChild(state.skipBack);
        center.appendChild(state.play);
        center.appendChild(state.skipFwd);
        controls.appendChild(center);

        // Seek feedback pills
        state.fbLeft = el("div", { class: "pl-seek-feedback left", html: "&#8630;<span class='lab'>-10s</span>" });
        state.fbRight = el("div", { class: "pl-seek-feedback right", html: "&#8631;<span class='lab'>+10s</span>" });
        root.appendChild(state.fbLeft);
        root.appendChild(state.fbRight);

        // Bottom timeline
        var bottom = el("div", { class: "pl-bottom" });
        state.timeline = el("div", { class: "pl-timeline" });
        state.buffered = el("div", { class: "buffered" });
        state.played = el("div", { class: "played" });
        state.knob = el("div", { class: "knob" });
        state.timeline.appendChild(state.buffered);
        state.timeline.appendChild(state.played);
        state.timeline.appendChild(state.knob);
        bottom.appendChild(state.timeline);
        var times = el("div", { class: "pl-times" });
        state.tCur = el("span", { text: "0:00" });
        state.tDur = el("span", { text: "0:00" });
        times.appendChild(state.tCur);
        times.appendChild(state.tDur);
        bottom.appendChild(times);
        controls.appendChild(bottom);

        root.appendChild(controls);

        // Next-up overlay (hidden until near end)
        state.nextUp = null;

        // The ordered focus targets.
        state.focusEls = [state.back, state.skipBack, state.play, state.skipFwd, state.timeline];
        applyFocus();
        setupPointer();

        // Video events
        video.addEventListener("timeupdate", onTimeUpdate);
        video.addEventListener("progress", onBuffer);
        video.addEventListener("loadedmetadata", onLoaded);
        video.addEventListener("playing", function () { updatePlayIcon(); });
        video.addEventListener("pause", function () { updatePlayIcon(); });
        video.addEventListener("ended", onEnded);
        video.addEventListener("error", function () { showError("This title could not be played."); });
        video.addEventListener("waiting", function () { /* buffering */ });
    }

    /* Pointer-remote support: the air-mouse reveals controls, hover focuses a
       button, click activates it, and clicking the timeline seeks to that point. */
    function setupPointer() {
        root.addEventListener("mousemove", function () { showControls(false); });

        var actions = [
            { el: state.back, i: 0, act: destroy },
            { el: state.skipBack, i: 1, act: function () { skip(-cfg.skipSeconds); } },
            { el: state.play, i: 2, act: togglePlay },
            { el: state.skipFwd, i: 3, act: function () { skip(cfg.skipSeconds); } }
        ];
        actions.forEach(function (a) {
            a.el.addEventListener("mouseenter", function () { showControls(true); focusAt(a.i); });
            a.el.addEventListener("click", function () { focusAt(a.i); a.act(); showControls(false); });
        });

        state.timeline.addEventListener("mouseenter", function () { showControls(true); focusAt(4); });
        state.timeline.addEventListener("click", function (e) {
            var r = state.timeline.getBoundingClientRect();
            var frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            var dur = (isFinite(video.duration) && video.duration > 0) ? video.duration : state.duration;
            if (dur > 0) { try { video.currentTime = frac * dur; } catch (err) {} }
            showControls(false);
        });
    }

    /* <video> cannot send Authorization headers. For same-origin API HLS proxies,
       attach the TV JWT (+ profile) as query params so middleware can authenticate. */
    function withTvAuth(url) {
        if (!url) return url;
        var token = API.getAccessToken && API.getAccessToken();
        if (!token) return url;
        var base = cfg.apiBase || "";
        if (url.indexOf(base) !== 0 && url.indexOf("/api/") !== 0) return url;
        var sep = url.indexOf("?") >= 0 ? "&" : "?";
        var out = url + sep + "tv_token=" + encodeURIComponent(token);
        var profileId = API.getViewerProfileId && API.getViewerProfileId();
        if (profileId) out += "&tv_profile=" + encodeURIComponent(profileId);
        return out;
    }

    function loadAndPlay() {
        API.fetchPlaybackBundle(state.contentId, state.episodeId, state.isTrailer).then(function (bundle) {
            var src = bundle && bundle.playback && bundle.playback.src;
            if (!src) throw new API.ApiError("No playable stream was returned for this title.", 0);
            if (src.indexOf("http") !== 0) src = cfg.apiBase + (src.charAt(0) === "/" ? "" : "/") + src;
            state.streamSrc = withTvAuth(src);
            state.streamType = (bundle.playback && bundle.playback.type) || "";
            state.duration = bundle.duration || 0;
            attachSubtitles(bundle.subtitles || []);

            if (state.isTrailer) return { position: 0 };
            return API.fetchWatchProgress(state.contentId);
        }).then(function (progress) {
            state.resumeAt = (progress && progress.position) || 0;
            startPlayback();
        }).catch(function (err) {
            showError((err && err.message) || "Playback failed.");
        });
    }

    function startPlayback() {
        video.src = state.streamSrc;
        video.load();
        var resume = state.resumeAt;
        var doResume = function () {
            if (!state.isTrailer && resume > 5) {
                try { video.currentTime = resume; } catch (e) {}
            }
            video.removeEventListener("loadedmetadata", doResume);
        };
        video.addEventListener("loadedmetadata", doResume);
        var playPromise = video.play();
        if (playPromise && playPromise.catch) playPromise.catch(function () {});
        hideStatus();
        scheduleHide();
        if (!state.isTrailer) startSaveTimer();
    }

    function attachSubtitles(list) {
        // Native tracks; the default one is shown. Kept simple and reliable on Tizen.
        list.forEach(function (s, i) {
            if (!s.vttUrl) return;
            var trackSrc = s.vttUrl.indexOf("http") === 0 ? s.vttUrl : (cfg.apiBase + s.vttUrl);
            var track = el("track", {
                kind: "subtitles",
                src: withTvAuth(trackSrc),
                srclang: s.language || ("s" + i),
                label: s.label || s.language || ("Subtitles " + (i + 1))
            });
            if (s.isDefault) track.setAttribute("default", "default");
            video.appendChild(track);
        });
    }

    /* ---------- Playback state / UI ---------- */

    function onLoaded() {
        var d = video.duration;
        if (isFinite(d) && d > 0) { state.duration = d; state.tDur.textContent = fmtTime(d); }
    }

    function onTimeUpdate() {
        var cur = video.currentTime || 0;
        var dur = (isFinite(video.duration) && video.duration > 0) ? video.duration : state.duration;
        state.watched = Math.max(state.watched, cur);
        var pct = dur > 0 ? (cur / dur) * 100 : 0;
        state.played.style.width = pct + "%";
        state.knob.style.left = pct + "%";
        state.tCur.textContent = fmtTime(cur);
        if (dur > 0) state.tDur.textContent = fmtTime(dur);
        renderCue(cur);
        maybeNextUp(cur, dur);
    }

    function onBuffer() {
        try {
            if (video.buffered.length) {
                var end = video.buffered.end(video.buffered.length - 1);
                var dur = video.duration || state.duration;
                if (dur > 0) state.buffered.style.width = Math.min(100, (end / dur) * 100) + "%";
            }
        } catch (e) {}
    }

    function renderCue(cur) {
        // Native track cues -> mirror into our styled line.
        try {
            var tracks = video.textTracks;
            var text = "";
            for (var i = 0; i < tracks.length; i++) {
                if (tracks[i].mode === "showing" && tracks[i].activeCues) {
                    for (var j = 0; j < tracks[i].activeCues.length; j++) {
                        text += (text ? "\n" : "") + tracks[i].activeCues[j].text;
                    }
                }
            }
            // Hide native rendering, use ours
            for (var k = 0; k < tracks.length; k++) if (tracks[k].mode === "showing") tracks[k].mode = "hidden";
            state.subs.textContent = text.replace(/<[^>]+>/g, "");
        } catch (e) {}
    }

    function updatePlayIcon() {
        var playing = !video.paused && !video.ended;
        state.play.innerHTML = playing ? "&#10073;&#10073;" : "&#9654;";
        if (playing) scheduleHide(); else showControls(true);
    }

    function togglePlay() {
        if (video.paused) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
        else video.pause();
    }

    function skip(delta) {
        var t = (video.currentTime || 0) + delta;
        t = Math.max(0, Math.min(t, (video.duration || state.duration || t)));
        try { video.currentTime = t; } catch (e) {}
        seekFeedback(delta > 0);
    }

    function seekFeedback(forward) {
        var pill = forward ? state.fbRight : state.fbLeft;
        pill.classList.add("show");
        if (state.seekFeedbackTimer) clearTimeout(state.seekFeedbackTimer);
        state.seekFeedbackTimer = setTimeout(function () { pill.classList.remove("show"); }, 650);
    }

    /* ---------- Controls visibility ---------- */

    function showControls(persist) {
        state.controlsVisible = true;
        controls.classList.remove("faded");
        if (state.hideTimer) { clearTimeout(state.hideTimer); state.hideTimer = null; }
        if (!persist) scheduleHide();
    }
    function scheduleHide() {
        if (state.hideTimer) clearTimeout(state.hideTimer);
        if (video.paused) return;
        state.hideTimer = setTimeout(function () {
            state.controlsVisible = false;
            controls.classList.add("faded");
        }, cfg.controlsHideMs);
    }
    function hideStatus() { state.status.classList.add("hidden"); }
    function showError(msg) {
        state.status.classList.remove("hidden");
        STU.dom.clear(state.status);
        state.status.appendChild(el("div", { class: "msg", text: msg }));
        var close = el("div", { class: "btn primary focusable", text: "Close" });
        close.__onEnter = destroy;
        state.status.appendChild(close);
    }

    /* ---------- Focus within player ---------- */

    function applyFocus() {
        state.focusEls.forEach(function (e, i) {
            if (i === state.focusIndex) e.classList.add("focused");
            else e.classList.remove("focused");
        });
    }
    function focusAt(i) {
        if (i < 0 || i >= state.focusEls.length) return;
        state.focusIndex = i;
        applyFocus();
    }

    /* Key handling. Index map: 0 back, 1 skipBack, 2 play, 3 skipFwd, 4 timeline */
    function onKey(name) {
        // Next-up overlay owns keys when visible.
        if (state.nextUp) { nextUpKey(name); return; }

        if (name === "Back" || name === "Exit" || name === "Stop") { destroy(); return; }

        // Media transport keys always work, even with controls hidden.
        switch (name) {
            case "PlayPause": togglePlay(); showControls(false); return;
            case "Play": if (video.paused) togglePlay(); showControls(false); return;
            case "Pause": if (!video.paused) togglePlay(); showControls(true); return;
            case "Forward": skip(cfg.skipSeconds); showControls(false); return;
            case "Rewind": skip(-cfg.skipSeconds); showControls(false); return;
        }

        // First D-pad/OK press while hidden simply wakes the controls.
        if (!state.controlsVisible) { showControls(false); return; }

        showControls(false);
        var i = state.focusIndex;

        if (name === "Up") {
            if (i === 4) focusAt(2);            // timeline -> play
            else focusAt(0);                    // center row -> back
        } else if (name === "Down") {
            if (i === 0) focusAt(2);            // back -> play
            else focusAt(4);                    // center row -> timeline
        } else if (name === "Left") {
            if (i === 4) { skip(-cfg.skipSeconds); }       // scrub timeline
            else if (i === 2) focusAt(1);
            else if (i === 3) focusAt(2);
        } else if (name === "Right") {
            if (i === 4) { skip(cfg.skipSeconds); }
            else if (i === 1) focusAt(2);
            else if (i === 2) focusAt(3);
        } else if (name === "Enter") {
            if (i === 0) destroy();
            else if (i === 1) skip(-cfg.skipSeconds);
            else if (i === 2) togglePlay();
            else if (i === 3) skip(cfg.skipSeconds);
            else if (i === 4) togglePlay();
        }
    }

    /* ---------- Progress persistence ---------- */

    function startSaveTimer() {
        if (state.saveTimer) clearInterval(state.saveTimer);
        state.saveTimer = setInterval(function () { flush(false); }, cfg.progressSaveMs);
    }
    function flush(final) {
        if (state.isTrailer || !state.contentId) return;
        var pos = video.currentTime || 0;
        if (!isFinite(pos) || pos < 0) return;
        var dur = (isFinite(video.duration) && video.duration > 0) ? video.duration : null;
        if (Math.abs(pos - state.lastSaved) < 3 && !final) return;
        state.lastSaved = pos;
        API.saveWatchProgress(state.contentId, pos, dur);
        if (final && state.watched > 5) API.recordWatchSession(state.contentId, state.watched);
    }

    /* ---------- Episode "Up Next" ---------- */

    function currentEpIndex() {
        if (!state.episodeId || !state.episodes.length) return -1;
        for (var i = 0; i < state.episodes.length; i++) {
            if (state.episodes[i].episodeId === state.episodeId) return i;
        }
        return -1;
    }
    function nextEpisode() {
        var i = currentEpIndex();
        if (i >= 0 && i + 1 < state.episodes.length) return state.episodes[i + 1];
        return null;
    }

    function maybeNextUp(cur, dur) {
        if (state.isTrailer || state.nextUp) return;
        var next = nextEpisode();
        if (!next) return;
        if (dur > 0 && dur - cur <= 12 && cur > 0) beginNextUp(next);
    }

    function onEnded() {
        state.ended = true;
        flush(true);
        var next = nextEpisode();
        if (next && !state.nextUp && !state.isTrailer) beginNextUp(next);
    }

    function beginNextUp(next) {
        showControls(true);
        var box = el("div", { class: "nextup" });
        var th = el("div", { class: "th" });
        STU.components.backdropInto(th, STU.mediaUrl.candidates({
            posterUrl: next.thumbnailUrl, preferBackdrop: true
        }), next.title);
        box.appendChild(th);
        var body = el("div", { class: "body" });
        body.appendChild(el("div", { class: "k", text: "Up Next" }));
        body.appendChild(el("div", { class: "lbl", text: next.episodeLabel || "" }));
        body.appendChild(el("div", { class: "t", text: next.title }));
        var btn = el("div", { class: "btn primary focusable focused", html: "<span class='ico'>&#9654;</span> Play Next" });
        body.appendChild(btn);
        box.appendChild(body);
        root.appendChild(box);
        setTimeout(function () { box.classList.add("show"); }, 20);

        state.nextUp = { box: box, next: next, countdown: cfg.nextUpCountdown, btn: btn };
        state.nextUpTimer = setInterval(function () {
            state.nextUp.countdown -= 1;
            btn.innerHTML = "<span class='ico'>&#9654;</span> Play Next \u00b7 " + state.nextUp.countdown;
            if (state.nextUp.countdown <= 0) playNext();
        }, 1000);
        btn.__onEnter = playNext;
    }

    function nextUpKey(name) {
        if (name === "Enter") { playNext(); return; }
        if (name === "Back" || name === "Exit") { dismissNextUp(); return; }
    }
    function dismissNextUp() {
        if (!state.nextUp) return;
        clearInterval(state.nextUpTimer); state.nextUpTimer = null;
        state.nextUp.box.classList.remove("show");
        var box = state.nextUp.box;
        setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 300);
        state.nextUp = null;
    }
    function playNext() {
        var next = state.nextUp && state.nextUp.next;
        dismissNextUp();
        if (!next) { destroy(); return; }
        flush(true);
        state.episodeId = next.episodeId;
        state.ended = false;
        state.watched = 0; state.lastSaved = 0; state.resumeAt = 0;
        state.title = state.req.title;
        state.status.classList.remove("hidden");
        STU.dom.clear(state.status);
        state.status.appendChild(el("div", { class: "spinner" }));
        // remove old subtitle tracks
        var tks = video.querySelectorAll("track");
        for (var i = 0; i < tks.length; i++) video.removeChild(tks[i]);
        loadAndPlay();
    }

    /* ---------- Teardown ---------- */

    function destroy() {
        flush(true);
        if (state.hideTimer) clearTimeout(state.hideTimer);
        if (state.saveTimer) clearInterval(state.saveTimer);
        if (state.nextUpTimer) clearInterval(state.nextUpTimer);
        STU.keys.pop(onKey);
        try { video.pause(); } catch (e) {}
        try { video.removeAttribute("src"); video.load(); } catch (e) {}
        root.classList.add("hidden");
        STU.dom.clear(root);
        var cb = state.onClose;
        video = null; controls = null;
        state = null;
        if (cb) cb();
    }

    STU.player = { open: open, close: function () { if (state) destroy(); } };
})();
