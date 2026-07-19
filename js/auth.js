/* NextAuth credentials-viewer sign-in flow. Ported from iOS AuthService.swift. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var API = STU.API, cfg = STU.config;

    var Auth = {
        fetchSession: function () {
            return API.request({ path: "api/auth/session" }).then(function (res) {
                if (res.status !== 200) {
                    if (res.status === 401) return null;
                    throw API.parseError(res);
                }
                if (!res.text || res.text === "null") return null;
                var s = res.data;
                if (!s || !s.user || (!s.user.email && !s.user.id)) return null;
                return s;
            });
        },

        signIn: function (email, password) {
            return API.request({ path: "api/auth/csrf" }).then(function (res) {
                if (res.status !== 200) throw API.parseError(res);
                var csrf = res.data && res.data.csrfToken;
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
                var d = res.data;
                if (d && d.error) {
                    var msg = d.error === "CredentialsSignin" ? "Invalid email or password." : d.error;
                    throw new API.ApiError(msg, res.status);
                }
                if (res.status < 200 || (res.status >= 300 && res.status !== 302)) {
                    throw API.parseError(res);
                }
                return Auth.fetchSession();
            }).then(function (session) {
                if (!session || !session.user) {
                    throw new API.ApiError("Sign-in succeeded but no session was created.", 0);
                }
                return session;
            });
        },

        signOut: function () {
            return API.request({ path: "api/auth/csrf" }).then(function (res) {
                var csrf = res.data && res.data.csrfToken;
                return API.request({
                    path: "api/auth/signout",
                    method: "POST",
                    form: { csrfToken: csrf, callbackUrl: cfg.webBase, json: "true" }
                });
            }).catch(function () {});
        }
    };

    STU.Auth = Auth;
})();
