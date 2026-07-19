/* Image URL resolution — ported from iOS MediaURL.swift.
 * Produces an ordered list of candidate image URLs; callers try each until one loads. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});

    function trim(s) { return s == null ? "" : String(s).trim(); }

    function isNonImageMedia(raw) {
        var l = raw.toLowerCase();
        return l.indexOf("manifest/video") >= 0 ||
            /\.m3u8$/.test(l) || /\.mpd$/.test(l) || /\.mp4$/.test(l) ||
            l.indexOf("/iframe") >= 0 || l.indexOf("/downloads/") >= 0;
    }

    function displayableHTTP(raw) {
        raw = trim(raw); if (!raw) return null;
        var l = raw.toLowerCase();
        if (l.indexOf("https://") !== 0 && l.indexOf("http://") !== 0) return null;
        if (isNonImageMedia(raw)) return null;
        return raw;
    }

    function siteRelative(raw) {
        raw = trim(raw); if (!raw) return null;
        if (raw.charAt(0) === "/") return STU.config.apiBase + raw;
        return null;
    }

    function previewProxy(raw) {
        raw = trim(raw); if (!raw) return null;
        var priv = raw.indexOf("s3://") === 0 ||
            raw.indexOf(".amazonaws.com/") >= 0 ||
            raw.indexOf("r2.cloudflarestorage.com") >= 0 ||
            raw.indexOf("storage.googleapis.com") >= 0 ||
            (raw.toLowerCase().indexOf("http") !== 0 && raw.charAt(0) !== "/");
        if (!priv) return null;
        return STU.config.apiBase + "/api/files/preview?ref=" +
            encodeURIComponent(raw) + "&context=marketplace";
    }

    function extractStreamUID(videoUrl) {
        videoUrl = trim(videoUrl); if (!videoUrl) return null;
        if (/^[a-fA-F0-9]{32}$/.test(videoUrl)) return videoUrl;
        var host, path;
        try {
            var m = videoUrl.match(/^https?:\/\/([^\/]+)(\/[^?#]*)?/);
            if (!m) {
                if (videoUrl.indexOf("videodelivery.net") >= 0 || videoUrl.indexOf("cloudflarestream.com") >= 0) {
                    return extractStreamUID("https://" + videoUrl);
                }
                return null;
            }
            host = m[1].toLowerCase(); path = m[2] || "";
        } catch (e) { return null; }
        if (host.indexOf("videodelivery.net") < 0 && host.indexOf("cloudflarestream.com") < 0) return null;
        var first = path.split("/").filter(Boolean)[0];
        if (!first || first.indexOf(".") >= 0) return null;
        return first;
    }

    function streamThumb(videoUrl, time, height, width) {
        var uid = extractStreamUID(videoUrl);
        if (!uid) return null;
        var u = "https://videodelivery.net/" + uid + "/thumbnails/thumbnail.jpg?time=" +
            (time || "3s") + "&height=" + (height || 480);
        if (width) u += "&width=" + width + "&fit=crop";
        return u;
    }

    /* Returns an ordered array of candidate URLs. */
    function candidates(opts) {
        var posterUrl = opts.posterUrl, backdropUrl = opts.backdropUrl,
            videoUrl = opts.videoUrl, preferBackdrop = !!opts.preferBackdrop;
        var seen = {}, out = [];
        function add(u) { if (u && !seen[u]) { seen[u] = 1; out.push(u); } }

        var primary = preferBackdrop ? backdropUrl : posterUrl;
        var secondary = preferBackdrop ? posterUrl : backdropUrl;
        var backdropKey = trim(backdropUrl).toLowerCase();

        function notBackdrop(u) {
            if (u && backdropKey && u.toLowerCase() === backdropKey) return null;
            return u;
        }

        if (preferBackdrop) {
            add(displayableHTTP(primary));
            add(previewProxy(primary));
            add(siteRelative(primary));
            add(streamThumb(videoUrl, "5s", 720, null));
            add(displayableHTTP(secondary));
            add(previewProxy(secondary));
            add(siteRelative(secondary));
        } else {
            add(notBackdrop(displayableHTTP(primary)));
            add(notBackdrop(previewProxy(primary)));
            add(notBackdrop(siteRelative(primary)));
            var hasPoster = !!trim(posterUrl);
            if (!hasPoster) add(streamThumb(videoUrl, "2s", 480, 320));
        }
        return out.slice(0, 4);
    }

    function first(opts) { var c = candidates(opts); return c.length ? c[0] : null; }

    STU.mediaUrl = { candidates: candidates, first: first, streamThumb: streamThumb };
})();
