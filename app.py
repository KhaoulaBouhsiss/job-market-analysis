from flask import Flask, request, jsonify, render_template, Response
from flask_cors import CORS
from dotenv import load_dotenv
from collections import Counter
from datetime import datetime
import io
import csv
import os
import json
import re
import anthropic
import pdfplumber

from db import get_connection
from seed_data import SAMPLE_DATA

load_dotenv()

ai_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_FIELDS = [
    "job_title", "company", "industry", "location",
    "work_mode", "experience_level", "salary", "skills", "posted_date"
]

SALARY_BUCKETS = [
    (0, 50000, "< 50k"),
    (50000, 70000, "50k - 70k"),
    (70000, 90000, "70k - 90k"),
    (90000, 110000, "90k - 110k"),
    (110000, 130000, "110k - 130k"),
    (130000, 150000, "130k - 150k"),
    (150000, 10_000_000, "150k +"),
]

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────
def fetch_all(query, params=None):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            return cur.fetchall()
    finally:
        conn.close()


def build_filter_clause(args):
    clauses = []
    params = []
    industry = args.get("industry")
    mode = args.get("mode")
    experience = args.get("experience")
    search = args.get("search")
    if industry:
        clauses.append("industry = %s")
        params.append(industry)
    if mode:
        clauses.append("work_mode = %s")
        params.append(mode)
    if experience:
        clauses.append("experience_level = %s")
        params.append(experience)
    if search:
        clauses.append("(job_title LIKE %s OR company LIKE %s OR skills LIKE %s)")
        like = f"%{search}%"
        params.extend([like, like, like])
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


def skill_counter(rows):
    counter = Counter()
    for r in rows:
        skills = r.get("skills") or ""
        for s in [x.strip() for x in skills.split(",") if x.strip()]:
            counter[s] += 1
    return counter


def extract_text_from_pdf(file_path):
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        text = f"Error extracting PDF: {str(e)}"
    return text.strip()


def analyze_compatibility(cv_text, job_text):
    prompt = f"""Tu es un expert en recrutement et analyse de CV. Analyse la compatibilité entre ce CV et cette offre d'emploi.

=== CV ===
{cv_text}

=== OFFRE D'EMPLOI ===
{job_text}

Réponds UNIQUEMENT avec un objet JSON valide (sans backticks, sans markdown), avec exactement cette structure:
{{
  "score": <nombre entier entre 0 et 100>,
  "niveau": "<Excellent | Très bon | Bon | Moyen | Faible>",
  "resume": "<résumé de la compatibilité en 2-3 phrases>",
  "points_forts": [
    {{"titre": "<titre>", "detail": "<explication>"}},
    {{"titre": "<titre>", "detail": "<explication>"}},
    {{"titre": "<titre>", "detail": "<explication>"}}
  ],
  "points_faibles": [
    {{"titre": "<titre>", "detail": "<explication>"}},
    {{"titre": "<titre>", "detail": "<explication>"}}
  ],
  "recommandations": [
    "<recommandation concrète 1>",
    "<recommandation concrète 2>",
    "<recommandation concrète 3>"
  ],
  "competences_matchees": ["<compétence 1>", "<compétence 2>", "<compétence 3>"],
  "competences_manquantes": ["<compétence 1>", "<compétence 2>"]
}}"""

    message = ai_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    response_text = message.content[0].text.strip()
    response_text = re.sub(r'^```json\s*', '', response_text)
    response_text = re.sub(r'\s*```$', '', response_text)
    return json.loads(response_text.strip())


# ─────────────────────────────────────────────────────────────
# Page route
# ─────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


