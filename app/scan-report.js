// Premium AI Skin Scan report: header with observed concerns, a slot for the skin map, compact product picks,
// and closing actions. Built with DOM APIs so every value from the server is inserted as text.
import { CONCERN_STYLES, mappableAreas } from "./face-map.js";

const INTENSITY = { mild: "Mild", moderate: "Moderate", pronounced: "Pronounced" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function concernLabel(concern) {
  return CONCERN_STYLES[concern] ? CONCERN_STYLES[concern].label : String(concern || "").replace(/_/g, " ");
}

function productHref(product) {
  return "/products/" + encodeURIComponent(product.handle || "") + (product.variantId ? "?variant=" + encodeURIComponent(String(product.variantId).split("/").pop()) : "");
}

// Returns { report, end }: report goes at the top of the result, end after the email box.
export function buildScanReport(result) {
  const areas = mappableAreas(result.scanAreas);
  const report = el("div", "scan-report");
  report.setAttribute("data-scan-report", "");
  report.setAttribute("aria-label", "Your skin report");

  const head = el("div", "sr-head");
  const status = el("p", "sr-status");
  const check = el("span", "sr-status-icon"); check.setAttribute("aria-hidden", "true"); check.textContent = "✓";
  const date = new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  status.append(check, document.createTextNode("Scan complete · " + date));
  const title = el("h2", "sr-title", "Your Skin Report");
  const summary = (result.profile && result.profile.essence) || "";
  head.append(status, title);
  if (summary) head.appendChild(el("p", "sr-summary", summary));

  if (areas.length) {
    const chips = el("ul", "sr-chips");
    chips.setAttribute("aria-label", "Observed concerns");
    areas.forEach((area) => {
      const chip = el("li", "sr-chip");
      chip.style.setProperty("--c", CONCERN_STYLES[area.concern].color);
      const dot = el("span", "sr-chip-dot"); dot.setAttribute("aria-hidden", "true");
      chip.append(dot, el("span", "sr-chip-name", concernLabel(area.concern)));
      if (INTENSITY[area.intensity]) chip.appendChild(el("span", "sr-chip-level", INTENSITY[area.intensity]));
      chips.appendChild(chip);
    });
    head.appendChild(chips);
  } else {
    head.appendChild(el("p", "sr-clear", "No visible concerns stood out in this photo."));
  }
  report.appendChild(head);

  // The skin map is built asynchronously; the slot shows a shimmer until it arrives.
  const mapSlot = el("div", "sr-map-slot");
  mapSlot.setAttribute("data-face-map-slot", "");
  if (areas.length) {
    const skeleton = el("div", "sr-map-skeleton");
    skeleton.setAttribute("aria-hidden", "true");
    mapSlot.appendChild(skeleton);
    report.appendChild(mapSlot);
  }

  const products = Array.isArray(result.products) ? result.products : [];
  if (products.length) {
    const section = el("div", "sr-section");
    section.append(el("h3", "sr-section-title", "Recommended for you"), el("p", "sr-section-sub", "Matched to what we observed in your photo."));
    const list = el("ul", "sr-products");
    products.forEach((product) => {
      const item = el("li");
      const link = el("a", "sr-product");
      link.href = productHref(product);
      link.setAttribute("aria-label", "View " + (product.title || "product"));
      const media = el("span", "sr-product-img");
      if (product.image) {
        const img = el("img"); img.src = product.image; img.alt = ""; img.loading = "lazy";
        media.appendChild(img);
      } else media.classList.add("is-empty");
      const body = el("span", "sr-product-body");
      body.appendChild(el("span", "sr-product-name", product.title || ""));
      const concerns = Array.isArray(product.concerns) ? product.concerns.filter((concern) => CONCERN_STYLES[concern]) : [];
      if (concerns.length) {
        const tags = el("span", "sr-product-tags");
        concerns.forEach((concern) => {
          const tag = el("span", "sr-tag", "For " + concernLabel(concern).toLowerCase());
          tag.style.setProperty("--c", CONCERN_STYLES[concern].color);
          tags.appendChild(tag);
        });
        body.appendChild(tags);
      }
      const side = el("span", "sr-product-side");
      if (product.price) side.appendChild(el("span", "sr-price", product.price));
      side.appendChild(el("span", "sr-view", "View →"));
      link.append(media, body, side);
      // Add to cart sits outside the link (a button cannot live inside a link).
      const add = el("button", "sr-add", "Add to cart");
      add.type = "button";
      add.setAttribute("data-add-to-cart", "");
      add.setAttribute("data-handle", product.handle || "");
      if (product.variantId) add.setAttribute("data-variant", String(product.variantId));
      add.setAttribute("aria-label", "Add " + (product.title || "product") + " to cart");
      item.append(link, add);
      list.appendChild(item);
    });
    section.appendChild(list);
    report.appendChild(section);
  }

  const end = el("div", "sr-end");
  end.setAttribute("data-scan-report-end", "");
  const again = el("button", "sr-again", "Scan again");
  again.type = "button";
  again.setAttribute("data-goto", "scanner");
  const actions = el("div", "sr-actions");
  const save = el("button", "sr-share", "Save report");
  save.type = "button"; save.setAttribute("data-report-save", "");
  const copy = el("button", "sr-share", "Copy link");
  copy.type = "button"; copy.setAttribute("data-report-link", "");
  actions.append(save, copy);
  end.append(actions, again, el("p", "sr-disclaimer", "Cosmetic observations from one photo, not a medical diagnosis. Your photo is not saved. Follow product labels and avoid the eyes and lips."));
  return { report, end, mapSlot: areas.length ? mapSlot : null };
}

// A shareable PNG of the report (summary, photo, observations, picks), drawn on the shopper's device only.
export async function reportImage(result, photoSrc, mirrored, storeName) {
  const W = 1080, H = 1350, pad = 72;
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d");
  c.fillStyle = "#ffffff"; c.fillRect(0, 0, W, H);
  const font = (size, weight) => `${weight || 400} ${size}px Inter, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  const wrap = (text, x, y, maxWidth, lineHeight, maxLines) => {
    const words = String(text || "").split(/\s+/); let line = "", lines = 0;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (c.measureText(test).width > maxWidth && line) { c.fillText(line, x, y); y += lineHeight; line = word; if (++lines >= maxLines - 1) break; }
      else line = test;
    }
    if (line) { c.fillText(line, x, y); y += lineHeight; }
    return y;
  };
  c.fillStyle = "#6b6158"; c.font = font(26, 600);
  c.fillText(new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }), pad, pad + 10);
  c.fillStyle = "#111111"; c.font = font(60, 700); c.fillText("My Skin Report", pad, pad + 86);
  c.fillStyle = "#3a3a3a"; c.font = font(30, 400);
  let y = wrap((result.profile && result.profile.essence) || "", pad, pad + 146, W - pad * 2, 42, 3);
  if (photoSrc) {
    try {
      const img = new Image(); img.src = photoSrc; await img.decode();
      const size = 460, x = (W - size) / 2, top = y + 20;
      const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      const sw = size / scale, sh = size / scale, sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
      c.save(); c.beginPath(); c.roundRect ? c.roundRect(x, top, size, size, 32) : c.rect(x, top, size, size); c.clip();
      if (mirrored) { c.translate(x + size, top); c.scale(-1, 1); c.drawImage(img, sx, sy, sw, sh, 0, 0, size, size); }
      else c.drawImage(img, sx, sy, sw, sh, x, top, size, size);
      c.restore();
      y = top + size + 40;
    } catch { y += 20; }
  }
  const areas = mappableAreas(result.scanAreas);
  c.font = font(34, 700); c.fillStyle = "#111111"; c.fillText("What we observed", pad, y + 20); y += 70;
  for (const area of areas.slice(0, 5)) {
    const style = CONCERN_STYLES[area.concern];
    c.fillStyle = style.color; c.beginPath(); c.arc(pad + 12, y - 10, 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#111111"; c.font = font(30, 600); c.fillText(style.label, pad + 40, y);
    c.fillStyle = "#6b6158"; c.font = font(26, 400); c.fillText(String(area.intensity || "").replace(/^./, (ch) => ch.toUpperCase()), pad + 60 + c.measureText(style.label).width * 1.15, y);
    y += 50;
  }
  const picks = (Array.isArray(result.products) ? result.products : []).slice(0, 3).map((product) => product.title).filter(Boolean);
  if (picks.length && y < H - 220) {
    c.font = font(30, 700); c.fillStyle = "#111111"; c.fillText("My picks", pad, y + 20); y += 62;
    c.font = font(26, 400); c.fillStyle = "#3a3a3a";
    for (const title of picks) { if (y > H - 140) break; y = wrap("\u2022 " + title, pad, y, W - pad * 2, 36, 1); }
  }
  c.fillStyle = "#8a8178"; c.font = font(22, 400);
  c.fillText("Cosmetic observations, not a medical diagnosis" + (storeName ? "  \u00b7  " + storeName : ""), pad, H - pad / 2);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
