/**
 * Boot watchdog, loaded before the app bundle.
 *
 * A blank page tells the reader nothing, and this app has several ways to fail before React mounts:
 * the module script rejected for its MIME type (a host serving the source entry instead of a build),
 * the bundle throwing, the dataset missing, or a browser too old for it. Each used to look identical:
 * a dark empty screen with the right title. This turns every one of them into a message that says what
 * happened and offers a reload.
 */
(function () {
  var root = document.getElementById("root");
  var failed = false;

  function esc(s) {
    return String(s).replace(/[<>&]/g, function (c) {
      return c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;";
    });
  }

  function fail(title, detail) {
    if (failed || !root) return;
    // React mounted after all: the page is fine, so stay out of the way.
    if (root.children.length > 0) return;
    failed = true;
    var dark = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
    var fg = dark ? "#e8e8e8" : "#16191f";
    var dim = dark ? "#b0b0b0" : "#5f6b7a";
    var panel = dark ? "#1d2124" : "#f4f4f4";
    var line = dark ? "#3d4449" : "#d5dbdb";
    var btn = dark ? "#5f6b7a" : "#8d99a8";
    root.innerHTML =
      '<div style="font:14px/1.55 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;' +
      "max-width:640px;margin:11vh auto;padding:0 24px;color:" + fg + '">' +
      '<h1 style="font-size:22px;font-weight:600;margin:0 0 10px;line-height:1.3">Cellmap could not start</h1>' +
      '<p style="margin:0 0 14px;color:' + dim + '">' + esc(title) + "</p>" +
      '<pre style="white-space:pre-wrap;word-break:break-word;background:' + panel + ";border:1px solid " + line +
      ';border-radius:8px;padding:12px;font:12.5px/1.5 ui-monospace,Menlo,monospace;margin:0 0 14px">' +
      esc(detail) + "</pre>" +
      '<button onclick="location.reload()" style="font:inherit;padding:7px 16px;border-radius:20px;border:1px solid ' +
      btn + ';background:transparent;color:inherit;cursor:pointer">Reload</button>' +
      "</div>";
  }

  function scriptSrcMismatch() {
    // A build loads exactly one module from ./assets/. Anything pointing at /src/ is the source entry.
    var mods = document.querySelectorAll('script[type="module"][src]');
    for (var i = 0; i < mods.length; i++) {
      if (/\/src\//.test(mods[i].src)) return mods[i].src;
    }
    return "";
  }

  // A module script rejected for its MIME type fires `error` on the element in some engines and only
  // surfaces as a console message in others, so check the tag shape as well as the events.
  function checkNow() {
    if (root && root.children.length > 0) return;
    var bad = scriptSrcMismatch();
    if (bad) {
      fail(
        "The page is loading the development entry, which a browser cannot run.",
        "This page points at:\n  " + bad + "\n\nThat is raw TypeScript from src/, not a built bundle, so nothing renders.\n\n" +
          "Serve the built folder instead (site/cellmap-explorer/), or run the dev server: cd web && npm run dev"
      );
      return true;
    }
    return false;
  }

  window.addEventListener(
    "error",
    function (e) {
      if (e.target && e.target.tagName !== "SCRIPT") return;
      var src = (e.target && e.target.src) || "";
      if (location.protocol === "file:") {
        fail(
          "This page was opened straight from disk.",
          "A browser will not let a file:// page load the bundled script or read data.json beside it, " +
            "so the app cannot start this way.\n\nServe the folder over http instead:\n" +
            "  python3 -m http.server 8000\n" +
            "then open http://127.0.0.1:8000/ in that folder."
        );
      } else {
        fail(
          "The app script did not load.",
          "Blocked: " + (src || "(inline)") +
            "\n\nIf this page came from a folder, the build is missing or stale; serve the built copy."
        );
      }
    },
    true
  );

  // Poll briefly: catch the source-entry case within a second, and give a genuinely slow bundle time
  // to mount before saying anything.
  var tries = 0;
  var timer = setInterval(function () {
    if (root && root.children.length > 0) {
      clearInterval(timer);
      return;
    }
    tries++;
    if (checkNow()) clearInterval(timer);
    if (tries >= 40) {
      clearInterval(timer);
      fail(
        "The page loaded but the app never mounted.",
        "The browser refused the bundle or the dataset request failed.\n\n" +
          "Open the browser console for the exact error, then reload. Opening this file straight from disk " +
          "will not work either: browsers block a file:// page from reading data.json beside it."
      );
    }
  }, 250);
})();
