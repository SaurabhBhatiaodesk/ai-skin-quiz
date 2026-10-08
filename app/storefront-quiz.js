import { createFaceScan } from "./face-scan.js";
(function () {
  var PROXY = "/apps/dosha-quiz";

  function init(root) {
    if (root.getAttribute("data-ready") === "1") return;
    root.setAttribute("data-ready", "1");

    var quiz = null;
    var deepStep = 0;
    var deepAnswers = {};
    var quickAnswers = {};
    var quickStep = 0;
    var modalKey = "tridoshic";
    var doshaKey = "balanced";
    var source = "Quick Quiz";
    var cameraStream = null;
    var faceScan = null;
    var cameraGeneration = 0;
    var scanCapturing = false;
    var cameraOpening = false;
    var scanMode = "camera";
    var captured = null;
    var scanPhoto = null;
    var reportId = null;
    var reportLocked = false;
    var submitting = false;
    var lastFocus = null;

    function q(sel) { return root.querySelector(sel); }

    function go(name, fromUser) {
      if (quiz && quiz.layout === "single" && (name === "entry" || name === "deep" || name === "scanner")) name = quiz.singleFlow || "quick";
      if (quiz && quiz.layout === "scan" && (name === "entry" || name === "deep" || name === "quick")) name = "scanner";
      if (name === "scanner" && quiz && quiz.scanReady !== true) return;
      var screens = root.querySelectorAll(".screen");
      for (var i = 0; i < screens.length; i++) screens[i].classList.remove("active");
      var target = q('[data-screen="' + name + '"]');
      if (target) target.classList.add("active");
      if (name !== "scanner") stopCamera();
      if (name === "scanner") showScanStep(1);
      if (name === "quick") resetQuick();
      if (name === "deep") resetDeep();
      // Only move the page when the shopper navigates, never on load (blocks may sit below the fold).
      if (fromUser && target) {
        var rect = root.getBoundingClientRect();
        if (rect.top < 0 || rect.top > window.innerHeight * 0.5) root.scrollIntoView({ block: "start" });
        var heading = target.querySelector(".hdr-title, .rh-dosha");
        if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
      }
    }

    var quizCode = (root.getAttribute("data-quiz-code") || "").replace(/^\[dosha-quiz:([^\]]+)\]$/i, "$1").trim();

    function loadQuiz() {

      if (quiz) return Promise.resolve(quiz);
      return fetch(PROXY + "/quiz?code=" + encodeURIComponent(quizCode) + "&layout=" + encodeURIComponent(root.getAttribute("data-block-layout") || ""), { headers: { Accept: "application/json" } })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (body) { if (!res.ok || !body) throw new Error((body && body.error) || "Could not load quiz."); return body; }); })
        .then(function (data) { quiz = data; if (data.handle) quizCode = data.handle; return quiz; });
    }

    function showError(message, path) {
      var screen = q('[data-screen="' + (path === "scan" ? "scanner" : path || "quick") + '"]') || q(".screen.active");
      var area = path === "scan" ? q("[data-scan-status]") : screen && screen.querySelector("[data-quiz-error]");
      if (area) area.textContent = message;
    }

    function clearErrors() {
      var areas = root.querySelectorAll("[data-quiz-error]");
      for (var i = 0; i < areas.length; i++) areas[i].textContent = "";
    }

    function paintResult(data) {
      var result = data.result || data;
      var profile = result.profile;
      reportId = result.reportId || null;
      reportLocked = Boolean(result.locked);
      if (!profile) { showError("Could not show your result. Please try again.", source === "Deep Dosha" ? "deep" : "quick"); return; }
      doshaKey = result.dosha || doshaKey;
      source = result.source || source;
      modalKey = profile.modal || "tridoshic";
      var hero = q("[data-hero]");
      if (hero) hero.className = "result-hero " + profile.heroClass;
      q("[data-dosha-name]").textContent = profile.name;
      q("[data-dosha-sub]").textContent = profile.sub;
      q("[data-dosha-essence]").textContent = profile.essence;
      q("[data-dosha-source]").textContent = (source === "AI Skin Scan" ? "Scan Complete | " : "via ") + source;
      q("[data-insight]").innerHTML = safeHtml(result.insight || profile.insight);
      var oldMap = q("[data-face-map]");
      if (oldMap) oldMap.remove();
      if (source === "AI Skin Scan" && scanPhoto) {
        var map = document.createElement("figure"); map.setAttribute("data-face-map", "");
        map.style.cssText = "margin:20px 0;text-align:left";
        var photoBox = document.createElement("div"); photoBox.style.cssText = "position:relative;max-width:420px;margin:auto;line-height:0";
        var photo = document.createElement("img"); photo.src = scanPhoto; photo.alt = "Your captured photo with approximate cosmetic observation markers";
        photo.style.cssText = "width:100%;height:auto;display:block;border-radius:16px"; photoBox.appendChild(photo);
        var legend = document.createElement("figcaption"); legend.style.cssText = "line-height:1.6;margin-top:12px";
        var note = document.createElement("p"); note.textContent = "Approximate areas observed in your photo. Cosmetic estimates, not a diagnosis. Your photo stays in this browser result and is not saved in the report."; legend.appendChild(note);
        (result.scanAreas || []).forEach(function(area, index) {
          if (!Number.isFinite(area.x) || !Number.isFinite(area.y) || area.x < 0 || area.x > 1 || area.y < 0 || area.y > 1) return;
          var pin = document.createElement("span"); pin.textContent = String(index + 1); pin.title = area.area + ": " + area.observation;
          pin.style.cssText = "position:absolute;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:50%;background:#fff;color:#222;border:2px solid currentColor;display:grid;place-items:center;line-height:1;font:700 15px sans-serif;box-shadow:0 0 0 6px #ffffff40;left:" + (area.x*100) + "%;top:" + (area.y*100) + "%";
          photoBox.appendChild(pin);
          var row = document.createElement("p"); row.textContent = (index+1) + ". " + area.area + " ? " + area.observation; legend.appendChild(row);
        });
        map.appendChild(photoBox); map.appendChild(legend); q("[data-insight]").before(map);
      }
      if (source !== "AI Skin Scan") scanPhoto = null;
      var learn = q("[data-open-modal]");
      if (learn) learn.textContent = "Explore your full " + profile.name + " guide →";
      var markers = q("[data-markers]");
      var grid = q("[data-marker-grid]");
      if (markers && grid) {
        grid.textContent = "";
        if (result.markers) {
          markers.style.display = "block";
          Object.keys(result.markers).forEach(function (key) {
            var marker = result.markers[key];
            var level = marker.score > 70 ? "high" : marker.score > 40 ? "mid" : "low";
            var item = document.createElement("div");
            item.className = "marker-item";
            item.innerHTML = '<div class="marker-bar"><div class="marker-fill ' + level + '" style="width:' + marker.score + '%"></div></div>';
            var val = document.createElement("div");
            val.className = "marker-val";
            val.textContent = marker.label;
            var label = document.createElement("div");
            label.className = "marker-name";
            label.textContent = key;
            item.appendChild(val);
            item.appendChild(label);
            grid.appendChild(item);
          });
        } else markers.style.display = "none";
      }
      var activeGuide = q('[data-modal="' + modalKey + '"]');
      if (activeGuide && !reportLocked) {
        var guideTitle = activeGuide.querySelector(".modal-dosha-name");
        var guideSub = activeGuide.querySelector(".modal-tagline");
        var guideBody = activeGuide.querySelector(".modal-body");
        if (guideTitle) guideTitle.textContent = profile.name;
        if (guideSub) guideSub.textContent = profile.sub;
        if (guideBody) guideBody.innerHTML = safeHtml(result.insight || profile.insight);
        var extraSections = activeGuide.querySelectorAll(".modal-section");
        for (var sectionIndex = 1; sectionIndex < extraSections.length; sectionIndex++) extraSections[sectionIndex].style.display = "none";
      }
      var guideButton = q("[data-open-modal]");
      if (guideButton) guideButton.style.display = reportLocked ? "none" : "";
      var emailBox = q(".email-box");
      if (emailBox) {
        emailBox.querySelector(".eb-title").textContent = reportLocked ? "Unlock your full Prakriti analysis" : "Email your ritual guide";
        emailBox.querySelector(".eb-sub").textContent = reportLocked ? "Enter your email to view the detailed guide and recommended ritual." : "Optional: link this result to your email.";
      }
      var breakdown = q("[data-percentage-breakdown]");
      if (!breakdown) { breakdown = document.createElement("div"); breakdown.setAttribute("data-percentage-breakdown", ""); q("[data-dosha-source]").parentNode.appendChild(breakdown); }
      breakdown.className = "dosha-breakdown";
      breakdown.innerHTML = result.percentages ? Object.keys(result.percentages).map(function (key) {
        var value = Math.max(0, Math.min(100, Number(result.percentages[key]) || 0));
        return '<div class="db-row"><span class="db-name">' + esc(key) + '</span><span class="db-bar" role="img" aria-label="' + esc(key) + " " + value + '%"><span class="db-fill" style="width:' + value + '%"></span></span><span class="db-val">' + value + "%</span></div>";
      }).join("") : "";
      var nudge = q("[data-upgrade]");
      if (nudge) nudge.style.display = result.showUpgrade && (!quiz.enabledPaths || quiz.enabledPaths.indexOf("deep") !== -1) ? "block" : "none";
      var email = q("[data-email]");
      if (email) { email.disabled = false; email.value = ""; }
      var confirm = q("[data-email-confirm]");
      if (confirm) confirm.classList.remove("show");
      var box = q("[data-products]");
      if (box) {
        box.innerHTML = (result.products || []).map(function (product) {
          var img = product.image ? '<img src="' + esc(product.image) + '" alt="" loading="lazy">' : '<span class="no-img" aria-hidden="true">âœ¦</span>';
          var href = "/products/" + encodeURIComponent(product.handle || "") + (product.variantId ? "?variant=" + encodeURIComponent(String(product.variantId).split("/").pop()) : "");
          return '<div class="product-card"><div class="pc-img">' + img + '</div><div class="pc-body"><div class="pc-name">' + esc(product.title) + "</div>" + (product.why ? '<div class="pc-why">' + esc(product.why) + "</div>" : "") + '<div class="pc-bottom"><span class="pc-price">' + esc(product.price) + '</span><a class="btn-shop" href="' + esc(href) + '" aria-label="Shop ' + esc(product.title) + '">Shop Now →</a></div></div></div>';
        }).join("");
        if (!result.products || !result.products.length) box.textContent = "No matching products are available for this result yet.";
      }
      var resultScreen = q('[data-screen="result"]');
      if (!resultScreen || !resultScreen.classList.contains("active")) go("result", true);
    }

    function setSubmitting(state) {
      submitting = state;
      var buttons = root.querySelectorAll("[data-quick-next], [data-deep-next]");
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].setAttribute("aria-busy", state ? "true" : "false");
        buttons[i].classList.toggle("busy", state);
      }
    }

    var pendingEmailPayload = null;
    function submitWithEmail(payload) {
      if (!quiz.emailCapture || !quiz.emailCapture.enabled) return submit(payload);
      pendingEmailPayload = payload;
      var screen = q('[data-screen="email-capture"]');
      if (!screen) {
        screen = document.createElement("div"); screen.className = "screen"; screen.setAttribute("data-screen", "email-capture");
        root.appendChild(screen);
      }
      screen.innerHTML = '<div class="q-step active"><h2>' + esc(quiz.emailCapture.heading) + '</h2><input type="email" data-capture-email placeholder="your@email.com" aria-label="Email address" autocomplete="email" style="width:100%;padding:14px;margin:16px 0"><button type="button" class="btn-entry" data-capture-submit>' + esc(quiz.emailCapture.button) + '</button>' + (quiz.emailCapture.allowSkip ? '<button type="button" data-capture-skip>Skip</button>' : '') + '<p data-capture-error role="alert"></p></div>';
      go("email-capture", true);
    }
    root.addEventListener("click", function(event) {
      if (event.target.closest("[data-capture-skip]")) { if (!submitting && pendingEmailPayload) submit(pendingEmailPayload); return; }
      if (!event.target.closest("[data-capture-submit]") || submitting || !pendingEmailPayload) return;
      var input = q("[data-capture-email]");
      if (!input.value.trim() || !input.checkValidity()) { q("[data-capture-error]").textContent = "Enter a valid email address."; return; }
      submit(Object.assign({}, pendingEmailPayload, {email: input.value.trim()}));
    });

    function submit(payload) {
      if (submitting) return Promise.resolve();
      setSubmitting(true);
      clearErrors();
      payload.code = quizCode;
      var controller = new AbortController();
      var requestTimer = setTimeout(function () { controller.abort(); }, payload.path === "scan" ? 40000 : 20000);
      return fetch(PROXY + "/result", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) { if (!res.ok) throw new Error(body.error || "Quiz service unavailable. Please try again."); if (!body.result) throw new Error(body.error || "The server returned no result. Please try again."); return body; });
      }).then(function (data) {
        if (payload.path === "scan") q("[data-scan-status]").textContent = "Scan Complete";
        paintResult(data);
      }).catch(function (error) {
        if (error.name === "AbortError") error = new Error("Analysis took too long. Check your connection and try again with a smaller photo.");
        var captureError = q('[data-screen="email-capture"].active [data-capture-error]');
        if (captureError) captureError.textContent = error.message;
        var status = q("[data-scan-status]");
        if (payload.path === "scan" && status) { status.textContent = error.message; showError(error.message || "Skin analysis failed. Please try again.", "scan"); }
        else showError(error.message || "Something went wrong. Please try again.", payload.path);
      }).finally(function () { clearTimeout(requestTimer); setSubmitting(false); });
    }

    function esc(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
        return ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : "&#39;";
      });
    }

    // Result copy may use simple emphasis; every other tag is shown as text.
    function safeHtml(value) {
      return esc(value).replace(/&lt;(\/?)(em|strong|b|i|br|p)\s*\/?&gt;/gi, "<$1$2>");
    }

    function optHtml(options, selected, attr) {
      var html = "";
      for (var i = 0; i < options.length; i++) {
        var focusable = selected === i || (selected === undefined && i === 0);
        html += '<div class="q-opt' + (selected === i ? " selected" : "") + '" role="radio" aria-checked="' + (selected === i) + '" tabindex="' + (focusable ? 0 : -1) + '" ' + attr + '="' + i + '"><div class="q-opt-dot" aria-hidden="true"></div><div class="q-opt-text"><div class="q-opt-main">' + esc(options[i].label) + "</div>" + (options[i].hint ? '<div class="q-opt-hint">' + esc(options[i].hint) + "</div>" : "") + "</div></div>";
      }
      return html;
    }

    function questionHtml(question, selected, attr, id) {
      return '<div class="q-step active">' + (question.image ? '<img class="q-image" src="' + esc(question.image) + '" alt="" loading="lazy">' : "") + '<div class="q-text" id="' + id + '">' + esc(question.text) + "</div>" + (question.sub ? '<div class="q-sub">' + esc(question.sub) + "</div>" : "") + '<div class="q-options" role="radiogroup" aria-labelledby="' + id + '">' + optHtml(question.options, selected, attr) + "</div></div>";
    }

    function markSelected(option, attr) {
      var all = root.querySelectorAll("[" + attr + "]");
      for (var i = 0; i < all.length; i++) {
        var on = all[i] === option;
        all[i].classList.toggle("selected", on);
        all[i].setAttribute("aria-checked", on ? "true" : "false");
        all[i].setAttribute("tabindex", on ? "0" : "-1");
      }
    }

    function setNext(button, ready, label) {
      if (!button) return;
      button.classList.toggle("ready", ready);
      button.setAttribute("aria-disabled", ready ? "false" : "true");
      if (label) button.textContent = label + " →";
    }

    function setProgress(fill, step, total) {
      if (!fill) return;
      fill.style.width = Math.round((step / total) * 100) + "%";
      var bar = fill.parentNode;
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", String(total));
      bar.setAttribute("aria-valuenow", String(step));
      bar.setAttribute("aria-label", "Question " + step + " of " + total);
    }

    function resetQuick() {
      quickStep = 0;
      quickAnswers = {};
      loadQuiz().then(renderQuick).catch(function () {
        var area = q("[data-quick-area]");
        if (area) area.textContent = "Could not load the quiz. Refresh this page.";
      });
    }

    function renderQuick() {
      var area = q("[data-quick-area]");
      if (!quiz || !area || !quiz.quick || !quiz.quick.length) {
        if (area) area.textContent = "Loading your quiz…";
        return;
      }
      var question = quiz.quick[quickStep];
      var total = quiz.quick.length;
      setProgress(q("[data-quick-fill]"), quickStep + 1, total);
      if (q("[data-quick-count]")) q("[data-quick-count]").textContent = (quickStep + 1) + " of " + total;
      if (q("[data-quick-phase]")) q("[data-quick-phase]").textContent = question.phase || "";
      area.innerHTML = questionHtml(question, quickAnswers[quickStep], "data-quick-opt", root.id + "-quick-q");
      setNext(q("[data-quick-next]"), quickAnswers[quickStep] !== undefined, question.continueLabel || (quickStep === total - 1 ? "See my result" : "Continue"));
      var back = q("[data-quick-back]");
      if (back) back.style.visibility = quickStep === 0 ? "hidden" : "visible";
    }

    function renderDeep() {
      var area = q("[data-deep-area]");
      if (!quiz || !area) {
        if (area) area.textContent = "Loading your reading…";
        return;
      }
      var question = quiz.deep[deepStep];
      if (!question) { area.textContent = "This quiz has no questions yet."; return; }
      setProgress(q("[data-deep-fill]"), deepStep + 1, quiz.deep.length);
      if (q("[data-deep-count]")) q("[data-deep-count]").textContent = (deepStep + 1) + " of " + quiz.deep.length;
      if (q("[data-deep-phase]")) q("[data-deep-phase]").textContent = question.phase;
      var pills = root.querySelectorAll("[data-layer]");
      for (var i = 0; i < pills.length; i++) pills[i].classList.toggle("active", String(question.layer) === pills[i].getAttribute("data-layer"));
      area.innerHTML = questionHtml(question, deepAnswers[deepStep], "data-deep-opt", root.id + "-deep-q");
      setNext(q("[data-deep-next]"), deepAnswers[deepStep] !== undefined, question.continueLabel || (deepStep === quiz.deep.length - 1 ? "See my result" : "Continue"));
      var back = q("[data-deep-back]");
      if (back) back.style.visibility = deepStep === 0 ? "hidden" : "visible";
    }

    function resetDeep() {
      deepStep = 0;
      deepAnswers = {};
      loadQuiz().then(renderDeep).catch(function () {
        var area = q("[data-deep-area]");
        if (area) area.textContent = "Could not load the quiz. Refresh this page.";
      });
    }

    function showScanStep(step) {
      root.querySelectorAll("[data-scan-step]").forEach(function (section) { section.hidden = section.getAttribute("data-scan-step") !== String(step); });
      root.querySelectorAll("[data-scan-step-label]").forEach(function (label) {
        if (label.getAttribute("data-scan-step-label") === String(step)) label.setAttribute("aria-current", "step");
        else label.removeAttribute("aria-current");
      });
      if (step === 2) selectMode(scanMode); else stopCamera();
    }

    function consentGiven() {
      var bio = q("[data-consent='biometric']");
      var age = q("[data-consent='age']");
      return Boolean(bio && bio.checked && age && age.checked);
    }

    // The camera turns on only after the shopper accepts the required consents.
    function selectMode(mode) {
      if (quiz && quiz.scanner) {
        if (mode === "camera" && !quiz.scanner.camera) mode = "upload";
        if (mode === "upload" && !quiz.scanner.upload) mode = "camera";
      }
      scanMode = mode;
      var cam = q("[data-mode='camera']");
      var up = q("[data-mode='upload']");
      if (cam) cam.classList.toggle("active", mode === "camera");
      if (up) up.classList.toggle("active", mode === "upload");
      var zone = q("[data-camera-zone]");
      var upload = q("[data-upload-zone]");
      if (zone) zone.classList.toggle("active", mode === "camera");
      if (upload) upload.classList.toggle("hidden", mode !== "upload");
      var status = q("[data-scan-status]");
      if (status) status.textContent = mode === "camera" ? "Position your face in the frame and hold still" : "Upload a clear selfie in good lighting";
      if (mode === "camera" && consentGiven()) startCamera();
      else if (mode === "camera" && status) status.textContent = "Accept the consents below to turn on the camera";
      if (mode !== "camera") stopCamera();
    }

    function startCamera() {
      if (cameraStream) {
        var currentFeed = q("[data-camera-feed]");
        if (currentFeed) currentFeed.play().catch(function () { q("[data-scan-status]").textContent = "Camera playback is blocked. Allow camera access or use Upload Photo."; });
        return;
      }
      if (cameraOpening) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { q("[data-scan-status]").textContent = "Camera is unavailable. Use a secure browser connection or upload a photo."; return; }
      cameraOpening = true;
      var generation = ++cameraGeneration;
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false }).then(function (stream) {
        if (generation !== cameraGeneration) { stream.getTracks().forEach(function (track) { track.stop(); }); return; }
        cameraOpening = false;
        cameraStream = stream;
        var feed = q("[data-camera-feed]");
        if (feed) {
          feed.srcObject = stream;
          feed.play().catch(function () { if (generation === cameraGeneration) q("[data-scan-status]").textContent = "Tap Live Camera to resume playback."; });
          q("[data-scan-status]").textContent = "Loading face tracking...";
          createFaceScan(feed, q("[data-camera-zone]"), function (text) { q("[data-scan-status]").textContent = text; }).then(function (tracker) {
            if (generation !== cameraGeneration) { tracker.close(); return; }
            faceScan = tracker;
          }).catch(function () { if (generation === cameraGeneration) { stopCamera(); q("[data-scan-status]").textContent = "Face tracking could not load. Check your connection, retry the camera, or upload a photo."; } });
        }
      }).catch(function () {
        if (generation !== cameraGeneration) return;
        cameraOpening = false;
        var status = q("[data-scan-status]");
        if (status) status.textContent = "Camera access denied — please use Upload instead";
        scanMode = "upload";
        var zone = q("[data-camera-zone]");
        var upload = q("[data-upload-zone]");
        if (zone) zone.classList.remove("active");
        if (upload) upload.classList.remove("hidden");
        var cam = q("[data-mode='camera']");
        var up = q("[data-mode='upload']");
        if (cam) cam.classList.remove("active");
        if (up) up.classList.add("active");
      });
    }

    function stopCamera() {
      cameraGeneration++; cameraOpening = false;
      if (faceScan) { faceScan.close(); faceScan = null; }
      if (cameraStream) {
        cameraStream.getTracks().forEach(function (track) { track.stop(); });
        cameraStream = null;
      }
    }

    root.addEventListener("click", function (event) {
      var origin = event.target.closest ? event.target : null;
      if (!origin) return;
      var goto = origin.closest("[data-goto]");
      if (goto) { go(goto.getAttribute("data-goto"), true); return; }
      if (origin.closest("[data-scan-continue]")) {
        var consentError = q("[data-consent-error]");
        if (!consentGiven()) { if (consentError) consentError.classList.add("show"); return; }
        if (consentError) consentError.classList.remove("show");
        showScanStep(2);
        var photoHeading = q('[data-scan-step="2"] .scan-step-title');
        if (photoHeading) { photoHeading.setAttribute("tabindex", "-1"); photoHeading.focus(); }
        return;
      }
      if (origin.closest("[data-scan-back]")) { showScanStep(1); return; }
      var mode = origin.closest("[data-mode]");
      if (mode) { selectMode(mode.getAttribute("data-mode")); return; }
      if (origin.closest("[data-upload-zone]")) { var file = q("[data-file]"); if (file) file.click(); return; }
      if (origin.closest("[data-scan]")) { runScan(); return; }
      var quickOpt = origin.closest("[data-quick-opt]");
      if (quickOpt) {
        quickAnswers[quickStep] = parseInt(quickOpt.getAttribute("data-quick-opt"), 10);
        markSelected(quickOpt, "data-quick-opt");
        setNext(q("[data-quick-next]"), true);
        return;
      }
      if (origin.closest("[data-quick-back]")) {
        if (quickStep === 0) return;
        quickStep--;
        renderQuick();
        return;
      }
      if (origin.closest("[data-quick-next]")) {
        if (quickAnswers[quickStep] === undefined || !quiz || submitting) return;
        clearErrors();
        if (quickStep < quiz.quick.length - 1) {
          quickStep++;
          renderQuick();
        } else {
          submitWithEmail({ path: "quick", answers: quickAnswers });
        }
        return;
      }
      var deepOpt = origin.closest("[data-deep-opt]");
      if (deepOpt) {
        deepAnswers[deepStep] = parseInt(deepOpt.getAttribute("data-deep-opt"), 10);
        markSelected(deepOpt, "data-deep-opt");
        setNext(q("[data-deep-next]"), true);
        return;
      }
      if (origin.closest("[data-deep-back]")) {
        if (deepStep === 0) { go("entry", true); return; }
        deepStep--;
        renderDeep();
        return;
      }
      if (origin.closest("[data-deep-next]")) {
        if (deepAnswers[deepStep] === undefined || !quiz || submitting) return;
        clearErrors();
        if (deepStep < quiz.deep.length - 1) { deepStep++; renderDeep(); }
        else {
          var answers = [];
          for (var n = 0; n < quiz.deep.length; n++) answers.push(deepAnswers[n]);
          submitWithEmail({ path: "deep", answers: answers });
        }
        return;
      }
      if (origin.closest("[data-open-modal]")) {
        if (reportLocked) return;
        openModal(q('[data-modal="' + modalKey + '"]'), origin.closest("[data-open-modal]"));
        return;
      }
      if (origin.closest("[data-close-modal]") || origin.classList.contains("modal-overlay")) {
        closeModals();
        return;
      }
      if (origin.closest("[data-save-email]")) saveEmail();
    });

    function openModal(modal, trigger) {
      if (!modal) return;
      lastFocus = trigger || document.activeElement;
      modal.classList.add("active");
      var close = modal.querySelector("[data-close-modal]");
      if (close) close.focus();
    }

    function closeModals() {
      var modals = root.querySelectorAll(".modal-overlay.active");
      if (!modals.length) return;
      for (var m = 0; m < modals.length; m++) modals[m].classList.remove("active");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      lastFocus = null;
    }

    // Keyboard support: Enter/Space activate cards and answers, arrows move between answers, Escape closes the guide.
    root.addEventListener("keydown", function (event) {
      var key = event.key;
      if (key === "Escape") { closeModals(); return; }
      var target = event.target;
      if (!target || !target.closest) return;
      var activeModal = target.closest(".modal-overlay.active");
      if (key === "Tab" && activeModal) {
        var focusables = activeModal.querySelectorAll("button, a[href], [tabindex='0']");
        if (focusables.length) {
          var first = focusables[0];
          var last = focusables[focusables.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        return;
      }
      var option = target.closest("[role='radio']");
      if (option && (key === "ArrowDown" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowLeft")) {
        event.preventDefault();
        var group = option.parentNode.querySelectorAll("[role='radio']");
        var at = Array.prototype.indexOf.call(group, option);
        var nextOption = group[(at + (key === "ArrowDown" || key === "ArrowRight" ? 1 : group.length - 1)) % group.length];
        nextOption.focus();
        nextOption.click();
        return;
      }
      if ((key === "Enter" || key === " ") && (option || (target.matches && target.matches(".entry-card")))) {
        event.preventDefault();
        target.click();
      }
    });

    function runScan() {
      if (submitting) return;
      var bio = q("[data-consent='biometric']");
      var age = q("[data-consent='age']");
      var err = q("[data-consent-error]");
      if (!bio || !age || !bio.checked || !age.checked) {
        if (err) { err.classList.add("show"); err.textContent = "Please accept the required consents before scanning."; }
        return;
      }
      if (err) err.classList.remove("show");
      if (scanCapturing) return;
      if (scanMode === "camera") {
        if (!faceScan) { q("[data-scan-status]").textContent = "Wait for face tracking to load, or retry the camera."; return; }
        scanCapturing = true;
        faceScan.start().then(function (images) {
          scanCapturing = false;
          finishScan(images);
        }).catch(function (error) { scanCapturing = false; q("[data-scan-status]").textContent = error.message; });
        return;
      }
      finishScan(captured);
    }

    function finishScan(images) {
      stopCamera();
      if (!images) {
        q("[data-scan-status]").textContent = "Please enable camera or upload a photo first";
        if (scanMode === "camera") startCamera();
        return;
      }
      scanPhoto = Array.isArray(images) ? images[0] : images;
      var overlay = q("[data-analyzing]");
      if (overlay) overlay.classList.add("active");
      submit({ path: "scan", image: Array.isArray(images) ? undefined : images, images: Array.isArray(images) ? images : undefined, consent: true, adult: true }).finally(function () {
        captured = null;
        stopCamera();
        var preview = q("[data-upload-preview]");
        if (preview) { preview.removeAttribute("src"); preview.style.display = "none"; }
        var fileInput = q("[data-file]");
        if (fileInput) fileInput.value = "";
        var uploadZone = q("[data-upload-zone]");
        if (uploadZone && scanMode === "upload") uploadZone.classList.remove("hidden");
        if (overlay) overlay.classList.remove("active");
      });
    }

    function saveEmail() {
      var input = q("[data-email]");
      var confirm = q("[data-email-confirm]");
      if (!input || !reportId) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) { confirm.textContent = "Enter a valid email address."; confirm.classList.add("show"); return; }
      var button = q("[data-save-email]");
      if (button.disabled) return;
      button.disabled = true;
      var email = input.value.trim();
      fetch(PROXY + "/result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent: "unlock", reportId: reportId, email: email }) })
        .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.error || "Could not save your email."); return data; }); })
        .then(function (data) { paintResult(data); confirm.textContent = data.delivery === "queued" ? "Guide unlocked. Email delivery has been queued." : data.delivery === "failed" ? "Guide unlocked and email saved. Delivery failed; retry to send again." : "Guide unlocked and email saved. Email delivery is not configured yet."; confirm.classList.add("show"); input.value = email; })
        .catch(function (error) { confirm.textContent = error.message; confirm.classList.add("show"); })
        .finally(function () { button.disabled = false; });
    }
    root.addEventListener("change", function (event) {
      if (event.target && event.target.matches && event.target.matches("[data-consent]") && !consentGiven()) stopCamera();
    });

    var fileInput = q("[data-file]");
    if (fileInput) {
      fileInput.addEventListener("change", function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
          captured = null;
          q("[data-scan-status]").textContent = "Upload a JPG, PNG or WebP photo under 5 MB.";
          return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) {
          captured = ev.target.result;
          var preview = q("[data-upload-preview]");
          preview.src = ev.target.result;
          preview.style.display = "block";
          q("[data-upload-zone]").classList.add("hidden");
          q("[data-scan-status]").textContent = "Photo ready — tap Analyse My Skin";
        };
        reader.readAsDataURL(file);
      });
    }
    loadQuiz().then(function (data) {
      var expectedLayout = root.getAttribute("data-block-layout");
      if (expectedLayout && expectedLayout !== (data.layout || "three")) throw new Error("Paste the widget code of a " + (expectedLayout === "single" ? "Single Quiz" : expectedLayout === "scan" ? "scan" : "Combined Quiz") + " from All quizzes in the app.");
      root.setAttribute("data-configured", "true");
      var quickCount = (data.quick || []).length;
      var deepCount = (data.deep || []).length;
      var minutes = function (count, seconds) { return Math.max(1, Math.round(count * seconds / 60)); };
      var plural = function (count) { return count + (count === 1 ? " question" : " questions"); };
      var copy = {
        "[data-quick-desc]": plural(quickCount) + " about your skin. Instant ritual match — no camera needed.",
        "[data-quick-time]": "âœ¦ About " + minutes(quickCount, 20) + " min",
        "[data-quick-sub]": plural(quickCount) + ". Your personal ritual.",
        "[data-deep-desc]": plural(deepCount) + " across constitution, current state, and environment. The full Ayurvedic reading.",
        "[data-deep-time]": "âœ¦ About " + minutes(deepCount, 15) + " min"
      };
      Object.keys(copy).forEach(function (selector) { var node = q(selector); if (node) node.textContent = copy[selector]; });
      if (data.widgetCss) {
        var widgetStyle = document.createElement("style");
        // Nesting under :scope gives merchant rules like ".entry-card" the same weight as the defaults, and they load later, so they win.
        widgetStyle.textContent = "@scope (#" + CSS.escape(root.id) + ") { :scope { " + data.widgetCss.replace(/\.prana-quiz\b/g, "&") + " } }";
        root.appendChild(widgetStyle);
      }
      if (data.design) {
        var design = data.design;
        root.style.setProperty("--canvas", design.background);
        root.style.setProperty("--ink", design.text);
        root.style.setProperty("--gold", design.accent);
        root.style.setProperty("--button-text", design.buttonText);
        root.style.setProperty("--button-radius", design.radius === "pill" ? "999px" : design.radius === "square" ? "0px" : "8px");
        if (design.font === "sans") root.setAttribute("data-font", "sans");
      }
      var scanReady = data.scanReady === true;
      // Without a connected analysis provider a scan cannot produce a result, so it is never offered to shoppers.
      if (!scanReady && data.layout === "scan") throw new Error("AI Skin Scan analysis is not connected yet, so this block stays hidden on your store. Use a question quiz block for now.");
      ["scan", "quick", "deep"].forEach(function(path) {
        var icon = q('.ec-icon.' + path);
        var value = data.cardIcons && data.cardIcons[path];
        if (!icon || !value || !(value.indexOf("https://") === 0 || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(value))) return;
        var image = document.createElement("img"); image.alt = "";
        image.style.cssText = "width:32px;height:32px;object-fit:contain";
        image.addEventListener("load", function() { icon.textContent = ""; icon.appendChild(image); });
        image.src = value;
      });
      var scanner = data.scanner || { title: "AI Skin Scan", description: "Camera or photo upload for visible cosmetic skin observations.", camera: true, upload: true };
      var scanCard = q('[data-goto="scanner"].entry-card');
      if (scanCard) {
        var title = scanCard.querySelector(".ec-name");
        var description = scanCard.querySelector(".ec-desc");
        if (title) title.textContent = scanner.title;
        if (description) description.textContent = scanReady ? scanner.description : "AI Skin Scan setup is pending. The analysis provider is not connected yet.";
        if (!scanReady) {
          scanCard.setAttribute("aria-disabled", "true");
          var scanLabel = scanCard.querySelector(".btn-entry");
          if (scanLabel) { scanLabel.textContent = "Setup required"; scanLabel.disabled = true; }
          var scanBadge = scanCard.querySelector(".ec-badge");
          if (scanBadge) scanBadge.textContent = "SETUP REQUIRED";
        }
      }
      var cameraButton = q('[data-mode="camera"]');
      var uploadButton = q('[data-mode="upload"]');
      if (cameraButton) cameraButton.style.display = scanner.camera ? "" : "none";
      if (uploadButton) uploadButton.style.display = scanner.upload ? "" : "none";

      scanMode = scanner.camera ? "camera" : "upload";
      var enabledPaths = (data.enabledPaths || (data.layout === "scan" ? ["scan"] : data.layout === "single" ? [data.singleFlow || "quick"] : ["quick", "deep", "scan"]));
      var pathNames = { quick: "quick", deep: "deep", scan: "scanner" };
      ["quick", "deep", "scan"].forEach(function (path) { if (enabledPaths.indexOf(path) === -1) { var links = root.querySelectorAll('[data-goto="' + pathNames[path] + '"]'); for (var at = 0; at < links.length; at++) links[at].style.display = "none"; } });
      if (data.layout === "scan") {
        root.setAttribute("data-quiz-layout", "scan");
        var quizLinks = root.querySelectorAll('[data-goto="quick"], [data-goto="deep"], [data-upgrade]');
        for (var scanIndex = 0; scanIndex < quizLinks.length; scanIndex++) quizLinks[scanIndex].style.display = "none";
        go("scanner");
      }
      var appearance = data.scanAppearance || {};
      if (appearance.enabled !== false && scanReady && enabledPaths.indexOf("scan") !== -1 && !document.querySelector("[data-scan-chat-launcher]")) {
        var launcher = document.createElement("button");
        launcher.type = "button"; launcher.className = "prana-scan-launcher";
        launcher.setAttribute("data-scan-chat-launcher", "");
        launcher.setAttribute("aria-label", "Open skin scan assistant");
        launcher.setAttribute("aria-expanded", "false");
        launcher.textContent = appearance.label || "Skin Scan";
        launcher.style.background = appearance.buttonColor || "#ee5368";
        launcher.style.color = appearance.buttonTextColor || "#ffffff";
        launcher.style.borderRadius = (appearance.radius == null ? 32 : appearance.radius) + "px";
        if (appearance.shape === "circle") {
          launcher.textContent = "";
          launcher.setAttribute("aria-label", appearance.label || "Open skin scan assistant");
          var scanIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          scanIcon.setAttribute("viewBox", "0 0 24 24"); scanIcon.setAttribute("width", "28"); scanIcon.setAttribute("height", "28"); scanIcon.setAttribute("fill", "none"); scanIcon.setAttribute("stroke", "currentColor"); scanIcon.setAttribute("stroke-width", "1.7"); scanIcon.setAttribute("stroke-linecap", "round"); scanIcon.setAttribute("stroke-linejoin", "round"); scanIcon.setAttribute("aria-hidden", "true");
          var scanPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
          scanPath.setAttribute("d", "M7 3H5a2 2 0 0 0-2 2v2m14-4h2a2 2 0 0 1 2 2v2M3 17v2a2 2 0 0 0 2 2h2m10 0h2a2 2 0 0 0 2-2v-2M12 6c-2.5 0-4 2-4 4v2c0 3 1.8 6 4 6s4-3 4-6v-2c0-2-1.5-4-4-4ZM6 12h12M10 10h.01M14 10h.01");
          scanIcon.appendChild(scanPath); launcher.appendChild(scanIcon);
          Object.assign(launcher.style, { width: "64px", height: "64px", padding: "0", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" });
        }
        if (appearance.iconImage && (appearance.iconImage.indexOf("https://") === 0 || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(appearance.iconImage))) {
          var launcherImage = document.createElement("img"); launcherImage.alt = "";
          launcherImage.style.cssText = appearance.shape === "circle" ? "width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;flex-shrink:0" : "width:28px;height:28px;object-fit:cover;border-radius:50%;flex-shrink:0";
          launcherImage.addEventListener("load", function() {
            if (appearance.shape === "circle") launcher.textContent = "";
            else { launcher.style.display = "inline-flex"; launcher.style.alignItems = "center"; launcher.style.gap = "8px"; }
            launcher.prepend(launcherImage);
          });
          launcherImage.src = appearance.iconImage;
        }
        launcher.style.bottom = (appearance.offset == null ? 24 : appearance.offset) + "px";
        launcher.style[appearance.position === "left" ? "left" : "right"] = (appearance.offset == null ? 24 : appearance.offset) + "px";
        launcher.style[appearance.position === "left" ? "right" : "left"] = "auto";
        root.style.setProperty("--scan-panel", appearance.panelColor || "#faf7f2");
        root.style.setProperty("--scan-text", appearance.textColor || "#1a1208");
        root.style.setProperty("--scan-accent", appearance.accentColor || "#8f6330");
        root.setAttribute("data-scan-position", appearance.position === "left" ? "left" : "right");
        document.body.appendChild(launcher);
        var close = document.createElement("button");
        close.type = "button"; close.className = "scan-chat-close"; close.textContent = "Close";
        close.setAttribute("aria-label", "Close skin scan assistant"); root.appendChild(close);
        var previousOverflow = "";
        var closeScanChat = function () {
          if (!root.classList.contains("scan-chat-open")) return;
          root.classList.remove("scan-chat-open"); root.removeAttribute("role"); root.removeAttribute("aria-modal"); root.removeAttribute("aria-label");
          document.body.style.overflow = previousOverflow;
          stopCamera(); launcher.setAttribute("aria-expanded", "false"); launcher.focus();
        };
        launcher.addEventListener("click", function () {
          previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
          root.classList.add("scan-chat-open"); root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Skin scan assistant");
          launcher.setAttribute("aria-expanded", "true"); go("scanner", true); close.focus();
        });
        close.addEventListener("click", closeScanChat);
        root.addEventListener("keydown", function(event) {
          if (!root.classList.contains("scan-chat-open")) return;
          if (event.key === "Escape") { closeScanChat(); return; }
          if (event.key === "Tab") {
            var controls = Array.prototype.filter.call(root.querySelectorAll('button, input, a[href], [tabindex="0"]'), function(node) { return !node.disabled && node.getClientRects().length; });
            var first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }
        });
      }
      var requestedScan = new URLSearchParams(window.location ? window.location.search : "").get("dosha_scan");
      if (scanReady && data.layout !== "single" && requestedScan === quizCode) go("scanner");
      if (data.layout === "single") {
        root.setAttribute("data-quiz-layout", "single");
        var unavailable = root.querySelectorAll('[data-goto="' + (data.singleFlow === "deep" ? "quick" : "deep") + '"], [data-goto="scanner"], [data-upgrade]');
        for (var i = 0; i < unavailable.length; i++) unavailable[i].style.display = "none";
        go(data.singleFlow || "quick");
      }
    }).catch(function (error) {
      root.setAttribute("data-configured", "false");
      var note = q("[data-widget-setup]");
      if (note) note.textContent = error.message || "Could not load the quiz. Refresh this page.";
    });
  }

  function boot() {
    var nodes = document.querySelectorAll("[data-prana-quiz]");
    for (var i = 0; i < nodes.length; i++) init(nodes[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  // The theme editor re-renders sections without a page load.
  document.addEventListener("shopify:section:load", boot);
})();
