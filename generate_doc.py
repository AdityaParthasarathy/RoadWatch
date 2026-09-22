"""
Generates ROADWATCH_DOCUMENTATION.docx
Run: python generate_doc.py
"""

from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

# ── Palette ────────────────────────────────────────────────────────────────
CYAN    = RGBColor(0x00, 0xE5, 0xFF)
RED     = RGBColor(0xFF, 0x3B, 0x3B)
AMBER   = RGBColor(0xFF, 0xC8, 0x57)
GREEN   = RGBColor(0x3D, 0xDB, 0x6B)
DARK_BG = RGBColor(0x0D, 0x14, 0x20)
MID_BG  = RGBColor(0x14, 0x1B, 0x26)
TEXT_PRI= RGBColor(0xE6, 0xED, 0xF3)
TEXT_MUT= RGBColor(0x8B, 0x94, 0x9E)
BLACK   = RGBColor(0x00, 0x00, 0x00)
WHITE   = RGBColor(0xFF, 0xFF, 0xFF)

# ── Helpers ────────────────────────────────────────────────────────────────

def set_cell_bg(cell, hex_color: str):
    """Set cell background color via XML."""
    tc   = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd  = OxmlElement('w:shd')
    shd.set(qn('w:val'),   'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'),  hex_color.lstrip('#'))
    tcPr.append(shd)

def set_cell_borders(cell, color='D0D0D0'):
    tc   = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for side in ('top', 'left', 'bottom', 'right'):
        bd = OxmlElement(f'w:{side}')
        bd.set(qn('w:val'),   'single')
        bd.set(qn('w:sz'),    '4')
        bd.set(qn('w:space'), '0')
        bd.set(qn('w:color'), color)
        tcBorders.append(bd)
    tcPr.append(tcBorders)

def add_heading(doc, text, level=1, color=None):
    p    = doc.add_heading(text, level=level)
    run  = p.runs[0] if p.runs else p.add_run(text)
    run.font.color.rgb = color or (CYAN if level == 1 else BLACK)
    run.font.bold = True
    if level == 1:
        run.font.size = Pt(18)
    elif level == 2:
        run.font.size = Pt(14)
        run.font.color.rgb = RGBColor(0x1A, 0x56, 0x70)
    elif level == 3:
        run.font.size = Pt(12)
        run.font.color.rgb = RGBColor(0x2A, 0x70, 0x5A)
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after  = Pt(4)
    return p

def add_para(doc, text='', bold=False, italic=False, size=11, color=None, space_after=6):
    p   = doc.add_paragraph()
    run = p.add_run(text)
    run.bold   = bold
    run.italic = italic
    run.font.size = Pt(size)
    if color:
        run.font.color.rgb = color
    p.paragraph_format.space_after  = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    return p

def add_bullet(doc, text, level=0, bold_prefix=None):
    p = doc.add_paragraph(style='List Bullet')
    if bold_prefix:
        r = p.add_run(bold_prefix)
        r.bold = True
        r.font.size = Pt(10.5)
        r2 = p.add_run(text)
        r2.font.size = Pt(10.5)
    else:
        r = p.add_run(text)
        r.font.size = Pt(10.5)
    p.paragraph_format.left_indent   = Inches(0.25 + level * 0.25)
    p.paragraph_format.space_after   = Pt(3)
    p.paragraph_format.space_before  = Pt(0)
    return p

def add_code_block(doc, code: str):
    for line in code.strip().split('\n'):
        p   = doc.add_paragraph()
        run = p.add_run(line if line else ' ')
        run.font.name = 'Courier New'
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0x20, 0x20, 0x20)
        p.paragraph_format.space_after  = Pt(0)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.left_indent  = Inches(0.3)
        # Light grey background via XML shading on the paragraph
        pPr  = p._p.get_or_add_pPr()
        shd  = OxmlElement('w:shd')
        shd.set(qn('w:val'),   'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'),  'F4F4F4')
        pPr.append(shd)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

def add_table(doc, headers, rows, col_widths=None, header_bg='0D1420', stripe=True):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.LEFT

    # Header row
    hrow = table.rows[0]
    for i, h in enumerate(headers):
        cell = hrow.cells[i]
        cell.text = ''
        run  = cell.paragraphs[0].add_run(h)
        run.bold = True
        run.font.size = Pt(9.5)
        run.font.color.rgb = WHITE
        set_cell_bg(cell, header_bg)
        cell.paragraphs[0].paragraph_format.space_after  = Pt(2)
        cell.paragraphs[0].paragraph_format.space_before = Pt(2)
        if col_widths:
            cell.width = Inches(col_widths[i])

    # Data rows
    for ri, row_data in enumerate(rows):
        row = table.rows[ri + 1]
        bg  = 'F7F9FC' if (stripe and ri % 2 == 0) else 'FFFFFF'
        for ci, val in enumerate(row_data):
            cell = row.cells[ci]
            cell.text = ''
            p    = cell.paragraphs[0]
            if isinstance(val, tuple):   # (text, bold, color_rgb)
                text, bold, clr = val
                run = p.add_run(text)
                run.bold = bold
                if clr:
                    run.font.color.rgb = clr
                run.font.size = Pt(9.5)
            else:
                run = p.add_run(str(val))
                run.font.size = Pt(9.5)
            p.paragraph_format.space_after  = Pt(2)
            p.paragraph_format.space_before = Pt(2)
            set_cell_bg(cell, bg)
            if col_widths:
                cell.width = Inches(col_widths[ci])
    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return table

