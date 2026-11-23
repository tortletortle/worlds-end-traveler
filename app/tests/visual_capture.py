"""Capture deterministic V0.6 visual comparison frames using a real browser WebGL2 context.

Start the game server first: py -m http.server 8000
Then run: python tests/visual_capture.py
For hardware evidence, use a headed browser with GPU acceleration enabled and inspect renderer metadata.
"""
import argparse
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000/")
    parser.add_argument("--output", default="artifacts/visual-captures")
    parser.add_argument("--camera-x", type=float, default=-48.0)
    parser.add_argument("--camera-z", type=float, default=42.0)
    parser.add_argument("--yaw", type=float, default=0.10)
    parser.add_argument("--pitch", type=float, default=-0.08)
    parser.add_argument("--headless", action="store_true", help="Use only for diagnostic captures; headed mode is preferred for GPU validation.")
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    page_errors = []
    captures = []

    with sync_playwright() as playwright:
        launch = {
            "headless": args.headless,
            "args": ["--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=default"],
        }
        if os.environ.get("CHROMIUM"):
            launch["executable_path"] = os.environ["CHROMIUM"]
        browser = playwright.chromium.launch(**launch)
        browser_version = browser.version
        page = browser.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=1)
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.goto(args.url, wait_until="load")
        page.wait_for_function("window.__gameDebug && window.__gameDebug.getState", timeout=30000)
        renderer = page.evaluate("""() => {
            const canvas = document.getElementById("gameCanvas");
            const gl = canvas && canvas.getContext("webgl2");
            if (!gl) return null;
            const ext = gl.getExtension("WEBGL_debug_renderer_info");
            return {
                version: gl.getParameter(gl.VERSION),
                shading_language: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            };
        }""")
        if renderer is None:
            browser.close()
            raise RuntimeError("WebGL2 is unavailable. Enable browser GPU acceleration and retry.")
        page.evaluate("window.__gameDebug.start()")
        page.evaluate("""p => window.__gameDebug.setCamera(p.x, p.z, p.yaw, p.pitch)""", {
            "x": args.camera_x, "z": args.camera_z, "yaw": args.yaw, "pitch": args.pitch,
        })
        for label, hour in [("dawn", 6), ("noon", 12), ("dusk", 18), ("night", 23)]:
            page.evaluate("hour => window.__gameDebug.setClockHour(hour)", hour)
            page.wait_for_timeout(1200)
            image_path = output / f"{label}.png"
            page.screenshot(path=str(image_path), full_page=True)
            lighting = page.evaluate("window.__gameDebug.getLightingState()")
            captures.append({"label": label, "hour": hour, "file": str(image_path), "lighting": lighting})
        browser.close()

    renderer_name = renderer["renderer"] or "unknown"
    software = any(token in renderer_name.lower() for token in ("swiftshader", "llvmpipe", "software rasterizer"))
    result = {
        "result": "PAGE_ERRORS" if page_errors else ("SOFTWARE_RENDERER" if software else "CAPTURED"),
        "browser_version": browser_version,
        "webgl2": renderer,
        "software_renderer": software,
        "camera": {"x": args.camera_x, "z": args.camera_z, "yaw": args.yaw, "pitch": args.pitch},
        "captures": captures,
        "page_errors": page_errors,
        "note": "A screenshot is not proof of player acceptance. Software-rendered captures are diagnostic only, not GPU performance evidence.",
    }
    (output / "manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
