export function widgetEmbedCode(code: string) {
  return `<iframe src="/apps/dosha-quiz/widget?code=${encodeURIComponent(code)}" title="Skin quiz" style="display:block;width:100%;height:700px;border:0;" loading="lazy" allow="camera"></iframe>
<script>(function(){var frame=document.currentScript.previousElementSibling;window.addEventListener('message',function(event){if(event.source!==frame.contentWindow||event.origin!==window.location.origin||!event.data||event.data.type!=='prana-widget-height')return;var height=Number(event.data.height);if(Number.isFinite(height)&&height>=0&&height<20000){frame.style.height=Math.ceil(height)+'px';frame.style.display=height===0?'none':'block';}});})();</script>`;
}
