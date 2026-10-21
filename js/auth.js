/* Samsung TV session auth.
 *
 * Tizen webviews cannot keep NextAuth SameSite cookies on cross-origin fetch.
 * Login MUST use POST /api/tv/session → JWT stored in localStorage, then
 * Authorization: Bearer on every API call.
 *
 * Also: never use credentials:"include" against a CORS "*" API (blocked by
 * Chromium/Tizen) — that was why session creation failed in Samsung QA. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var API = STU.API, cfg = STU.config;

    function sessionFromPayload(s) {
        if (!s) return null;
        var user = s.user || s;
        if (!user || (!user.email && !user.id)) return null;
        return s.user ? s : { user: user };
    }

    function persistSignedIn(on) {
        try {
            if (on) window.localStorage.setItem("stu_signed_in", "1");
            else window.localStorage.removeItem("stu_signed_in");
        } catch (e) {}
    }

    function onTizen() {
        return !!(STU.tv && STU.tv.isTizen);
    }

    var Auth = {
        fetchSession: function () {
            var token = API.getAccessToken && API.getAccessToken();
            if (!token) {
                if (onTizen()) return Promise.resolve(null);
                return Auth.fetchCookieSession();
            }
            return API.request({ path: "api/tv/session", omitCredentials: true }).then(function (res) {
                if (res.status === 401 || res.status === 403) {
                    API.clearAccessToken();
                    persistSignedIn(false);
                    return null;
                }
                if (res.status === 404 || res.status === 405) {
                    if (onTizen()) return null;
                    return Auth.fetchCookieSession();
                }
                if (res.status !== 200) {
                    if (res.status === 0 && !onTizen()) return Auth.fetchCookieSession();
                    if (res.status === 0) return null;
                    throw API.parseError(res);
                }
                var session = sessionFromPayload(res.data);
                if (!session || !session.user) {
                    API.clearAccessToken();
                    persistSignedIn(false);
                    return null;
                }
                persistSignedIn(true);
                return session;
            }).catch(function (err) {
                if (onTizen()) {
                    if (err && err.status === 401) {
                        API.clearAccessToken();
                        persistSignedIn(false);
                        return null;
                    }
                    throw err;
                }
                return Auth.fetchCookieSession();
            });
        },

        fetchCookieSession: function () {
            return API.request({ path: "api/auth/session", query: { _ts: String(Date.now()) } }).then(function (res) {
                if (res.status !== 200) {
                    if (res.status === 401) return null;
                    throw API.parseError(res);
                }
                if (!res.text || res.text === "null") return null;
                return sessionFromPayload(res.data);
            });
        },

        /* Primary path for TV — Bearer JWT. */
        signInTv: function (email, password, mfaCode) {
            var cleanEmail = String(email || "").trim().toLowerCase();
            var cleanPass = String(password || "");
            if (!cleanEmail || !cleanPass) {
                return Promise.reject(new API.ApiError("Enter your email and password.", 400));
            }
            var body = { email: cleanEmail, password: cleanPass };
            if (mfaCode && String(mfaCode).trim()) body.mfaCode = String(mfaCode).trim();
            return API.request({
                path: "api/tv/session",
                method: "POST",
                omitCredentials: true,
                json: body
            }).then(function (res) {
                if (res.status === 200) {
                    var token = res.data && res.data.token;
                    var session = sessionFromPayload((res.data && res.data.session) || res.data);
                    if (!token || !session) {
                        throw new API.ApiError("Sign-in succeeded but no session token was returned.", 0);
                    }
                    API.setAccessToken(token);
                    if (API.setViewerProfileId) API.setViewerProfileId(null);
                    persistSignedIn(true);
                    /* Prove the token round-trips before leaving the sign-in screen. */
                    return Auth.fetchSession().then(function (verified) {
                        if (!verified || !verified.user) {
                            API.clearAccessToken();
                            persistSignedIn(false);
                            throw new API.ApiError("Session token was rejected. Please try again.", 0);
                        }
                        return verified;
                    });
                }
                if (res.status === 404 || res.status === 405) {
                    throw new API.ApiError("TV sign-in is not available on the server yet.", res.status);
                }
                throw API.parseError(res);
            });
        },

        /* Desktop preview only — cookies never stick on packaged Tizen apps. */
        signInCookies: function (email, password) {
            return API.request({ path: "api/auth/csrf" }).then(function (res) {
                if (res.status !== 200) throw API.parseError(res);
                var csrf = res.data && res.data.csrfToken;
                if (!csrf) throw new API.ApiError("Could not start sign-in. Please try again.", 0);
                return API.request({
                    path: "api/auth/callback/credentials-viewer",
                    method: "POST",
                    form: {
                        csrfToken: csrf,
                        email: String(email).trim().toLowerCase(),
                        password: password,
                        callbackUrl: cfg.webBase + "/profiles",
                        json: "true"
                    }
                });
            }).then(function (res) {
                var d = res.data || {};
                if (d.error) {
                    var msg = d.error === "CredentialsSignin" ? "Invalid email or password." : d.error;
                    throw new API.ApiError(msg, res.status);
                }
                if (res.status < 200 || (res.status >= 300 && res.status !== 302)) {
                    throw API.parseError(res);
                }
                return Auth.fetchCookieSession();
            }).then(function (session) {
                if (!session || !session.user) {
                    throw new API.ApiError("Sign-in succeeded but no session was created.", 0);
                }
                persistSignedIn(true);
                return session;
            });
        },

        signIn: function (email, password, mfaCode) {
            if (onTizen()) {
                return Auth.signInTv(email, password, mfaCode);
            }
            return Auth.signInTv(email, password, mfaCode).catch(function (err) {
                if (err && (err.status === 404 || err.status === 405)) {
                    return Auth.signInCookies(email, password);
                }
                throw err;
            });
        },

        signOut: function () {
            API.clearAccessToken();
            persistSignedIn(false);
            return API.request({ path: "api/tv/session", method: "DELETE", omitCredentials: true })
                .catch(function () {})
                .then(function () {
                    if (onTizen()) return;
                    return API.request({ path: "api/auth/csrf" }).then(function (res) {
                        var csrf = res.data && res.data.csrfToken;
                        return API.request({
                            path: "api/auth/signout",
                            method: "POST",
                            form: { csrfToken: csrf, callbackUrl: cfg.webBase, json: "true" }
                        });
                    });
                }).catch(function () {});
        }
    };

    STU.Auth = Auth;
})();