def add_divider(doc):
    p   = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    pBdr= OxmlElement('w:pBdr')
    bot = OxmlElement('w:bottom')
    bot.set(qn('w:val'),   'single')
    bot.set(qn('w:sz'),    '4')
    bot.set(qn('w:space'), '1')
    bot.set(qn('w:color'), '00E5FF')
    pBdr.append(bot)
    pPr.append(pBdr)
    p.paragraph_format.space_after  = Pt(10)
    p.paragraph_format.space_before = Pt(4)

def add_info_box(doc, text, bg='E8F8FF', border_color='00AACC'):
    """Single-cell table used as a callout box."""
    t    = doc.add_table(rows=1, cols=1)
    cell = t.rows[0].cells[0]
    cell.text = ''
    p    = cell.paragraphs[0]
    run  = p.add_run(text)
    run.font.size  = Pt(10)
    run.font.italic= True
    run.font.color.rgb = RGBColor(0x1A, 0x56, 0x70)
    p.paragraph_format.space_after  = Pt(4)
    p.paragraph_format.space_before = Pt(4)
    set_cell_bg(cell, bg)
    set_cell_borders(cell, border_color)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

# ══════════════════════════════════════════════════════════════════════════
# BUILD DOCUMENT
# ══════════════════════════════════════════════════════════════════════════

doc = Document()

# ── Page margins ──────────────────────────────────────────────────────────
for section in doc.sections:
    section.top_margin    = Cm(2.0)
    section.bottom_margin = Cm(2.0)
    section.left_margin   = Cm(2.5)
    section.right_margin  = Cm(2.5)

# ── Normal style defaults ─────────────────────────────────────────────────
style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(11)

# ══════════════════════════════════════════════════════════════════════════
# COVER / TITLE
# ══════════════════════════════════════════════════════════════════════════

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('RoadWatch AI')
r.font.size  = Pt(32)
r.font.bold  = True
r.font.color.rgb = CYAN

p2 = doc.add_paragraph()
p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
r2 = p2.add_run('Complete Project Documentation')
r2.font.size  = Pt(16)
r2.font.color.rgb = RGBColor(0x1A, 0x56, 0x70)

p3 = doc.add_paragraph()
p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
r3 = p3.add_run('Infrastructure Intelligence Platform  ·  April 2026')
r3.font.size  = Pt(11)
r3.font.color.rgb = TEXT_MUT
r3.font.italic = True

add_divider(doc)

# ══════════════════════════════════════════════════════════════════════════
# 1. WHAT IS ROADWATCH AI
# ══════════════════════════════════════════════════════════════════════════

add_heading(doc, '1. What is RoadWatch AI?', 1)
add_para(doc,
    'RoadWatch AI is a real-time road infrastructure monitoring platform that combines smartphone '
    'sensors, computer vision (AI), GPS mapping, and civic data tools to detect, classify, and '
    'report road damage — automatically.',
    size=11, space_after=8)

add_heading(doc, 'The Problem It Solves', 2)
add_para(doc,
    'Roads deteriorate faster than governments can inspect them. Traditional monitoring relies on '
    'manual inspections (slow, expensive, infrequent), unstructured citizen complaints, and reactive '
    'repairs. RoadWatch AI replaces all of this with continuous, automated, geo-tagged infrastructure intelligence.',
    size=11, space_after=8)

add_heading(doc, 'What Makes It Different', 2)
add_table(doc,
    headers=['Feature', 'Traditional Systems', 'RoadWatch AI'],
    col_widths=[2.0, 2.2, 2.2],
    rows=[
        ('Damage detection',   'Manual inspection',            'AI + smartphone accelerometer'),
        ('Data granularity',   'Per-road, once a year',        'Per-GPS-point, real-time'),
        ('Civic reporting',    'Phone call / paper form',      'One-tap mobile sensor page'),
        ('Route planning',     'Shortest path',                'Safest path — avoids damage zones'),
        ('Government handoff', 'Verbal / spreadsheet',         'Auto-generated official PDF report'),
        ('Road health view',   'Not available',                'Live 0–100 Health Index per zone'),
    ]
)

# ══════════════════════════════════════════════════════════════════════════
# 2. SYSTEM ARCHITECTURE
# ══════════════════════════════════════════════════════════════════════════

add_heading(doc, '2. System Architecture', 1)
add_para(doc,
    'RoadWatch AI is a three-tier architecture with four distinct services that communicate over HTTP.',
    size=11, space_after=6)