# ─────────────────────────────────────────────────────────────
# CV Analysis
# ─────────────────────────────────────────────────────────────
@app.route("/api/analyze-cv", methods=["POST"])
def analyze_cv():
    if "cv" not in request.files or "job" not in request.files:
        return jsonify({"error": "Veuillez fournir le CV et l'offre d'emploi."}), 400

    cv_file = request.files["cv"]
    job_file = request.files["job"]

    if cv_file.filename == "" or job_file.filename == "":
        return jsonify({"error": "Fichiers manquants."}), 400

    cv_path = os.path.join(UPLOAD_FOLDER, "cv_temp.pdf")
    job_path = os.path.join(UPLOAD_FOLDER, "job_temp.pdf")
    cv_file.save(cv_path)
    job_file.save(job_path)

    cv_text = extract_text_from_pdf(cv_path)
    job_text = extract_text_from_pdf(job_path)

    if not cv_text:
        return jsonify({"error": "Impossible d'extraire le texte du CV."}), 400
    if not job_text:
        return jsonify({"error": "Impossible d'extraire le texte de l'offre."}), 400

    result = analyze_compatibility(cv_text, job_text)
    return jsonify(result)


# ─────────────────────────────────────────────────────────────
# Dashboard stats
# ─────────────────────────────────────────────────────────────
@app.route("/api/stats")
def stats():
    rows = fetch_all("SELECT * FROM job_listings")
    total_listings = len(rows)
    avg_salary = round(sum(r["salary"] for r in rows) / total_listings, 0) if total_listings else 0
    industry_counts = Counter(r["industry"] for r in rows)
    leading_industry = industry_counts.most_common(1)[0][0] if industry_counts else "—"
    skills_count = skill_counter(rows)
    top_skill = skills_count.most_common(1)[0][0] if skills_count else "—"

    month_counts = Counter()
    for r in rows:
        d = r["posted_date"]
        key = d.strftime("%Y-%m") if isinstance(d, datetime) else str(d)[:7]
        month_counts[key] += 1
    months_sorted = sorted(month_counts.keys())
    area_chart = {"labels": months_sorted, "values": [month_counts[m] for m in months_sorted]}
    industry_pie = {"labels": list(industry_counts.keys()), "values": list(industry_counts.values())}
    mode_counts = Counter(r["work_mode"] for r in rows)
    work_mode_donut = {"labels": list(mode_counts.keys()), "values": list(mode_counts.values())}
    exp_order = ["Entry", "Mid", "Senior", "Lead"]
    exp_counts = Counter(r["experience_level"] for r in rows)
    experience_bar = {
        "labels": [e for e in exp_order if e in exp_counts] or list(exp_counts.keys()),
        "values": [exp_counts[e] for e in exp_order if e in exp_counts] or list(exp_counts.values()),
    }

    return jsonify({
        "total_listings": total_listings,
        "avg_salary": int(avg_salary),
        "top_skill": top_skill,
        "leading_industry": leading_industry,
        "area_chart": area_chart,
        "industry_pie": industry_pie,
        "work_mode_donut": work_mode_donut,
        "experience_bar": experience_bar,
    })


# ─────────────────────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────────────────────
@app.route("/api/analytics")
def analytics():
    rows = fetch_all("SELECT * FROM job_listings")
    skills_count = skill_counter(rows)
    top_skills = skills_count.most_common(10)
    skills_demand = {"labels": [s for s, _ in top_skills], "values": [c for _, c in top_skills]}

    bucket_counts = [0] * len(SALARY_BUCKETS)
    for r in rows:
        for i, (lo, hi, _) in enumerate(SALARY_BUCKETS):
            if lo <= r["salary"] < hi:
                bucket_counts[i] += 1
                break
    salary_histogram = {"labels": [l for _, _, l in SALARY_BUCKETS], "values": bucket_counts}

    month_salaries = {}
    for r in rows:
        d = r["posted_date"]
        key = d.strftime("%Y-%m") if isinstance(d, datetime) else str(d)[:7]
        month_salaries.setdefault(key, []).append(r["salary"])
    months_sorted = sorted(month_salaries.keys())
    salary_trend = {
        "labels": months_sorted,
        "values": [round(sum(month_salaries[m]) / len(month_salaries[m]), 0) for m in months_sorted],
    }

    return jsonify({"skills_demand": skills_demand, "salary_histogram": salary_histogram, "salary_trend": salary_trend})


