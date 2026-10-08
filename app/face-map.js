// Premium skin map: circles on the shopper's own photo mark where each visible concern was observed.
// Circle positions come from face landmarks (MediaPipe), not from the AI model, so they sit on the right facial area.
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
  const width = image.naturalWidth, height = image.naturalHeight;
  const points = landmarks || await withTimeout(detectImageLandmarks(photo).catch(() => null), 8000);

  const figure = document.createElement("figure");
  figure.className = "face-map";
  figure.setAttribute("data-face-map", "");

  const header = document.createElement("div");
  header.className = "face-map-header";
  const title = document.createElement("h3"); title.className = "face-map-title"; title.textContent = "Your skin map";
  const subtitle = document.createElement("p"); subtitle.className = "face-map-subtitle";
  subtitle.textContent = marked.length === 1 ? "1 area observed in your photo" : marked.length + " areas observed in your photo";
  header.append(title, subtitle);

  const stage = document.createElement("div");
  stage.className = "face-map-stage";
  const img = document.createElement("img");
  img.src = photo; img.alt = "Your photo with the observed skin areas circled";
  if (mirrored) img.style.transform = "scaleX(-1)";
  stage.appendChild(img);

  if (points) {
    const fx = (x) => (mirrored ? width - x : x);
    const overlay = svg("svg", { viewBox: "0 0 " + width + " " + height, "aria-hidden": "true", class: "face-map-overlay" });
    const unit = Math.max(width, height) / 400;

    // Fine face mesh for the scanned look.
    const mesh = svg("g", { class: "face-map-mesh", fill: "none", stroke: "#ffffff", "stroke-width": unit * 0.6, "stroke-opacity": 0.35, "stroke-linejoin": "round" });
    for (const contour of FACE_CONTOURS) {
      const path = contour.filter((index) => points[index]).map((index) => fx(points[index].x * width).toFixed(1) + "," + (points[index].y * height).toFixed(1)).join(" ");
      if (path) mesh.appendChild(svg("polyline", { points: path }));
    }
    overlay.appendChild(mesh);

    const badges = [];
    const faceCenter = points[1] ? fx(points[1].x * width) : width / 2;
    marked.forEach((area, index) => {
      const color = CONCERN_STYLES[area.concern].color;
      const group = svg("g", { class: "face-map-area", style: "--delay:" + (0.35 + index * 0.25) + "s" });
      const circles = area.regions.flatMap((region) => regionCircles(points, width, height, region));
      for (const shape of circles) {
        const cx = fx(shape.x);
        group.appendChild(svg("circle", { cx, cy: shape.y, r: shape.r, fill: color, "fill-opacity": 0.16 }));
        group.appendChild(svg("circle", { cx, cy: shape.y, r: shape.r, fill: "none", stroke: color, "stroke-width": unit * 2.2, "stroke-opacity": 0.35, class: "face-map-glow" }));
        group.appendChild(svg("circle", { cx, cy: shape.y, r: shape.r, fill: "none", stroke: color, "stroke-width": unit * 1.1, "stroke-dasharray": unit * 4 + " " + unit * 2.5 }));
      }
      overlay.appendChild(group);
      if (circles.length) {
        // Point the callout at the circle on the outer side of the face, so lines do not cross the face.
        const target = circles.map((shape) => ({ x: fx(shape.x), y: shape.y, r: shape.r })).sort((a, b) => Math.abs(b.x - faceCenter) - Math.abs(a.x - faceCenter))[0];
        badges.push({ number: index + 1, color, target, side: target.x < faceCenter - target.r * 0.3 ? "left" : target.x > faceCenter + target.r * 0.3 ? "right" : null, delay: 0.35 + index * 0.25 });
      }
    });

    // Callouts: numbered badges in the photo margins with a thin line to their circle, spaced so they never overlap.
    const badgeRadius = unit * 10, gap = badgeRadius * 2.6;
    const counts = { left: 0, right: 0 };
    badges.forEach((badge) => { if (badge.side) counts[badge.side]++; });
    badges.forEach((badge) => { if (!badge.side) { badge.side = counts.left <= counts.right ? "left" : "right"; counts[badge.side]++; } });
    for (const side of ["left", "right"]) {
      const column = badges.filter((badge) => badge.side === side).sort((a, b) => a.target.y - b.target.y);
      let lastY = -Infinity;
      for (const badge of column) {
        badge.y = Math.min(height - badgeRadius * 1.5, Math.max(badge.target.y, lastY + gap, badgeRadius * 1.5));
        badge.x = side === "left" ? badgeRadius * 1.9 : width - badgeRadius * 1.9;
        lastY = badge.y;
      }
    }
    for (const badge of badges) {
      const group = svg("g", { class: "face-map-badge", style: "--delay:" + badge.delay + "s" });
      const angle = Math.atan2(badge.y - badge.target.y, badge.x - badge.target.x);
      const edgeX = badge.target.x + Math.cos(angle) * badge.target.r, edgeY = badge.target.y + Math.sin(angle) * badge.target.r;
      group.appendChild(svg("line", { x1: edgeX, y1: edgeY, x2: badge.x, y2: badge.y, stroke: "#ffffff", "stroke-width": unit * 2.2, "stroke-opacity": 0.6, "stroke-linecap": "round" }));
      group.appendChild(svg("line", { x1: edgeX, y1: edgeY, x2: badge.x, y2: badge.y, stroke: badge.color, "stroke-width": unit * 1.1, "stroke-linecap": "round" }));
      group.appendChild(svg("circle", { cx: edgeX, cy: edgeY, r: unit * 2, fill: badge.color }));
      group.appendChild(svg("circle", { cx: badge.x, cy: badge.y, r: badgeRadius, fill: "#ffffff", stroke: badge.color, "stroke-width": unit * 2.2 }));
      const text = svg("text", { x: badge.x, y: badge.y, "text-anchor": "middle", "dominant-baseline": "central", "font-size": unit * 11, "font-weight": 700, fill: "#1a1208", "font-family": "system-ui, sans-serif" });
      text.textContent = String(badge.number);
      group.appendChild(text);
      overlay.appendChild(group);
    }
    stage.appendChild(overlay);
    const sweep = document.createElement("span"); sweep.className = "face-map-sweep"; sweep.setAttribute("aria-hidden", "true");
    stage.appendChild(sweep);
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
    ? "Circles show where each observation was seen. Cosmetic observations from one photo, not a medical diagnosis. Your photo is not saved."
    : "We could not map the areas on this photo. Cosmetic observations from one photo, not a medical diagnosis. Your photo is not saved.";
  legend.append(list, note);

  figure.append(header, stage, legend);
  return figure;
}
