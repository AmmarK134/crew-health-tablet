"""Crew Health tablet: start the team's crew health server with the touch-first tablet interface.

    python run.py

Then open http://localhost:5050 in a browser. That is all.

What this does
    It loads the team's existing server (server.py in the vitals-atlas-radiation folder) exactly as it is,
    and serves the new tablet interface from the "dist" folder in front of it. Every rule, number and
    scenario still comes from that server; nothing in it is changed or copied.

    The original interface stays available at http://localhost:5050/classic for comparison.

Options
    python run.py --no-browser            do not open the browser by itself
    python run.py --port 8080             use another port
    python run.py --host 0.0.0.0          let other devices on the same network open it (a real tablet, a phone)
    python run.py --backend "D:\\path\\to\\vitals-atlas-radiation"
                                          point at the server folder if it is somewhere else
"""
import argparse
import os
import sys
import threading
import webbrowser
from pathlib import Path

HERE = Path(__file__).resolve().parent
DIST = HERE / "dist"

# Explicit content types. Windows sometimes reports the wrong type for .js files, which stops the page loading.
TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json; charset=utf-8",
}


def find_backend(given):
    """The folder that holds the team's server.py."""
    places = [
        given,
        os.environ.get("CREW_BACKEND"),
        HERE.parent / "anna" / "vitals-atlas-radiation",
        HERE.parent / "vitals-atlas-radiation",
        HERE / "vitals-atlas-radiation",
        HERE / "backend",
        HERE.parent,
    ]
    for place in places:
        if place and (Path(place) / "server.py").is_file() and (Path(place) / "crew" / "engine.py").is_file():
            return Path(place).resolve()
    return None


def make_app(backend_app):
    dist_root = DIST.resolve()
    index = dist_root / "index.html"

    def app(environ, start_response):
        path = environ.get("PATH_INFO", "/") or "/"
        # The server's own endpoints, untouched.
        if path.startswith("/api/"):
            return backend_app(environ, start_response)
        # The original interface, kept for comparison.
        if path == "/classic" or path == "/classic/":
            environ = dict(environ, PATH_INFO="/")
            return backend_app(environ, start_response)
        if path.startswith("/static/"):
            return backend_app(environ, start_response)
        # The tablet interface. Only files inside "dist" are ever served; anything else gets the tablet page.
        target = index
        try:
            wanted = (dist_root / path.lstrip("/\\")).resolve()
            if dist_root in wanted.parents and wanted.is_file():
                target = wanted
        except (OSError, ValueError):
            pass
        data = target.read_bytes()
        headers = [
            ("Content-Type", TYPES.get(target.suffix.lower(), "application/octet-stream")),
            ("Content-Length", str(len(data))),
            ("Cache-Control", "no-cache" if target.name == "index.html" else "public, max-age=604800"),
        ]
        start_response("200 OK", headers)
        return [data]

    return app


def main():
    parser = argparse.ArgumentParser(description="Start the Crew Health tablet interface.")
    parser.add_argument("--port", type=int, default=5050)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--backend", default=None, help="folder that holds the team's server.py")
    parser.add_argument("--no-browser", action="store_true", help="do not open the browser")
    args = parser.parse_args()

    backend = find_backend(args.backend)
    if backend is None:
        sys.exit(
            "Could not find the team's server (a folder with server.py and crew/engine.py).\n"
            "Put this crew-tablet folder next to the 'anna' folder, or run:\n"
            '    python run.py --backend "path\\to\\vitals-atlas-radiation"'
        )
    if not (DIST / "index.html").is_file():
        sys.exit("The built interface is missing (dist/index.html). Run:  npm install  then  npm run build")

    sys.path.insert(0, str(backend))
    os.chdir(backend)
    try:
        import server  # the team's Flask server, exactly as it is
    except ModuleNotFoundError as err:
        sys.exit(f"The server needs a Python package that is not installed: {err.name}\nRun:  pip install flask pandas requests")

    try:
        from werkzeug.serving import run_simple  # installed together with Flask
    except ModuleNotFoundError:
        sys.exit("Flask is not installed. Run:  pip install flask pandas requests")

    shown = "localhost" if args.host in ("127.0.0.1", "0.0.0.0") else args.host
    base = f"http://{shown}:{args.port}"
    print()
    print("  Crew Health tablet is running.")
    print(f"  Server folder: {backend}")
    print()
    print(f"  Lena (flight engineer)   {base}/?as=lena")
    print(f"  Sam (crew doctor)        {base}/?as=sam")
    print(f"  Ravi                     {base}/?as=ravi")
    print(f"  Maya (commander)         {base}/?as=maya")
    print(f"  All four side by side    {base}/?wall=1")
    print(f"  Original interface       {base}/classic")
    print()
    print("  Press Ctrl+C to stop.")
    print()
    if not args.no_browser:
        threading.Timer(1.2, lambda: webbrowser.open(f"{base}/?as=lena")).start()
    try:
        run_simple(args.host, args.port, make_app(server.app), threaded=True, use_reloader=False)
    except OSError as err:
        sys.exit(
            f"Could not start on port {args.port}: {err}\n"
            "Another program may be using that port. Close it, or pick another port:\n"
            f"    python run.py --port {args.port + 1}"
        )


if __name__ == "__main__":
    main()