# ─────────────────────────────────────────────────────────────
# Filter options
# ─────────────────────────────────────────────────────────────
@app.route("/api/filter-options")
def filter_options():
    industries = fetch_all("SELECT DISTINCT industry FROM job_listings ORDER BY industry")
    modes = fetch_all("SELECT DISTINCT work_mode FROM job_listings ORDER BY work_mode")
    experiences = fetch_all("SELECT DISTINCT experience_level FROM job_listings ORDER BY experience_level")
    return jsonify({
        "industries": [r["industry"] for r in industries],
        "work_modes": [r["work_mode"] for r in modes],
        "experience_levels": [r["experience_level"] for r in experiences],
    })


# ─────────────────────────────────────────────────────────────
# Browse data
# ─────────────────────────────────────────────────────────────
@app.route("/api/listings")
def listings():
    where, params = build_filter_clause(request.args)
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 10))
    offset = (page - 1) * per_page
    total = fetch_all(f"SELECT COUNT(*) AS cnt FROM job_listings {where}", params)[0]["cnt"]
    rows = fetch_all(
        f"SELECT * FROM job_listings {where} ORDER BY posted_date DESC LIMIT %s OFFSET %s",
        params + [per_page, offset],
    )
    for r in rows:
        if hasattr(r["posted_date"], "isoformat"):
            r["posted_date"] = r["posted_date"].isoformat()
    return jsonify({
        "data": rows, "total": total, "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page if per_page else 1,
    })


# ─────────────────────────────────────────────────────────────
# CSV export
# ─────────────────────────────────────────────────────────────
@app.route("/api/export")
def export_csv():
    where, params = build_filter_clause(request.args)
    rows = fetch_all(f"SELECT * FROM job_listings {where} ORDER BY posted_date DESC", params)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=ALLOWED_FIELDS)
    writer.writeheader()
    for r in rows:
        row = {k: r.get(k) for k in ALLOWED_FIELDS}
        if hasattr(row["posted_date"], "isoformat"):
            row["posted_date"] = row["posted_date"].isoformat()
        writer.writerow(row)
    return Response(
        output.getvalue(), mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=job_listings_export.csv"},
    )


# ─────────────────────────────────────────────────────────────
# Upload CSV
# ─────────────────────────────────────────────────────────────
@app.route("/api/upload", methods=["POST"])
def upload():
    payload = request.get_json(silent=True)
    if not payload or "rows" not in payload:
        return jsonify({"error": "Aucune donnée reçue."}), 400
    rows = payload["rows"]
    if not isinstance(rows, list) or not rows:
        return jsonify({"error": "Le fichier ne contient aucune ligne valide."}), 400
    conn = get_connection()
    inserted = 0
    try:
        with conn.cursor() as cur:
            for row in rows:
                values = []
                for field in ALLOWED_FIELDS:
                    val = row.get(field, "")
                    if field == "salary":
                        try:
                            val = int(float(str(val).replace(",", "").strip())) if val not in (None, "") else 0
                        except (ValueError, TypeError):
                            val = 0
                    elif field == "posted_date":
                        val = str(val).strip() or datetime.today().strftime("%Y-%m-%d")
                    else:
                        val = str(val).strip()
                    values.append(val)
                placeholders = ", ".join(["%s"] * len(ALLOWED_FIELDS))
                cur.execute(
                    f"INSERT INTO job_listings ({', '.join(ALLOWED_FIELDS)}) VALUES ({placeholders})",
                    values,
                )
                inserted += 1
    finally:
        conn.close()
    return jsonify({"inserted": inserted})


# ─────────────────────────────────────────────────────────────
# Restore sample data
# ─────────────────────────────────────────────────────────────
@app.route("/api/restore-sample", methods=["POST"])
def restore_sample():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE job_listings")
            placeholders = ", ".join(["%s"] * len(ALLOWED_FIELDS))
            for row in SAMPLE_DATA:
                values = [row[f] for f in ALLOWED_FIELDS]
                cur.execute(
                    f"INSERT INTO job_listings ({', '.join(ALLOWED_FIELDS)}) VALUES ({placeholders})",
                    values,
                )
    finally:
        conn.close()
    return jsonify({"restored": len(SAMPLE_DATA)})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