add_code_block(doc, """\
┌──────────────────────────────────────────────────────────┐
│                    USER INTERFACES                        │
│   Dashboard (React + Leaflet)  │  Mobile Reporter (Phone) │
└────────────────────┬──────────────────────┬──────────────┘
                     │ HTTP REST            │ HTTP REST
                     ▼                      ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND API  (Spring Boot — Port 8080)      │
│   /api/issues   /api/predictions   /api/health           │
│   /api/telemetry   /api/issues/upload   /api/issues/report│
└─────────────────┬───────────────────────────────────────┘
                  │
         ┌────────┴─────────┐
         ▼                  ▼
┌────────────────┐  ┌──────────────────────────────────────┐
│  AI SERVICE    │  │         FIREBASE (Google Cloud)       │
│  Python Flask  │  │  Firestore (database) + Auth (login)  │
│  Port 5000     │  └──────────────────────────────────────┘
│  OpenCV        │
└────────────────┘""")

add_heading(doc, 'Service Roles', 2)
add_table(doc,
    headers=['Service', 'Technology', 'Port', 'Responsibility'],
    col_widths=[1.5, 2.0, 0.8, 2.1],
    rows=[
        ('Frontend',    'React 18 + Vite',            '5173', 'User interface, map, mobile page'),
        ('Backend API', 'Spring Boot 3.2.4 (Java)',   '8080', 'Data layer, routing, coordination'),
        ('AI Service',  'Python 3 + Flask + OpenCV',  '5000', 'Image-based damage classification'),
        ('Firebase',    'Google Cloud',               'cloud','User authentication + Firestore DB'),
    ]
)

# ══════════════════════════════════════════════════════════════════════════
# 3. TECHNOLOGY STACK
# ══════════════════════════════════════════════════════════════════════════

add_heading(doc, '3. Technology Stack', 1)

add_heading(doc, 'Frontend', 2)
add_table(doc,
    headers=['Library', 'Purpose'],
    col_widths=[2.0, 4.4],
    rows=[
        ('React 18',              'UI framework — component-based rendering'),
        ('Vite 8',                'Build tool and fast development server'),
        ('Leaflet + react-leaflet','Interactive map rendering'),
        ('Framer Motion',         'Animations (page transitions, cards, toasts)'),
        ('Recharts',              'Charts and graphs in the Intelligence Panel'),
        ('jsPDF + jspdf-autotable','PDF report generation and table layout'),
        ('date-fns',              'Human-readable timestamps ("2 hours ago")'),
        ('lucide-react',          'Icon library'),
        ('axios',                 'HTTP client for API calls'),
        ('Firebase JS SDK',       'Authentication state management'),
    ]
)

add_heading(doc, 'Backend', 2)
add_table(doc,
    headers=['Library', 'Purpose'],
    col_widths=[2.2, 4.2],
    rows=[
        ('Spring Boot 3.2.4', 'REST API framework'),
        ('Spring Web',        'HTTP request handling and CORS configuration'),
        ('Spring Cloud GCP',  'Google Firestore database client'),
        ('Jackson',           'JSON serialization and deserialization'),
        ('SLF4J / Logback',   'Application logging'),
    ]
)

add_heading(doc, 'AI Service', 2)
add_table(doc,
    headers=['Library', 'Purpose'],
    col_widths=[2.2, 4.2],
    rows=[
        ('Flask',   'Lightweight HTTP server'),
        ('OpenCV',  'Computer vision — edge detection, damage analysis'),
        ('NumPy',   'Image array processing'),
        ('Pillow',  'Image format handling and conversion'),
    ]
)

add_heading(doc, 'Cloud & Infrastructure', 2)
add_table(doc,
    headers=['Service', 'Purpose'],
    col_widths=[2.5, 3.9],
    rows=[
        ('Firebase Authentication', 'Email/password login system'),
        ('Google Cloud Firestore',  'NoSQL document database for road issues'),
        ('OpenRouteService (ORS)',   'Real road-following route computation API'),
    ]
)

# ══════════════════════════════════════════════════════════════════════════
# 4. HOW TO START
# ══════════════════════════════════════════════════════════════════════════

add_heading(doc, '4. How to Start the System', 1)

add_heading(doc, 'Prerequisites', 2)
for item in [
    'Node.js 18+ and npm',
    'Java 17+ and Maven 3.9+',
    'Python 3.9+ with pip',
    'A Firebase project (credentials in frontend/.env)',
]:
    add_bullet(doc, item)

add_heading(doc, 'Step 1 — Start the AI Service', 2)
add_code_block(doc, """\
cd C:\\RoadWatch\\ai_service
python app.py
# Runs on http://localhost:5000""")

add_heading(doc, 'Step 2 — Start the Backend API', 2)
add_code_block(doc, """\
cd C:\\RoadWatch\\backend
mvn spring-boot:run
# Runs on http://localhost:8080
# Wait for: "Started RoadwatchApplication" """)

add_heading(doc, 'Step 3 — Start the Frontend', 2)
add_code_block(doc, """\
cd C:\\RoadWatch\\frontend
npm run dev
# Runs on http://localhost:5173""")

add_heading(doc, 'Step 4 — Mobile Reporter (from phone)', 2)
add_para(doc,
    'Find your computer\'s local IP: run ipconfig on Windows and look for the IPv4 Address under your '
    'WiFi adapter. Then on your phone (connected to the same WiFi network), open:',
    size=11, space_after=4)
