import json
import os
import re
import sqlite3
import uuid
import warnings
from datetime import datetime, timezone

from flask import Flask, jsonify, request, g
from flask_cors import CORS

warnings.filterwarnings("ignore", category=FutureWarning)

try:
    import google.generativeai as genai
except ImportError:
    genai = None


app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), "problempulse.db")


def load_env_file():
    env_path = os.path.join(os.path.dirname(__file__), ".env")

    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()

            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

model = None

try:
    if genai and GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        print("✅ Gemini initialized successfully")
    else:
        print("❌ Gemini API key not found or library missing")
except Exception as e:
    print(f"❌ Gemini initialization failed: {e}")
    model = None


SECTOR_LINKS = {
    "transportation": [
        {"label": "Parivahan Citizen Services", "url": "https://parivahan.gov.in/parivahan/"},
        {"label": "Road Safety Feedback", "url": "https://morth.nic.in/"},
    ],
    "healthcare": [
        {"label": "National Health Portal", "url": "https://www.nhp.gov.in/"},
        {"label": "Health Ministry", "url": "https://mohfw.gov.in/"},
    ],
    "education": [
        {"label": "Education Ministry", "url": "https://www.education.gov.in/"},
    ],
    "environment": [
        {"label": "CPCB Complaints", "url": "https://cpcb.nic.in/"},
        {"label": "Environment Ministry", "url": "https://moef.gov.in/"},
    ],
    "sanitation": [
        {"label": "Swachh Bharat Mission", "url": "https://swachhbharatmission.gov.in/"},
    ],
    "public safety": [
        {"label": "Emergency Response Support System", "url": "https://112.gov.in/"},
    ],
}

COMMON_LINKS = [
    {"label": "CPGRAMS Public Grievance", "url": "https://pgportal.gov.in/"},
    {"label": "MyGov India", "url": "https://www.mygov.in/"},
]

SAMPLE_REPORTS = [
    {
        "title": "Overflowing garbage near school gate",
        "description": "Waste has not been collected for several days and students pass through the smell every morning.",
        "sector": "Sanitation",
        "location": "Ward 12, Green Valley School Road",
    },
    {
        "title": "Street lights not working on main road",
        "description": "The road becomes unsafe after 8 PM and residents reported minor accidents near the junction.",
        "sector": "Public Safety",
        "location": "Lakshmi Nagar Junction",
    },
    {
        "title": "Water leakage from public pipeline",
        "description": "Clean water is leaking continuously and causing muddy patches near homes.",
        "sector": "Water Supply",
        "location": "Indira Colony Lane 4",
    },
    {
        "title": "Bus stop has no shelter or route display",
        "description": "Commuters wait in heat and rain without real-time bus information.",
        "sector": "Transportation",
        "location": "Tech Park Bus Stop",
    },
    {
        "title": "Open drain causing mosquito breeding",
        "description": "Residents are facing mosquito problems and fear dengue cases in the area.",
        "sector": "Healthcare",
        "location": "Lake View Colony",
    },
    {
        "title": "Air pollution near construction site",
        "description": "Dust spreads during school hours and nearby families complain about breathing discomfort.",
        "sector": "Environment",
        "location": "Metro Extension Road",
    },
]

HACKATHON_IDEAS = [
    {
        "title": "Civic Heatmap Engine",
        "sector": "Transportation",
        "problem_title": "Pothole near market",
        "team": "Team RoadSense",
        "host": "College Smart City Hackathon",
        "status": "Recognized",
        "score": 94,
        "summary": "A ward-wise dashboard that clusters road complaints and highlights repeated accident zones.",
        "why_selected": "Selected because it converts many scattered road complaints into one priority map.",
        "implementation": "Pilot-ready dashboard for municipal engineers.",
        "image_url": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80",
    },
    {
        "title": "AI Complaint Router",
        "sector": "Education",
        "problem_title": "Unresolved campus maintenance complaints",
        "team": "Team CivicFlow",
        "host": "University Innovation Cell",
        "status": "Shortlisted",
        "score": 89,
        "summary": "An AI layer that reads complaints and routes them to the correct civic department.",
        "why_selected": "Selected because routing errors are a major reason public complaints stay pending.",
        "implementation": "Can connect with existing grievance portals.",
        "image_url": "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=80",
    },
    {
        "title": "Proof-of-Resolution Tracker",
        "sector": "Sanitation",
        "problem_title": "Overflowing garbage near school gate",
        "team": "Team CleanLoop",
        "host": "Public Impact Hack Day",
        "status": "Implemented demo",
        "score": 96,
        "summary": "A before-and-after evidence workflow for verifying whether civic issues were actually fixed.",
        "why_selected": "Selected because it measures real resolution instead of only complaint submission.",
        "implementation": "Demo includes photo evidence, timestamps, and authority update trail.",
        "image_url": "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80",
    },
    {
        "title": "Emergency Signal Detector",
        "sector": "Public Safety",
        "problem_title": "Street lights not working on main road",
        "team": "Team SafePulse",
        "host": "HackHazards Safety Sprint",
        "status": "Recognized",
        "score": 92,
        "summary": "A classifier that detects unsafe reports and instantly raises priority with emergency contacts.",
        "why_selected": "Selected because public safety reports need faster triage than normal complaints.",
        "implementation": "Ready for integration with a citizen reporting app.",
        "image_url": "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80",
    },
]


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def row_to_report(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "sector": row["sector"],
        "location": row["location"],
        "analysis": json.loads(row["analysis"]) if row["analysis"] else {},
        "createdAt": row["created_at"],
        "source": row["source"],
        "submitted_by": row["submitted_by"] if "submitted_by" in row.keys() else "",
    }


