/* Home row definitions — mirrors iOS CatalogueTypes.swift / production content-types. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});

    var pluralLabels = {
        MOVIE: "Movies", SERIES: "Series", SHOW: "Shows", DOCUMENTARY: "Documentaries",
        SHORT_FILM: "Short Films", PODCAST: "Podcasts", COMEDY_SKIT: "Comedy Skits",
        STAND_UP: "Stand-Up", ANIMATION: "Animation", SPORTS: "Sports",
        MUSIC_VIDEO: "Music Videos", LIVE_EVENT: "Live Events", REALITY: "Reality",
        WEB_SERIES: "Web Series", NEWS: "News", EDUCATIONAL: "Educational"
    };

    var allCatalogueTypeValues = [
        "MOVIE", "SERIES", "SHOW", "DOCUMENTARY", "SHORT_FILM", "PODCAST",
        "COMEDY_SKIT", "STAND_UP", "ANIMATION", "SPORTS", "MUSIC_VIDEO",
        "LIVE_EVENT", "REALITY", "WEB_SERIES", "NEWS", "EDUCATIONAL"
    ];

    /* id, types[], category?, title */
    var homeRows = [
        { id: "MOVIE", types: ["MOVIE"], title: "Movies" },
        { id: "SERIES", types: ["SERIES"], title: "Series" },
        { id: "ANIMATION", types: ["ANIMATION"], title: "Animation" },
        { id: "SPORTS", types: ["SPORTS"], title: "Sports" },
        { id: "COMEDY", types: ["COMEDY_SKIT", "STAND_UP"], title: "Comedy" },
        { id: "DOCUMENTARY", types: ["DOCUMENTARY"], title: "Documentaries" },
        { id: "SHOW", types: ["SHOW"], title: "Shows" },
        { id: "PODCAST", types: ["PODCAST"], title: "Podcasts" },
        { id: "LIVE_EVENT", types: ["LIVE_EVENT"], title: "Live Events" },
        { id: "COMEDY_SHOWS", types: ["SHOW"], category: "Comedy", title: "Comedy Shows" },
        { id: "SHORT_FILM", types: ["SHORT_FILM"], title: "Short Films" },
        { id: "MUSIC_VIDEO", types: ["MUSIC_VIDEO"], title: "Music Videos" },
        { id: "REALITY", types: ["REALITY"], title: "Reality" },
        { id: "WEB_SERIES", types: ["WEB_SERIES"], title: "Web Series" },
        { id: "NEWS", types: ["NEWS"], title: "News" },
        { id: "EDUCATIONAL", types: ["EDUCATIONAL"], title: "Educational" }
    ];

    var longFormTypes = { SERIES: 1, SHOW: 1, PODCAST: 1, WEB_SERIES: 1, REALITY: 1, NEWS: 1 };

    function trackedTypes() {
        var set = {};
        homeRows.forEach(function (r) { r.types.forEach(function (t) { set[t] = 1; }); });
        allCatalogueTypeValues.forEach(function (t) { set[t] = 1; });
        return set;
    }

    function pluralTitle(t) {
        return pluralLabels[t] || String(t).replace(/_/g, " ").replace(/\w\S*/g, function (w) {
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        });
    }

    STU.catalogue = {
        homeRows: homeRows,
        pluralTitle: pluralTitle,
        trackedTypes: trackedTypes,
        isLongForm: function (t) { return !!(t && longFormTypes[String(t).toUpperCase()]); }
    };
})();
