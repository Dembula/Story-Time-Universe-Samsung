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
            /* Do NOT register digit keys globally — that steals them from the
               system IME and crashes / bricks login typing on Tizen 8–10. */
            var keys = [
                "MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop",
                "MediaRewind", "MediaFastForward",
                "MediaTrackPrevious", "MediaTrackNext",
                "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue",
                "ChannelUp", "ChannelDown", "Info", "Back"
            ];
            keys.forEach(function (k) {
                try { tizen.tvinputdevice.registerKey(k); } catch (e) { /* key not supported */ }
            });
        },

        registerDigitKeys: function () {
            if (!hasTizen || !tizen.tvinputdevice) return;
            ["0","1","2","3","4","5","6","7","8","9"].forEach(function (k) {
                try { tizen.tvinputdevice.registerKey(k); } catch (e) {}
            });
        },

        unregisterDigitKeys: function () {
            if (!hasTizen || !tizen.tvinputdevice || !tizen.tvinputdevice.unregisterKey) return;
            ["0","1","2","3","4","5","6","7","8","9"].forEach(function (k) {
                try { tizen.tvinputdevice.unregisterKey(k); } catch (e) {}
            });
        },

        /* Show/hide the Smart-Remote pointer. The app supports pointer remotes:
           it boots in D-pad mode (cursor hidden) and reveals the pointer the
           moment the remote's air-mouse moves. CSS mirrors this visually so it
           works even on panels without setCursorVisibility. */
        setPointerVisible: function (visible) {
            try {
                if (hasWebapis && webapis.tvinfo && webapis.tvinfo.setCursorVisibility) {
                    webapis.tvinfo.setCursorVisibility(!!visible);
                }
            } catch (e) { /* not supported — CSS input-mode classes still apply */ }
        },

        /* Back-compat: some callers may still ask to hide the pointer. */
        hidePointer: function () { this.setPointerVisible(false); },

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