add_code_block(doc, 'http://[your-ip]:5173/report')

# ══════════════════════════════════════════════════════════════════════════
# 5. FEATURES
# ══════════════════════════════════════════════════════════════════════════

add_heading(doc, '5. Feature-by-Feature Breakdown', 1)

# 5.1 Auth
add_heading(doc, '5.1  Authentication', 2)
add_para(doc,
    'A login/signup screen that guards the entire dashboard. Powered by Firebase Authentication '
    '(email/password). When the app loads it checks Firebase for an existing session. If none exists, '
    'the AuthScreen is shown. Successful login persists a session token in the browser across refreshes. '
    'The signed-in user\'s email appears in the top bar; a sign-out button is beside it.',
    size=11, space_after=6)

add_heading(doc, 'Authentication States', 3)
add_table(doc,
    headers=['State', 'Meaning', 'UI Shown'],
    col_widths=[1.4, 2.4, 2.6],
    rows=[
        ('undefined', 'Auth check in progress', 'Spinner only'),
        ('null',      'No user logged in',       'Login / Signup screen'),
        ('User object','Authenticated',           'Full dashboard'),
    ]
)

# 5.2 Landing
add_heading(doc, '5.2  Landing Page & Boot Screen', 2)
add_para(doc,
    'A cinematic intro sequence before the dashboard. The landing page shows a hero banner. '
    'Clicking "Enter Dashboard" triggers the Boot Screen — a simulated terminal window that types '
    'out system initialization messages one by one over ~3.5 seconds before the dashboard fades in. '
    'This is purely cosmetic — setting the tone of an authoritative, high-tech platform.',
    size=11, space_after=8)

# 5.3 Map
add_heading(doc, '5.3  Live Dashboard Map', 2)
add_para(doc,
    'The central feature — an interactive dark-themed map showing all road issues in real time. '
    'Built with Leaflet and CartoDB Dark Matter tiles. Issues are fetched from the backend every '
    '15 seconds and overlaid as animated markers. Multiple visualization layers can be toggled on/off.',
    size=11, space_after=6)

add_heading(doc, 'Map Layer Toggles', 3)
add_table(doc,
    headers=['Toggle', 'What It Shows'],
    col_widths=[2.0, 4.4],
    rows=[
        ('Risk Layer',    'Dashed red circles around AI-predicted danger zones'),
        ('Risk Heatmap',  'Color-blended canvas overlay (green → red) based on issue density'),
        ('Health Index',  'Grid rectangles colored by road health score (green = healthy, red = critical)'),
    ]
)

# 5.4 Markers
add_heading(doc, '5.4  Issue Markers & Severity System', 2)
add_para(doc,
    'Every road issue detected is shown as a pulsing animated dot on the map. The size, color, '
    'pulse speed, and ring count all reflect the severity level.',
    size=11, space_after=6)

add_heading(doc, 'Severity Levels', 3)
add_table(doc,
    headers=['Level', 'Score Range', 'Color', 'Visual Behavior'],
    col_widths=[1.3, 1.4, 1.0, 2.7],
    rows=[
        (('MINOR',    True, GREEN), '0.0 – 0.4', 'Green',  'Small dot, slow outer pulse ring'),
        (('WARNING',  True, AMBER), '0.4 – 0.8', 'Amber',  'Medium dot, two pulse rings'),
        (('CRITICAL', True, RED),   '0.8 – 1.0', 'Red',    'Large dot, fast double ring + ripple burst'),
    ]
)

add_para(doc,
    'The severity score is a decimal from 0.0 (undamaged) to 1.0 (severe), displayed as X/10 in the UI. '
    'Clicking a marker opens a popup showing: issue type, severity bar, AI Confidence %, coordinates, '
    'and time since reported.',
    size=11, space_after=8)

# 5.5 Heatmap
add_heading(doc, '5.5  AI Risk Heatmap', 2)
add_para(doc,
    'A soft, blurred color overlay rendered on an HTML canvas element layered over the map. Each issue '
    'and pre-defined hotspot cluster produces a radial gradient blob colored red (high risk), amber '
    '(medium), or green (low). The canvas redraws on every map pan/zoom. Pre-loaded hotspots cover '
    'Chennai neighbourhoods and New York City zones so the heatmap is non-empty even before user data '
    'is added.',
    size=11, space_after=8)

# 5.6 Predictions
add_heading(doc, '5.6  Predictive Risk Layer', 2)
add_para(doc,
    'AI-predicted zones likely to deteriorate, shown as 150m-radius dashed red circles. Fetched from '
    'GET /api/predictions when first enabled. Each prediction includes a location, risk score (0–1), '
    'and a reason string explaining why the area is at risk. Clicking a circle shows the AI reasoning.',
    size=11, space_after=8)

# 5.7 Health Index
add_heading(doc, '5.7  Road Health Index', 2)
add_para(doc,
    'A score from 0 to 100 assigned to every ~1.1 km² grid cell of the road network, showing the '
    'health of infrastructure in that area. This shifts the framing from "individual issues" to '
    '"network-wide infrastructure health" — more useful for government planning.',
    size=11, space_after=6)

