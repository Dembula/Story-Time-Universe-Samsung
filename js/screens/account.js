/* Account — profile, subscription status (read-only), and web hand-offs. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var el = STU.dom.el, C = STU.components, cfg = STU.config;
    STU.screens = STU.screens || {};

    STU.screens.account = {
        render: function (ctx) {
            var node = el("div");
            var nav = C.sideNav("account", function (id) { if (id !== "account") ctx.replace(id); });
            node.appendChild(nav.node);

            var app = ctx.app;
            var user = (app.session && app.session.user) || {};
            var profile = app.activeProfile || {};

            var page = el("div", { class: "account" });
            page.appendChild(el("h1", { text: "Account" }));
            page.appendChild(el("div", { class: "whoami",
                text: (profile.name ? profile.name + "  \u00b7  " : "") + (user.email || "") }));

            var sub = app.subscription;
            var card = el("div", { class: "sub-card" });
            var status = (sub && sub.status) || "UNKNOWN";
            var warn = app.needsPaymentAttention();
            card.appendChild(el("div", { class: "st-row" }, [
                el("div", { class: "plan", text: (sub && sub.plan) ? sub.plan : "Subscription" }),
                el("div", { class: "badge " + (warn ? "warn" : "ok"), text: status })
            ]));
            if (sub && sub.currentPeriodEnd) {
                var d = new Date(sub.currentPeriodEnd);
                card.appendChild(el("div", { class: "hint",
                    text: (sub.cancelAtPeriodEnd ? "Ends " : "Renews ") + (isNaN(d) ? sub.currentPeriodEnd : d.toDateString()) }));
            }
            card.appendChild(el("div", { class: "hint",
                text: "Payments and plan changes are handled on the Story Time website." }));

            var actions = el("div", { class: "actions" });
            actions.appendChild(webBtn("Manage on Web", cfg.urls.account));
            if (warn) actions.appendChild(webBtn("Renew", cfg.urls.renew, true));
            else actions.appendChild(webBtn("Change Plan", cfg.urls.changePlan));
            card.appendChild(actions);
            page.appendChild(card);

            var lower = el("div", { class: "actions", style: "margin-top:10px" });
            var switchBtn = btn("Switch Profile");
            switchBtn.__onEnter = function () { ctx.app.activeProfile = null; ctx.replace("profiles"); };
            var signOutBtn = btn("Sign Out");
            signOutBtn.__onEnter = function () {
                try { window.localStorage.removeItem("stu_signed_in"); } catch (e) {}
                STU.Auth.signOut().then(function () {
                    ctx.app.session = null; ctx.app.activeProfile = null; ctx.app.subscription = null;
                    ctx.replace("signin");
                });
            };
            lower.appendChild(switchBtn); lower.appendChild(signOutBtn);
            page.appendChild(lower);

            node.appendChild(page);

            function btn(label) { return el("div", { class: "btn focusable", tabindex: "-1", text: label }); }
            function webBtn(label, url, primary) {
                var b = el("div", { class: "btn focusable" + (primary ? " primary" : ""), tabindex: "-1", text: label });
                b.__onEnter = function () { STU.tv.openBrowser(url); STU.dom.toast("Opening " + label + " on your browser\u2026"); };
                return b;
            }

            function onKey(name) {
                if (name === "Back" || name === "Exit") { ctx.replace("home"); return; }
                if (name === "Up" || name === "Down" || name === "Left" || name === "Right") STU.focus.move(name);
                else if (name === "Enter") STU.focus.enter();
            }

            return {
                node: node,
                onKey: onKey,
                initialFocus: function () { STU.focus.focusFirst(".account .btn"); },
                destroy: function () {}
            };
        }
    };
})();
