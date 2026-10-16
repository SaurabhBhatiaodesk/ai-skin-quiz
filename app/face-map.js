// Premium skin map: circles on the shopper's own photo mark where each visible concern was observed.
// Circle positions come from face landmarks (MediaPipe), not from the AI model, so they sit on the right facial area.
import { detectImageLandmarks, regionCircles } from "./face-scan.js";

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

// Portrait crop (4:5) around the face so it fills the map instead of the room behind it.
// Returns pixel bounds in the original photo.
export function faceCrop(points, width, height) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const point of points) { if (point.x < minX) minX = point.x; if (point.x > maxX) maxX = point.x; if (point.y < minY) minY = point.y; if (point.y > maxY) maxY = point.y; }
  const faceW = (maxX - minX) * width, faceH = (maxY - minY) * height;
  const top = minY * height - faceH * 0.32, bottom = maxY * height + faceH * 0.16;
  let h = Math.max(bottom - top, faceW * 1.6 * 1.25), w = h * 0.8;
  if (w > width) { w = width; h = Math.min(height, w * 1.25); }
  if (h > height) { h = height; w = Math.min(width, h * 0.8); }
  const centerX = (minX + maxX) / 2 * width, centerY = (top + bottom) / 2;
  const x = Math.min(Math.max(0, centerX - w / 2), width - w), y = Math.min(Math.max(0, centerY - h / 2), height - h);
  return { x, y, w, h };
}

function cropPhoto(image, crop) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 900 / Math.max(crop.w, crop.h));
  canvas.width = Math.round(crop.w * scale); canvas.height = Math.round(crop.h * scale);
  canvas.getContext("2d").drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

// Only areas with a known concern and at least one known region can be drawn.
export function mappableAreas(areas) {
  return (Array.isArray(areas) ? areas : []).filter((area) => area && CONCERN_STYLES[area.concern] && Array.isArray(area.regions) && area.regions.some((region) => REGION_LABELS[region]));
}

// Builds the figure. Returns null when there is nothing to show.
// mirrored: camera captures are shown mirrored, like the selfie preview the shopper saw.
export async function buildFaceMap({ photo, areas, landmarks, mirrored }) {
  const marked = mappableAreas(areas);
  if (!photo || !marked.length) return null;
  const image = await loadImage(photo);
  let width = image.naturalWidth, height = image.naturalHeight;
  let points = landmarks || await withTimeout(detectImageLandmarks(photo).catch(() => null), 8000);
  let shown = photo;
  if (points) {
    // Show the face, not the room: crop and move the landmarks into the cropped frame.
    const crop = faceCrop(points, width, height);
    shown = cropPhoto(image, crop);
    points = points.map((point) => ({ x: (point.x * width - crop.x) / crop.w, y: (point.y * height - crop.y) / crop.h }));
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
  img.src = shown; img.alt = "Your photo with the observed skin areas circled";
  if (mirrored) img.style.transform = "scaleX(-1)";
  stage.appendChild(img);

  if (points) {
    const fx = (x) => (mirrored ? width - x : x);
    const overlay = svg("svg", { viewBox: "0 0 " + width + " " + height, "aria-hidden": "true", class: "face-map-overlay" });
    const unit = Math.max(width, height) / 400;
    const defs = svg("defs", {});
    overlay.appendChild(defs);
    const uid = "fm" + Math.random().toString(36).slice(2, 8);

    // Each observed area is a soft colour glow on the skin with one numbered pin. No outlines or connector lines.
    const pins = [];
    marked.forEach((area, index) => {
      const color = CONCERN_STYLES[area.concern].color;
      const gradient = svg("radialGradient", { id: uid + "-" + index });
      gradient.appendChild(svg("stop", { offset: "0%", "stop-color": color, "stop-opacity": 0.55 }));
      gradient.appendChild(svg("stop", { offset: "55%", "stop-color": color, "stop-opacity": 0.28 }));
      gradient.appendChild(svg("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0 }));
      defs.appendChild(gradient);
      const group = svg("g", { class: "face-map-area", style: "--delay:" + (0.25 + index * 0.2) + "s" });
      const circles = area.regions.flatMap((region) => regionCircles(points, width, height, region));
      for (const shape of circles) group.appendChild(svg("circle", { cx: fx(shape.x), cy: shape.y, r: shape.r * 1.25, fill: "url(#" + uid + "-" + index + ")" }));
      overlay.appendChild(group);
      if (circles.length) pins.push({ number: index + 1, color, x: fx(circles[0].x), y: circles[0].y, delay: 0.45 + index * 0.2 });
    });

    // Keep pins apart when two areas share a spot (for example nose and between the brows).
    const pinRadius = unit * 10;
    pins.forEach((pin, index) => {
      for (const other of pins.slice(0, index)) {
        if (Math.hypot(pin.x - other.x, pin.y - other.y) < pinRadius * 2.4) pin.x = other.x + pinRadius * 2.6;
      }
    });
    for (const pin of pins) {
      const group = svg("g", { class: "face-map-badge", style: "--delay:" + pin.delay + "s" });
      group.appendChild(svg("circle", { cx: pin.x, cy: pin.y, r: pinRadius * 1.55, fill: "#ffffff", "fill-opacity": 0.28 }));
      group.appendChild(svg("circle", { cx: pin.x, cy: pin.y, r: pinRadius, fill: pin.color, stroke: "#ffffff", "stroke-width": unit * 2 }));
      const text = svg("text", { x: pin.x, y: pin.y, "text-anchor": "middle", "dominant-baseline": "central", "font-size": unit * 11, "font-weight": 700, fill: "#ffffff", "font-family": "system-ui, sans-serif" });
      text.textContent = String(pin.number);
      group.appendChild(text);
      overlay.appendChild(group);
    }
    stage.appendChild(overlay);
  }

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
  note.textContent = points
    ? "Circles mark where each observation was seen."
    : "We could not map the areas on this photo.";
  legend.append(list, note);

  figure.append(header, stage, legend);
  return figure;
}