add_heading(doc, 'Score Formula', 3)
add_code_block(doc, """\
Health Score = 100 - Σ(penalty × age_factor)

Where:
  CRITICAL issue (score > 0.7)  →  25 points deducted
  WARNING  issue (score > 0.4)  →  12 points deducted
  MINOR    issue (score ≤ 0.4)  →   5 points deducted
  age_factor = max(0.2, 1 - days_old / 90)   ← issues decay over 90 days""")

add_heading(doc, 'Score Grades', 3)
add_table(doc,
    headers=['Score', 'Grade', 'Color'],
    col_widths=[1.2, 1.4, 1.4],
    rows=[
        ('80 – 100', 'GOOD',     'Green'),
        ('60 – 79',  'FAIR',     'Yellow-green'),
        ('40 – 59',  'POOR',     'Amber'),
        ('20 – 39',  'BAD',      'Orange-red'),
        ('0 – 19',   'CRITICAL', 'Red'),
    ]
)

add_para(doc,
    'The UI shows a map overlay of colored grid rectangles and a floating panel (bottom-left) '
    'displaying the network average score, healthy vs critical segment counts, and the 5 worst '
    'GPS coordinates with their individual scores.',
    size=11, space_after=8)

# 5.8 Route Recommender
add_heading(doc, '5.8  Route Recommender', 2)
add_para(doc,
    'A smart route planner that calculates the safest path between two points on the map by '
    'avoiding roads with known damage.',
    size=11, space_after=6)

add_heading(doc, 'How It Works', 3)
steps = [
    'User activates the planner and clicks two points on the map (Start → End).',
    'The system calls the OpenRouteService (ORS) Directions API to fetch up to 3 real road-following routes.',
    'Each route is scored by proximity to known issues, weighted by severity.',
    'Routes are sorted: Safest (lowest risk) → Balanced → Fastest.',
    'All three are drawn as colored polylines; the user switches between them on the panel.',
]
for i, s in enumerate(steps, 1):
    add_bullet(doc, f'{i}. {s}')

add_heading(doc, 'Risk Scoring Formula', 3)
add_code_block(doc, """\
Route Risk Score = Σ  severity × (1 - distance / 500m)
                   for each issue within 500m of any route point

Lower score = Safer route""")

# 5.9 Image Upload
add_heading(doc, '5.9  Image Upload & AI Detection', 2)
add_para(doc,
    'Users can upload a photo of a road surface. The AI automatically classifies the damage type '
    '(pothole, crack, waterlogging) and assigns a severity score.',
    size=11, space_after=6)

add_heading(doc, 'Detection Pipeline', 3)
pipeline = [
    'User selects an image and enters GPS coordinates.',
    'Image is sent to POST /api/issues/upload on the backend.',
    'Backend forwards the image to the Python AI service at POST /api/detect.',
    'OpenCV analyzes the image using edge detection, texture analysis, and contour finding.',
    'AI returns { type: "pothole", severity: 7 } (severity on 1–10 scale).',
    'Backend converts severity to 0.0–1.0 scale and saves the issue to Firestore.',
    'The issue marker appears on the map within seconds.',
]
for i, s in enumerate(pipeline, 1):
    add_bullet(doc, f'{i}. {s}')

add_info_box(doc,
    'Fallback: If the AI service is offline, the issue is still saved with type: "unknown" and '
    'severity: 0.0. The system never rejects a report due to a downstream failure.')

# 5.10 Mobile Sensor
add_heading(doc, '5.10  Mobile Sensor Reporter', 2)
add_para(doc,
    'A dedicated phone page that uses the phone\'s built-in accelerometer and GPS to automatically '
    'detect potholes while driving — no camera or manual input required.',
    size=11, space_after=6)

add_heading(doc, 'Access URL', 3)
add_code_block(doc, 'http://[your-computer-lan-ip]:5173/report')

add_heading(doc, 'Detection Thresholds', 3)
add_table(doc,
    headers=['Level', 'Spike (m/s²)', 'Color', 'Type Assigned'],
    col_widths=[1.3, 1.5, 1.0, 1.8],
    rows=[
        (('MINOR',    True, GREEN), '> 2.5', 'Green', 'crack'),
        (('WARNING',  True, AMBER), '> 5.0', 'Amber', 'pothole'),
        (('CRITICAL', True, RED),   '> 9.0', 'Red',   'pothole'),
    ]
)

add_heading(doc, 'Key Technical Concepts', 3)
bullets = [
    ('EMA Baseline: ', 'baseline = baseline × 0.95 + current × 0.05 — drifts slowly, adapting to the phone\'s normal vibration so only real bumps trigger detections.'),
    ('Debounce: ', 'After any detection, the system waits 2.2 seconds before allowing another — prevents one bump registering multiple times.'),
    ('GPS Lock: ', 'navigator.geolocation.watchPosition tracks real-time location. Detections are only saved after GPS lock is confirmed.'),
    ('G-Force Meter: ', 'An SVG arc gauge in the UI shows the live spike value in real time.'),
    ('Voice Alerts: ', 'Each detection is spoken aloud using the browser\'s speech synthesis engine.'),
]
for bold, text in bullets:
    add_bullet(doc, text, bold_prefix=bold)

