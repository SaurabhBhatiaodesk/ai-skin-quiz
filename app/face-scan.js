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

// The face guide is a circle in the middle of the frame, sized from the shorter side so it (and its ticks)
// stays inside the portrait camera frame, which crops the sides of a landscape video.
export function guideOval(width, height) {
  const radius = Math.min(width, height) * 0.34;
  return { centerX: width * 0.5, centerY: height * 0.5, radiusX: radius, radiusY: radius };
}

// Decides whether the current frame is good enough to start the flash capture, and what to tell the shopper.
// box is the face bounding box in pixels; light is the average face brightness (0-255).
export function frameCheck({ faces, box, light, yaw, width, height }) {
  if (!faces) return { ok: false, message: "Keep your face in the circle." };
  if (faces > 1) return { ok: false, message: "Only one face should be visible." };
  const oval = guideOval(width, height);
  const faceWidth = box.maxX - box.minX;
  if (faceWidth < oval.radiusX * 2 * 0.5) return { ok: false, message: "Move a little closer." };
  if (faceWidth > oval.radiusX * 2 * 1.15) return { ok: false, message: "Move back a little." };
  const offsetX = ((box.minX + box.maxX) / 2 - oval.centerX) / oval.radiusX;
  const offsetY = ((box.minY + box.maxY) / 2 - oval.centerY) / oval.radiusY;
  if (Math.hypot(offsetX, offsetY) > 0.45) return { ok: false, message: "Move your face to the centre." };
  if (light < 30) return { ok: false, message: "Move to a brighter spot." };
  if (Math.abs(yaw) > 0.4) return { ok: false, message: "Look straight at the camera." };
  return { ok: true, message: "Hold still." };
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
// How long the face must stay steady in the oval before the photo is taken.
export const HOLD_MS = 1400;

// Progress (0-1) of the hold-to-scan ring.
export function holdProgress(readySince, now) {
  return readySince ? Math.min(1, Math.max(0, (now - readySince) / HOLD_MS)) : 0;
}

const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
let visionModule = null;
function loadVision() {
  visionModule ||= import(/* @vite-ignore */ VISION_URL + "/vision_bundle.mjs").then(async (module) => ({ module, files: await module.FilesetResolver.forVisionTasks(VISION_URL + "/wasm") }));
  visionModule.catch(() => { visionModule = null; });
  return visionModule;
}

// Landmarks for a still photo (used for uploaded photos, which have no live tracking).
export async function detectImageLandmarks(src) {
  const { module, files } = await loadVision();
  const detector = await module.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" }, runningMode: "IMAGE", numFaces: 1 });
  try {
    const image = new Image();
    image.src = src;
    await image.decode();
    const result = detector.detect(image);
    return result.faceLandmarks.length === 1 ? result.faceLandmarks[0].map((point) => ({ x: point.x, y: point.y })) : null;
  } finally {
    detector.close();
  }
}

const HAND_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Why a captured photo cannot be analysed, or null when it is fine. Points are normalised (0-1);
// a hand covers the face when several of its landmarks fall inside the (slightly padded) face box.
export function photoProblem({ faces, points, hands }) {
  if (!faces) return "We could not find your face in the photo. Face the camera in good light and try again.";
  if (faces > 1) return "Only one face should be in the photo. Try again on your own.";
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const padX = (maxX - minX) * 0.05, padY = (maxY - minY) * 0.05;
  const covering = (hands || []).some((hand) => hand.filter((point) => point.x > minX - padX && point.x < maxX + padX && point.y > minY - padY && point.y < maxY + padY).length >= 4);
  if (covering) return "Keep your hands away from your face, then try again.";
  const pose = landmarkPose(points);
  if (pose && Math.abs(pose.yaw) > 0.45) return "Look straight at the camera, then try again.";
  return null;
}

// Checks the photo that will be analysed: finds the face on that exact image (so the skin map lines up with it)
// and rejects photos with a hand over the face, several faces or a turned head. Returns null if the check
// itself cannot run (offline model), so the scan is not blocked by it.
// The photo-check detectors are created once and kept; the camera warms them up while the shopper frames
// their face, so the check after the flash takes a moment instead of a model download.
let photoDetectors = null;
export function preparePhotoCheck() {
  photoDetectors ||= loadVision().then(async ({ module, files }) => {
    const face = await module.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" }, runningMode: "IMAGE", numFaces: 2 });
    const hand = await module.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "CPU" }, runningMode: "IMAGE", numHands: 2 }).catch(() => null);
    return { face, hand };
  });
  photoDetectors.catch(() => { photoDetectors = null; });
  return photoDetectors;
}

