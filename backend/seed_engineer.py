"""One-time script: insert an Engineer-layout sample portfolio into the DB."""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal, engine
from app import models

models.Base.metadata.create_all(bind=engine)

SLUG = "arjun-dev"

DATA = {
    "theme": "noir",
    "layout": "engineer",
    "name": "Arjun Shah",
    "role": "Software Engineer",
    "greeting": "©",
    "tagline": "I build scalable web products and APIs that power real businesses. Available for full-time roles and freelance contracts.",
    "image": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
    "ctaText": "Get in Touch",
    "resumeText": "Download CV",
    "resumeUrl": "#",
    "socials": {
        "github": "#",
        "linkedin": "#",
        "twitter": "#",
    },
    "stats": [
        {"value": "5+", "label": "Years Experience"},
        {"value": "40+", "label": "Projects Shipped"},
        {"value": "12", "label": "Open Source Repos"},
        {"value": "3", "label": "Products Launched"},
    ],
    "aboutHeading": "Building things that scale",
    "about": "I'm a full-stack software engineer based in Bengaluru, India. I specialise in backend systems, REST & GraphQL APIs, and modern React frontends. I care about clean architecture, readable code, and products that actually ship. Previously at a Series B fintech; now available for new challenges.",
    "personal": {
        "email": "arjun@example.com",
        "phone": "+91 98765 43210",
        "location": "Bengaluru, India",
        "availability": "Available for hire",
        "languages": "English, Hindi",
    },
    "hServices": "What I Do",
    "services": [
        {"icon": "fa-server", "title": "Backend Engineering", "desc": "High-throughput APIs in Python (FastAPI, Django) and Node.js with PostgreSQL and Redis."},
        {"icon": "fa-code", "title": "Frontend Development", "desc": "Fast, accessible UIs in React and Next.js — pixel-perfect from Figma to production."},
        {"icon": "fa-cloud", "title": "Cloud & DevOps", "desc": "Docker, CI/CD pipelines, AWS/GCP deployments, monitoring and zero-downtime releases."},
        {"icon": "fa-shield-halved", "title": "API Design", "desc": "RESTful and GraphQL API design with thorough documentation and versioning strategy."},
        {"icon": "fa-database", "title": "Data Engineering", "desc": "ETL pipelines, schema design, query optimisation and reporting dashboards."},
        {"icon": "fa-code-branch", "title": "Code Review & Mentoring", "desc": "PR reviews, architecture discussions and mentoring junior developers."},
    ],
    "hSkills": "Tech Stack",
    "skills": [
        {"name": "Python / FastAPI", "percent": 95},
        {"name": "React / TypeScript", "percent": 88},
        {"name": "PostgreSQL / Redis", "percent": 90},
        {"name": "Docker / Kubernetes", "percent": 82},
        {"name": "AWS / GCP", "percent": 78},
        {"name": "System Design", "percent": 85},
    ],
    "hWork": "Selected Work",
    "projects": [
        {"title": "PayFlow — Payments API", "category": "Backend", "image": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=80", "desc": "High-throughput payments orchestration layer processing ₹2 Cr/day.", "url": "#"},
        {"title": "Insight — Analytics SaaS", "category": "Full-Stack", "image": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80", "desc": "Real-time analytics dashboard with streaming data and custom report builder.", "url": "#"},
        {"title": "DevDock — OSS CLI Tool", "category": "Open Source", "image": "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=600&q=80", "desc": "CLI for spinning up local dev environments in under 30 seconds. 2k GitHub stars.", "url": "#"},
        {"title": "Merchant Portal Redesign", "category": "Frontend", "image": "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?auto=format&fit=crop&w=600&q=80", "desc": "Full React rewrite of a legacy merchant dashboard; reduced task time by 40%.", "url": "#"},
        {"title": "DataSync — ETL Pipeline", "category": "Data", "image": "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?auto=format&fit=crop&w=600&q=80", "desc": "Automated ETL syncing 5M records daily across 3 data warehouses.", "url": "#"},
        {"title": "Auth Service", "category": "Backend", "image": "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=600&q=80", "desc": "Multi-tenant JWT + OAuth2 auth microservice handling 100k req/min.", "url": "#"},
    ],
    "hResume": "Experience & Education",
    "hExperience": "Experience",
    "hEducation": "Education",
    "experience": [
        {"role": "Senior Software Engineer", "company": "FinPay Technologies", "period": "2022 — Present", "desc": "Led backend architecture for a payments platform. Reduced API latency by 60% and onboarded 3 enterprise clients."},
        {"role": "Software Engineer II", "company": "Groww (Fintech)", "period": "2020 — 2022", "desc": "Built data pipelines and internal tooling. Shipped features for 8M+ active users."},
        {"role": "Junior Developer", "company": "StartupLab Bengaluru", "period": "2018 — 2020", "desc": "Full-stack development across 4 client products using React and Django."},
    ],
    "education": [
        {"degree": "B.Tech Computer Science", "company": "BITS Pilani", "period": "2014 — 2018", "desc": "Specialisation in Software Systems. Final-year thesis on distributed caching."},
    ],
    "hAchievements": "Recognition",
    "achievements": [
        {"icon": "fa-star", "title": "GitHub Arctic Code Vault", "subtitle": "Contributor 2023"},
        {"icon": "fa-trophy", "title": "Hackathon Winner", "subtitle": "HackIndia 2022"},
        {"icon": "fa-award", "title": "Employee of the Quarter", "subtitle": "FinPay Technologies"},
    ],
    "hTestimonials": "What Clients Say",
    "testimonials": [
        {"text": "Arjun's API design is some of the cleanest I've seen. He thinks about the consumer first, and it shows in how smooth our integrations have been.", "author": "Priya Mehta", "role": "CTO, QuickBill SaaS", "avatar": "https://i.pravatar.cc/100?img=47"},
        {"text": "He shipped our merchant portal in 6 weeks when the original estimate was 3 months. Quality and speed — a rare combination.", "author": "Rahul Nair", "role": "Product Manager, FinPay", "avatar": "https://i.pravatar.cc/100?img=11"},
        {"text": "The DevDock CLI changed how our whole team sets up environments. Saved us hours every sprint.", "author": "Sneha Iyer", "role": "Lead Engineer, StartupLab", "avatar": "https://i.pravatar.cc/100?img=31"},
    ],
    "contactHeading": "Let's Build Something",
    "contactText": "Open to senior engineering roles, tech-lead positions, and interesting freelance contracts. Drop me a message.",
}

db = SessionLocal()
try:
    existing = db.query(models.SamplePortfolio).filter_by(slug=SLUG).first()
    if existing:
        existing.data_json = json.dumps(DATA)
        existing.full_name = DATA["name"]
        existing.title = DATA["role"]
        existing.bio = DATA["about"][:160]
        existing.avatar_url = DATA["image"]
        existing.skills_json = json.dumps([s["name"] for s in DATA["skills"]])
        print(f"Updated existing sample: {SLUG}")
    else:
        db.add(models.SamplePortfolio(
            slug=SLUG,
            full_name=DATA["name"],
            title=DATA["role"],
            bio=DATA["about"][:160],
            avatar_url=DATA["image"],
            skills_json=json.dumps([s["name"] for s in DATA["skills"]]),
            data_json=json.dumps(DATA),
        ))
        print(f"Inserted new sample: {SLUG}")
    db.commit()
    print("Done. Visit http://localhost:8000/sample/arjun-dev to preview.")
finally:
    db.close()
