import { useEffect, useState } from "react";
import type { StoredQuiz } from "../quiz-shared";
import type { WidgetPreviewAssets } from "../widget-preview.server";

type PopupQuiz = Pick<StoredQuiz, "design" | "scanner" | "texts" | "hiddenTexts" | "widgetCss"> & { handle?: string; name?: string };

// The real floating Skin Scan popup (same markup, CSS and runtime as the storefront) in a sandboxed iframe,
// opened on its consent step with the unsaved appearance, so the preview matches what shoppers see.
function popupDocument(assets: WidgetPreviewAssets, quiz: PopupQuiz, appearance: Record<string, unknown>) {
  const config = {
    handle: quiz.handle || "preview",
    name: quiz.name || "",
    layout: "scan",
    enabledPaths: ["scan"],
    scanner: quiz.scanner || { title: "Skin Insights", description: "Use a camera or upload a photo for cosmetic skin observations.", camera: true, upload: true },
    scanReady: true,
    scanAppearance: { ...appearance, enabled: true },
    design: quiz.design,
    widgetCss: quiz.widgetCss,
    texts: quiz.texts || {},
    hiddenTexts: quiz.hiddenTexts || [],
    defaultCss: "",
    apiVersion: 1,
    preview: true,
    endpoints: { result: "#" },
    quick: [],
    deep: [],
  };
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  const markup = assets.markup.replace('data-floating-embed=""', 'data-floating-embed="true"');
  const open = `(function(){var tries=0;(function wait(){var launcher=document.querySelector('[data-scan-chat-launcher]');if(launcher&&launcher.getAttribute('aria-expanded')!=='true'){launcher.click();setTimeout(function(){if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();},150);return;}if(++tries<100)setTimeout(wait,80);})();
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(a)e.preventDefault();},true);})();`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:#f1f2f1;min-height:100vh}${assets.stylesheet}</style></head><body>${markup}<script type="application/json" id="prana-embed-config" data-widget-root="${assets.rootId}">${json}</script><script>${assets.script}</script><script>${open}</script></body></html>`;
}

export default function PopupPreview({ assets, quiz, appearance, mobile }: { assets: WidgetPreviewAssets; quiz: PopupQuiz; appearance: Record<string, unknown>; mobile: boolean }) {
  const [doc, setDoc] = useState(() => popupDocument(assets, quiz, appearance));
  // Rebuild shortly after edits stop, so dragging a colour picker does not reload the preview on every step.
  useEffect(() => {
    const timer = setTimeout(() => setDoc(popupDocument(assets, quiz, appearance)), 350);
    return () => clearTimeout(timer);
  }, [assets, quiz, appearance]);
  return <div style={{ width: "100%", maxWidth: mobile ? 390 : "100%", margin: "0 auto", border: "1px solid #DADDD9", borderRadius: 12, overflow: "hidden", background: "#f1f2f1" }}>
    <iframe title="Skin Scan popup preview" srcDoc={doc} sandbox="allow-scripts" style={{ display: "block", width: "100%", height: mobile ? 760 : 820, border: 0 }} />
  </div>;
}