# 5.11 Trip Simulator
add_heading(doc, '5.11  Trip Simulator', 2)
add_para(doc,
    'Simulates a vehicle driving along a predefined route, generating real-time GPS telemetry with '
    'roughness ratings every 2 seconds. Trip paths appear on the map as colored polylines: '
    'green = smooth, amber = bumpy, red = rough. Roughness is a 0.0–1.0 measure of simulated '
    'road vibration intensity.',
    size=11, space_after=8)

# 5.12 Alert System
add_heading(doc, '5.12  Real-Time Alert System', 2)
add_para(doc,
    'A multi-layered notification system that fires when new road issues are detected.',
    size=11, space_after=6)

add_heading(doc, 'Alert Components', 3)
add_table(doc,
    headers=['Component', 'Description'],
    col_widths=[2.2, 4.2],
    rows=[
        ('Toast Stack (top-right)', 'Floating cards for new issues — up to 4 visible, auto-dismiss after 5 seconds'),
        ('Alert History Panel',     'Bell icon opens a sliding panel with the last 50 alerts this session'),
        ('Unread Badge',            'Red counter on the bell icon showing unread alert count'),
        ('Incident Banner',         'Large centered banner that appears when SIMULATE button is pressed'),
        ('Simulation Fallback',     'If no real issues arrive for 28 seconds, a fake issue is generated to keep the dashboard "live"'),
    ]
)

# 5.13 PDF
add_heading(doc, '5.13  Municipal PDF Report Generator', 2)
add_para(doc,
    'Generates a formatted, print-ready PDF document summarizing all current road issues — designed '
    'to be submitted to city governments or road maintenance departments. Click "Generate PDF Report" '
    'in the sidebar Tools section.',
    size=11, space_after=6)

add_heading(doc, 'PDF Contents', 3)
pdf_contents = [
    ('Header: ', 'RoadWatch AI branding, generation date/time, "OFFICIAL REPORT" badge'),
    ('Executive Summary: ', 'Four stat boxes (Total, Critical, Warning, Minor) + average severity progress bar'),
    ('Recommendations: ', 'Auto-generated action items based on severity distribution'),
    ('Issue Register: ', 'Full table with columns: #, Type, Level, Score, Latitude, Longitude, Date'),
    ('Footer (every page): ', '"RoadWatch AI · CONFIDENTIAL" and page numbers'),
]
for bold, text in pdf_contents:
    add_bullet(doc, text, bold_prefix=bold)

add_heading(doc, 'Recommendation Logic', 3)
add_table(doc,
    headers=['Condition', 'Recommendation Text'],
    col_widths=[2.0, 4.4],
    rows=[
        ('Critical issues exist', '"Require immediate repair within 48 hours to prevent vehicle damage and liability."'),
        ('Warning issues exist',  '"Should be scheduled for repair within 2–4 weeks."'),
        ('Minor issues exist',    '"Should be included in the next routine maintenance cycle."'),
    ]
)

# 5.14 Voice
add_heading(doc, '5.14  Voice Alerts', 2)
add_para(doc,
    'The system announces new road hazards aloud using the browser\'s built-in Text-to-Speech engine '
    '(window.speechSynthesis). No external service required — works entirely in the browser.',
    size=11, space_after=6)

add_heading(doc, 'Dashboard Voice Alerts', 3)
add_para(doc,
    'Fires for any new issue with severity > 0.7 (CRITICAL). A mute/unmute toggle (speaker icon) is '
    'in the top bar. Example: "Critical alert. Pothole in T. Nagar. Severity 9 out of 10. Immediate '
    'attention required."', size=11, space_after=6)

add_heading(doc, 'Mobile Reporter Voice Alerts', 3)
add_table(doc,
    headers=['Detection Level', 'Announcement'],
    col_widths=[1.8, 4.6],
    rows=[
        ('CRITICAL', '"Critical road hazard! Pothole detected. Severity 8.2 out of 10."'),
        ('WARNING',  '"Warning. Pothole detected ahead. Severity 5.1."'),
        ('MINOR',    '"Minor crack detected."'),
    ]
)

# 5.15 Intelligence Panel
add_heading(doc, '5.15  Intelligence Panel', 2)
add_para(doc,
    'A data dashboard view showing charts and statistics about all road issues. '
    'Access via "Intelligence Panel" in the sidebar. Shows bar charts of issue type distribution, '
    'severity breakdowns, and issue counts. Built with Recharts.',
    size=11, space_after=8)

# 5.16 System Health
add_heading(doc, '5.16  System Health Monitor', 2)
add_para(doc,
    'Live status indicators in the top bar showing whether each service is reachable. '
    'The system polls every 5 seconds. A counter shows seconds since last check.',
    size=11, space_after=6)

