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
    var scanMode = "camera";
    var captured = null;

    function q(sel) { return root.querySelector(sel); }

    function go(name) {
      if (quiz && quiz.layout === "single" && (name === "entry" || name === "deep" || name === "scanner")) name = "quick";
      if (quiz && quiz.layout === "scan" && (name === "entry" || name === "deep" || name === "quick")) name = "scanner";
      var screens = root.querySelectorAll(".screen");
      for (var i = 0; i < screens.length; i++) screens[i].classList.remove("active");
      var target = q('[data-screen="' + name + '"]');
      if (target) target.classList.add("active");
      if (name !== "scanner") stopCamera();
      if (name === "scanner") selectMode(scanMode);
      if (name === "quick") resetQuick();
      if (name === "deep") resetDeep();
      window.scrollTo(0, 0);
    }

    var quizCode = (root.getAttribute("data-quiz-code") || "dosha-quiz").replace(/^\[dosha-quiz:([^\]]+)\]$/i, "$1").trim() || "dosha-quiz";

    function loadQuiz() {
      if (quiz) return Promise.resolve(quiz);
      return fetch(PROXY + "/quiz?code=" + encodeURIComponent(quizCode), { headers: { Accept: "application/json" } })
        .then(function (res) { if (!res.ok) throw new Error("quiz"); return res.json(); })
        .then(function (data) { quiz = data; return quiz; });
    }

    function showError(message) {
      var area = q("[data-deep-area]") || q("[data-scan-status]");
      if (area) area.textContent = message;
    }

    function paintResult(data) {
      var result = data.result || data;
      var profile = result.profile;
      if (!profile) return;
      doshaKey = result.dosha || doshaKey;
      source = result.source || source;
      modalKey = profile.modal || "tridoshic";
      var hero = q("[data-hero]");
      if (hero) hero.className = "result-hero " + profile.heroClass;
      q("[data-dosha-name]").textContent = profile.name;
      q("[data-dosha-sub]").textContent = profile.sub;
      q("[data-dosha-essence]").textContent = profile.essence;
      q("[data-dosha-source]").textContent = "via " + source;
      q("[data-insight]").innerHTML = result.insight || profile.insight;
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
      var nudge = q("[data-upgrade]");
      if (nudge) nudge.style.display = result.showUpgrade ? "block" : "none";
      var email = q("[data-email]");
      if (email) { email.disabled = false; email.value = ""; }
      var confirm = q("[data-email-confirm]");
      if (confirm) confirm.classList.remove("show");
      var box = q("[data-products]");
      if (box) {
        box.innerHTML = (result.products || []).map(function (product) {
          var img = product.image ? '<img src="' + product.image + '" alt="">' : '<span class="no-img">✦</span>';
          return '<div class="product-card"><div class="pc-img">' + img + '</div><div class="pc-body"><div class="pc-name">' + product.title + '</div>' + (product.why ? '<div class="pc-why">' + product.why + '</div>' : '') + '<div class="pc-bottom"><span class="pc-price">' + (product.price || '') + '</span><a class="btn-shop" href="/products/' + product.handle + (product.variantId ? '?variant=' + encodeURIComponent(product.variantId.split('/').pop()) : '') + '">Shop Now →</a></div></div></div>';
        }).join("");
        if (!result.products || !result.products.length) box.textContent = "No matching products are available for this result yet.";
      }
      go("result");
    }

    function submit(payload) {
      payload.code = quizCode;
      return fetch(PROXY + "/result", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().then(function (body) { if (!res.ok) throw new Error(body.error || "Quiz service unavailable."); return body; });
      }).then(paintResult).catch(function (error) {
        var status = q("[data-scan-status]");
        if (payload.path === "scan" && status) status.textContent = error.message;
        else showError(error.message);
      });
    }

    function esc(value) {
      return String(value || "").replace(/[&<>"]/g, function (ch) {
        return ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;";
      });
    }

    function optHtml(options, selected, attr) {
      var html = "";
      for (var i = 0; i < options.length; i++) {
        html += '<div class="q-opt' + (selected === i ? " selected" : "") + '" role="button" tabindex="0" ' + attr + '="' + i + '"><div class="q-opt-dot"></div><div class="q-opt-text"><div class="q-opt-main">' + esc(options[i].label) + '</div><div class="q-opt-hint">' + esc(options[i].hint) + '</div></div></div>';
      }
      return html;
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
      if (q("[data-quick-fill]")) q("[data-quick-fill]").style.width = Math.round(((quickStep + 1) / total) * 100) + "%";
      if (q("[data-quick-count]")) q("[data-quick-count]").textContent = (quickStep + 1) + " of " + total;
      if (q("[data-quick-phase]")) q("[data-quick-phase]").textContent = question.phase || "";
      area.innerHTML = '<div class="q-step active"><div class="q-text">' + esc(question.text) + '</div><div class="q-sub">' + esc(question.sub) + '</div><div class="q-options">' + optHtml(question.options, quickAnswers[quickStep], "data-quick-opt") + "</div></div>";
      var next = q("[data-quick-next]");
      if (next) next.classList.toggle("ready", quickAnswers[quickStep] !== undefined);
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
      var fill = q("[data-deep-fill]");
      if (fill) fill.style.width = Math.round(((deepStep + 1) / quiz.deep.length) * 100) + "%";
      if (q("[data-deep-count]")) q("[data-deep-count]").textContent = (deepStep + 1) + " of " + quiz.deep.length;
      if (q("[data-deep-phase]")) q("[data-deep-phase]").textContent = question.phase;
      var pills = root.querySelectorAll("[data-layer]");
      for (var i = 0; i < pills.length; i++) pills[i].classList.toggle("active", String(question.layer) === pills[i].getAttribute("data-layer"));
      area.innerHTML = '<div class="q-step active"><div class="q-text">' + esc(question.text) + '</div><div class="q-sub">' + esc(question.sub) + '</div><div class="q-options">' + optHtml(question.options, deepAnswers[deepStep], "data-deep-opt") + "</div></div>";
      var next = q("[data-deep-next]");
      if (next) next.classList.toggle("ready", deepAnswers[deepStep] !== undefined);
      var back = q("[data-deep-back]");
      if (back) back.style.visibility = deepStep === 0 ? "hidden" : "visible";
    }

    function resetDeep() {
      deepStep = 0;
      deepAnswers = {};
      loadQuiz().then(renderDeep).catch(function () {
        showError("Could not load the quiz. Refresh this page.");
      });
    }

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
      if (mode === "camera") startCamera();
      else stopCamera();
    }

    function startCamera() {
      if (cameraStream || !navigator.mediaDevices) return;
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }).then(function (stream) {
        cameraStream = stream;
        var feed = q("[data-camera-feed]");
        if (feed) feed.srcObject = stream;
      }).catch(function () {
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
      if (cameraStream) {
        cameraStream.getTracks().forEach(function (track) { track.stop(); });
        cameraStream = null;
      }
    }

    root.addEventListener("click", function (event) {
      var origin = event.target.closest ? event.target : null;
      if (!origin) return;
      var goto = origin.closest("[data-goto]");
      if (goto) { go(goto.getAttribute("data-goto")); return; }
      var mode = origin.closest("[data-mode]");
      if (mode) { selectMode(mode.getAttribute("data-mode")); return; }
      if (origin.closest("[data-upload-zone]")) { var file = q("[data-file]"); if (file) file.click(); return; }
      if (origin.closest("[data-scan]")) { runScan(); return; }
      var quickOpt = origin.closest("[data-quick-opt]");
      if (quickOpt) {
        quickAnswers[quickStep] = parseInt(quickOpt.getAttribute("data-quick-opt"), 10);
        renderQuick();
        return;
      }
      if (origin.closest("[data-quick-back]")) {
        if (quickStep === 0) return;
        quickStep--;
        renderQuick();
        return;
      }
      if (origin.closest("[data-quick-next]")) {
        if (quickAnswers[quickStep] === undefined || !quiz) return;
        if (quickStep < quiz.quick.length - 1) {
          quickStep++;
          renderQuick();
        } else {
          submit({ path: "quick", answers: quickAnswers });
        }
        return;
      }
      var deepOpt = origin.closest("[data-deep-opt]");
      if (deepOpt) {
        deepAnswers[deepStep] = parseInt(deepOpt.getAttribute("data-deep-opt"), 10);
        var all = root.querySelectorAll("[data-deep-opt]");
        for (var d = 0; d < all.length; d++) all[d].classList.remove("selected");
        deepOpt.classList.add("selected");
        q("[data-deep-next]").classList.add("ready");
        return;
      }
      if (origin.closest("[data-deep-back]")) {
        if (deepStep === 0) { go("entry"); return; }
        deepStep--;
        renderDeep();
        return;
      }
      if (origin.closest("[data-deep-next]")) {
        if (deepAnswers[deepStep] === undefined || !quiz) return;
        if (deepStep < quiz.deep.length - 1) { deepStep++; renderDeep(); }
        else {
          var answers = [];
          for (var n = 0; n < quiz.deep.length; n++) answers.push(deepAnswers[n]);
          submit({ path: "deep", answers: answers });
        }
        return;
      }
      if (origin.closest("[data-open-modal]")) {
        var modal = q('[data-modal="' + modalKey + '"]');
        if (modal) modal.classList.add("active");
        return;
      }
      if (origin.closest("[data-close-modal]") || origin.classList.contains("modal-overlay")) {
        var modals = root.querySelectorAll(".modal-overlay");
        for (var m = 0; m < modals.length; m++) modals[m].classList.remove("active");
        return;
      }
      if (origin.closest("[data-save-email]")) saveEmail();
    });

    function runScan() {
      var bio = q("[data-consent='biometric']");
      var age = q("[data-consent='age']");
      var err = q("[data-consent-error]");
      if (!bio.checked || !age.checked) {
        err.classList.add("show");
        err.textContent = "Please accept the required consents before scanning.";
        return;
      }
      err.classList.remove("show");
      if (scanMode === "camera") {
        var video = q("[data-camera-feed]");
        if (video && video.videoWidth) {
          var canvas = document.createElement("canvas");
          var scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
          captured = canvas.toDataURL("image/jpeg", 0.85);
        }
      }
      stopCamera();
      if (!captured) {
        q("[data-scan-status]").textContent = "Please enable camera or upload a photo first";
        if (scanMode === "camera") startCamera();
        return;
      }
      var overlay = q("[data-analyzing]");
      if (overlay) overlay.classList.add("active");
      submit({ path: "scan", image: captured, consent: true }).finally(function () {
        captured = null;
        if (overlay) overlay.classList.remove("active");
      });
    }

    function saveEmail() {
      var input = q("[data-email]");
      if (!input || input.value.indexOf("@") === -1) return;
      input.disabled = true;
      q("[data-email-confirm]").classList.add("show");
      var body = "form_type=customer&utf8=%E2%9C%93&contact%5Bemail%5D=" + encodeURIComponent(input.value.trim()) + "&contact%5Btags%5D=dosha-quiz," + doshaKey;
      fetch("/contact", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body }).catch(function () {});
    }

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
      var scanner = data.scanner || { title: "AI Skin Scan", description: "Try the skin scan demo with a live camera or photo upload.", camera: true, upload: true };
      var scanCard = q('[data-goto="scanner"].entry-card');
      if (scanCard) {
        var title = scanCard.querySelector(".ec-name");
        var description = scanCard.querySelector(".ec-desc");
        var badge = scanCard.querySelector(".ec-badge");
        if (title) title.textContent = scanner.title;
        if (description) description.textContent = scanner.description;
        if (badge) badge.textContent = "Demo scan";
      }
      var cameraButton = q('[data-mode="camera"]');
      var uploadButton = q('[data-mode="upload"]');
      if (cameraButton) cameraButton.style.display = scanner.camera ? "" : "none";
      if (uploadButton) uploadButton.style.display = scanner.upload ? "" : "none";
      scanMode = scanner.camera ? "camera" : "upload";
      if (data.layout === "scan") {
        root.setAttribute("data-quiz-layout", "scan");
        var quizLinks = root.querySelectorAll('[data-goto="quick"], [data-goto="deep"], [data-upgrade]');
        for (var scanIndex = 0; scanIndex < quizLinks.length; scanIndex++) quizLinks[scanIndex].style.display = "none";
        go("scanner");
      }
      var requestedScan = new URLSearchParams(window.location ? window.location.search : "").get("dosha_scan");
      if (data.layout !== "single" && requestedScan === quizCode) go("scanner");
      if (data.layout === "single") {
        root.setAttribute("data-quiz-layout", "single");
        var unavailable = root.querySelectorAll('[data-goto="deep"], [data-goto="scanner"], [data-upgrade]');
        for (var i = 0; i < unavailable.length; i++) unavailable[i].style.display = "none";
        go("quick");
      }
    }).catch(function () {
      var note = q(".entry-note");
      if (note) note.textContent = "Could not load the quiz. Refresh this page.";
    });
  }

  function boot() {
    var nodes = document.querySelectorAll("[data-prana-quiz]");
    for (var i = 0; i < nodes.length; i++) init(nodes[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
