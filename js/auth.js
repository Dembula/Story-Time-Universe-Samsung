/* NextAuth + Samsung TV session.
 *
 * Tizen packaged apps run as file:// / widget origin. Chromium on Tizen 8–10
 * will not store NextAuth SameSite=Lax cookies on cross-origin fetch, so
 * credentials-viewer can appear to succeed while GET /api/auth/session is empty
 * ("Sign-in succeeded but no session was created").
 *
 * Primary path: POST /api/tv/session → JWT, sent as Authorization: Bearer on
 * every API call. Cookie NextAuth remains a fallback for desktop preview. */
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

    function wait(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    var Auth = {
        fetchSession: function () {
            var token = API.getAccessToken && API.getAccessToken();
            if (token) {
                return API.request({ path: "api/tv/session" }).then(function (res) {
                    if (res.status === 401 || res.status === 403) {
                        API.clearAccessToken();
                        persistSignedIn(false);
                        return null;
                    }
                    if (res.status === 404 || res.status === 405) {
                        return Auth.fetchCookieSession();
                    }
                    if (res.status !== 200) {
                        if (res.status === 0) return Auth.fetchCookieSession();
                        throw API.parseError(res);
                    }
                    return sessionFromPayload(res.data);
                }).catch(function () {
                    return Auth.fetchCookieSession();
                });
            }
            return Auth.fetchCookieSession();
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

        signInTv: function (email, password) {
            return API.request({
                path: "api/tv/session",
                method: "POST",
                json: {
                    email: String(email).trim().toLowerCase(),
                    password: password
                }
            }).then(function (res) {
                if (res.status === 200) {
                    var token = res.data && res.data.token;
                    var session = sessionFromPayload((res.data && res.data.session) || res.data);
                    if (!token || !session) {
                        throw new API.ApiError("Sign-in succeeded but no session was created.", 0);
                    }
                    API.setAccessToken(token);
                    persistSignedIn(true);
                    return session;
                }
                if (res.status === 401 || res.status === 429) throw API.parseError(res);
                if (res.status === 403 && res.data && res.data.error) throw API.parseError(res);
                return null;
            });
        },

        signInCookies: function (email, password) {
            return API.request({ path: "api/auth/csrf" }).then(function (res) {
                if (res.status !== 200) throw API.parseError(res);
                var csrf = res.data && res.data.csrfToken;
                if (!csrf) throw new API.ApiError("Could not start sign-in. Please try again.", 0);
                var form = {
                    csrfToken: csrf,
                    email: String(email).trim().toLowerCase(),
                    password: password,
                    callbackUrl: cfg.webBase + "/profiles",
                    json: "true"
                };
                return API.request({
                    path: "api/auth/callback/credentials-viewer",
                    method: "POST",
                    form: form
                });
            }).then(function (res) {
                var d = res.data || {};
                if (d.error) {
                    var msg = d.error === "CredentialsSignin" ? "Invalid email or password." : d.error;
                    throw new API.ApiError(msg, res.status);
                }
                var url = String(d.url || "");
                if (/[?&]csrf=true\b/.test(url) || /[?&]error=/.test(url)) {
                    throw new API.ApiError("Sign-in could not create a session on this TV. Please try again.", 0);
                }
                if (res.status < 200 || (res.status >= 300 && res.status !== 302)) {
                    throw API.parseError(res);
                }
                return Auth.fetchCookieSession();
            }).then(function (session) {
                if (session && session.user) return session;
                return wait(400).then(function () { return Auth.fetchCookieSession(); });
            }).then(function (session) {
                if (!session || !session.user) {
                    throw new API.ApiError("Sign-in succeeded but no session was created.", 0);
                }
                persistSignedIn(true);
                return session;
            });
        },

        signIn: function (email, password) {
            return Auth.signInTv(email, password).then(function (session) {
                if (session && session.user) return session;
                return Auth.signInCookies(email, password);
            }).catch(function (err) {
                if (err && err.status && err.status !== 404 && err.status !== 405) throw err;
                return Auth.signInCookies(email, password);
            });
        },

        signOut: function () {
            API.clearAccessToken();
            persistSignedIn(false);
            return API.request({ path: "api/tv/session", method: "DELETE" }).catch(function () {}).then(function () {
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
