import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Initialize session persistence before anything else
import "./lib/session-persistence";

/**
 * ✅ MOBILE SAFE ERROR OVERLAY
 * If the app crashes (black screen), show the real error on the page.
 * Remove this block once the root cause is fixed.
 */
(function installFatalErrorOverlay() {
  const show = (title: string, err: any) => {
    try {
      const msg = String(err?.message || err || "");
      const stack = String(err?.stack || "");
      document.body.innerHTML = `<pre style="white-space:pre-wrap;padding:12px;color:#ffb4b4;background:#120b0b;font-size:12px;line-height:1.35;">
${title}
${msg}

${stack}
</pre>`;
    } catch {
      // ignore
    }
  };

  window.addEventListener("error", (e) => show("JS ERROR:", (e as any).error || e));
  window.addEventListener("unhandledrejection", (e: any) => show("PROMISE REJECTION:", e?.reason || e));
})();

createRoot(document.getElementById("root")!).render(<App />);