export async function checkPhoto(src) {
  try {
    const { face, hand } = await preparePhotoCheck();
    const image = new Image();
    image.src = src;
    await image.decode();
    const faces = face.detect(image).faceLandmarks;
    let hands = [];
    try { hands = hand ? hand.detect(image).landmarks : []; } catch { hands = []; }
    const points = faces.length ? faces[0].map((point) => ({ x: point.x, y: point.y })) : null;
    return { points, problem: photoProblem({ faces: faces.length, points, hands }) };
  } catch {
    return null;
  }
}

// Mesh lines drawn over the face for the scan look (face outline, eyes, lips, nose).
export const FACE_CONTOURS = [
  [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10],
  [33,160,158,133,153,144,33], [263,387,385,362,380,373,263],
  [61,40,37,0,267,270,291,321,314,17,84,91,61], [168,6,197,195,5,4,1],
  [70,63,105,66,107], [336,296,334,293,300],
];

// Circles marking each facial region, placed from landmarks (normalised 0-1) on a photo of width x height pixels.
// Sizes scale with the distance between the outer eye corners, so they fit any face size.
export function regionCircles(points, width, height, region) {
  const p = (index) => points[index] ? { x: points[index].x * width, y: points[index].y * height } : null;
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const leftEye = p(33), rightEye = p(263);
  if (!leftEye || !rightEye) return [];
  const span = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const circle = (point, size) => point ? { x: point.x, y: point.y, r: span * size } : null;
  const below = (point, amount) => point ? { x: point.x, y: point.y + span * amount } : null;
  const shapes = {
    forehead: () => [circle(p(9) && p(10) ? mix(p(9), p(10), 0.6) : null, 0.34)],
    between_brows: () => [circle(p(9), 0.15)],
    under_eyes: () => [circle(below(p(145), 0.14), 0.15), circle(below(p(374), 0.14), 0.15)],
    nose: () => [circle(p(6) && p(1) ? mix(p(6), p(1), 0.6) : null, 0.17)],
    // Cheek centres sit between the inner cheek (50/280) and the face edge (234/454), a little lower.
    cheeks: () => [circle(p(50) && p(234) ? below(mix(p(50), p(234), 0.35), 0.08) : null, 0.24), circle(p(280) && p(454) ? below(mix(p(280), p(454), 0.35), 0.08) : null, 0.24)],
    mouth_area: () => [circle(p(13), 0.3)],
    chin: () => [circle(p(17) && p(152) ? mix(p(17), p(152), 0.55) : null, 0.2)],
    jawline: () => [circle(p(172), 0.17), circle(p(397), 0.17)],
  };
  return (shapes[region] ? shapes[region]() : []).filter(Boolean);
}

