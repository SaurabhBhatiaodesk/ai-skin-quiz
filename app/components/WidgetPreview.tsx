import { useEffect, useState } from "react";
import type { StoredQuiz } from "../quiz-shared";
import type { WidgetPreviewAssets } from "../widget-preview.server";

type Kind = "quick" | "deep" | "scan";

// Runs the real storefront widget in a sandboxed iframe with the unsaved quiz, so the admin preview matches the
// theme block exactly. It opens the chosen flow and steps to the chosen question by answering the earlier ones.
export function previewDocument(assets: WidgetPreviewAssets, quiz: StoredQuiz & { handle?: string; name?: string }, kind: Kind, index: number) {
  const config = {
    handle: quiz.handle || "preview",
    name: quiz.name || "",
    resultMode: quiz.resultMode,
    emailCapture: quiz.emailCapture,
    enabledPaths: quiz.enabledPaths,
    singleFlow: quiz.singleFlow,
    layout: quiz.layout || "three",
    scanner: quiz.scanner,
    cardIcons: { ...assets.cardIcons, ...(quiz.cardIcons || {}) },
    scanReady: true,
    design: quiz.design,
    widgetCss: quiz.widgetCss,
    defaultCss: "",
    apiVersion: 1,
    endpoints: { result: "#" },
    quick: quiz.quick,
    mappings: quiz.mappings,
    deep: quiz.deep,
  };
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  const target = kind === "scan" ? "scanner" : kind;
  const steer = `(function(){var root=document.getElementById(${JSON.stringify(assets.rootId)});var tries=0;
function step(){var screen=root.querySelector('[data-screen="${target}"].active');if(!screen)return;var left=${Math.max(0, index)};
(function next(){if(!left)return;var opt=screen.querySelector('.q-opt');var btn=screen.querySelector('[data-${kind}-next]');if(!opt||!btn)return;opt.click();setTimeout(function(){btn.click();left--;setTimeout(next,60);},30);})();}
(function wait(){if(root.getAttribute('data-configured')==='true'){var card=root.querySelector('[data-goto="${target}"]');if(card&&!root.querySelector('[data-screen="${target}"].active'))card.click();setTimeout(function(){step();setTimeout(function(){if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();},150);},80);return;}if(++tries<100)setTimeout(wait,50);})();
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(a)e.preventDefault();},true);})();`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:#fff}body{font-family:Georgia,"Times New Roman",serif}${assets.stylesheet}</style></head><body>${assets.markup}<script type="application/json" id="prana-embed-config" data-widget-root="${assets.rootId}">${json}</script><script>${assets.script}</script><script>${steer}</script></body></html>`;
}

export default function WidgetPreview({ assets, quiz, kind, index, mobile }: { assets: WidgetPreviewAssets; quiz: StoredQuiz & { handle?: string; name?: string }; kind: Kind; index: number; mobile: boolean }) {
  const [doc, setDoc] = useState(() => previewDocument(assets, quiz, kind, index));
  // Rebuild shortly after edits stop, so typing in a field does not reload the preview on every key.
  useEffect(() => {
    const timer = setTimeout(() => setDoc(previewDocument(assets, quiz, kind, index)), 350);
    return () => clearTimeout(timer);
  }, [assets, quiz, kind, index]);
  return <div style={{ width: "100%", maxWidth: mobile ? 390 : "100%", margin: "0 auto", border: "1px solid #DADDD9", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
    <iframe title="Storefront widget preview" srcDoc={doc} sandbox="allow-scripts" style={{ display: "block", width: "100%", height: mobile ? 760 : 720, border: 0 }} />
  </div>;
}
