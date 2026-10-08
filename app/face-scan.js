// Face guidance runs locally in the browser. One flash-lit photo is captured; only that photo goes to the analysis API.

// Raw camera coordinates are unmirrored. Landmarks give a rough head turn so shoppers can be asked to look straight.
export function landmarkPose(points) {
  const left = points[33], right = points[263], nose = points[1];
  if (!left || !right || !nose) return null;
  const distance = Math.hypot(right.x-left.x, right.y-left.y);
  if (distance < 0.025) return null;
  const centerX = (left.x+right.x)/2, centerY = (left.y+right.y)/2;
  return { yaw: Math.atan2(nose.x-centerX, distance/2), pitch: Math.atan2(nose.y-centerY, distance) };
}

// The face guide is an oval in the middle of the frame, sized from the shorter side.
export function guideOval(width, height) {
  const radiusX = Math.min(width, height) * 0.3;
  return { centerX: width * 0.5, centerY: height * 0.47, radiusX, radiusY: Math.min(radiusX * 1.32, height * 0.44) };
}

// Decides whether the current frame is good enough to start the flash capture, and what to tell the shopper.
// box is the face bounding box in pixels; light is the average face brightness (0-255).
export function frameCheck({ faces, box, light, yaw, width, height }) {
  if (!faces) return { ok: false, message: "Position your face inside the oval." };
  if (faces > 1) return { ok: false, message: "Only one face should be visible." };
  const oval = guideOval(width, height);
  const faceWidth = box.maxX - box.minX;
  if (faceWidth < oval.radiusX * 2 * 0.5) return { ok: false, message: "Move a little closer." };
  if (faceWidth > oval.radiusX * 2 * 1.15) return { ok: false, message: "Move back a little." };
  const offsetX = ((box.minX + box.maxX) / 2 - oval.centerX) / oval.radiusX;
  const offsetY = ((box.minY + box.maxY) / 2 - oval.centerY) / oval.radiusY;
  if (Math.hypot(offsetX, offsetY) > 0.45) return { ok: false, message: "Center your face in the oval." };
  if (light < 30) return { ok: false, message: "It is too dark. Face a window or a lamp." };
  if (Math.abs(yaw) > 0.4) return { ok: false, message: "Look straight at the camera." };
  return { ok: true, message: "Perfect. Hold still." };
}

