/* Choose profile — full-bleed cycling backdrop covering the whole screen. */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var el = STU.dom.el, colorFor = STU.dom.colorFor, initials = STU.dom.initials;
    STU.screens = STU.screens || {};

    STU.screens.profiles = {
        render: function (ctx) {
            var profiles = [], backdrops = [], bIdx = 0, rotateTimer = null;
            var selecting = false;

            var node = el("div", { class: "profiles" });

            // Backdrop layer (covers 1920x1080)
            var backdrop = el("div", { class: "backdrop" });
            var slides = el("div");
            backdrop.appendChild(slides);
            backdrop.appendChild(el("div", { class: "scrim" }));
            node.appendChild(backdrop);

            // Top bar
            var signOut = el("div", { class: "link", text: "Sign Out" });
            var topbar = el("div", { class: "topbar" }, [
                el("div", { class: "brand" }, [ el("img", { class: "brand-mark-img", src: "img/logo.png", alt: "Story Time" }) ]),
                signOut
            ]);
            node.appendChild(topbar);

            // Feature title (over backdrop)
            var featTitle = el("div", { class: "feature-title" });
            var ftT = el("div", { class: "t" }); var ftC = el("div", { class: "c" });
            featTitle.appendChild(ftT); featTitle.appendChild(ftC);
            node.appendChild(featTitle);

            // Bottom panel
            var panel = el("div", { class: "panel" });
            panel.appendChild(el("h2", { text: "Choose your profile" }));
            var avatars = el("div", { class: "avatars" });
            panel.appendChild(avatars);
            node.appendChild(panel);

            // ---- focus model ----
            var targets = [];       // avatar/add elements + signOut
            var idx = 0;
            var modal = null;       // PIN or Add modal state

            function paint() {
                targets.forEach(function (t, i) { t.classList.toggle("focused", i === idx && !modal); });
            }

            function buildAvatars() {
                STU.dom.clear(avatars);
                targets = [];
                profiles.forEach(function (p) {
                    var av = el("div", { class: "avatar" });
                    var tile = el("div", { class: "tile", style: "background:linear-gradient(135deg," + colorFor(p.id) + "," + shade(colorFor(p.id)) + ")" });
                    tile.textContent = initials(p.name);
                    if (p.pinEnabled) tile.appendChild(el("div", { class: "lock", html: "&#128274;" }));
                    av.appendChild(tile);
                    av.appendChild(el("div", { class: "nm", text: p.name }));
                    av.appendChild(el("div", { class: "ag", text: ageLabel(p.age) }));
                    av.__profile = p;
                    avatars.appendChild(av);
                    targets.push(av);
                });
                // Add tile
                var add = el("div", { class: "avatar" });
                var atile = el("div", { class: "tile add", text: "+" });
                add.appendChild(atile);
                add.appendChild(el("div", { class: "nm", text: "Add" }));
                add.appendChild(el("div", { class: "ag", text: " " }));
                add.__add = true;
                avatars.appendChild(add);
                targets.push(add);

                targets.push(signOut);  // sign out reachable via Up
                idx = 0; paint();
            }

            function ageLabel(age) { return age <= 12 ? "Kids" : (age <= 15 ? "Teen" : "Adult"); }
            function shade(hex) { return hex; }

            // ---- data load ----
            function load() {
                STU.API.fetchProfiles().then(function (list) {
                    profiles = list || [];
                    buildAvatars();
                }).catch(function (err) {
                    // Session no longer valid -> back to sign in.
                    if (err && (err.status === 401 || err.status === 403)) {
                        try { window.localStorage.removeItem("stu_signed_in"); } catch (e) {}
                        if (STU.API && STU.API.clearAccessToken) STU.API.clearAccessToken();
                        ctx.app.session = null;
                        ctx.replace("signin");
                        return;
                    }
                    STU.dom.toast((err && err.message) || "Could not load profiles.", true);
                    profiles = []; buildAvatars();
                });

                var featured = STU.API.fetchContent({ featured: true, limit: 10 }).catch(function () { return []; });
                var trending = STU.API.fetchContent({ limit: 16 }).catch(function () { return []; });
                Promise.all([featured, trending]).then(function (r) {
                    var combined = (r[0] && r[0].length ? r[0] : []).concat(r[1] || []);
                    var seen = {};
                    backdrops = combined.filter(function (it) {
                        if (seen[it.id]) return false; seen[it.id] = 1;
                        return STU.mediaUrl.candidates({ posterUrl: it.posterUrl, backdropUrl: it.backdropUrl, videoUrl: it.videoUrl, preferBackdrop: true }).length > 0;
                    }).slice(0, 8);
                    buildBackdrops();
                });
            }

            function buildBackdrops() {
                STU.dom.clear(slides);
                backdrops.forEach(function (it, i) {
                    var s = el("div", { class: "slide" + (i === 0 ? " on" : "") });
                    STU.components.backdropInto(s, STU.mediaUrl.candidates({
                        posterUrl: it.posterUrl, backdropUrl: it.backdropUrl, videoUrl: it.videoUrl, preferBackdrop: true
                    }), it.title);
                    slides.appendChild(s);
                });
                bIdx = 0; renderFeature();
                if (rotateTimer) clearInterval(rotateTimer);
                if (backdrops.length > 1) rotateTimer = setInterval(rotate, STU.config.profileBackdropRotateMs);
            }
            function rotate() {
                var ch = slides.children;
                if (!ch.length) return;
                ch[bIdx] && ch[bIdx].classList.remove("on");
                bIdx = (bIdx + 1) % ch.length;
                ch[bIdx] && ch[bIdx].classList.add("on");
                renderFeature();
            }
            function renderFeature() {
                var it = backdrops[bIdx];
                if (!it) { ftT.textContent = ""; ftC.textContent = ""; return; }
                ftT.textContent = it.title;
                ftC.textContent = it.category || "";
            }

            // ---- selection ----
            function selectProfile(p) {
                if (p.pinEnabled) { openPin(p); return; }
                activate(p, null);
            }
            function activate(p, pin) {
                if (selecting) return;
                selecting = true;
                STU.API.activateProfile(p.id, pin).then(function (active) {
                    ctx.app.activeProfile = active;
                    if (modal) closeModal();
                    ctx.replace("home");
                }).catch(function (err) {
                    selecting = false;
                    if (err && err.requiresPin) { STU.dom.toast("Incorrect PIN. Try again.", true); if (modal) modal.reset(); return; }
                    STU.dom.toast((err && err.message) || "Could not open profile.", true);
                    if (err && err.paymentRequired && modal) closeModal();
                });
            }

            // ---- PIN modal ----
            function openPin(p) {
                var box = el("div", { class: "pin-box" });
                box.appendChild(el("h3", { text: "Enter PIN for " + p.name }));
                var dots = el("div", { class: "pin-dots" });
                var dotEls = [0, 1, 2, 3].map(function () { var d = el("i"); dots.appendChild(d); return d; });
                box.appendChild(dots);
                var pad = el("div", { class: "numpad" });
                var keys = [];
                ["1","2","3","4","5","6","7","8","9","del","0","ok"].forEach(function (v) {
                    var k = el("div", { class: "numkey", html: v === "del" ? "&#9003;" : (v === "ok" ? "&#10003;" : v) });
                    k.__v = v; pad.appendChild(k); keys.push(k);
                });
                box.appendChild(pad);
                var wrap = el("div", { class: "pin-modal" }, [box]);
                node.appendChild(wrap);
                setTimeout(function () { wrap.classList.add("show"); }, 10);

                var pin = "", mi = 0;
                function paintPad() { keys.forEach(function (k, i) { k.classList.toggle("focused", i === mi); }); }
                function paintDots() { dotEls.forEach(function (d, i) { d.classList.toggle("on", i < pin.length); }); }
                function press(v) {
                    if (v === "del") { pin = pin.slice(0, -1); paintDots(); return; }
                    if (v === "ok") { if (pin.length === 4) activate(p, pin); return; }
                    if (pin.length < 4) { pin += v; paintDots(); if (pin.length === 4) activate(p, pin); }
                }
                mi = 0; paintPad();
                modal = {
                    key: function (name) {
                        if (name === "Back" || name === "Exit") { closeModal(); return; }
                        if (name === "Left") { mi = Math.max(0, mi - 1); paintPad(); }
                        else if (name === "Right") { mi = Math.min(keys.length - 1, mi + 1); paintPad(); }
                        else if (name === "Up") { mi = Math.max(0, mi - 3); paintPad(); }
                        else if (name === "Down") { mi = Math.min(keys.length - 1, mi + 3); paintPad(); }
                        else if (name === "Enter") press(keys[mi].__v);
                        else if (/^[0-9]$/.test(name)) press(name);
                    },
                    reset: function () { pin = ""; paintDots(); },
                    node: wrap
                };
            }

            // ---- Add modal (name via OSK + Adult/Kids) ----
            function openAdd() {
                var name = "", isKid = false;
                var box = el("div", { class: "pin-box", style: "width:900px" });
                box.appendChild(el("h3", { text: "New profile" }));
                var nameField = el("div", { class: "field focused", style: "margin:0 0 20px" }, [
                    el("span", { class: "ico", html: "&#128100;" }),
                    (function () { var v = el("span", { class: "val placeholder", text: "Name" }); nameField_val = v; return v; })()
                ]);
                var nameField_val;
                var typeRow = el("div", { class: "row-links", style: "margin-bottom:24px" });
                var adultBtn = el("div", { class: "link", text: "Adult" });
                var kidBtn = el("div", { class: "link", text: "Kids" });
                typeRow.appendChild(adultBtn); typeRow.appendChild(kidBtn);
                var createBtn = el("div", { class: "btn primary", text: "Create", style: "width:100%" });
                box.appendChild(nameField); box.appendChild(typeRow); box.appendChild(createBtn);
                var wrap = el("div", { class: "modal-backdrop" }, [box]);
                node.appendChild(wrap);
                setTimeout(function () { wrap.classList.add("show"); }, 10);

                // reuse the sign-in style simple keyboard via prompt of chars using number/color? Keep it light:
                // Use a compact inline keyboard.
                var kbRows = ["abcdefghij".split(""), "klmnopqrst".split(""), "uvwxyz -'".split("")];
                var kb = el("div", { class: "osk show", style: "position:static;transform:none;width:auto;margin-top:20px" });
                var keyGrid = [];
                kbRows.forEach(function (row) {
                    var r = el("div", { class: "krow" });
                    var re = [];
                    row.forEach(function (ch) { var k = el("div", { class: "key", text: ch === " " ? "Space" : ch }); k.__char = ch; r.appendChild(k); re.push(k); });
                    kb.appendChild(r); keyGrid.push(re);
                });
                var last = el("div", { class: "krow" });
                var del = el("div", { class: "key", html: "&#9003;" }); del.__act = "del";
                last.appendChild(del); kb.appendChild(last); keyGrid.push([del]);
                box.appendChild(kb);

                function renderName() {
                    if (!name) { nameField_val.className = "val placeholder"; nameField_val.textContent = "Name"; }
                    else { nameField_val.className = "val"; nameField_val.textContent = name; }
                }

                // focus zones: 0 = keyboard grid, 1 = adult, 2 = kid, 3 = create
                var zone = 0, gr = 0, gc = 0, btnIdx = 0;
                var btns = [adultBtn, kidBtn, createBtn];
                function paintAll() {
                    keyGrid.forEach(function (row, r) { row.forEach(function (k, c) { k.classList.toggle("focused", zone === 0 && r === gr && c === gc); }); });
                    btns.forEach(function (b, i) { b.classList.toggle("focused", zone === 1 && i === btnIdx); });
                    adultBtn.style.background = (!isKid ? "var(--accent-soft)" : "");
                    kidBtn.style.background = (isKid ? "var(--accent-soft)" : "");
                }
                function create() {
                    if (!name.trim()) { STU.dom.toast("Enter a name.", true); return; }
                    var now = new Date();
                    var year = now.getUTCFullYear() - (isKid ? 10 : 21);
                    STU.API.createProfile({ name: name.trim(), birthYear: year, birthMonth: 1, birthDay: 1 }).then(function () {
                        closeModal(); load();
                    }).catch(function (err) { STU.dom.toast((err && err.message) || "Could not create profile.", true); });
                }
                renderName(); paintAll();
                modal = {
                    key: function (nm) {
                        if (nm === "Back" || nm === "Exit") { closeModal(); return; }
                        if (zone === 0) {
                            if (nm === "Up") { if (gr === 0) { zone = 1; btnIdx = 0; } else gr--; clamp(); paintAll(); }
                            else if (nm === "Down") { if (gr < keyGrid.length - 1) gr++; else { zone = 1; btnIdx = 2; } clamp(); paintAll(); }
                            else if (nm === "Left") { gc = Math.max(0, gc - 1); paintAll(); }
                            else if (nm === "Right") { gc = Math.min(keyGrid[gr].length - 1, gc + 1); paintAll(); }
                            else if (nm === "Enter") {
                                var k = keyGrid[gr][gc];
                                if (k.__act === "del") name = name.slice(0, -1); else name += k.__char;
                                renderName();
                            }
                        } else {
                            if (nm === "Left") { btnIdx = Math.max(0, btnIdx - 1); paintAll(); }
                            else if (nm === "Right") { btnIdx = Math.min(btns.length - 1, btnIdx + 1); paintAll(); }
                            else if (nm === "Down") { zone = 0; gr = 0; paintAll(); }
                            else if (nm === "Up") { zone = 0; gr = keyGrid.length - 1; clamp(); paintAll(); }
                            else if (nm === "Enter") {
                                if (btns[btnIdx] === adultBtn) { isKid = false; paintAll(); }
                                else if (btns[btnIdx] === kidBtn) { isKid = true; paintAll(); }
                                else create();
                            }
                        }
                    },
                    node: wrap
                };
                function clamp() { if (gc >= keyGrid[gr].length) gc = keyGrid[gr].length - 1; }
            }

            function closeModal() {
                if (!modal) return;
                var n = modal.node; modal = null;
                if (n) { n.classList.remove("show"); setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 250); }
                paint();
            }

            function onKey(name) {
                if (modal) return modal.key(name);
                if (name === "Back" || name === "Exit") { STU.tv.exitApp(); return; }

                var onSignOut = targets[idx] === signOut;
                if (name === "Up") { idx = targets.length - 1; paint(); return; }        // jump to Sign Out
                if (name === "Down") { if (onSignOut) { idx = 0; paint(); } return; }
                if (name === "Left") { if (!onSignOut) { idx = Math.max(0, idx - 1); paint(); } return; }
                if (name === "Right") { if (!onSignOut && idx < targets.length - 2) { idx++; paint(); } return; }
                if (name === "Enter") {
                    var t = targets[idx];
                    if (t === signOut) { doSignOut(); }
                    else if (t.__add) { openAdd(); }
                    else if (t.__profile) { selectProfile(t.__profile); }
                }
            }

            function doSignOut() {
                try { window.localStorage.removeItem("stu_signed_in"); } catch (e) {}
                STU.Auth.signOut().then(function () {
                    ctx.app.session = null; ctx.app.activeProfile = null; ctx.app.subscription = null;
                    ctx.replace("signin");
                });
            }

            load();

            return {
                node: node,
                onKey: onKey,
                initialFocus: function () { paint(); },
                destroy: function () { if (rotateTimer) clearInterval(rotateTimer); }
            };
        }
    };
})();