def row_to_idea(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "sector": row["sector"],
        "problem_title": row["problem_title"],
        "team": row["team"],
        "host": row["host"],
        "status": row["status"],
        "score": row["score"],
        "summary": row["summary"],
        "why_selected": row["why_selected"],
        "implementation": row["implementation"],
        "image_url": row["image_url"],
        "ai_top": bool(row["ai_top"] if "ai_top" in row.keys() and row["ai_top"] is not None else 0),
        "ai_score": int(row["ai_score"] if "ai_score" in row.keys() and row["ai_score"] is not None else 0),
        "user_top": bool(row["user_top"] if "user_top" in row.keys() and row["user_top"] is not None else 0),
        "submitted_by": row["submitted_by"] if "submitted_by" in row.keys() else "",
        "voted_by": row["voted_by"] if "voted_by" in row.keys() else "",
        "createdAt": row["created_at"],
    }


def save_report(data, analysis, source):
    report_id = data.get("id") or str(uuid.uuid4())
    db = get_db()

    db.execute(
        """
        INSERT INTO reports (id, title, description, sector, location, analysis, source, created_at, submitted_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            report_id,
            data.get("title", "").strip(),
            data.get("description", "").strip(),
            data.get("sector", "General").strip() or "General",
            data.get("location", "").strip(),
            json.dumps(analysis),
            source,
            now_iso(),
            data.get("submitted_by", "").strip(),
        ),
    )
    db.commit()

    return get_report(report_id)


def get_report(report_id):
    db = get_db()
    row = db.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()

    return row_to_report(row) if row else None


def list_reports():
    db = get_db()
    rows = db.execute("SELECT * FROM reports ORDER BY created_at DESC").fetchall()

    return [row_to_report(row) for row in rows]


def save_idea(data):
    idea_id = data.get("id") or str(uuid.uuid4())
    db = get_db()

    db.execute(
        """
        INSERT INTO hackathon_ideas (
            id, title, sector, problem_title, team, host, status, score, summary,
            why_selected, implementation, image_url, ai_top, ai_score, user_top, created_at, submitted_by, voted_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            idea_id,
            data.get("title", "").strip(),
            data.get("sector", "General").strip() or "General",
            data.get("problem_title", "").strip(),
            data.get("team", "").strip() or "Student Team",
            data.get("host", "").strip() or "Hackathon Host",
            data.get("status", "Submitted").strip() or "Submitted",
            int(data.get("score", 86) or 86),
            data.get("summary", "").strip(),
            data.get("why_selected", "").strip(),
            data.get("implementation", "").strip(),
            data.get("image_url", "").strip(),
            1 if data.get("ai_top") else 0,
            int(data.get("ai_score") or 0),
            1 if data.get("user_top") else 0,
            now_iso(),
            data.get("submitted_by", "").strip(),
            data.get("voted_by", "").strip(),
        ),
    )
    db.commit()

    return get_idea(idea_id)


def get_idea(idea_id):
    db = get_db()
    row = db.execute("SELECT * FROM hackathon_ideas WHERE id = ?", (idea_id,)).fetchone()

    return row_to_idea(row) if row else None


def list_ideas():
    db = get_db()
    rows = db.execute("SELECT * FROM hackathon_ideas ORDER BY user_top DESC, ai_top DESC, score DESC, created_at DESC").fetchall()

    return [row_to_idea(row) for row in rows]


@app.route("/ideas/<idea_id>/mark_best", methods=["POST"])
def mark_idea_best(idea_id):
    data = request.get_json(silent=True) or {}
    mark = bool(data.get("mark"))
    user_name = data.get("user_name", "").strip()
    db = get_db()
    db.execute(
        "UPDATE hackathon_ideas SET user_top = ?, voted_by = ? WHERE id = ?",
        (1 if mark else 0, user_name if mark else "", idea_id),
    )
    db.commit()
    idea = get_idea(idea_id)
    if not idea:
        return jsonify({"success": False, "error": "Idea not found"}), 404
    return jsonify({"success": True, "idea": idea})