export async function createFaceScan(video, zone, onStatus) {
  const { module, files } = await loadVision();
  const detector = await module.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" }, runningMode: "VIDEO", numFaces: 2, minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5, outputFacialTransformationMatrixes: false });
  // Warm up the photo check (face + hand models) once live tracking is running.
  preparePhotoCheck().catch(() => {});

  const overlay = document.createElement("canvas"); overlay.className = "face-tracking-canvas"; overlay.setAttribute("aria-hidden", "true"); zone.appendChild(overlay);
  const guide = document.createElement("div"); guide.className = "face-scan-guidance";
  const instruction = document.createElement("strong");
  const hint = document.createElement("span"); hint.className = "face-scan-hint";
  const quality = document.createElement("span"); quality.className = "face-scan-quality";
  quality.hidden = true;
  guide.append(instruction, hint, quality);
  // The guidance is a glass pill inside the camera frame (popup and page section).
  zone.appendChild(guide);
  const countdown = document.createElement("div"); countdown.className = "face-scan-countdown"; countdown.setAttribute("aria-hidden", "true"); zone.appendChild(countdown);
  const context = overlay.getContext("2d");
  const sample = document.createElement("canvas"); sample.width = 64; sample.height = 64;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });

  let disposed = false, timer = 0, lastCheck = { ok: false, message: "Loading camera..." }, readySince = 0;
  let scanning = false, flashEl = null, checkedAt = 0, trackingFailed = false, faceBox = null, facePoints = null;
  // Count presented frames. Some mobile browsers never advance video.currentTime for a live camera,
  // so it cannot be used to tell whether a new frame has arrived.
  let presentedFrames = 0, processedFrames = -1, processedAt = 0;
  const startedAt = performance.now();
  if (video.requestVideoFrameCallback) {
    const onFrame = () => { presentedFrames++; if (!disposed) video.requestVideoFrameCallback(onFrame); };
    video.requestVideoFrameCallback(onFrame);
  }
  function hasNewFrame(now) {
    if (!video.requestVideoFrameCallback) return true;
    // Fall back to time-based sampling if frame callbacks stall while the video is playing.
    return presentedFrames !== processedFrames || now - processedAt > 400;
  }

  // Viewfinder: the room is dimmed, the oval is ringed by short ticks (like Face ID setup) that light up while
  // the face holds steady, and a soft scan line moves inside the oval while scanning.
  function draw(points, ok) {
    overlay.width = video.videoWidth; overlay.height = video.videoHeight;
    const w = overlay.width, h = overlay.height, oval = guideOval(w, h), now = performance.now();
    context.clearRect(0, 0, w, h);
    context.fillStyle = "rgba(8, 7, 6, 0.5)";
    context.beginPath(); context.rect(0, 0, w, h); context.ellipse(oval.centerX, oval.centerY, oval.radiusX, oval.radiusY, 0, 0, Math.PI * 2, true); context.fill("evenodd");
    const progress = ok && scanning ? holdProgress(readySince, now) : 0;
    const ticks = 72, unit = Math.min(w, h) / 100;
    context.lineCap = "round";
    context.lineWidth = Math.max(2, unit * 0.55);
    for (let i = 0; i < ticks; i++) {
      const angle = (i / ticks) * Math.PI * 2 - Math.PI / 2;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const lit = i / ticks < progress;
      const inner = 1.06, outer = lit ? 1.15 : 1.12;
      context.strokeStyle = lit ? "#7fe0a6" : ok ? "rgba(255, 255, 255, 0.75)" : "rgba(255, 255, 255, 0.4)";
      context.beginPath();
      context.moveTo(oval.centerX + cos * oval.radiusX * inner, oval.centerY + sin * oval.radiusY * inner);
      context.lineTo(oval.centerX + cos * oval.radiusX * outer, oval.centerY + sin * oval.radiusY * outer);
      context.stroke();
    }
    if (ok && scanning) {
      // Soft scan line sweeping top to bottom inside the oval.
      const phase = (now % 1600) / 1600;
      const y = oval.centerY - oval.radiusY + phase * oval.radiusY * 2;
      context.save();
      context.beginPath(); context.ellipse(oval.centerX, oval.centerY, oval.radiusX, oval.radiusY, 0, 0, Math.PI * 2); context.clip();
      const band = context.createLinearGradient(0, y - unit * 8, 0, y + unit * 1);
      band.addColorStop(0, "rgba(127, 224, 166, 0)"); band.addColorStop(1, "rgba(127, 224, 166, 0.35)");
      context.fillStyle = band; context.fillRect(0, y - unit * 8, w, unit * 9);
      context.fillStyle = "rgba(200, 255, 225, 0.85)"; context.fillRect(0, y, w, Math.max(1, unit * 0.3));
      context.restore();
    }
  }

  function tick() {
    if (disposed) return;
    try {
      const now = performance.now();
      const playing = video.readyState >= 2 && !video.paused && !video.ended && !document.hidden && video.videoWidth > 0;
      if (!playing || !hasNewFrame(now)) {
        // Tell the shopper when the camera never starts (for example, autoplay blocked in low-power mode).
        if (!playing && now - (checkedAt || startedAt) >= (checkedAt ? 600 : 1500)) {
          readySince = 0; lastCheck = { ok: false, message: "Camera paused. Tap Live Camera to resume, or upload a photo." };
          instruction.textContent = lastCheck.message; quality.textContent = "Waiting for live camera";
          guide.classList.remove("is-ready");
          if (video.videoWidth && video.videoHeight) draw(null,false);
          if (!scanning) onStatus(lastCheck.message);
        }
        timer = setTimeout(tick, 80); return;
      }
      processedFrames = presentedFrames; processedAt = now;
      // Video and landmark canvas share the same centered cover crop in CSS.
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
      checkedAt = performance.now();
      faceBox = box; facePoints = points;
      quality.textContent = [faces === 1 ? "Face detected" : "Face needed", light >= 30 ? "Lighting ready" : "More light needed", lastCheck.ok ? "Position ready" : "Adjust position"].join("  \u00b7  ");
      readySince = lastCheck.ok ? readySince || performance.now() : 0;
      if (!scanning) {
        instruction.textContent = lastCheck.ok ? "Face found" : lastCheck.message;
        hint.textContent = "";
      }
      guide.classList.toggle("is-ready", lastCheck.ok);
      draw(points, lastCheck.ok);
      if (!scanning) onStatus(lastCheck.ok ? "Ready to take your photo." : lastCheck.message);
      timer = setTimeout(tick, 80);
    } catch {
      trackingFailed = true; lastCheck = { ok: false, message: "Face tracking failed. Please retry or upload a photo." }; readySince = 0;
      onStatus(lastCheck.message);
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

  // Still photo through the ImageCapture API (Chrome on Android and desktop). Only used when it has the same
  // framing as the preview, so the face landmarks still line up; otherwise the caller falls back to video frames.
  async function takeStill() {
    const track = video.srcObject && video.srcObject.getVideoTracks ? video.srcObject.getVideoTracks()[0] : null;
    if (!track || typeof ImageCapture === "undefined") return null;
    try {
      const blob = await Promise.race([new ImageCapture(track).takePhoto(), wait(2500).then(() => null)]);
      if (!blob) return null;
      const bitmap = await createImageBitmap(blob);
      const sameFraming = Math.abs(bitmap.width / bitmap.height - video.videoWidth / video.videoHeight) < 0.03;
      if (!sameFraming || bitmap.width <= video.videoWidth) { bitmap.close(); return null; }
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return canvas;
    } catch {
      return null;
    }
  }

  function grabFrame() {
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const small = document.createElement("canvas"); small.width = 160; small.height = Math.round(160 * canvas.height / canvas.width);
    const smallContext = small.getContext("2d", { willReadFrequently: true });
    // Rank facial detail, not sharp wallpaper or objects behind the shopper.
    if (faceBox) smallContext.drawImage(video, Math.max(0,faceBox.minX), Math.max(0,faceBox.minY), Math.max(1,faceBox.maxX-faceBox.minX), Math.max(1,faceBox.maxY-faceBox.minY), 0, 0, small.width, small.height);
    else smallContext.drawImage(canvas, 0, 0, small.width, small.height);
    // Keep the landmarks seen with this frame so the result can mark facial regions on the photo.
    return { canvas, points: facePoints ? facePoints.map((point) => ({ x: point.x, y: point.y })) : null, score: sharpness(smallContext.getImageData(0, 0, small.width, small.height).data, small.width, small.height) };
  }

  function assertActive() {
    if (disposed) throw new Error("Scan cancelled. You can start again.");
    if (trackingFailed) throw new Error("Face tracking stopped. Switch to Upload, or reopen the camera.");
  }
  function freshFace() { return lastCheck.ok && performance.now() - checkedAt < 600 && !document.hidden && !video.paused && !video.ended; }
  // The photo itself is checked before it is sent: a hand over the face or a turned head stops the scan
  // (the camera keeps running for another try), and the landmarks found on the photo replace the live ones.
  async function verified(images) {
    instruction.textContent = "Checking your photo…";
    onStatus(instruction.textContent);
    const verdict = await Promise.race([checkPhoto(images[0]), wait(9000).then(() => null)]);
    if (verdict && verdict.problem) { readySince = 0; instruction.textContent = verdict.problem; throw new Error(verdict.problem); }
    if (verdict && verdict.points) images.landmarks = verdict.points;
    return images;
  }
  async function capture() {
    // Hold-to-scan: the ring around the oval fills while the face stays steady, then the photo is taken.
    const deadline = performance.now() + 20000;
    while (!(freshFace() && readySince && performance.now() - readySince >= HOLD_MS)) {
      assertActive();
      if (performance.now() > deadline) throw new Error("We could not see your face clearly. Try better light, or upload a photo.");
      instruction.textContent = freshFace() ? "Hold still — scanning" : lastCheck.message;
      onStatus(instruction.textContent);
      await wait(60);
    }
    countdown.textContent = "";
    onStatus("Capturing...");
    await flash(true);
    try {
      await wait(450); // let the camera adjust its exposure to the flash
      // A full-resolution still from the camera is much sharper than a video frame; use it when available.
      const still = await takeStill();
      if (still) {
        const images = [still.toDataURL("image/jpeg", 0.9)];
        images.landmarks = facePoints ? facePoints.map((point) => ({ x: point.x, y: point.y })) : null;
        return await verified(images);
      }
      const frames = [];
      for (let i = 0; i < 5; i++) {
        if (disposed) throw new Error("Scan cancelled. You can start again.");
        assertActive();
        if (!freshFace()) throw new Error("Your face moved during capture. Position your face and retry.");
        frames.push(grabFrame()); await wait(70);
      }
      if (disposed) throw new Error("Scan cancelled. You can start again.");
      frames.sort((a, b) => b.score - a.score);
      const images = [frames[0].canvas.toDataURL("image/jpeg", 0.88)];
      images.landmarks = frames[0].points;
      return await verified(images);
    } finally {
      await flash(false);
    }
  }


  tick();
  return {
    start() {
      if (disposed) return Promise.reject(new Error("Camera closed. Please reopen it."));
      if (scanning) return Promise.reject(new Error("A scan is already running."));
      scanning = true;
      return capture().then((images) => { onStatus("Photo captured. Analysing visible skin details…"); return images; }).finally(() => { scanning = false; countdown.textContent = ""; });
    },
    close() {
      disposed = true; clearTimeout(timer); flash(false); detector.close();
      overlay.remove(); guide.remove(); countdown.remove();
    },
  };
}
