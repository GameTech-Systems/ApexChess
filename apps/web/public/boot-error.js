/* global addEventListener, document, window */
// Shows a plain message if the app's script fails to load. Kept out of index.html so the
// Content-Security-Policy in _headers needs no inline scripts.
addEventListener(
  "error",
  function (e) {
    var root = document.getElementById("root");
    if (root && !root.hasChildNodes() && e.target !== window)
      root.textContent = "Apex Chess failed to load. Please reload the page.";
  },
  true,
);
