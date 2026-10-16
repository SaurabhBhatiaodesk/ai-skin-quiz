// Skin map in the style of a professional skin analysis: a fine scan grid over the face, corner brackets
// framing it, and magnified "loupe" circles beside the face that show the actual skin at each observed
// area, joined to the spot by a thin line. Positions come from face landmarks (MediaPipe), not the AI model.
import { FACE_CONTOURS, detectImageLandmarks, regionCircles } from "./face-scan.js";

export const CONCERN_STYLES = {
  dryness: { label: "Dryness", color: "#e3a33b" },
  redness: { label: "Redness", color: "#e05a78" },
  pigmentation: { label: "Uneven tone", color: "#b0743f" },
  texture: { label: "Texture", color: "#8b6fd6" },
  fine_lines: { label: "Fine lines", color: "#4d92dc" },
  dullness: { label: "Dullness", color: "#c2a35a" },
};

export const REGION_LABELS = {
  forehead: "Forehead",
  between_brows: "Between the brows",
  under_eyes: "Under the eyes",
  nose: "Nose",
  cheeks: "Cheeks",
  mouth_area: "Around the mouth",
  chin: "Chin",
  jawline: "Jawline",
};

const INTENSITY_LABELS = { mild: "Mild", moderate: "Moderate", pronounced: "Pronounced" };
const SVG = "http://www.w3.org/2000/svg";
const ZOOM = 1.8;

function svg(tag, attributes) {
  const element = document.createElementNS(SVG, tag);
  for (const key in attributes) element.setAttribute(key, String(attributes[key]));
  return element;
}

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image.decode().then(() => image);
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

// Portrait crop around the face. faceAt (0-1) is where the face centre sits horizontally, leaving room
// for the loupe column. Returns pixel bounds in the original photo.
export function faceCrop(points, width, height, faceAt = 0.5) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const point of points) { if (point.x < minX) minX = point.x; if (point.x > maxX) maxX = point.x; if (point.y < minY) minY = point.y; if (point.y > maxY) maxY = point.y; }
  const faceW = (maxX - minX) * width, faceH = (maxY - minY) * height;
  const top = minY * height - faceH * 0.3, bottom = maxY * height + faceH * 0.14;
  // Wide enough that the face fills about half the frame, leaving the other side for the loupes.
  let h = Math.max(bottom - top, faceW * 2.3), w = h * 0.86;
  if (w > width) { w = width; h = Math.min(height, w / 0.86); }
  if (h > height) { h = height; w = Math.min(width, h * 0.86); }
  const centerX = (minX + maxX) / 2 * width, centerY = (top + bottom) / 2;
  const x = Math.min(Math.max(0, centerX - w * faceAt), width - w), y = Math.min(Math.max(0, centerY - h / 2), height - h);
  return { x, y, w, h };
}

// Crops (and mirrors, for selfie captures) into a new image, so overlays use plain display coordinates.
function cropPhoto(image, crop, mirrored) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1400 / Math.max(crop.w, crop.h));
  canvas.width = Math.round(crop.w * scale); canvas.height = Math.round(crop.h * scale);
  const context = canvas.getContext("2d");
  if (mirrored) { context.translate(canvas.width, 0); context.scale(-1, 1); }
  context.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

// Only areas with a known concern and at least one known region can be drawn.
export function mappableAreas(areas) {
  return (Array.isArray(areas) ? areas : []).filter((area) => area && CONCERN_STYLES[area.concern] && Array.isArray(area.regions) && area.regions.some((region) => REGION_LABELS[region]));
}

// Vertical centres for n loupes, grouped around the face centre and kept inside the frame.
export function loupeSlots(count, centerY, radius, height) {
  const gap = radius * 2.35;
  const first = Math.min(Math.max(radius * 1.15, centerY - (gap * (count - 1)) / 2), height - radius * 1.15 - gap * (count - 1));
  return Array.from({ length: count }, (_, index) => first + gap * index);
}

