/* Sign in — NextAuth credentials-viewer, with an on-screen keyboard (pointer-free). */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var el = STU.dom.el, toast = STU.dom.toast;
    STU.screens = STU.screens || {};

    var KB_ROWS = [
        "1234567890".split(""),
        "qwertyuiop".split(""),
        "asdfghjkl".split(""),
        "zxcvbnm@._-".split("")
    ];

    STU.screens.signin = {
        render: function (ctx) {
            var email = "", password = "", showPass = false, busy = false;

            var node = el("div", { class: "signin" });
            var panel = el("div", { class: "panel" });
            panel.appendChild(el("img", { class: "brand-logo", src: "img/logo.png", alt: "Story Time" }));
            panel.appendChild(el("h1", { text: "Story Time Universe" }));
            panel.appendChild(el("div", { class: "sub", text: "Sign in to watch" }));

            var errEl = el("div", { class: "err" });

            var emailField = field("\u2709", "email");
            var passField = field("\u26bf", "password");
            var eye = el("span", { class: "eye", html: "&#128065;" });
            passField.appendChild(eye);

            var signBtn = el("div", { class: "btn primary", text: "Sign In" });
            var signup = el("div", { class: "link", text: "Sign up on web" });
            var links = el("div", { class: "row-links" }, [signup]);

            panel.appendChild(errEl);
            panel.appendChild(emailField);
            panel.appendChild(passField);
            panel.appendChild(signBtn);
            panel.appendChild(links);
            node.appendChild(panel);

            // On-screen keyboard
            var osk = el("div", { class: "osk" });
            var keyEls = [];   // rows of elements
            KB_ROWS.forEach(function (row) {
                var r = el("div", { class: "krow" });
                var rowEls = [];
                row.forEach(function (ch) {
                    var k = el("div", { class: "key", text: ch });
                    k.__char = ch;
                    r.appendChild(k); rowEls.push(k);
                });
                osk.appendChild(r); keyEls.push(rowEls);
            });
            var lastRow = el("div", { class: "krow" });
            var spaceKey = el("div", { class: "key wide", text: "Space" }); spaceKey.__char = " ";
            var delKey = el("div", { class: "key", html: "&#9003; Del" }); delKey.__act = "del";
            var doneKey = el("div", { class: "key wide", text: "Done" }); doneKey.__act = "done";
            lastRow.appendChild(spaceKey); lastRow.appendChild(delKey); lastRow.appendChild(doneKey);
            osk.appendChild(lastRow);
            keyEls.push([spaceKey, delKey, doneKey]);
            node.appendChild(osk);

            function field(icon, kind) {
                var f = el("div", { class: "field" });
                f.appendChild(el("span", { class: "ico", html: kind === "email" ? "&#9993;" : "&#128274;" }));
                var val = el("span", { class: "val placeholder", text: kind === "email" ? "Email" : "Password" });
                f.appendChild(val);
                f.__val = val; f.__kind = kind;
                return f;
            }

            function renderField(f) {
                var isEmail = f.__kind === "email";
                var text = isEmail ? email : password;
                var display = isEmail ? text : text.replace(/./g, showPass ? "" : "\u2022");
                if (!showPass && !isEmail) display = text.replace(/./g, "\u2022");
                if (showPass && !isEmail) display = text;
                if (!text) {
                    f.__val.className = "val placeholder";
                    f.__val.textContent = isEmail ? "Email" : "Password";
                } else {
                    f.__val.className = "val";
                    f.__val.textContent = display;
                }
            }

            // ---- focus model ----
            var mode = "form";
            var formTargets = [emailField, passField, signBtn, signup];
            var formIdx = 0;
            var oskR = 0, oskC = 0;
            var activeFieldKind = "email";

            function paintForm() {
                formTargets.forEach(function (t, i) {
                    t.classList.toggle("focused", i === formIdx && mode === "form");
                });
            }
            function paintOsk() {
                keyEls.forEach(function (row, r) {
                    row.forEach(function (k, c) {
                        k.classList.toggle("focused", mode === "osk" && r === oskR && c === oskC);
                    });
                });
            }

            function openOsk(kind) {
                activeFieldKind = kind;
                mode = "osk"; oskR = 1; oskC = 0;
                osk.classList.add("show");
                paintForm(); paintOsk();
            }
            function closeOsk() {
                mode = "form";
                osk.classList.remove("show");
                paintOsk(); paintForm();
            }

            function typeChar(ch) {
                if (activeFieldKind === "email") email += ch; else password += ch;
                renderField(activeFieldKind === "email" ? emailField : passField);
            }
            function backspace() {
                if (activeFieldKind === "email") email = email.slice(0, -1);
                else password = password.slice(0, -1);
                renderField(activeFieldKind === "email" ? emailField : passField);
            }

            function submit() {
                if (busy) return;
                if (!email || !password) { errEl.textContent = "Enter your email and password."; return; }
                busy = true; errEl.textContent = ""; signBtn.textContent = "Signing in\u2026";
                STU.Auth.signIn(email, password).then(function (session) {
                    ctx.app.session = session;
                    try { window.localStorage.setItem("stu_signed_in", "1"); } catch (e) {}
                    return STU.API.fetchSubscription();
                }).then(function (sub) {
                    ctx.app.subscription = sub;
                    ctx.app.activeProfile = null;
                    ctx.replace("profiles");
                }).catch(function (err) {
                    busy = false; signBtn.textContent = "Sign In";
                    errEl.textContent = (err && err.message) || "Sign-in failed.";
                });
            }

            function onKey(name) {
                if (mode === "osk") return oskKey(name);
                // form mode
                if (name === "Back" || name === "Exit") { STU.tv.exitApp(); return; }
                if (name === "Down") { formIdx = Math.min(formTargets.length - 1, formIdx + 1); paintForm(); return; }
                if (name === "Up") { formIdx = Math.max(0, formIdx - 1); paintForm(); return; }
                if (name === "Yellow") { showPass = !showPass; renderField(passField); return; }
                if (name === "Right" && formTargets[formIdx] === passField) { showPass = !showPass; renderField(passField); return; }
                if (name === "Enter") {
                    var t = formTargets[formIdx];
                    if (t === emailField) openOsk("email");
                    else if (t === passField) openOsk("password");
                    else if (t === signBtn) submit();
                    else if (t === signup) STU.tv.openBrowser(STU.config.urls.signup);
                }
            }

            function oskKey(name) {
                if (name === "Back" || name === "Exit") { closeOsk(); return; }
                if (name === "Up") { oskR = Math.max(0, oskR - 1); clampCol(); paintOsk(); return; }
                if (name === "Down") { oskR = Math.min(keyEls.length - 1, oskR + 1); clampCol(); paintOsk(); return; }
                if (name === "Left") { oskC = Math.max(0, oskC - 1); paintOsk(); return; }
                if (name === "Right") { oskC = Math.min(keyEls[oskR].length - 1, oskC + 1); paintOsk(); return; }
                if (name === "Yellow") { showPass = !showPass; renderField(passField); return; }
                if (name === "Enter") {
                    var k = keyEls[oskR][oskC];
                    if (k.__act === "done") { closeOsk(); return; }
                    if (k.__act === "del") { backspace(); return; }
                    if (k.__char != null) typeChar(k.__char);
                }
            }
            function clampCol() { if (oskC >= keyEls[oskR].length) oskC = keyEls[oskR].length - 1; }

            renderField(emailField); renderField(passField);
            paintForm();

            return {
                node: node,
                onKey: onKey,
                initialFocus: function () { formIdx = 0; paintForm(); },
                destroy: function () {}
            };
        }
    };
})();