// Variance of a Laplacian filter over greyscale pixels: higher means a sharper, less blurred frame.
export function sharpness(pixels, width, height) {
  const grey = new Float32Array(width * height);
  for (let i = 0; i < grey.length; i++) grey[i] = pixels[i*4] * 0.299 + pixels[i*4+1] * 0.587 + pixels[i*4+2] * 0.114;
  let sum = 0, sumSq = 0, count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const at = y * width + x;
      const value = grey[at-1] + grey[at+1] + grey[at-width] + grey[at+width] - 4 * grey[at];
      sum += value; sumSq += value * value; count++;
    }
  }
  return count ? sumSq / count - (sum / count) ** 2 : 0;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createFaceScan(video, zone, onStatus) {
  const moduleUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs";
  const { FaceLandmarker, FilesetResolver } = await import(/* @vite-ignore */ moduleUrl);
  const files = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm");
  const detector = await FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "CPU" }, runningMode: "VIDEO", numFaces: 2, minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5, outputFacialTransformationMatrixes: false });

  const overlay = document.createElement("canvas"); overlay.className = "face-tracking-canvas"; overlay.setAttribute("aria-hidden", "true"); zone.appendChild(overlay);
  const guide = document.createElement("div"); guide.className = "face-scan-guidance";
  const instruction = document.createElement("strong");
  const hint = document.createElement("span"); hint.className = "face-scan-hint";
  guide.append(instruction, hint); zone.appendChild(guide);
  const countdown = document.createElement("div"); countdown.className = "face-scan-countdown"; countdown.setAttribute("aria-hidden", "true"); zone.appendChild(countdown);
  const context = overlay.getContext("2d");
  const sample = document.createElement("canvas"); sample.width = 64; sample.height = 64;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });

  let disposed = false, timer = 0, frameTime = -1, lastCheck = { ok: false, message: "Loading camera..." }, readySince = 0;
  let scanning = false, flashEl = null;

  function draw(points, ok) {
    overlay.width = video.videoWidth; overlay.height = video.videoHeight;
    const w = overlay.width, h = overlay.height, oval = guideOval(w, h);
    context.fillStyle = "#00000066";
    context.beginPath(); context.rect(0, 0, w, h); context.ellipse(oval.centerX, oval.centerY, oval.radiusX, oval.radiusY, 0, 0, Math.PI * 2, true); context.fill("evenodd");
    context.strokeStyle = ok ? "#75e6ae" : "#ffffff"; context.lineWidth = Math.max(3, w / 220);
    context.beginPath(); context.ellipse(oval.centerX, oval.centerY, oval.radiusX, oval.radiusY, 0, 0, Math.PI * 2); context.stroke();
    if (!points || !ok) return;
    context.save(); context.beginPath(); context.ellipse(oval.centerX, oval.centerY, oval.radiusX, oval.radiusY, 0, 0, Math.PI * 2); context.clip();
    context.fillStyle = "#75e6ae80";
    for (let i = 0; i < points.length; i += 6) { context.beginPath(); context.arc(points[i].x * w, points[i].y * h, 1.4, 0, Math.PI * 2); context.fill(); }
    context.restore();
  }

  function tick() {
    if (disposed) return;
    try {
      if (video.readyState < 2 || video.currentTime === frameTime) { timer = setTimeout(tick, 80); return; }
      frameTime = video.currentTime;
      zone.style.aspectRatio = video.videoWidth + " / " + video.videoHeight;
      const result = detector.detectForVideo(video, performance.now());
      const faces = result.faceLandmarks.length;
      const points = faces === 1 ? result.faceLandmarks[0] : null;
      let box = null, light = 0, yaw = 0;
      if (points) {
        let minX = 1, maxX = 0, minY = 1, maxY = 0;
        for (const point of points) { if (point.x < minX) minX = point.x; if (point.x > maxX) maxX = point.x; if (point.y < minY) minY = point.y; if (point.y > maxY) maxY = point.y; }
        box = { minX: minX * video.videoWidth, maxX: maxX * video.videoWidth, minY: minY * video.videoHeight, maxY: maxY * video.videoHeight };
        sampleContext.drawImage(video, box.minX, box.minY, Math.max(1, box.maxX - box.minX), Math.max(1, box.maxY - box.minY), 0, 0, 64, 64);
        const pixels = sampleContext.getImageData(0, 0, 64, 64).data;
        for (let i = 0; i < pixels.length; i += 4) light += pixels[i] * 0.2126 + pixels[i+1] * 0.7152 + pixels[i+2] * 0.0722;
        light /= 4096;
        yaw = landmarkPose(points)?.yaw || 0;
      }
      lastCheck = frameCheck({ faces, box, light, yaw, width: video.videoWidth, height: video.videoHeight });
      readySince = lastCheck.ok ? readySince || performance.now() : 0;
      if (!scanning) {
        instruction.textContent = lastCheck.ok ? "Ready. Tap Analyse My Skin." : lastCheck.message;
        hint.textContent = "Keep your face inside the oval. The screen will flash to light your skin.";
      }
      guide.classList.toggle("is-ready", lastCheck.ok);
      draw(points, lastCheck.ok);
      if (!scanning) onStatus(lastCheck.ok ? "Face detected. Tap Analyse My Skin." : lastCheck.message);
      timer = setTimeout(tick, 80);
    } catch {
      onStatus("Face tracking failed. Please retry or upload a photo.");
    }
  }

  async function setTorch(on) {
    const track = video.srcObject && video.srcObject.getVideoTracks ? video.srcObject.getVideoTracks()[0] : null;
    try {
      if (track && track.getCapabilities && track.getCapabilities().torch) await track.applyConstraints({ advanced: [{ torch: on }] });
    } catch { /* torch is optional */ }
  }

  function flash(on) {
    if (on && !flashEl) {
      // A white screen lights the face for the front camera, like a phone's selfie flash.
      flashEl = document.createElement("div");
      flashEl.setAttribute("aria-hidden", "true");
      flashEl.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#fffaf2;opacity:0;transition:opacity 120ms ease;pointer-events:none";
      document.body.appendChild(flashEl);
      requestAnimationFrame(() => { if (flashEl) flashEl.style.opacity = "1"; });
    }
    if (!on && flashEl) { flashEl.remove(); flashEl = null; }
    return setTorch(on);
  }

  function grabFrame() {
    const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const small = document.createElement("canvas"); small.width = 160; small.height = Math.round(160 * canvas.height / canvas.width);
    const smallContext = small.getContext("2d", { willReadFrequently: true });
    smallContext.drawImage(canvas, 0, 0, small.width, small.height);
    return { canvas, score: sharpness(smallContext.getImageData(0, 0, small.width, small.height).data, small.width, small.height) };
  }

  async function capture() {
    // Wait for a steady, well-placed face (up to 15 seconds).
    const started = performance.now();
    while (!(lastCheck.ok && readySince && performance.now() - readySince > 400)) {
      if (disposed) throw new Error("Scan cancelled. You can start again.");
      if (performance.now() - started > 15000) throw new Error("We could not see your face clearly. Try better light, or upload a photo.");
      instruction.textContent = lastCheck.message; hint.textContent = "The scan starts as soon as your face is in place.";
      onStatus(lastCheck.message);
      await wait(100);
    }
    for (const count of [3, 2, 1]) {
      if (disposed) throw new Error("Scan cancelled. You can start again.");
      if (!lastCheck.ok) { countdown.textContent = ""; return capture(); }
      countdown.textContent = String(count);
      instruction.textContent = "Hold still"; hint.textContent = "Capturing in " + count + "...";
      onStatus("Hold still. Capturing in " + count);
      await wait(550);
    }
    countdown.textContent = "";
    onStatus("Capturing...");
    await flash(true);
    try {
      await wait(450); // let the camera adjust its exposure to the flash
      const frames = [];
      for (let i = 0; i < 3; i++) { frames.push(grabFrame()); await wait(90); }
      frames.sort((a, b) => b.score - a.score);
      return [frames[0].canvas.toDataURL("image/jpeg", 0.88)];
    } finally {
      await flash(false);
    }
  }

  tick();
  return {
    start() {
      if (scanning) return Promise.reject(new Error("A scan is already running."));
      scanning = true;
      return capture().then((images) => { onStatus("Photo captured. Analysing your skin..."); return images; }).finally(() => { scanning = false; countdown.textContent = ""; });
    },
    close() {
      disposed = true; clearTimeout(timer); flash(false); detector.close();
      overlay.remove(); guide.remove(); countdown.remove();
    },
  };
}