def init_db():
    # Using a temporary connection just for initialization
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                sector TEXT NOT NULL,
                location TEXT NOT NULL,
                analysis TEXT NOT NULL,
                source TEXT NOT NULL,
                created_at TEXT NOT NULL,
                submitted_by TEXT DEFAULT ''
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS hackathon_ideas (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                sector TEXT NOT NULL,
                problem_title TEXT NOT NULL,
                team TEXT NOT NULL,
                host TEXT NOT NULL,
                status TEXT NOT NULL,
                score INTEGER NOT NULL,
                summary TEXT NOT NULL,
                why_selected TEXT NOT NULL,
                implementation TEXT NOT NULL,
                image_url TEXT NOT NULL,
                ai_top INTEGER DEFAULT 0,
                ai_score INTEGER DEFAULT 0,
                user_top INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                submitted_by TEXT DEFAULT '',
                voted_by TEXT DEFAULT ''
            )
            """
        )

        # Ensure new columns exist for older databases
        idea_cols = [r[1] for r in conn.execute("PRAGMA table_info(hackathon_ideas)").fetchall()]
        if "ai_top" not in idea_cols:
            conn.execute("ALTER TABLE hackathon_ideas ADD COLUMN ai_top INTEGER DEFAULT 0")
        if "ai_score" not in idea_cols:
            conn.execute("ALTER TABLE hackathon_ideas ADD COLUMN ai_score INTEGER DEFAULT 0")
        if "user_top" not in idea_cols:
            conn.execute("ALTER TABLE hackathon_ideas ADD COLUMN user_top INTEGER DEFAULT 0")
        if "submitted_by" not in idea_cols:
            conn.execute("ALTER TABLE hackathon_ideas ADD COLUMN submitted_by TEXT DEFAULT ''")
        if "voted_by" not in idea_cols:
            conn.execute("ALTER TABLE hackathon_ideas ADD COLUMN voted_by TEXT DEFAULT ''")

        report_cols = [r[1] for r in conn.execute("PRAGMA table_info(reports)").fetchall()]
        if "submitted_by" not in report_cols:
            conn.execute("ALTER TABLE reports ADD COLUMN submitted_by TEXT DEFAULT ''")

        report_count = conn.execute("SELECT COUNT(*) FROM reports").fetchone()[0]
        idea_count = conn.execute("SELECT COUNT(*) FROM hackathon_ideas").fetchone()[0]

    if report_count == 0:
        for report in SAMPLE_REPORTS:
            save_report(report, fallback_analysis(report), "sample-data")

    if idea_count == 0:
        for idea in HACKATHON_IDEAS:
            save_idea(idea)


def emergency_contacts_for(text):
    normalized = text.lower()
    contacts = [{"label": "National Emergency", "phone": "112"}]

    if any(word in normalized for word in ["fire", "smoke", "burn", "electric spark"]):
        contacts.append({"label": "Fire Service", "phone": "101"})

    if any(word in normalized for word in ["accident", "injury", "medical", "hospital", "ambulance"]):
        contacts.append({"label": "Ambulance", "phone": "108"})

    if any(word in normalized for word in ["crime", "violence", "theft", "unsafe", "harassment"]):
        contacts.append({"label": "Police", "phone": "100"})

    unique = {}
    for contact in contacts:
        unique[contact["phone"]] = contact

    return list(unique.values())


def complaint_links_for(sector):
    links = list(COMMON_LINKS)
    links.extend(SECTOR_LINKS.get(sector.lower(), []))
    return links


def fallback_analysis(data):
    sector = data.get("sector") or "General Civic Issue"
    location = data.get("location") or "the reported area"
    title = data.get("title") or "Reported civic problem"
    description = data.get("description") or ""
    severity = "High" if re.search(r"danger|accident|fire|injury|sewage|flood|unsafe", description, re.I) else "Medium"

    return {
        "category": sector,
        "severity": severity,
        "impact": (
            f"The issue at {location} can affect public safety, accessibility, cleanliness, "
            "and citizen trust if it remains unresolved."
        ),
        "suggestions": [
            "Verify the exact spot with a photo, landmark, and time of occurrence.",
            "Prioritize a short-term field inspection and temporary safety control.",
            "Route the complaint to the responsible ward or sector department.",
            "Track resolution time and reopen the issue if the problem repeats.",
        ],
        "authorities": [
            "Local municipal corporation or ward office",
            f"{sector} department",
            "Public grievance cell",
        ],
        "complaint_format": (
            "Subject: Request for urgent action on civic issue\n\n"
            "Respected Sir/Madam,\n\n"
            f"I would like to report the following issue: {title}.\n"
            f"Location: {location}\n"
            f"Description: {description}\n\n"
            "This is affecting nearby residents and commuters. Kindly inspect the location, "
            "take corrective action, and share an update on the resolution.\n\n"
            "Thank you."
        ),
        "innovation_ideas": [
            "Citizen issue heatmap with severity scoring.",
            "AI complaint router that identifies the correct department automatically.",
            "Before-and-after evidence tracking for civic problem resolution.",
        ],
        "best_hackathon_solution": "AI Complaint Router",
        "smart_city_solutions": [
            "Ward-level dashboards for recurring problem clusters.",
            "IoT sensors or QR-based reporting at repeated issue locations.",
            "SLA monitoring for every complaint category.",
        ],
        "emergency_contacts": emergency_contacts_for(f"{title} {description} {sector}"),
        "complaint_links": complaint_links_for(sector),
    }


def extract_json(text):
    if not text:
        raise ValueError("Empty Gemini response")

    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()

    match = re.search(r"\{.*\}", cleaned, flags=re.S)
    if not match:
        raise ValueError("Gemini did not return JSON")

    return json.loads(match.group(0))


def normalize_analysis(analysis, data):
    fallback = fallback_analysis(data)

    for key, value in fallback.items():
        if not analysis.get(key):
            analysis[key] = value

    for key in ["suggestions", "authorities", "innovation_ideas", "smart_city_solutions"]:
        if isinstance(analysis[key], str):
            analysis[key] = [analysis[key]]

    analysis["emergency_contacts"] = emergency_contacts_for(
        f"{data.get('title', '')} {data.get('description', '')} {data.get('sector', '')}"
    )
    analysis["complaint_links"] = complaint_links_for(data.get("sector") or "")

    return analysis


init_db()


@app.route("/")
def home():
    return jsonify(
        {
            "message": "ProblemPulse AI backend is running",
            "gemini_enabled": model is not None,
            "model": GEMINI_MODEL if model else None,
            "saved_reports": len(list_reports()),
        }
    )


@app.route("/reports", methods=["GET"])
def reports():
    return jsonify({"success": True, "reports": list_reports()})


@app.route("/ideas", methods=["GET"])
def ideas():
    return jsonify({"success": True, "ideas": list_ideas()})


@app.route("/ideas", methods=["POST"])
def create_idea():
    data = request.get_json(silent=True) or {}
    missing = [field for field in ["title", "sector", "problem_title", "summary"] if not data.get(field)]

    if missing:
        return jsonify({"success": False, "error": f"Missing fields: {', '.join(missing)}"}), 400

    idea = save_idea(data)
    return jsonify({"success": True, "idea": idea}), 201


@app.route("/analyze", methods=["POST"])
def analyze_problem():
    data = request.get_json(silent=True) or {}

    missing = [field for field in ["title", "description", "location"] if not data.get(field)]
    if missing:
        return jsonify({"success": False, "error": f"Missing fields: {', '.join(missing)}"}), 400

    prompt = f"""
