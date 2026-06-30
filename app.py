from datetime import datetime, timezone
import os
from xml.etree import ElementTree

from flask import Flask, Response, render_template, request, url_for
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
IS_PRODUCTION = os.environ.get("FLASK_ENV") == "production"
SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "change-me-in-production")

if IS_PRODUCTION and SECRET_KEY == "change-me-in-production":
    raise RuntimeError("Set a unique FLASK_SECRET_KEY before running in production.")

app.config["SECRET_KEY"] = SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = IS_PRODUCTION

PROJECTS = [
    {
        "slug": "apollo",
        "title": "Apollo 11 Lander",
        "description": "A C++ lunar landing simulator with thrust, gravity, collision checks, and a playable OpenGL window.",
        "tags": ["C++", "OpenGL", "freeglut", "Physics"],
        "status": "Playable build",
        "play_endpoint": "apollo11_game",
        "preview_image": "wasm/apollo11/menu-background.png",
        "download_filename": "downloads/apollo11-lander-windows.zip",
        "source_url": None,
    },
    {
        "slug": "artillery",
        "title": "Artillery Simulator",
        "description": "A trajectory simulator that models projectile motion, aiming, and terrain interaction in C++.",
        "tags": ["C++", "OpenGL", "Simulation", "Unit tests"],
        "status": "Playable build",
        "play_endpoint": "artillery_game",
        "preview_image": "images/artillery-menu-day-desert.png",
        "download_filename": "downloads/artillery-simulator-windows.zip",
        "source_url": None,
    },
    {
        "slug": "chess",
        "title": "Chess Project",
        "description": "A desktop chess game built around board state, legal moves, special rules, and an OpenGL interface.",
        "tags": ["C++", "OpenGL", "OOP", "Game logic"],
        "status": "Playable build",
        "play_endpoint": "chess_game",
        "preview_image": "images/chess-menu-preview.png",
        "download_filename": "downloads/chess-project-windows.zip",
        "source_url": None,
    },
]


def site_url():
    return os.environ.get("SITE_URL", "http://localhost:5000").rstrip("/")


@app.context_processor
def inject_site_metadata():
    return {
        "site_title": os.environ.get("SITE_TITLE", "Andrew's Portfolio"),
        "site_description": os.environ.get(
            "SITE_DESCRIPTION", "Personal projects, experiments, and notes from Andrew."
        ),
        "site_email": os.environ.get("SITE_EMAIL", "hello@example.com"),
        "github_url": os.environ.get("GITHUB_URL", "#"),
        "linkedin_url": os.environ.get("LINKEDIN_URL", "#"),
        "site_url": site_url(),
        "canonical_url": f"{site_url()}{request.path}",
        "current_year": datetime.now(timezone.utc).year,
    }


@app.route("/")
def home():
    return render_template("index.html", projects=PROJECTS[:3])


@app.route("/projects")
def projects():
    return render_template("projects.html", projects=PROJECTS)


@app.route("/games/apollo11")
def apollo11_game():
    return render_template("game_apollo11.html")


@app.route("/games/artillery")
def artillery_game():
    return render_template("game_artillery.html")


@app.route("/games/chess")
def chess_game():
    return render_template("game_chess.html")


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/robots.txt")
def robots():
    body = f"User-agent: *\nAllow: /\n\nSitemap: {site_url()}/sitemap.xml\n"
    return Response(body, mimetype="text/plain")


@app.route("/sitemap.xml")
def sitemap():
    namespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
    ElementTree.register_namespace("", namespace)
    urlset = ElementTree.Element(f"{{{namespace}}}urlset")

    for endpoint in ("home", "projects", "apollo11_game", "artillery_game", "chess_game", "about", "contact"):
        url_element = ElementTree.SubElement(urlset, f"{{{namespace}}}url")
        location = ElementTree.SubElement(url_element, f"{{{namespace}}}loc")
        location.text = f"{site_url()}{url_for(endpoint)}"

    xml = ElementTree.tostring(urlset, encoding="utf-8", xml_declaration=True)
    return Response(xml, mimetype="application/xml")


@app.route("/contact")
def contact():
    return render_template("contact.html")


@app.errorhandler(404)
def not_found(_error):
    return render_template("404.html"), 404


@app.after_request
def add_security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), geolocation=(), microphone=()"
    )
    return response


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
