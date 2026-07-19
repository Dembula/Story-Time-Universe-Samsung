/* App-wide configuration and constants. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});

    STU.config = {
        /* Production Story Time viewer web app + API (matches iOS AppConfig). */
        webBase: "https://story-time.online",
        apiBase: "https://story-time.online",

        /* Web destinations opened on a companion device (no in-app payments). */
        urls: {
            renew: "https://story-time.online/browse/account/renew",
            account: "https://story-time.online/browse/account",
            changePlan: "https://story-time.online/browse/account/change-plan",
            signup: "https://story-time.online/auth/signup"
        },

        cookies: {
            viewerProfile: "st_viewer_profile"
        },

        userAgent: "StoryTimeUniverseTizen/1.0",

        /* Player behaviour */
        controlsHideMs: 3500,
        skipSeconds: 10,
        progressSaveMs: 8000,
        nextUpCountdown: 8,

        /* Home hero rotation */
        heroRotateMs: 8000,
        profileBackdropRotateMs: 6000
    };

    STU.api = function (path) {
        var clean = String(path || "").replace(/^\/+/, "");
        return STU.config.apiBase + "/" + clean;
    };
})();
