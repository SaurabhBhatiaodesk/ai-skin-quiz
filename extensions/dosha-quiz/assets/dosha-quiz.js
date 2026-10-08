/* Small app-block entry point. Full widget loads once from the Shopify asset CDN. */
(function () {
  function load() {
    if (document.querySelector("script[data-prana-runtime]")) return;
    var root = document.querySelector("[data-prana-quiz][data-runtime-url]");
    if (!root || !root.getAttribute("data-runtime-url")) return;
    var script = document.createElement("script");
    script.src = root.getAttribute("data-runtime-url"); script.async = true;
    script.setAttribute("data-prana-runtime", "");
    script.onerror = function () {
      script.remove();
      document.querySelectorAll("[data-widget-setup]").forEach(function (note) { note.textContent = "Quiz could not load. Please refresh the page."; });
    };
    document.head.appendChild(script);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
  document.addEventListener("shopify:section:load", load);
})();
