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
        "slug": "satellite-orbit",
        "title": "Satellite Orbit Simulator",
        "description": "An interactive C++ orbital mechanics simulation featuring a controllable spacecraft and a populated Earth orbit with GPS, Hubble, Sputnik, Starlink, and Crew Dragon satellites. The simulator applies gravity and velocity each frame, detects satellite and Earth collisions, and models objects breaking into dynamic debris. Its inheritance-based architecture, real-time OpenGL rendering, and automated physics tests demonstrate object-oriented design, polymorphism, mathematical modeling, and collision systems.",
        "tags": ["C++", "Orbital mechanics", "OpenGL", "Inheritance"],
        "status": "Playable build",
        "play_endpoint": "satellite_orbit_game",
        "preview_image": "images/satellite-orbit-preview.webp",
        "download_filename": "downloads/satellite-orbit-simulator-windows.zip",
        "source_url": None,
    },
    {
        "slug": "chess",
        "title": "Chess",
        "description": "A fully featured C++ implementation of the classic game of chess, built using object-oriented design principles and modern software engineering practices. The project includes complete game logic, move validation, special rules such as castling, en passant, and pawn promotion, turn management, and a graphical user interface for interactive gameplay. Designed with extensibility and maintainability in mind, the application demonstrates proficiency in data structures, algorithms, inheritance, polymorphism, event-driven programming, and the development of complex, rule-based systems.",
        "tags": ["C++", "Game logic", "Rule engine", "OOP design"],
        "status": "Playable build",
        "play_endpoint": "chess_game",
        "preview_image": "images/chess-menu-preview.png",
        "download_filename": "downloads/chess-project-windows.zip",
        "source_url": None,
    },
    {
        "slug": "artillery",
        "title": "Artillery Simulator",
        "description": "A C++ physics simulation that models the firing of an M777 howitzer using realistic projectile motion and environmental physics. The application calculates factors such as velocity, acceleration, gravity, launch angle, and terrain interactions to accurately simulate artillery trajectories and impact points. Developed with an object-oriented architecture and OpenGL-based visualization, the project demonstrates strong problem-solving skills in mathematical modeling, simulation development, class design, and real-time user interaction while reinforcing core software engineering principles.",
        "tags": ["C++", "Ballistics", "OpenGL", "Simulation"],
        "status": "Playable build",
        "play_endpoint": "artillery_game",
        "preview_image": "images/artillery-menu-day-desert.png",
        "download_filename": "downloads/artillery-simulator-windows.zip",
        "source_url": None,
    },
    {
        "slug": "apollo",
        "title": "Apollo 11 Lander",
        "description": "A C++ physics simulation inspired by NASA's historic moon landing. The project recreates lunar gravity, thrust, momentum, and collision mechanics, allowing players to safely land a spacecraft using realistic physics principles. Built with an object-oriented architecture, the simulation emphasizes clean class design, modular components, and mathematical modeling while demonstrating proficiency in game loops, physics calculations, user input handling, and software engineering fundamentals.",
        "tags": ["C++", "Physics sim", "Gameplay systems", "OOP design"],
        "status": "Playable build",
        "play_endpoint": "apollo11_game",
        "preview_image": "wasm/apollo11/menu-background.png",
        "download_filename": "downloads/apollo11-lander-windows.zip",
        "source_url": None,
    },
]

JOB_HISTORY = [
    {
        "company": "Going Indie",
        "title": "Intern",
        "summary": "As a Software Engineering Intern at Going Indie, I contribute to the development of tools that help game developers make informed business decisions. My work has included performing quality assurance testing across internal applications and designing a market research platform that aggregates Steam data into actionable insights for developers. The tool leverages APIs, databases, and data analysis to simplify market research, helping studios evaluate competition, player trends, and opportunities within the gaming industry. Through this internship, I've gained valuable experience in collaborative software development, product design, and building real-world tools that provide measurable value to users.",
    },
    {
        "company": "360Epoxy",
        "title": "Contract Web Developer",
        "summary": "As a contract web developer for 360Epoxy, I designed, developed, and deployed a custom business website using Flask, HTML, CSS, and JavaScript. Working directly with the client, I gathered requirements, implemented new features, and delivered a responsive, production-ready website tailored to their business needs. I also integrated a custom contact form with the company's CRM, allowing customer inquiries to flow directly into their lead management system and improving communication with prospective clients. Throughout the project, I focused on security, performance, and creating a seamless user experience.",
    },
    {
        "company": "Textron Aviation",
        "title": "Trim Technician",
        "summary": "During my time at Textron Aviation, I worked as part of a high-performing manufacturing team responsible for producing composite components for commercial aircraft. I consistently ranked among the top performers by maintaining quality, efficiency, and strong communication with teammates and supervisors. The role taught me the importance of precision, teamwork, technical documentation, and problem-solving in a fast-paced, quality-driven engineering environment.",
    },
]

WEBSITES = [
    {
        "name": "360Epoxy",
        "url": "https://360-epoxy.com",
        "summary": "A custom business website designed and developed with Flask, HTML, CSS, and JavaScript, built to support lead generation, client communication, and a polished production-ready web presence.",
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
        "site_phone": "(620) 803-8630",
        "site_phone_href": "+16208038630",
        "github_url": os.environ.get("GITHUB_URL", "#"),
        "linkedin_url": os.environ.get("LINKEDIN_URL", "#"),
        "site_url": site_url(),
        "canonical_url": f"{site_url()}{request.path}",
        "current_year": datetime.now(timezone.utc).year,
    }


@app.route("/")
def home():
    return render_template(
        "index.html",
        projects=[PROJECTS[1], PROJECTS[0], PROJECTS[2]],
        jobs=JOB_HISTORY,
        websites=WEBSITES,
    )


@app.route("/projects")
def projects():
    return render_template("projects.html", projects=PROJECTS)


@app.route("/games/apollo11")
def apollo11_game():
    return render_template("game_apollo11.html")


@app.route("/games/satellite-orbit")
def satellite_orbit_game():
    return render_template("game_satellite_orbit.html")


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

    for endpoint in ("home", "projects", "satellite_orbit_game", "apollo11_game", "artillery_game", "chess_game", "about", "contact"):
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
