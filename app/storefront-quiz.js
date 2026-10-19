import { defaultScanIcon } from "./default-scan-icon.js";
import { checkPhoto, createFaceScan } from "./face-scan.js";
import { buildFaceMap } from "./face-map.js";
import { buildScanReport } from "./scan-report.js";
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
    var scanLandmarks = null;
    var scanMirrored = false;
    var faceMapToken = 0;
    var reportId = null;
    var reportLocked = false;
    var submitting = false;
    var lastFocus = null;
    var scanChatOpen = false;
    var closeScanChat = null;
    var removed = false;
    var removeLauncher = null;
    function cleanupWidget(event) {
      if (event && event.type === "shopify:section:unload" && event.target !== root && !(event.target && event.target.contains(root))) return;
      removed = true;
      if (closeScanChat) closeScanChat();
      stopCamera();
      if (removeLauncher) removeLauncher();
      document.removeEventListener("shopify:section:unload", cleanupWidget);
    }
    document.addEventListener("shopify:section:unload", cleanupWidget);

    function q(sel) { return root.querySelector(sel); }

    function go(name, fromUser) {
      if (scanChatOpen) {
        if (name === "entry") { if (closeScanChat) closeScanChat(); return; }
        if (name === "quick" || name === "deep") name = "scanner";
      }
      if (quiz && quiz.layout === "single" && (name === "entry" || name === "deep" || name === "scanner")) name = quiz.singleFlow || "quick";
      if (quiz && quiz.layout === "scan" && (name === "entry" || name === "deep" || name === "quick")) name = "scanner";
      if (name === "scanner" && quiz && quiz.scanReady !== true) return;
      var screens = root.querySelectorAll(".screen");
      for (var i = 0; i < screens.length; i++) screens[i].classList.remove("active");
      var target = q('[data-screen="' + name + '"]');
      if (target) target.classList.add("active");
      if (name === "result" && scanChatOpen) root.scrollTop = 0;
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
      var embeddedConfig = document.getElementById && document.getElementById("prana-embed-config");
      if (embeddedConfig && embeddedConfig.getAttribute("data-widget-root") === root.id) {
        try { quiz = JSON.parse(embeddedConfig.textContent); if (quiz.handle) quizCode = quiz.handle; return Promise.resolve(quiz); }
        catch (error) { return Promise.reject(new Error("Could not read embedded widget configuration.")); }
      }
      return fetch(PROXY + "/quiz?code=" + encodeURIComponent(quizCode) + "&layout=" + encodeURIComponent(root.getAttribute("data-block-layout") || "") + "&floating=" + (root.getAttribute("data-floating-embed") === "true" ? "1" : "0"), { headers: { Accept: "application/json" } })
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
      var productsOnly = result.resultMode === "products";
      var profile = result.profile;
      reportId = result.reportId || null;
      reportLocked = Boolean(result.locked);
      if (!profile) { showError("Could not show your result. Please try again.", source === "Deep Dosha" ? "deep" : "quick"); return; }
      doshaKey = result.dosha || doshaKey;
      source = result.source || source;
      var isScanResult = source === "AI Skin Scan";
      if (isScanResult) root.setAttribute("data-scan-result", "");
      else root.removeAttribute("data-scan-result");
      modalKey = profile.modal || "tridoshic";
      var hero = q("[data-hero]");
      if (hero) hero.className = "result-hero " + profile.heroClass;
      if (hero) { var heroTag = hero.querySelector(".rh-tag"); if (heroTag) heroTag.textContent = isScanResult ? "AI Skin Scan" : productsOnly ? "Your recommendations" : "Your Dosha Profile"; }
      q("[data-dosha-name]").textContent = profile.name;
      q("[data-dosha-sub]").textContent = profile.sub;
      q("[data-dosha-essence]").textContent = profile.essence;
      q("[data-dosha-source]").textContent = isScanResult ? "" : "via " + source;
      var reading = q("[data-skin-reading]");
      var insightHtml = safeHtml(result.insight || profile.insight);
      q("[data-insight]").innerHTML = insightHtml;
      if (reading) reading.style.display = q("[data-insight]").textContent.trim() ? "" : "none";
      var oldMap = q("[data-face-map]");
      if (oldMap) oldMap.remove();
      root.querySelectorAll("[data-scan-report], [data-scan-report-end]").forEach(function (node) { node.remove(); });
      var mapToken = ++faceMapToken;
      // The redesigned scan report is only used inside the floating popup; the page section keeps its own layout.
      var inPopup = root.classList.contains("scan-chat-open");
      if (isScanResult && !inPopup && scanPhoto) {
        var insightBox = q("[data-insight]");
        buildFaceMap({ photo: scanPhoto, areas: result.scanAreas, landmarks: scanLandmarks, mirrored: scanMirrored }).then(function (map) {
          if (!map || mapToken !== faceMapToken || !insightBox) return;
          var stale = q("[data-face-map]");
          if (stale) stale.remove();
          insightBox.before(map);
          if (reading) reading.style.display = "";
        }).catch(function () { /* the written observations still show without the map */ });
      }
      if (isScanResult && inPopup) {
        // Scan results use the premium report layout; the quiz hero, reading card and ritual list are hidden by CSS.
        var built = buildScanReport(result);
        var wrap = q('[data-screen="result"] .result-wrap');
        if (wrap) wrap.insertBefore(built.report, wrap.querySelector(".result-hero"));
        var emailBlock = q(".email-box");
        if (emailBlock) emailBlock.after(built.end);
        else if (wrap) wrap.appendChild(built.end);
        if (built.mapSlot && scanPhoto) {
          var slot = built.mapSlot;
          buildFaceMap({ photo: scanPhoto, areas: result.scanAreas, landmarks: scanLandmarks, mirrored: scanMirrored }).then(function (map) {
            // Ignore a map that finishes after a newer result was painted.
            if (mapToken !== faceMapToken) return;
            if (!map) { slot.remove(); return; }
            slot.textContent = "";
            slot.appendChild(map);
          }).catch(function () { if (mapToken === faceMapToken) slot.remove(); });
        } else if (built.mapSlot) built.mapSlot.remove();
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
      if (guideButton) guideButton.style.display = productsOnly || reportLocked ? "none" : "";
      var emailBox = q(".email-box");
      if (emailBox) {
        emailBox.style.display = productsOnly ? "none" : "";
        emailBox.querySelector(".eb-title").textContent = reportLocked ? "Unlock your full Prakriti analysis" : isScanResult ? "Save your skin report" : "Email your ritual guide";
        emailBox.querySelector(".eb-sub").textContent = reportLocked ? "Enter your email to view the detailed guide and recommended ritual." : isScanResult ? "Get this report and your product picks in your inbox." : "Optional: link this result to your email.";
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
      var ritualSection = q("[data-ritual-section]");
      if (ritualSection) ritualSection.style.display = reportLocked ? "none" : "";
      if (ritualSection) { var ritualLabel = ritualSection.querySelector(".rs-label"); if (ritualLabel) ritualLabel.textContent = productsOnly ? "Recommended products" : "Your Ritual"; }
      var box = q("[data-products]");
      if (box) {
        box.innerHTML = (result.products || []).map(function (product) {
          var img = product.image ? '<img src="' + esc(product.image) + '" alt="" loading="lazy">' : '<span class="no-img" aria-hidden="true">+</span>';
          var href = "/products/" + encodeURIComponent(product.handle || "") + (product.variantId ? "?variant=" + encodeURIComponent(String(product.variantId).split("/").pop()) : "");
          return '<div class="product-card"><div class="pc-img">' + img + '</div><div class="pc-body"><div class="pc-name">' + esc(product.title) + "</div>" + (product.why ? '<div class="pc-why">' + esc(product.why) + "</div>" : "") + '<div class="pc-bottom"><span class="pc-price">' + esc(product.price) + '</span><a class="btn-shop" href="' + esc(href) + '" aria-label="Shop ' + esc(product.title) + '">Shop Now →</a></div></div></div>';
        }).join("");
        if (!result.products || !result.products.length) box.textContent = "No matching products are available for this result yet.";
      }
      // The quiz design paints result buttons inline; the scan report uses the scan accent instead.
      var sendButton = q("[data-save-email]");
      if (sendButton) {
        if (sendButton.getAttribute("data-quiz-style") === null) sendButton.setAttribute("data-quiz-style", sendButton.style.cssText);
        if (isScanResult && root.classList.contains("scan-chat-open")) { sendButton.style.removeProperty("background"); sendButton.style.setProperty("font-size", "15px", "important"); }
        else sendButton.style.cssText = sendButton.getAttribute("data-quiz-style");
      }
      // Without a brand name the footer would start with a stray separator.
      var footer = q(".result-footer");
      if (footer) footer.textContent = footer.textContent.replace(/^\s*·\s*/, "");
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

    // Analysing screen: the captured photo with a moving scan line, rotating step text and a progress bar.
    var analyzingTimer = 0;
    var ANALYZING_STEPS = ["Mapping your face", "Checking skin texture", "Reviewing tone and redness", "Preparing your report"];
    function showAnalyzing(overlay) {
      overlay.textContent = "";
      var card = document.createElement("div"); card.className = "an-card";
      if (scanPhoto) {
        var frame = document.createElement("div"); frame.className = "an-photo";
        var photo = document.createElement("img"); photo.src = scanPhoto; photo.alt = "";
        if (scanMirrored) photo.style.transform = "scaleX(-1)";
        frame.appendChild(photo);
        ["an-grid", "an-line", "an-corners"].forEach(function (name) { var layer = document.createElement("span"); layer.className = name; layer.setAttribute("aria-hidden", "true"); frame.appendChild(layer); });
        card.appendChild(frame);
      }
      var title = document.createElement("p"); title.className = "an-title"; title.setAttribute("data-analyzing-text", ""); title.textContent = "Analysing your skin";
      var step = document.createElement("p"); step.className = "an-step"; step.textContent = ANALYZING_STEPS[0];
      var bar = document.createElement("div"); bar.className = "an-bar"; bar.appendChild(document.createElement("span"));
      card.append(title, step, bar);
      overlay.appendChild(card);
      var index = 0;
      clearInterval(analyzingTimer);
      analyzingTimer = setInterval(function () { index = Math.min(index + 1, ANALYZING_STEPS.length - 1); step.textContent = ANALYZING_STEPS[index]; }, 1600);
      if (root.classList.contains("scan-chat-open")) root.scrollTop = 0;
      overlay.classList.add("active");
    }
    function hideAnalyzing(overlay) {
      clearInterval(analyzingTimer);
      overlay.classList.remove("active");
    }

    function isDarkColor(hex) {
      var match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ""));
      if (!match) return false;
      var luminance = (0.2126 * parseInt(match[1], 16) + 0.7152 * parseInt(match[2], 16) + 0.0722 * parseInt(match[3], 16)) / 255;
      return luminance < 0.5;
    }

    // Combined quizzes have a start screen to return to from the first question; single quizzes do not.
    function hasStartScreen() {
      return Boolean(quiz) && quiz.layout !== "single" && quiz.layout !== "scan";
    }

    // Editor placeholders such as "New question" are not shown to shoppers.
    function phaseLabel(phase) {
      var text = String(phase || "").trim();
      return /^(new question|question)$/i.test(text) ? "" : text;
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
        if (area) area.textContent = "";
        return;
      }
      var question = quiz.quick[quickStep];
      var total = quiz.quick.length;
      setProgress(q("[data-quick-fill]"), quickStep + 1, total);
      if (q("[data-quick-count]")) q("[data-quick-count]").textContent = (quickStep + 1) + " of " + total;
      if (q("[data-quick-phase]")) q("[data-quick-phase]").textContent = phaseLabel(question.phase);
      area.innerHTML = questionHtml(question, quickAnswers[quickStep], "data-quick-opt", root.id + "-quick-q");
      setNext(q("[data-quick-next]"), quickAnswers[quickStep] !== undefined, question.continueLabel || (quickStep === total - 1 ? "See my result" : "Continue"));
      var back = q("[data-quick-back]");
      if (back) back.style.display = quickStep === 0 && !hasStartScreen() ? "none" : "inline-flex";
    }

    function renderDeep() {
      var area = q("[data-deep-area]");
      if (!quiz || !area) {
        if (area) area.textContent = "";
        return;
      }
      var question = quiz.deep[deepStep];
      if (!question) { area.textContent = "This quiz has no questions yet."; return; }
      setProgress(q("[data-deep-fill]"), deepStep + 1, quiz.deep.length);
      if (q("[data-deep-count]")) q("[data-deep-count]").textContent = (deepStep + 1) + " of " + quiz.deep.length;
      var pills = root.querySelectorAll("[data-layer]");
      for (var i = 0; i < pills.length; i++) pills[i].classList.toggle("active", String(question.layer) === pills[i].getAttribute("data-layer"));
      area.innerHTML = questionHtml(question, deepAnswers[deepStep], "data-deep-opt", root.id + "-deep-q");
      setNext(q("[data-deep-next]"), deepAnswers[deepStep] !== undefined, question.continueLabel || (deepStep === quiz.deep.length - 1 ? "See my result" : "Continue"));
      var back = q("[data-deep-back]");
      if (back) back.style.display = deepStep === 0 && !hasStartScreen() ? "none" : "inline-flex";
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
      if (scanChatOpen) root.scrollTop = 0;
      if (step === 2) selectMode(scanMode); else stopCamera();
    }

    function consentGiven() {
      var bio = q("[data-consent='biometric']");
      var age = q("[data-consent='age']");
      return Boolean(bio && bio.checked && age && age.checked);
    }

    // The camera turns on only after the shopper accepts the required consents.
    function selectMode(mode) {
      var scanButton = q("[data-scan]");
      if (scanButton) scanButton.textContent = (quiz && quiz.texts && quiz.texts.analyseButton) || "Analyse My Skin →";
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

    // Explains why the camera could not open, so shoppers know what to do next.
    function cameraErrorMessage(error) {
      var name = error && error.name;
      var framed = false;
      try { framed = window.top !== window.self; } catch (frameError) { framed = true; }
      if ((name === "NotAllowedError" || name === "SecurityError") && framed) return "The camera is blocked in this preview. Open your store page to use the scan, or upload a photo.";
      if (name === "NotAllowedError" || name === "SecurityError") return "Camera permission is blocked. Allow camera access in your browser settings and tap Live Camera, or upload a photo.";
      if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device. Please upload a photo instead.";
      if (name === "NotReadableError" || name === "AbortError") return "Your camera is being used by another app. Close it and tap Live Camera, or upload a photo.";
      return "The camera could not start. Tap Live Camera to retry, or upload a photo.";
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
      // Prefer an HD front camera, but fall back to any camera when a device cannot meet that.
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false }).catch(function (error) {
        if (error && (error.name === "OverconstrainedError" || error.name === "NotReadableError" || error.name === "AbortError" || error.name === "NotFoundError")) {
          return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        throw error;
      }).then(function (stream) {
        if (generation !== cameraGeneration) { stream.getTracks().forEach(function (track) { track.stop(); }); return; }
        cameraOpening = false;
        cameraStream = stream;
        var feed = q("[data-camera-feed]");
        if (feed) {
          feed.srcObject = stream;
          feed.play().catch(function () { if (generation === cameraGeneration) q("[data-scan-status]").textContent = "Tap Live Camera to resume playback."; });
          q("[data-scan-status]").textContent = "";
          // Live guidance is shown inside the camera frame; the status line below is kept for errors only.
          createFaceScan(feed, q("[data-camera-zone]"), function () {}).then(function (tracker) {
            if (generation !== cameraGeneration) { tracker.close(); return; }
            faceScan = tracker;
            q("[data-scan-status]").textContent = "";
            // Modern hold-to-scan: start right away; the photo is taken once the face holds steady in the oval.
            if (consentGiven()) runScan();
          }).catch(function () { if (generation === cameraGeneration) { stopCamera(); q("[data-scan-status]").textContent = "Face tracking could not load. Check your connection, retry the camera, or upload a photo."; } });
        }
      }).catch(function (error) {
        if (generation !== cameraGeneration) return;
        cameraOpening = false;
        var status = q("[data-scan-status]");
        if (status) status.textContent = cameraErrorMessage(error);
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
        if (quickStep === 0) { if (hasStartScreen()) go("entry", true); return; }
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
        if (deepStep === 0) { if (hasStartScreen()) go("entry", true); return; }
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
        // While the hold-to-scan runs there is nothing to tap; the button returns as "Try again" if it stops.
        root.setAttribute("data-auto-scan", "");
        faceScan.start().then(function (images) {
          scanCapturing = false;
          root.removeAttribute("data-auto-scan");
          finishScan(images);
        }).catch(function (error) {
          scanCapturing = false;
          root.removeAttribute("data-auto-scan");
          var retry = q("[data-scan]");
          if (retry) retry.textContent = "Try again";
          // Switching to upload or closing the camera cancels the scan; that is not an error for the shopper.
          if (scanMode !== "camera" || !faceScan) return;
          q("[data-scan-status]").textContent = error.message;
        });
        return;
      }
      finishScan(captured);
    }

    // Bound vision input dimensions; JPEG compression alone does not reduce image tokens.
    function compactScanPhoto(value) {
      return new Promise(function (resolve, reject) {
        var image = new Image();
        image.onload = function () {
          // 1280px keeps fine detail (under-eye tone, spots, pores) readable for the analysis.
          var scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          var context = canvas.getContext("2d");
          if (!context) { reject(new Error("Could not prepare your photo. Please try again.")); return; }
          context.fillStyle = "#fff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.88));
        };
        image.onerror = function () { reject(new Error("Could not open your photo. Please choose another.")); };
        image.src = value;
      });
    }

    function finishScan(images) {
      stopCamera();
      if (!images) {
        q("[data-scan-status]").textContent = "Please enable camera or upload a photo first";
        if (scanMode === "camera") startCamera();
        return;
      }
      scanPhoto = Array.isArray(images) ? images[0] : images;
      // Camera captures carry the landmarks seen at capture and are shown mirrored like the live preview.
      scanLandmarks = Array.isArray(images) && images.landmarks ? images.landmarks : null;
      scanMirrored = scanMode === "camera";
      var overlay = q("[data-analyzing]");
      if (overlay) showAnalyzing(overlay);
      // Uploaded photos get the same check as camera photos (one face, no hand over it, facing the camera).
      var photoCheck = scanMode === "upload" ? Promise.race([checkPhoto(scanPhoto), new Promise(function (resolve) { setTimeout(resolve, 9000, null); })]) : Promise.resolve(null);
      photoCheck.then(function (verdict) {
        if (verdict && verdict.problem) throw new Error(verdict.problem);
        if (verdict && verdict.points) scanLandmarks = verdict.points;
        return Promise.all((Array.isArray(images) ? images : [images]).map(compactScanPhoto));
      }).then(function (photos) {
        if (removed || !consentGiven()) throw new Error("Scan cancelled. Confirm the required consents before trying again.");
        return submit({ path: "scan", images: photos, consent: true, adult: true });
      }).catch(function (error) {
        q("[data-scan-status]").textContent = error.message || "Could not prepare your photo. Please try again.";
      }).finally(function () {
        captured = null;
        stopCamera();
        var preview = q("[data-upload-preview]");
        if (preview) { preview.removeAttribute("src"); preview.style.display = "none"; }
        var fileInput = q("[data-file]");
        if (fileInput) fileInput.value = "";
        var uploadZone = q("[data-upload-zone]");
        if (uploadZone && scanMode === "upload") uploadZone.classList.remove("hidden");
        if (overlay) hideAnalyzing(overlay);
      });
    }

    function saveEmail() {
      var input = q("[data-email]");
      var confirm = q("[data-email-confirm]");
      if (!input || !reportId) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) { confirm.textContent = "Enter a valid email address."; confirm.setAttribute("data-delivery", "error"); confirm.classList.add("show"); return; }
      var button = q("[data-save-email]");
      if (button.disabled) return;
      button.disabled = true;
      var email = input.value.trim();
      fetch(PROXY + "/result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent: "unlock", reportId: reportId, email: email }) })
        .then(function (response) { return response.json().then(function (data) { if (!response.ok) throw new Error(data.error || "Could not save your email."); return data; }); })
        .then(function (data) { paintResult(data); confirm.textContent = data.delivery === "queued" ? "✓ Email sent to " + email + ". Check your inbox." : data.delivery === "failed" ? "✓ Saved. We could not send the email right now; tap Send to try again." : "✓ Saved. Your full report is unlocked below."; confirm.classList.add("show"); confirm.setAttribute("data-delivery", data.delivery || "saved"); input.value = email; })
        .catch(function (error) { confirm.textContent = error.message; confirm.setAttribute("data-delivery", "error"); confirm.classList.add("show"); })
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
      if (removed) return;
      var expectedLayout = root.getAttribute("data-block-layout");
      if (expectedLayout && expectedLayout !== (data.layout || "three")) throw new Error("Paste the widget code of a " + (expectedLayout === "single" ? "Single Quiz" : expectedLayout === "scan" ? "scan" : "Combined Quiz") + " from All quizzes in the app.");
      root.setAttribute("data-configured", "true");
      var quickCount = (data.quick || []).length;
      var deepCount = (data.deep || []).length;
      var minutes = function (count, seconds) { return Math.max(1, Math.round(count * seconds / 60)); };
      var plural = function (count) { return count + (count === 1 ? " question" : " questions"); };
      var copy = {
        "[data-quick-desc]": plural(quickCount) + " about your skin. Instant ritual match — no camera needed.",
        "[data-quick-time]": "About " + minutes(quickCount, 20) + " min",
        "[data-quick-sub]": plural(quickCount) + ". Your personal ritual.",
        "[data-deep-desc]": plural(deepCount) + " across constitution, current state, and environment. The full Ayurvedic reading.",
        "[data-deep-time]": "About " + minutes(deepCount, 15) + " min"
      };
      Object.keys(copy).forEach(function (selector) { var node = q(selector); if (node) node.textContent = copy[selector]; });
      if (data.widgetCss) {
        var widgetStyle = document.createElement("style");
        // Nesting under :scope gives merchant rules like ".entry-card" the same weight as the defaults, and they load later, so they win.
        widgetStyle.textContent = "@scope (#" + CSS.escape(root.id) + ") { :scope { " + data.widgetCss.replace(/\.prana-quiz\b/g, "&") + " } }";
        root.appendChild(widgetStyle);
      }
      // Use the host theme typography, including same-origin Custom Liquid embeds.
      var themeDocument = document;
      try { if (window.parent !== window && window.parent.document.body) themeDocument = window.parent.document; } catch (error) { /* Cross-origin embeds keep their own document typography. */ }
      var themeWindow = themeDocument.defaultView || window;
      var themeStyle = themeWindow.getComputedStyle ? themeWindow.getComputedStyle(themeDocument.body) : null;
      if (themeStyle) {
        var themeBodyFont = themeStyle.getPropertyValue("--font-body-family").trim() || themeStyle.fontFamily;
        var themeHeadingFont = themeStyle.getPropertyValue("--font-heading-family").trim() || themeBodyFont;
        if (themeBodyFont) root.style.setProperty("--scan-theme-font", themeBodyFont);
        if (themeHeadingFont) root.style.setProperty("--scan-theme-heading-font", themeHeadingFont);
      }
      if (themeDocument !== document && themeDocument.styleSheets && document.createElement) {
        var fontFaces = [];
        Array.prototype.forEach.call(themeDocument.styleSheets, function(sheet) {
          try { Array.prototype.forEach.call(sheet.cssRules, function(rule) { if (rule.type === 5) fontFaces.push(rule.cssText); }); } catch (error) { /* Cross-origin sheets cannot be inspected. */ }
        });
        if (fontFaces.length) { var themeFonts = document.createElement("style"); themeFonts.textContent = fontFaces.join("\n"); root.appendChild(themeFonts); }
      }
      if (data.design) {
        var design = data.design;
        root.style.setProperty("--canvas", design.background);
        ["desktopButtonWidth","mobileButtonWidth","desktopButtonHeight","mobileButtonHeight","mobileButtonSize","desktopWidth","desktopPadding","mobileWidth","mobilePadding","mobileHeadingSize","mobileQuestionSize","mobileAnswerSize","answerSpacing","mobileAnswerSpacing","answerPadding","mobileAnswerPadding","headingSize","bodySize","brandSize","mobileBrandSize","mobileSubtitleSize","questionGap","mobileQuestionGap","buttonGap","mobileButtonGap","entryTitleSize","mobileEntryTitleSize","entryTextSize","mobileEntryTextSize","entryPadding","mobileEntryPadding","entryGap","mobileEntryGap","entryRadius","entryIconSize","mobileEntryIconSize","entryTimeSize","mobileEntryTimeSize","headerTop","mobileHeaderTop","headerGap","mobileHeaderGap","scanTitleSize","mobileScanTitleSize","scanTextSize","mobileScanTextSize","scanUploadHeight","mobileScanUploadHeight","scanNoticeSize","mobileScanNoticeSize"].forEach(function(key) { if (Number.isFinite(Number(design[key]))) root.style.setProperty('--layout-' + key, Number(design[key]) + (['mobileWidth','desktopButtonWidth','mobileButtonWidth'].includes(key) ? '%' : 'px')); });
        root.dataset.buttonAlignment = ["left", "right"].includes(design.buttonAlignment) ? design.buttonAlignment : "center";
        root.style.setProperty("--ink", design.text);
        root.style.setProperty("--gold", design.accent);
        root.style.setProperty("--quiz-border", design.accent || "#52695a");
        root.style.setProperty("--quiz-selected", design.selectedColor || "#52695a");
        root.style.setProperty("--button-text", design.buttonText);
        root.style.setProperty("--button-radius", design.radius === "pill" ? "999px" : design.radius === "square" ? "0px" : "8px");
        root.querySelectorAll('[data-screen="quick"], [data-screen="deep"]').forEach(function (element) { element.style.setProperty("background", "transparent", "important"); });
        // Skin Scan colours of this widget (inline scan screen only; the floating popup has its own appearance).
        [["scanCard", "--sx-card"], ["scanText", "--sx-text"], ["scanHeading", "--sx-heading"], ["scanButton", "--sx-button"], ["scanButtonText", "--sx-button-text"], ["backBg", "--back-bg"], ["backText", "--back-text"], ["backBorder", "--back-border"], ["headingAccent", "--heading-accent"], ["entryBg", "--entry-bg"], ["entryBorder", "--entry-border"], ["entryFeatured", "--entry-featured"], ["brandColor", "--brand-color"], ["subtitleColor", "--subtitle-color"], ["entryTitleColor", "--entry-title"], ["entryTextColor", "--entry-text"], ["entryTimeColor", "--entry-time"], ["entryGhost", "--entry-ghost"], ["entryIconBg", "--entry-icon-bg"], ["scanAccent", "--sx-accent"], ["scanNoticeBg", "--sx-notice"], ["scanBoxBg", "--sx-box"], ["scanToggleBg", "--sx-toggle"], ["scanToggleActive", "--sx-toggle-active"], ["scanUploadBg", "--sx-upload"], ["scanUploadBorder", "--sx-upload-border"], ["scanHint", "--sx-hint"], ["scanStepIdle", "--sx-step-idle"], ["scanDivider", "--sx-divider"], ["scanNoticeText", "--sx-notice-text"], ["scanBoxBorder", "--sx-box-border"], ["scanLabel", "--sx-label"]].forEach(function (pair) {
          var attribute = "data-" + pair[1].slice(2);
          if (design[pair[0]]) { root.style.setProperty(pair[1], design[pair[0]]); root.setAttribute(attribute, ""); }
          else { root.style.removeProperty(pair[1]); root.removeAttribute(attribute); }
        });
        // A dark notice background without its own text colour gets readable light text (and the reverse).
        if (design.scanNoticeBg && !design.scanNoticeText) { root.style.setProperty("--sx-notice-text", isDarkColor(design.scanNoticeBg) ? "#ffffff" : "#3a2f28"); root.setAttribute("data-sx-notice-text", ""); }
        if (design.cardColor !== undefined) root.style.setProperty('--quiz-card', design.cardColor);
        if (design.cardColor !== undefined) root.querySelectorAll('.quiz-wrap').forEach(function (element) { element.style.setProperty("background", String(design.cardColor), "important"); });
        if (design.headingColor !== undefined) root.querySelectorAll('.rh-dosha').forEach(function (element) { element.style.setProperty("color", String(design.headingColor), "important"); });
        // Header title: its own colour when set, otherwise the question heading colour.
        if (design.titleColor || design.headingColor) root.querySelectorAll(root.getAttribute("data-floating-embed") === "true" ? '[data-screen]:not([data-screen="scanner"]) .hdr-title' : '[data-screen] .hdr-title').forEach(function (element) { var onScanner = element.closest('[data-screen="scanner"]'); element.style.setProperty("color", String((onScanner && design.scanHeading) || design.titleColor || design.headingColor), "important"); });
        if (design.headingSize !== undefined) root.querySelectorAll('.rh-dosha').forEach(function (element) { element.style.setProperty("font-size", String(design.headingSize) + "px", "important"); });
        if (design.questionSize !== undefined) root.querySelectorAll('.q-text').forEach(function (element) { element.style.setProperty("font-size", String(design.questionSize) + "px"); });
        if (design.headingColor !== undefined) root.querySelectorAll('.q-text').forEach(function (element) { element.style.setProperty("color", String(design.headingColor), "important"); });
        if (design.answerColor !== undefined) root.querySelectorAll('.q-opt:not(.selected)').forEach(function (element) { element.style.setProperty("background", String(design.answerColor), "important"); });
        if (design.answerText !== undefined) root.querySelectorAll('.q-opt:not(.selected) .q-opt-main').forEach(function (element) { element.style.setProperty("color", String(design.answerText), "important"); });
        if (design.selectedColor !== undefined) root.querySelectorAll('.q-opt.selected').forEach(function (element) { element.style.setProperty("background", String(design.selectedColor), "important"); });
        if (design.selectedText !== undefined) root.querySelectorAll('.q-opt.selected .q-opt-main').forEach(function (element) { element.style.setProperty("color", String(design.selectedText), "important"); });
        if (design.answerSize !== undefined) root.querySelectorAll('.q-opt-main').forEach(function (element) { element.style.setProperty("font-size", String(design.answerSize) + "px"); });
        if (design.accent !== undefined) root.querySelectorAll('.btn-next, .btn-eb, .btn-upgrade').forEach(function (element) { element.style.setProperty("background", String(design.accent), "important"); });
        if (design.buttonSize !== undefined) root.querySelectorAll('.btn-next, .btn-upgrade').forEach(function (element) { element.style.setProperty("font-size", String(design.buttonSize) + "px"); });
        if (design.bodySize !== undefined) root.querySelectorAll('.q-sub, .insight-text').forEach(function (element) { element.style.setProperty("font-size", String(design.bodySize) + "px", "important"); });
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
        image.style.cssText = "width:100px;height:100px;object-fit:contain";
        image.addEventListener("load", function() { icon.textContent = ""; icon.classList.add("has-image"); icon.appendChild(image); });
        image.src = value;
      });
      var scanner = data.scanner || { title: "Skin Insights", description: "Camera or photo upload for visible cosmetic skin observations.", camera: true, upload: true };
      if (scanner.title === "AI Skin Scan") scanner.title = "Skin Insights";
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

      // Merchant texts (Quiz design > Texts): a set value replaces the built-in text, a hidden one is removed.
      (function applyTexts(texts, hidden) {
        try {
        texts = texts || {}; hidden = hidden || [];
        var cards = { scan: '.entry-card[data-goto="scanner"] ', quick: '.entry-card[data-goto="quick"] ', deep: '.entry-card[data-goto="deep"] ' };
        var plain = { entryBrand: '[data-screen="entry"] .hdr-logo', entrySubtitle: '[data-screen="entry"] .hdr-sub', entryNote: ".entry-note",
          scanBadge: cards.scan + ".ec-badge", scanName: cards.scan + ".ec-name", scanDesc: cards.scan + ".ec-desc", scanTime: cards.scan + ".ec-time", scanButton: cards.scan + ".btn-entry",
          quickName: cards.quick + ".ec-name", quickDesc: cards.quick + ".ec-desc", quickTime: cards.quick + ".ec-time", quickButton: cards.quick + ".btn-entry",
          deepName: cards.deep + ".ec-name", deepDesc: cards.deep + ".ec-desc", deepTime: cards.deep + ".ec-time", deepButton: cards.deep + ".btn-entry",
          quickSubtitle: '[data-screen="quick"] .hdr-sub', deepSubtitle: '[data-screen="deep"] .hdr-sub',
          scannerSubtitle: '[data-screen="scanner"] .hdr-sub', scanStepTitle: '[data-scan-step="1"] .scan-step-title', scanStepIntro: '[data-scan-step="1"] .scan-step-intro',
          scanNotice: '[data-screen="scanner"] .cn-text', consentBio: 'label[for^="consent-bio"]', consentAge: 'label[for^="consent-age"]', consentMail: 'label[for^="consent-mail"]', scanContinue: "[data-scan-continue]",
          reviewConsent: "[data-scan-back]", photoTitle: '[data-scan-step="2"] .scan-step-title', photoIntro: '[data-scan-step="2"] .scan-step-intro',
          cameraLabel: '[data-mode="camera"] .sc-btn-label', uploadLabel: '[data-mode="upload"] .sc-btn-label', uploadTitle: ".upload-label", uploadSub: ".upload-sub", analyseButton: "[data-scan]" };
        // Hiding these removes the whole block (notice box, checkbox row); the two required consents cannot be hidden.
        var hideWhole = { scanNotice: ".consent-notice", consentMail: ".consent-row" };
        var required = ["consentBio", "consentAge"];
        Object.keys(plain).forEach(function (key) {
          var element = q(plain[key]); if (!element) return;
          if (hidden.indexOf(key) !== -1 && required.indexOf(key) === -1) { ((hideWhole[key] && element.closest(hideWhole[key])) || element).style.display = "none"; return; }
          if (texts[key]) element.textContent = texts[key];
        });
        ["entry", "quick", "deep", "scanner"].forEach(function (screen) {
          var heading = q('[data-screen="' + screen + '"] .hdr-title'); if (!heading) return;
          var em = heading.querySelector("em"); var titleKey = screen + "Title", accentKey = screen + "Accent";
          var titleText = Array.prototype.filter.call(heading.childNodes, function (node) { return node.nodeType === 3; }).map(function (node) { return node.textContent; }).join("").trim();
          var title = hidden.indexOf(titleKey) !== -1 ? "" : (texts[titleKey] || titleText);
          var accent = hidden.indexOf(accentKey) !== -1 ? "" : (texts[accentKey] || (em ? em.textContent : ""));
          if (!title && !accent) { heading.style.display = "none"; return; }
          heading.textContent = title ? title + (accent ? " " : "") : "";
          if (accent) { var mark = document.createElement("em"); mark.textContent = accent; heading.appendChild(mark); }
        });
        } catch (error) { /* custom texts are cosmetic; never block the widget */ }
      })(data.texts, data.hiddenTexts);
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
      if (root.getAttribute("data-floating-embed") === "true" && appearance.enabled !== false && scanReady && enabledPaths.indexOf("scan") !== -1 && !document.querySelector("[data-scan-chat-launcher]")) {
        var launcher = document.createElement("button");
        launcher.type = "button"; launcher.className = "prana-scan-launcher";
        launcher.setAttribute("data-scan-chat-launcher", "");
        launcher.setAttribute("aria-label", "Open skin scan assistant");
        launcher.setAttribute("aria-expanded", "false");
        launcher.textContent = appearance.label || "Skin Scan";
        launcher.style.background = appearance.buttonColor || "#e8f0eb";
        launcher.style.color = appearance.buttonTextColor || "#284c37";
        launcher.style.borderRadius = (appearance.radius == null ? 32 : appearance.radius) + "px";
        if (appearance.shape === "circle") {
          launcher.textContent = "";
          launcher.setAttribute("aria-label", appearance.label || "Open skin scan assistant");
          var scanIcon = document.createElement("img");
          scanIcon.src = defaultScanIcon; scanIcon.alt = "";
          scanIcon.style.cssText = "width:52px;height:52px;object-fit:contain;display:block";
          launcher.appendChild(scanIcon);
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
        root.style.setProperty("--scan-offset", (appearance.offset == null ? 24 : appearance.offset) + "px");
        root.style.setProperty("--scan-panel", appearance.panelColor || "#450333");
        // On a dark popup background, text placed directly on the panel switches to light colours.
        if (isDarkColor(appearance.panelColor || "#450333")) root.setAttribute("data-scan-dark", "");
        else root.removeAttribute("data-scan-dark");
        root.style.setProperty("--scan-text", appearance.textColor || "#1a1208");
        root.style.setProperty("--scan-accent", appearance.accentColor || "#52695a");
        root.style.setProperty("--scan-heading", appearance.headingColor || "#1a1208");
        root.style.setProperty("--scan-button-text", appearance.modalButtonTextColor || "#ffffff");
        root.style.setProperty("--scan-button", !appearance.modalButtonColor || ["#303030", "#4a2c21"].includes(String(appearance.modalButtonColor).toLowerCase()) ? "#000000" : appearance.modalButtonColor);
        root.style.setProperty("--scan-font-size", (appearance.modalFontSize || 14) + "px");
        root.style.setProperty("--scan-width", (appearance.modalWidth || 520) + "px");
        root.style.setProperty("--scan-radius", (appearance.modalRadius == null ? 24 : appearance.modalRadius) + "px");
        root.style.setProperty("--scan-mobile-radius", (appearance.mobileModalRadius == null ? 0 : appearance.mobileModalRadius) + "px");
        root.setAttribute("data-scan-position", appearance.position === "left" ? "left" : "right");
        if (removed) return;
        document.body.appendChild(launcher);
        removeLauncher = function () { launcher.remove(); };
        var close = document.createElement("button");
        close.type = "button"; close.className = "scan-chat-close"; close.textContent = "\u00d7";
        close.setAttribute("aria-label", "Close skin scan assistant"); root.prepend(close);
        var previousOverflow = "";
        var scrollLocked = false;
        closeScanChat = function () {
          if (!scanChatOpen && !scrollLocked) return;
          scanChatOpen = false;
          root.classList.remove("scan-chat-open"); root.removeAttribute("role"); root.removeAttribute("aria-modal"); root.removeAttribute("aria-label");
          if (scrollLocked) document.body.style.overflow = previousOverflow;
          scrollLocked = false;
          stopCamera(); launcher.setAttribute("aria-expanded", "false"); if (!removed) launcher.focus({ preventScroll: true });
        };
        launcher.addEventListener("click", function () {
          if (scanChatOpen) { closeScanChat(); return; }
          if (!scrollLocked) { previousOverflow = document.body.style.overflow; scrollLocked = true; }
          document.body.style.overflow = "hidden";
          scanChatOpen = true;
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
      if (root.getAttribute("data-design-mode") !== "true" && root.style) root.style.display = "none";
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
