/* Sign in — native <input> fields so Samsung's system IME handles typing.
 * A custom OSK previously crashed on Tizen 8–10 while filling credentials
 * (Smart Remote / IME key conflicts, Space/Backspace remapped, no real inputs). */
(function () {
    "use strict";
    var STU = window.STU || (window.STU = {});
    var el = STU.dom.el;
    STU.screens = STU.screens || {};

    STU.screens.signin = {
        render: function (ctx) {
            var showPass = false, busy = false, destroyed = false;

            var node = el("div", { class: "signin" });
            var panel = el("div", { class: "panel" });
            panel.appendChild(el("img", { class: "brand-logo", src: "img/logo.png", alt: "Story Time" }));
            panel.appendChild(el("h1", { text: "Story Time Universe" }));
            panel.appendChild(el("div", { class: "sub", text: "Sign in to watch" }));

            var errEl = el("div", { class: "err" });

            var emailField = makeField("email", "Email", "email");
            var passField = makeField("password", "Password", "current-password");
            var eye = el("div", {
                class: "eye-btn focusable",
                tabindex: "-1",
                text: "Show",
                title: "Show password"
            });
            passField.appendChild(eye);

            var signBtn = el("div", { class: "btn primary focusable", tabindex: "-1", text: "Sign In" });
            var signup = el("div", { class: "link focusable", tabindex: "-1", text: "Sign up on web" });
            var links = el("div", { class: "row-links" }, [signup]);

            panel.appendChild(errEl);
            panel.appendChild(emailField);
            panel.appendChild(passField);
            panel.appendChild(signBtn);
            panel.appendChild(links);
            node.appendChild(panel);

            var emailInput = emailField.querySelector("input");
            var passInput = passField.querySelector("input");
            var formTargets = [emailField, passField, eye, signBtn, signup];
            var formIdx = 0;

            function makeField(type, placeholder, autocomplete) {
                var f = el("div", { class: "field focusable", tabindex: "-1" });
                f.appendChild(el("span", {
                    class: "ico",
                    html: type === "email" ? "&#9993;" : "&#128274;"
                }));
                var input = document.createElement("input");
                input.type = type;
                input.className = "field-input";
                input.placeholder = placeholder;
                input.autocomplete = autocomplete || "off";
                input.spellcheck = false;
                input.setAttribute("autocapitalize", "off");
                input.setAttribute("autocorrect", "off");
                input.setAttribute("inputmode", type === "email" ? "email" : "text");
                /* Keep IME usable on Tizen — do not set readonly. */
                f.appendChild(input);
                f.__input = input;
                f.__kind = type;
                return f;
            }

            function blurInputs() {
                try { if (emailInput) emailInput.blur(); } catch (e) {}
                try { if (passInput) passInput.blur(); } catch (e) {}
            }

            function paintForm() {
                formTargets.forEach(function (t, i) {
                    t.classList.toggle("focused", i === formIdx);
                });
            }

            function focusField(field) {
                blurInputs();
                var input = field && field.__input;
                if (!input) return;
                try {
                    input.focus();
                    /* Move caret to end so reviewers can keep typing. */
                    var len = (input.value || "").length;
                    if (typeof input.setSelectionRange === "function") {
                        input.setSelectionRange(len, len);
                    }
                } catch (e) {}
            }

            function activateTarget(t) {
                if (!t) return;
                if (t === emailField) { focusField(emailField); return; }
                if (t === passField) { focusField(passField); return; }
                if (t === eye) { togglePass(); return; }
                if (t === signBtn) { submit(); return; }
                if (t === signup) {
                    try { STU.tv.openBrowser(STU.config.urls.signup); } catch (e) {}
                }
            }

            function togglePass() {
                showPass = !showPass;
                try {
                    passInput.type = showPass ? "text" : "password";
                } catch (e) {
                    /* Some Tizen builds reject type flips — recreate safely. */
                    showPass = !showPass;
                }
                eye.textContent = showPass ? "Hide" : "Show";
            }

            function readEmail() {
                return String((emailInput && emailInput.value) || "").trim();
            }
            function readPassword() {
                return String((passInput && passInput.value) || "");
            }

            function submit() {
                if (busy || destroyed) return;
                blurInputs();
                var email = readEmail();
                var password = readPassword();
                if (!email || !password) {
                    errEl.textContent = "Enter your email and password.";
                    return;
                }
                busy = true;
                errEl.textContent = "";
                signBtn.textContent = "Signing in\u2026";
                STU.Auth.signIn(email, password).then(function (session) {
                    if (destroyed) return null;
                    ctx.app.session = session;
                    try { window.localStorage.setItem("stu_signed_in", "1"); } catch (e) {}
                    return STU.API.fetchSubscription();
                }).then(function (sub) {
                    if (destroyed) return;
                    ctx.app.subscription = sub;
                    ctx.app.activeProfile = null;
                    ctx.replace("profiles");
                }).catch(function (err) {
                    if (destroyed) return;
                    busy = false;
                    signBtn.textContent = "Sign In";
                    errEl.textContent = (err && err.message) || "Sign-in failed.";
                });
            }

            /* Wire focusable Enter / pointer activation. */
            emailField.__onEnter = function () { formIdx = 0; paintForm(); focusField(emailField); };
            passField.__onEnter = function () { formIdx = 1; paintForm(); focusField(passField); };
            eye.__onEnter = function () { formIdx = 2; paintForm(); togglePass(); };
            signBtn.__onEnter = function () { formIdx = 3; paintForm(); submit(); };
            signup.__onEnter = function () { formIdx = 4; paintForm(); activateTarget(signup); };

            /* Enter inside an input submits / advances without crashing. */
            function onInputKeyDown(e) {
                var code = e.keyCode || e.which;
                if (code === 13) {
                    e.preventDefault();
                    e.stopPropagation();
                    blurInputs();
                    if (e.target === emailInput) {
                        formIdx = 1; paintForm(); focusField(passField);
                    } else {
                        submit();
                    }
                    return;
                }
                if (code === 27 || code === 10009 || code === 8 && !(e.target.value || "").length) {
                    /* Empty-field Back / TV Back leaves the input safely. */
                    if (code !== 8 || !(e.target.value || "").length) {
                        e.preventDefault();
                        blurInputs();
                    }
                }
            }
            emailInput.addEventListener("keydown", onInputKeyDown);
            passInput.addEventListener("keydown", onInputKeyDown);

            emailInput.addEventListener("focus", function () { formIdx = 0; paintForm(); });
            passInput.addEventListener("focus", function () { formIdx = 1; paintForm(); });

            function onKey(name) {
                try {
                    /* While the system IME owns an input, only handle TV chrome keys. */
                    var typing = document.activeElement === emailInput || document.activeElement === passInput;
                    if (typing) {
                        if (name === "Back" || name === "Exit") {
                            blurInputs();
                            paintForm();
                            return;
                        }
                        if (name === "Up") {
                            blurInputs();
                            formIdx = Math.max(0, formIdx - 1);
                            paintForm();
                            return;
                        }
                        if (name === "Down") {
                            blurInputs();
                            formIdx = Math.min(formTargets.length - 1, formIdx + 1);
                            paintForm();
                            return;
                        }
                        if (name === "Enter") {
                            blurInputs();
                            if (formIdx === 0) { formIdx = 1; paintForm(); focusField(passField); }
                            else submit();
                            return;
                        }
                        /* Digits / letters / Space / Backspace: leave to the IME. */
                        return;
                    }

                    if (name === "Back" || name === "Exit") {
                        STU.tv.exitApp();
                        return;
                    }
                    if (name === "Down") {
                        formIdx = Math.min(formTargets.length - 1, formIdx + 1);
                        paintForm();
                        return;
                    }
                    if (name === "Up") {
                        formIdx = Math.max(0, formIdx - 1);
                        paintForm();
                        return;
                    }
                    if (name === "Left" || name === "Right") {
                        if (formTargets[formIdx] === passField || formTargets[formIdx] === eye) {
                            formIdx = formTargets[formIdx] === eye ? 1 : 2;
                            paintForm();
                        }
                        return;
                    }
                    if (name === "Yellow") { togglePass(); return; }
                    if (name === "Enter") activateTarget(formTargets[formIdx]);
                } catch (err) {
                    try { errEl.textContent = "Input error — try again."; } catch (e2) {}
                }
            }

            paintForm();

            return {
                node: node,
                onKey: onKey,
                initialFocus: function () {
                    formIdx = 0;
                    paintForm();
                    /* Do not auto-open IME on mount — reviewers open it with OK. */
                },
                destroy: function () {
                    destroyed = true;
                    blurInputs();
                }
            };
        }
    };
})();