function drawOverlay(stage, shown, points, width, height, marked, uid) {
  const unit = Math.max(width, height) / 400;
  const overlay = svg("svg", { viewBox: "0 0 " + width + " " + height, "aria-hidden": "true", class: "face-map-overlay" });
  const defs = svg("defs", {});
  overlay.appendChild(defs);
  const at = (index) => ({ x: points[index].x * width, y: points[index].y * height });

  // Face outline keeps the scan grid on the skin.
  const outline = FACE_CONTOURS[0].filter((index) => points[index]).map(at);
  const faceClip = svg("clipPath", { id: uid + "-face" });
  faceClip.appendChild(svg("polygon", { points: outline.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ") }));
  defs.appendChild(faceClip);
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (const p of outline) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }

  // Scan grid with sparkle points, clipped to the face.
  const step = unit * 7.5;
  const startX = minX - (minX % step), startY = minY - (minY % step);
  // Soft edge so the grid melts into the skin instead of ending in a hard line.
  const fade = svg("radialGradient", { id: uid + "-fade", cx: "50%", cy: "50%", r: "55%" });
  fade.appendChild(svg("stop", { offset: "55%", "stop-color": "#ffffff", "stop-opacity": 1 }));
  fade.appendChild(svg("stop", { offset: "100%", "stop-color": "#ffffff", "stop-opacity": 0 }));
  defs.appendChild(fade);
  const mask = svg("mask", { id: uid + "-mask" });
  mask.appendChild(svg("rect", { x: minX, y: minY, width: maxX - minX, height: maxY - minY, fill: "url(#" + uid + "-fade)" }));
  defs.appendChild(mask);
  const grid = svg("g", { class: "face-map-grid", "clip-path": "url(#" + uid + "-face)", mask: "url(#" + uid + "-mask)" });
  let lines = "";
  for (let x = startX; x <= maxX; x += step) lines += "M" + x.toFixed(1) + " " + minY.toFixed(1) + "V" + maxY.toFixed(1);
  for (let y = startY; y <= maxY; y += step) lines += "M" + minX.toFixed(1) + " " + y.toFixed(1) + "H" + maxX.toFixed(1);
  grid.appendChild(svg("path", { d: lines, stroke: "#ffffff", "stroke-opacity": 0.22, "stroke-width": unit * 0.35, fill: "none" }));
  for (let x = startX; x <= maxX; x += step * 2) {
    for (let y = startY; y <= maxY; y += step * 2) grid.appendChild(svg("circle", { cx: x, cy: y, r: unit * 0.75, fill: "#ffffff", "fill-opacity": 0.75 }));
  }
  const nose = points[1] ? at(1) : { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  grid.appendChild(svg("path", { d: "M" + nose.x.toFixed(1) + " " + minY.toFixed(1) + "V" + maxY.toFixed(1), stroke: "#ffffff", "stroke-opacity": 0.55, "stroke-width": unit * 0.6 }));
  overlay.appendChild(grid);

  // Corner brackets framing the face.
  const pad = unit * 6, arm = (maxX - minX) * 0.16, bend = unit * 4;
  const corners = [[minX - pad, minY - pad, 1, 1], [maxX + pad, minY - pad, -1, 1], [minX - pad, maxY + pad, 1, -1], [maxX + pad, maxY + pad, -1, -1]];
  const brackets = svg("g", { class: "face-map-brackets", fill: "none", stroke: "#b8f5d2", "stroke-width": unit * 1.8, "stroke-linecap": "round", "stroke-linejoin": "round" });
  for (const [x, y, dx, dy] of corners) brackets.appendChild(svg("path", { d: "M" + x + " " + (y + dy * arm) + "V" + (y + dy * bend) + "Q" + x + " " + y + " " + (x + dx * bend) + " " + y + "H" + (x + dx * arm) }));
  overlay.appendChild(brackets);

  // Loupes: magnified skin from each observed spot, in a column beside the face.
  const radius = Math.min(width * (marked.length <= 3 ? 0.16 : 0.13), height / (marked.length * 2.5));
  // Light sharpening keeps skin texture crisp inside the magnified circles.
  const sharpen = svg("filter", { id: uid + "-sharp", x: "0", y: "0", width: "100%", height: "100%" });
  sharpen.appendChild(svg("feConvolveMatrix", { order: "3", kernelMatrix: "0 -0.6 0 -0.6 3.4 -0.6 0 -0.6 0", preserveAlpha: "true" }));
  defs.appendChild(sharpen);
  const columnX = width - radius - unit * 7;
  const slots = loupeSlots(marked.length, (minY + maxY) / 2, radius, height);
  // For areas on both sides (cheeks, under the eyes), point at the side nearer the loupes.
  const spots = marked.map((area) => area.regions.flatMap((region) => regionCircles(points, width, height, region)).sort((a, b) => b.x - a.x)[0] || null);
  // Two areas on the same spot would share one marker; move the later one a little down the face.
  spots.forEach((spot, index) => {
    if (!spot) return;
    for (const other of spots.slice(0, index)) {
      if (other && Math.hypot(spot.x - other.x, spot.y - other.y) < unit * 9) spots[index] = { ...spot, y: other.y + unit * 12 };
    }
  });
  // Stack the loupes in the same top-to-bottom order as their spots, so connector lines never cross.
  const order = marked.map((_, index) => index).sort((a, b) => (spots[a] ? spots[a].y : 0) - (spots[b] ? spots[b].y : 0));
  marked.forEach((area, index) => {
    const spot = spots[index];
    if (!spot) return;
    const color = CONCERN_STYLES[area.concern].color;
    const cy = slots[order.indexOf(index)], edgeX = columnX - radius;
    const group = svg("g", { class: "face-map-loupe", style: "--delay:" + (0.4 + index * 0.25) + "s" });
    group.appendChild(svg("path", { d: "M" + spot.x.toFixed(1) + " " + spot.y.toFixed(1) + "L" + edgeX.toFixed(1) + " " + cy.toFixed(1), stroke: "#ffffff", "stroke-width": unit * 0.9, "stroke-opacity": 0.9, fill: "none" }));
    group.appendChild(svg("circle", { cx: spot.x, cy: spot.y, r: unit * 3.2, fill: "#ffffff", "fill-opacity": 0.35 }));
    group.appendChild(svg("circle", { cx: spot.x, cy: spot.y, r: unit * 1.7, fill: "#ffffff" }));
    group.appendChild(svg("circle", { cx: edgeX, cy, r: unit * 1.5, fill: "#ffffff" }));
    const clip = svg("clipPath", { id: uid + "-loupe-" + index });
    clip.appendChild(svg("circle", { cx: columnX, cy, r: radius }));
    defs.appendChild(clip);
    group.appendChild(svg("circle", { cx: columnX, cy, r: radius + unit * 3, fill: "#000000", "fill-opacity": 0.18 }));
    group.appendChild(svg("image", { href: shown, x: columnX - spot.x * ZOOM, y: cy - spot.y * ZOOM, width: width * ZOOM, height: height * ZOOM, preserveAspectRatio: "none", "clip-path": "url(#" + uid + "-loupe-" + index + ")", filter: "url(#" + uid + "-sharp)" }));
    group.appendChild(svg("circle", { cx: columnX, cy, r: radius, fill: "none", stroke: "#ffffff", "stroke-width": unit * 2.4 }));
    // Thin ring in the concern colour ties the loupe to its row in the list.
    group.appendChild(svg("circle", { cx: columnX, cy, r: radius + unit * 2.6, fill: "none", stroke: color, "stroke-width": unit * 1.1, "stroke-opacity": 0.9 }));
    // Number badge linking the loupe to the list below.
    const bx = columnX - radius * 0.72, by = cy - radius * 0.72;
    group.appendChild(svg("circle", { cx: bx, cy: by, r: unit * 6.5, fill: color, stroke: "#ffffff", "stroke-width": unit * 1.4 }));
    const text = svg("text", { x: bx, y: by, "text-anchor": "middle", "dominant-baseline": "central", "font-size": unit * 7.5, "font-weight": 700, fill: "#ffffff", "font-family": "system-ui, sans-serif" });
    text.textContent = String(index + 1);
    group.appendChild(text);
    overlay.appendChild(group);
  });
  stage.appendChild(overlay);
}

// Builds the figure. Returns null when there is nothing to show.
// mirrored: camera captures are shown mirrored, like the selfie preview the shopper saw.
export async function buildFaceMap({ photo, areas, landmarks, mirrored }) {
  const marked = mappableAreas(areas);
  if (!photo || !marked.length) return null;
  const image = await loadImage(photo);
  const original = { width: image.naturalWidth, height: image.naturalHeight };
  let points = landmarks || await withTimeout(detectImageLandmarks(photo).catch(() => null), 8000);
  let shown = photo, width = original.width, height = original.height;
  if (points) {
    // Face on the left, loupes on the right of the displayed (possibly mirrored) frame.
    const crop = faceCrop(points, original.width, original.height, mirrored ? 0.6 : 0.4);
    shown = cropPhoto(image, crop, mirrored);
    points = points.map((point) => {
      const x = (point.x * original.width - crop.x) / crop.w;
      return { x: mirrored ? 1 - x : x, y: (point.y * original.height - crop.y) / crop.h };
    });
    const cropped = await loadImage(shown);
    width = cropped.naturalWidth; height = cropped.naturalHeight;
  }

  const figure = document.createElement("figure");
  figure.className = "face-map";
  figure.setAttribute("data-face-map", "");

  const header = document.createElement("div");
  header.className = "face-map-header";
  const title = document.createElement("h3"); title.className = "face-map-title"; title.textContent = "Skin map";
  const subtitle = document.createElement("p"); subtitle.className = "face-map-subtitle";
  subtitle.textContent = marked.length === 1 ? "1 area observed" : marked.length + " areas observed";
  header.append(title, subtitle);

  const stage = document.createElement("div");
  stage.className = "face-map-stage";
  const img = document.createElement("img");
  img.src = shown; img.alt = "Your photo with magnified views of the observed skin areas";
  if (!points && mirrored) img.style.transform = "scaleX(-1)";
  stage.appendChild(img);
  if (points) drawOverlay(stage, shown, points, width, height, marked, "fm" + Math.random().toString(36).slice(2, 8));

  const legend = document.createElement("figcaption");
  legend.className = "face-map-legend";
  const list = document.createElement("ol");
  list.className = "face-map-list";
  marked.forEach((area, index) => {
    const style = CONCERN_STYLES[area.concern];
    const item = document.createElement("li");
    item.className = "face-map-item";
    item.style.setProperty("--area-color", style.color);
    const number = document.createElement("span"); number.className = "face-map-number"; number.textContent = String(index + 1);
    const body = document.createElement("div");
    const head = document.createElement("div"); head.className = "face-map-item-head";
    const name = document.createElement("strong"); name.textContent = style.label;
    head.appendChild(name);
    if (INTENSITY_LABELS[area.intensity]) {
      const chip = document.createElement("span"); chip.className = "face-map-chip"; chip.textContent = INTENSITY_LABELS[area.intensity];
      head.appendChild(chip);
    }
    const where = document.createElement("span"); where.className = "face-map-where";
    where.textContent = area.regions.map((region) => REGION_LABELS[region]).filter(Boolean).join(" · ");
    const text = document.createElement("p"); text.textContent = area.observation || "";
    body.append(head, where, text);
    item.append(number, body);
    list.appendChild(item);
  });
  const note = document.createElement("p");
  note.className = "face-map-note";
  note.textContent = points ? "Circles show a magnified view of each area." : "We could not map the areas on this photo.";
  legend.append(list, note);

  figure.append(header, stage, legend);
  return figure;
}
