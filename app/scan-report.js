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
  const report = el("section", "scan-report");
  report.setAttribute("data-scan-report", "");
  report.setAttribute("aria-label", "Your skin report");

  const head = el("header", "sr-head");
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
    const section = el("section", "sr-section");
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
      item.appendChild(link);
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
  end.append(again, el("p", "sr-disclaimer", "Cosmetic observations from one photo, not a medical diagnosis. Your photo is not saved. Follow product labels and avoid the eyes and lips."));
  return { report, end, mapSlot: areas.length ? mapSlot : null };
}