add_table(doc,
    headers=['Indicator', 'What It Checks', 'DOWN Behavior'],
    col_widths=[1.4, 2.2, 2.8],
    rows=[
        ('BACKEND',   'Spring Boot API reachable at :8080',     'Full service unavailable overlay shown'),
        ('AI SVC',    'Python AI service reachable at :5000',   'Issues saved with type: unknown, severity: 0'),
        ('FIRESTORE', 'Firestore database responding',          'Issues stored in memory (lost on restart)'),
    ]
)

# ══════════════════════════════════════════════════════════════════════════
# 6. GLOSSARY
# ══════════════════════════════════════════════════════════════════════════

add_heading(doc, '6. Glossary of Terms', 1)
add_table(doc,
    headers=['Term', 'Definition'],
    col_widths=[2.2, 4.2],
    rows=[
        ('Severity Score',        'Decimal 0.0–1.0 representing road damage level. 0 = perfect, 1 = extreme. Shown as X/10 in the UI.'),
        ('Pothole',               'Bowl-shaped depression in a road surface caused by water damage and traffic. High-severity damage type.'),
        ('Crack',                 'Linear fracture in the road surface. Usually lower severity than potholes.'),
        ('Waterlogging',          'Standing water on a road surface that can hide damage and cause vehicle problems.'),
        ('EMA (Exponential Moving Average)', 'A filter that smooths sensor readings to establish a "normal" baseline, so spikes above it indicate real bumps.'),
        ('Debounce',              'A technique that prevents one physical bump from registering as many digital detections.'),
        ('Accelerometer',         'Phone sensor measuring forces in 3 axes (X, Y, Z). Z-axis detects vertical bumps.'),
        ('GPS Lock',              'When the phone has enough satellite signals to accurately report latitude and longitude.'),
        ('Severity Spike',        'Difference between current accelerometer Z-reading and the EMA baseline. Large spike = large bump.'),
        ('Heatmap',               'A geographic visualization where color intensity represents the density or severity of values.'),
        ('Road Health Index',     'Score 0–100 per ~1.1km² grid cell, calculated from number, severity, and age of issues in that area.'),
        ('Grid Cell',             'A ~1.1 km × 1.1 km geographic square used to group nearby issues for the Health Index.'),
        ('ORS (OpenRouteService)','Free, open-source routing engine that computes real road-following paths between GPS coordinates.'),
        ('Route Risk Score',      'How many damage zones a route passes through, weighted by severity and proximity. Lower = safer.'),
        ('Firestore',             'Google Cloud\'s NoSQL document database. RoadWatch stores road issues here persistently.'),
        ('Fallback Mode',         'When a downstream service is unavailable, the system continues with safe defaults instead of failing.'),
        ('Telemetry',             'Sensor data transmitted from a moving vehicle — GPS position and roughness ratings.'),
        ('Roughness',             'A 0.0–1.0 measure of road bumpiness generated by the Trip Simulator.'),
        ('AI Confidence',         'Percentage (61–98%) representing how certain the AI model is about its damage classification.'),
        ('CartoDB Dark Matter',   'The dark-themed map tile provider used by RoadWatch for the map background.'),
        ('Polyline',              'A line drawn on the map connecting multiple GPS coordinates. Used for routes and trip paths.'),
        ('Toast Notification',    'A small pop-up card that appears briefly to inform the user of an event, then disappears.'),
        ('LAN IP',                'Local Area Network IP — the address your computer has on WiFi. Phones on the same network use this to reach the app.'),
        ('CORS',                  'Cross-Origin Resource Sharing — a browser security rule. The backend allows all origins so the frontend can call it.'),
        ('REST API',              'Standard way of structuring HTTP endpoints. The backend follows REST conventions.'),
        ('Speech Synthesis',      'The browser\'s built-in text-to-speech engine (window.speechSynthesis). No internet required.'),
        ('Simulated Issue',       'A fake road issue injected by pressing the SIMULATE button, used for demonstration without real data.'),
    ]
)

# ══════════════════════════════════════════════════════════════════════════
# 7. DATA FLOW
# ══════════════════════════════════════════════════════════════════════════

add_heading(doc, '7. Data Flow', 1)

add_heading(doc, 'Image Upload Flow', 2)
add_code_block(doc, """\
User selects image + coordinates
         │
         ▼
  Frontend → POST /api/issues/upload { file, lat, lng }
         │
         ▼
  Backend → POST http://localhost:5000/api/detect (image)
         │
         ▼
  AI Service (OpenCV) → { type: "pothole", severity: 7 }
         │
         ▼
  Backend builds issue { id, type, lat, lng, severityScore: 0.7 }
         │
         ├── Saves to Firestore
         ├── Returns HTTP 201 to frontend
         │
         ▼
  Frontend adds marker to map + fires alert toast""")

add_heading(doc, 'Mobile Sensor Detection Flow', 2)
add_code_block(doc, """\
Phone accelerometer fires DeviceMotion event (~60/second)
         │
         ▼
  EMA baseline updated → Spike = |z - baseline|
         │
         ▼
  Spike > 2.5 m/s² AND debounce clear AND GPS locked?
         │
         ▼ YES
  severity = min(1.0, spike / 15.0)
  type = spike > 5.0 ? "pothole" : "crack"
         │
         ├── Voice alert spoken on phone
         ├── Flash overlay shown on screen
         │
         ▼
  POST /api/issues/report { type, latitude, longitude, severityScore }
         │
         ▼
  Backend saves to Firestore
         │
         ▼
  Dashboard polling (every 15s) picks up new issue
  Marker appears on map""")

