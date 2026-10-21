/* HTTP + viewer API client. Ported from iOS APIClient.swift + ViewerAPI.swift.
 * All requests send credentials so the NextAuth session + viewer-profile cookies flow. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var cfg = STU.config;
    var accessToken = null;
    var viewerProfileId = null;

    try { accessToken = window.localStorage.getItem("stu_session_token") || null; } catch (e) {}
    try { viewerProfileId = window.localStorage.getItem("stu_viewer_profile") || null; } catch (e) {}

    function persistToken(token) {
        accessToken = token || null;
        try {
            if (accessToken) window.localStorage.setItem("stu_session_token", accessToken);
            else window.localStorage.removeItem("stu_session_token");
        } catch (e) {}
    }

    function persistProfile(id) {
        viewerProfileId = id || null;
        try {
            if (viewerProfileId) window.localStorage.setItem("stu_viewer_profile", viewerProfileId);
            else window.localStorage.removeItem("stu_viewer_profile");
        } catch (e) {}
    }

    function ApiError(message, status, opts) {
        this.name = "ApiError";
        this.message = message || "Request failed";
        this.status = status || 0;
        this.paymentRequired = !!(opts && opts.paymentRequired);
        this.requiresPin = !!(opts && opts.requiresPin);
    }
    ApiError.prototype = Object.create(Error.prototype);

    function buildUrl(path, query) {
        var url = STU.api(path);
        if (query) {
            var parts = [];
            Object.keys(query).forEach(function (k) {
                var v = query[k];
                if (v === undefined || v === null || v === "") return;
                parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
            });
            if (parts.length) url += (url.indexOf("?") >= 0 ? "&" : "?") + parts.join("&");
        }
        return url;
    }

    /* Core request. Returns { status, data, text }. */
    function request(opts) {
        var method = opts.method || "GET";
        var url = buildUrl(opts.path, opts.query);
        var headers = { "Accept": "application/json" };
        if (cfg.userAgent) headers["X-ST-Platform"] = "tizen";
        headers["X-ST-Device"] = "samsung-tv";
        if (accessToken) headers["Authorization"] = "Bearer " + accessToken;
        if (viewerProfileId) {
            headers["X-ST-Viewer-Profile"] = viewerProfileId;
            headers["X-Viewer-Profile-Id"] = viewerProfileId;
        }
        var body = null;

        if (opts.json) {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(opts.json);
        } else if (opts.form) {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            body = Object.keys(opts.form).map(function (k) {
                return encodeURIComponent(k) + "=" + encodeURIComponent(opts.form[k]);
            }).join("&");
        }

        /* Tizen + production CORS use Access-Control-Allow-Origin: *.
           Browsers block credentials:"include" with a wildcard origin, which made
           POST /api/tv/session appear to hang/fail and left Samsung QA unable to
           log in. Always omit cookies on TV; auth is Bearer-only. */
        var onTizen = !!(STU.tv && STU.tv.isTizen);
        var omitCreds = !!accessToken || onTizen || !!opts.omitCredentials;

        return fetch(url, {
            method: method,
            headers: headers,
            body: body,
            credentials: omitCreds ? "omit" : "include",
            mode: "cors",
            cache: "no-store",
            redirect: "follow"
        }).then(function (res) {
            return res.text().then(function (text) {
                var data = null;
                if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }
                return { status: res.status, data: data, text: text, headers: res.headers };
            });
        }, function (err) {
            throw new ApiError((err && err.message) || "Network error — check TV internet connection.", 0);
        });
    }

    function parseError(res) {
        var d = res.data || {};
        var msg = d.error;
        if (res.status === 402 || d.paymentRequired) {
            return new ApiError(msg || "Complete your subscription on the web.", 402, { paymentRequired: true });
        }
        if (d.mfaRequired) {
            return new ApiError(
                "This account has authenticator MFA enabled. Disable MFA for the QA viewer account, or use an account without MFA.",
                401,
                { mfaRequired: true }
            );
        }
        if (res.status === 401) return new ApiError(msg || "Please sign in again.", 401);
        return new ApiError(msg || ("Request failed (" + res.status + ")."), res.status);
    }

    function ok(res) { return res.status >= 200 && res.status < 300; }

    /* Decode a catalogue array defensively (skip malformed rows). */
    function asArray(d) { return Array.isArray(d) ? d : []; }

    var API = {
        ApiError: ApiError,
        request: request,
        parseError: parseError,
        getAccessToken: function () { return accessToken; },
        setAccessToken: persistToken,
        clearAccessToken: function () { persistToken(null); persistProfile(null); },
        setViewerProfileId: persistProfile,
        getViewerProfileId: function () { return viewerProfileId; },

        /* ---------- Content / catalogue ---------- */
        fetchContent: function (o) {
            o = o || {};
            var q = { limit: o.limit || 20 };
            if (o.type) q.type = o.type;
            if (o.featured) q.featured = "true";
            if (o.category) q.category = o.category;
            return request({ path: "api/content", query: q }).then(function (res) {
                if (res.status !== 200) throw parseError(res);
                return asArray(res.data);
            });
        },

        /* One home row that may combine multiple types (+ optional category). */
        fetchRow: function (def, limit) {
            limit = limit || 16;
            var self = this;
            if (def.types.length === 1 && !def.category) {
                return self.fetchContent({ type: def.types[0], limit: limit }).catch(function () { return []; });
            }
            var seen = {}, combined = [];
            var chain = Promise.resolve();
            def.types.forEach(function (t) {
                chain = chain.then(function () {
                    if (combined.length >= limit) return;
                    return self.fetchContent({ type: t, category: def.category, limit: limit })
                        .catch(function () { return []; })
                        .then(function (batch) {
                            batch.forEach(function (it) { if (!seen[it.id]) { seen[it.id] = 1; combined.push(it); } });
                        });
                });
            });
            return chain.then(function () {
                if (!combined.length && def.category) {
                    return self.fetchContent({ category: def.category, limit: limit }).catch(function () { return []; });
                }
                return combined.slice(0, limit);
            });
        },

        fetchContentDetail: function (id) {
            return request({ path: "api/content/" + id }).then(function (res) {
                if (res.status !== 200) throw parseError(res);
                return res.data;
            });
        },

        fetchContinueWatching: function () {
            return request({ path: "api/watch/continue-watching" }).then(function (res) {
                return res.status === 200 ? asArray(res.data) : [];
            }).catch(function () { return []; });
        },

        fetchCrew: function (contentId) {
            return request({ path: "api/crew", query: { contentId: contentId } }).then(function (res) {
                return res.status === 200 ? asArray(res.data) : [];
            }).catch(function () { return []; });
        },

        fetchPersonPreview: function (personId) {
            return request({ path: "api/people/" + personId + "/preview" }).then(function (res) {
                if (res.status !== 200) throw parseError(res);
                return res.data;
            });
        },
        fetchPersonByCrew: function (crewMemberId) {
            return request({ path: "api/people/preview", query: { crewMemberId: crewMemberId } }).then(function (res) {
                if (res.status !== 200) throw parseError(res);
                return res.data;
            });
        },

        fetchRelated: function (id, category, type, limit) {
            limit = limit || 12;
            var self = this, items = [];
            var p = Promise.resolve();
            if (category) {
                p = p.then(function () {
                    return self.fetchContent({ category: category, limit: limit + 4 }).catch(function () { return []; })
                        .then(function (r) { items = items.concat(r); });
                });
            }
            p = p.then(function () {
                if (items.length >= 4 || !type) return;
                return self.fetchContent({ type: type, limit: limit + 4 }).catch(function () { return []; })
                    .then(function (r) { items = items.concat(r); });
            });
            p = p.then(function () {
                if (items.length) return;
                return self.fetchContent({ limit: limit + 4 }).catch(function () { return []; })
                    .then(function (r) { items = items.concat(r); });
            });
            return p.then(function () {
                var seen = {}; seen[id] = 1;
                return items.filter(function (it) {
                    if (seen[it.id]) return false; seen[it.id] = 1; return true;
                }).slice(0, limit);
            });
        },

        /* ---------- Playback ---------- */
        fetchPlaybackBundle: function (contentId, episodeId, trailer) {
            var q = {};
            if (episodeId) q.episodeId = episodeId;
            if (trailer) q.trailer = "1";
            return request({ path: "api/content/" + contentId + "/playback-bundle", query: q }).then(function (res) {
                if (res.status !== 200) throw parseError(res);
                return res.data;
            });
        },

        fetchWatchProgress: function (contentId) {
            return request({ path: "api/watch/progress", query: { contentId: contentId } }).then(function (res) {
                if (res.status !== 200) return { position: 0, duration: null };
                var d = res.data || {};
                return { position: d.positionSeconds || 0, duration: d.durationSeconds || null };
            }).catch(function () { return { position: 0, duration: null }; });
        },

        saveWatchProgress: function (contentId, positionSeconds, durationSeconds) {
            var j = { contentId: contentId, positionSeconds: positionSeconds };
            if (durationSeconds) j.durationSeconds = durationSeconds;
            return request({ path: "api/watch/progress", method: "PUT", json: j }).catch(function () {});
        },

        recordWatchSession: function (contentId, durationSeconds) {
            return request({ path: "api/watch", method: "POST",
                json: { contentId: contentId, durationSeconds: durationSeconds } }).catch(function () {});
        },

        /* ---------- Search ---------- */
        search: function (query) {
            var q = String(query || "").trim();
            if (q.length < 2) return Promise.resolve([]);
            return request({ path: "api/browse/search", query: { q: q, limit: 24 } }).then(function (res) {
                if (res.status !== 200) return [];
                return (res.data && res.data.results) || [];
            }).catch(function () { return []; });
        },

        /* ---------- My List ---------- */
        fetchWatchlist: function () {
            return request({ path: "api/watchlist" }).then(function (res) {
                if (res.status !== 200) throw parseError(res);
                return asArray(res.data).map(function (row) { return row.content; }).filter(Boolean);
            });
        },
        updateWatchlist: function (contentId, add) {
            return request({ path: "api/watchlist", method: "POST",
                json: { contentId: contentId, action: add ? "add" : "remove" } }).then(function (res) {
                if (!ok(res)) throw parseError(res);
                return true;
            });
        },

        /* ---------- Profiles ---------- */
        fetchProfiles: function () {
            return request({ path: "api/viewer/profiles" }).then(function (res) {
                if (res.status !== 200) throw parseError(res);
                return (res.data && res.data.profiles) || [];
            });
        },
        activateProfile: function (id, pin) {
            var j = { profileId: id };
            if (pin) j.pin = pin;
            return request({ path: "api/viewer/profiles/active", method: "POST", json: j }).then(function (res) {
                if (res.status === 402) throw parseError(res);
                if (res.status === 401 || res.status === 403) {
                    var d = res.data || {};
                    if (d.requiresPin) throw new ApiError(d.error || "PIN required", res.status, { requiresPin: true });
                    throw parseError(res);
                }
                if (!ok(res)) throw parseError(res);
                var profile = res.data && res.data.profile;
                if (!profile) throw new ApiError((res.data && res.data.error) || "Failed to select profile", res.status);
                persistProfile(profile.id);
                return profile;
            });
        },
        createProfile: function (o) {
            var j = { name: o.name, birthYear: o.birthYear, birthMonth: o.birthMonth, birthDay: o.birthDay };
            if (o.pin && String(o.pin).length === 4) { j.pinEnabled = true; j.pin = o.pin; }
            return request({ path: "api/viewer/profiles", method: "POST", json: j }).then(function (res) {
                if (!ok(res)) throw parseError(res);
                return res.data && res.data.profile;
            });
        },

        /* ---------- Subscription ---------- */
        fetchSubscription: function () {
            return request({ path: "api/viewer/subscription" }).then(function (res) {
                if (res.status !== 200) return null;
                return (res.data && res.data.subscription) || null;
            }).catch(function () { return null; });
        }
    };

    STU.API = API;
})();