Return only valid JSON. Do not use markdown.

Analyze this civic issue for a hackathon smart governance product.

Problem title: {data.get("title")}
Description: {data.get("description")}
Sector: {data.get("sector") or "General"}
Location: {data.get("location")}

Use this exact JSON schema:
{{
  "category": "short category",
  "severity": "Low, Medium, High, or Critical",
  "impact": "2-3 sentence public impact summary",
  "suggestions": ["practical AI/civic action", "practical AI/civic action"],
  "authorities": ["department or authority"],
  "complaint_format": "ready-to-send complaint letter",
  "innovation_ideas": ["hackathon/startup idea"],
  "best_hackathon_solution": "best single hackathon idea for this problem or Open for teams",
  "smart_city_solutions": ["long-term solution"]
}}
"""

    try:
        if not model:
            analysis = fallback_analysis(data)
            report = save_report(data, analysis, "local-fallback")
            return jsonify({"success": True, "analysis": analysis, "report": report, "source": "local-fallback"})

        response = model.generate_content(prompt)
        analysis = normalize_analysis(extract_json(response.text), data)
        report = save_report(data, analysis, "gemini")
        return jsonify({"success": True, "analysis": analysis, "report": report, "source": "gemini"})
    except Exception as exc:
        analysis = fallback_analysis(data)
        report = save_report(data, analysis, "local-fallback")
        return jsonify(
            {
                "success": True,
                "analysis": analysis,
                "report": report,
                "source": "local-fallback",
                "warning": str(exc),
            }
        )
if __name__ == "__main__":\
    port = int(os.environ.get("PORT", 5000))
app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
