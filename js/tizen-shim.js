/* Tizen platform bridge.
 * Real Samsung TVs expose global `tizen` and `webapis`. When previewing in a
 * desktop browser these are undefined, so we install harmless stubs so the app
 * still boots for design/QA. All TV-only calls are funnelled through STU.tv.  */
(function () {
    "use strict";

    var hasTizen = typeof window.tizen !== "undefined";
    var hasWebapis = typeof window.webapis !== "undefined";

    var STU = window.STU || (window.STU = {});

    STU.tv = {
        isTizen: hasTizen,

        /* Register the remote keys we care about so keydown events fire for them. */
        registerKeys: function () {
            if (!hasTizen || !tizen.tvinputdevice) return;
            var keys = [
                "MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop",
                "MediaRewind", "MediaFastForward",
                "MediaTrackPrevious", "MediaTrackNext",
                "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue",
                "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
                "ChannelUp", "ChannelDown", "Info", "Back"
            ];
            keys.forEach(function (k) {
                try { tizen.tvinputdevice.registerKey(k); } catch (e) { /* key not supported */ }
            });
        },

        /* Hide the Smart-Remote pointer/cursor if the panel supports it. */
        hidePointer: function () {
            try {
                if (hasWebapis && webapis.tvinfo && webapis.tvinfo.setCursorVisibility) {
                    webapis.tvinfo.setCursorVisibility(false);
                }
            } catch (e) { /* not supported — CSS `cursor:none` still applies */ }
            document.body.style.cursor = "none";
        },

        exitApp: function () {
            try {
                if (hasTizen && tizen.application) {
                    tizen.application.getCurrentApplication().exit();
                    return;
                }
            } catch (e) { /* ignore */ }
            // Browser preview fallback
            window.close();
        },

        /* Open the phone/web companion (payments etc.) via the platform browser. */
        openBrowser: function (url) {
            try {
                if (hasTizen && tizen.application) {
                    tizen.application.launchAppControl(
                        new tizen.ApplicationControl(
                            "http://tizen.org/appcontrol/operation/view", url
                        ),
                        null,
                        function () {},
                        function () {}
                    );
                    return;
                }
            } catch (e) { /* ignore */ }
            window.open(url, "_blank");
        },

        hasAVPlay: function () {
            return hasWebapis && typeof webapis.avplay !== "undefined";
        }
    };
})();