# ══════════════════════════════════════════════════════════════════════════
# 8. API REFERENCE
# ══════════════════════════════════════════════════════════════════════════

add_heading(doc, '8. API Reference', 1)

add_heading(doc, 'Backend API (Spring Boot — Port 8080)', 2)
add_table(doc,
    headers=['Method', 'Endpoint', 'Description'],
    col_widths=[0.9, 2.4, 3.1],
    rows=[
        ('GET',  '/api/issues',            'Fetch all road issues'),
        ('POST', '/api/issues/upload',     'Upload image + GPS for AI detection'),
        ('POST', '/api/issues/report',     'Submit sensor-detected issue (no image)'),
        ('GET',  '/api/predictions',       'Fetch AI risk prediction zones'),
        ('GET',  '/api/health',            'System health status (backend, AI, Firestore)'),
        ('GET',  '/api/telemetry/trips',   'Fetch live trip telemetry data'),
    ]
)

add_heading(doc, 'Sample: POST /api/issues/report — Request Body', 3)
add_code_block(doc, """\
{
  "type": "pothole",
  "latitude": 13.08271,
  "longitude": 80.27065,
  "severityScore": 0.76
}""")

add_heading(doc, 'Sample: GET /api/health — Response', 3)
add_code_block(doc, """\
{
  "backend": "UP",
  "ai": "DOWN",
  "firestore": "UP"
}""")

add_heading(doc, 'AI Service API (Python Flask — Port 5000)', 2)
add_table(doc,
    headers=['Method', 'Endpoint', 'Description'],
    col_widths=[0.9, 2.0, 3.5],
    rows=[
        ('POST', '/api/detect', 'Analyze road image, return damage type and severity (1–10)'),
    ]
)

# ══════════════════════════════════════════════════════════════════════════
# 9. DATABASE
# ══════════════════════════════════════════════════════════════════════════

add_heading(doc, '9. Database & Storage', 1)

add_heading(doc, 'Firestore Collection: road_issues', 2)
add_table(doc,
    headers=['Field', 'Type', 'Description'],
    col_widths=[1.6, 1.2, 3.6],
    rows=[
        ('id',            'String', 'Auto-generated unique identifier'),
        ('type',          'String', '"pothole", "crack", "waterlogging", or "unknown"'),
        ('latitude',      'Double', 'GPS latitude in decimal degrees'),
        ('longitude',     'Double', 'GPS longitude in decimal degrees'),
        ('severityScore', 'Double', '0.0–1.0 severity rating'),
        ('imageUrl',      'String', 'URL of uploaded image, or null for sensor reports'),
        ('timestamp',     'Long',   'Unix timestamp in milliseconds'),
    ]
)

add_info_box(doc,
    'In-Memory Fallback: If Firestore is unreachable, the backend stores issues in a '
    'ConcurrentHashMap in memory. Data persists only until the server restarts. '
    'The health endpoint reports firestore: "DOWN" in this state.')

# ══════════════════════════════════════════════════════════════════════════
# 10. ENVIRONMENT VARIABLES
# ══════════════════════════════════════════════════════════════════════════

add_heading(doc, '10. Environment Variables', 1)
add_para(doc, 'Located at: frontend/.env', bold=True, size=11, space_after=6)

add_table(doc,
    headers=['Variable', 'Description'],
    col_widths=[3.2, 3.2],
    rows=[
        ('VITE_ORS_API_KEY',                 'OpenRouteService API key for route computation'),
        ('VITE_FIREBASE_API_KEY',            'Firebase project API key'),
        ('VITE_FIREBASE_AUTH_DOMAIN',        'Firebase auth domain (e.g. project.firebaseapp.com)'),
        ('VITE_FIREBASE_PROJECT_ID',         'Firebase project ID'),
        ('VITE_FIREBASE_STORAGE_BUCKET',     'Firebase storage bucket URL'),
        ('VITE_FIREBASE_MESSAGING_SENDER_ID','Firebase messaging sender ID'),
        ('VITE_FIREBASE_APP_ID',             'Firebase application ID'),
        ('VITE_FIREBASE_MEASUREMENT_ID',     'Firebase Analytics measurement ID'),
    ]
)

add_info_box(doc,
    'Security Note: Never commit the .env file to a public repository. All VITE_ prefixed '
    'variables are embedded into the browser bundle at build time and are visible to anyone '
    'who inspects the page source.')

# ── Final footer line ──────────────────────────────────────────────────────
add_divider(doc)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('RoadWatch AI  ·  Infrastructure Intelligence Platform  ·  April 2026  ·  CONFIDENTIAL')
r.font.size = Pt(9)
r.font.italic = True
r.font.color.rgb = TEXT_MUT

# ── Save ──────────────────────────────────────────────────────────────────
output_path = r'C:\RoadWatch\RoadWatch_Documentation.docx'
doc.save(output_path)
print(f'Saved: {output_path}')
