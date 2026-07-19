/* Bootstrap: register remote keys, hide the pointer, resolve session, route. */
(function () {
    "use strict";
    var STU = window.STU;

    function boot() {
        STU.tv.registerKeys();
        STU.tv.hidePointer();
        STU.router.init();

        // Branded splash while we resolve the NextAuth session.
        STU.router.replace("splash");

        var minSplash = 2200;
        var started = Date.now();

        // Returning users authenticate once; the persisted session then lands
        // them straight on their profiles every launch (like the mobile apps).
        var signedInBefore = false;
        try { signedInBefore = window.localStorage.getItem("stu_signed_in") === "1"; } catch (e) {}

        STU.Auth.fetchSession().then(function (session) {
            STU.router.app.session = session;
            if (session && session.user) {
                return STU.API.fetchSubscription().then(function (sub) {
                    STU.router.app.subscription = sub;
                    return session;
                });
            }
            return session;
        }).then(function (session) {
            finish(session && session.user ? "profiles" : "signin");
        }).catch(function () {
            // Transient error at boot: if this device has signed in before, still
            // head to profiles (which safely redirects to sign-in on a real 401).
            finish(signedInBefore ? "profiles" : "signin");
        });

        function finish(screen) {
            var wait = Math.max(0, minSplash - (Date.now() - started));
            setTimeout(function () { STU.router.replace(screen); }, wait);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }

    // Global safety net: log unhandled errors to a toast during development.
    window.addEventListener("error", function (e) {
        if (STU && STU.dom) STU.dom.toast((e && e.message) || "Unexpected error", true);
    });
})();
