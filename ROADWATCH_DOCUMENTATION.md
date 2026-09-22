# RoadWatch AI — Complete Project Documentation

> **Infrastructure Intelligence Platform**
> Full-stack road monitoring, damage detection, and civic reporting system

---

## Table of Contents

1. [What is RoadWatch AI?](#1-what-is-roadwatch-ai)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [How to Start the System](#4-how-to-start-the-system)
5. [Feature-by-Feature Breakdown](#5-feature-by-feature-breakdown)
   - 5.1 Authentication
   - 5.2 Landing Page & Boot Screen
   - 5.3 Live Dashboard Map
   - 5.4 Issue Markers & Severity System
   - 5.5 AI Risk Heatmap
   - 5.6 Predictive Risk Layer
   - 5.7 Road Health Index
   - 5.8 Route Recommender
   - 5.9 Image Upload & AI Detection
   - 5.10 Mobile Sensor Reporter
   - 5.11 Trip Simulator
   - 5.12 Real-Time Alert System
   - 5.13 Municipal PDF Report Generator
   - 5.14 Voice Alerts
   - 5.15 Intelligence Panel (Admin)
   - 5.16 System Health Monitor
6. [Glossary of Terms](#6-glossary-of-terms)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [API Reference](#8-api-reference)
9. [Database & Storage](#9-database--storage)
10. [Environment Variables](#10-environment-variables)

---

## 1. What is RoadWatch AI?

**RoadWatch AI** is a real-time road infrastructure monitoring platform that combines smartphone sensors, computer vision (AI), GPS mapping, and civic data tools to detect, classify, and report road damage — automatically.

### The Problem It Solves

Roads deteriorate faster than governments can inspect them. Traditional monitoring relies on:
- Manual inspections (slow, expensive, infrequent)
- Citizen phone-in complaints (unstructured, hard to act on)
- Post-damage repair (reactive, not preventive)

RoadWatch AI replaces all of this with **continuous, automated, geo-tagged infrastructure intelligence**.

### What Makes It Different

| Feature | Traditional Systems | RoadWatch AI |
|---|---|---|
| Damage detection | Manual inspection | AI + smartphone accelerometer |
| Data granularity | Per-road, once a year | Per-GPS-point, real-time |
| Civic reporting | Phone call / form | One-tap mobile page |
| Route planning | Shortest path | Safest path (avoids damage) |
| Government handoff | Verbal / spreadsheet | Auto-generated official PDF |
| Road health view | Not available | Live 0–100 Health Index |

---

## 2. System Architecture

RoadWatch AI is a **three-tier architecture** with four distinct services:

```
┌──────────────────────────────────────────────────────────┐
│                    USER INTERFACES                        │
│  ┌─────────────────────┐   ┌──────────────────────────┐  │
│  │   Dashboard (Web)   │   │  Mobile Reporter (Phone) │  │
│  │   React + Leaflet   │   │  React (same Vite server)│  │
│  └──────────┬──────────┘   └───────────┬──────────────┘  │
└─────────────│─────────────────────────│─────────────────┘
              │ HTTP REST                │ HTTP REST
              ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND API  (Spring Boot — Port 8080)      │
│   /api/issues    /api/predictions    /api/health         │
│   /api/telemetry /api/issues/upload  /api/issues/report  │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴───────┐
        ▼                ▼
┌───────────────┐  ┌──────────────────────────────────────┐
│  AI SERVICE   │  │         FIREBASE (Google Cloud)       │
│  Python Flask │  │  Firestore (database) + Auth (login)  │
│  Port 5000    │  └──────────────────────────────────────┘
│  OpenCV       │
└───────────────┘
```

### Service Roles

| Service | Technology | Port | Responsibility |
|---|---|---|---|
| **Frontend** | React 18 + Vite | 5173 | User interface, map, mobile page |
| **Backend API** | Spring Boot 3.2.4 (Java) | 8080 | Data layer, routing, coordination |
| **AI Service** | Python 3 + Flask + OpenCV | 5000 | Image-based damage classification |
| **Firebase** | Google Cloud | (cloud) | User authentication + database |

---

## 3. Technology Stack

### Frontend
| Library | Purpose |
|---|---|
| **React 18** | UI framework — component-based rendering |
| **Vite 8** | Build tool and development server |
| **Leaflet + react-leaflet** | Interactive map rendering |
| **Framer Motion** | Animations (page transitions, card entries, toasts) |
| **Recharts** | Charts in the Intelligence Panel |
| **jsPDF + jspdf-autotable** | PDF report generation |
| **date-fns** | Human-readable timestamps ("2 hours ago") |
| **lucide-react** | Icon library |
| **axios** | HTTP client for API calls |
| **Firebase JS SDK** | Authentication state management |

### Backend
| Library | Purpose |
|---|---|
| **Spring Boot 3.2.4** | REST API framework |
| **Spring Web** | HTTP request handling, CORS |
| **Spring Cloud GCP / Firestore** | Google Firestore database client |
| **Jackson** | JSON serialization |
| **SLF4J / Logback** | Logging |

### AI Service
| Library | Purpose |
|---|---|
| **Flask** | Lightweight HTTP server |
| **OpenCV** | Computer vision — edge detection, damage analysis |
| **NumPy** | Image array processing |
| **Pillow** | Image format handling |

### Cloud & Infrastructure
| Service | Purpose |
|---|---|
| **Firebase Authentication** | Email/password login system |
| **Google Cloud Firestore** | NoSQL database for road issues |
| **OpenRouteService (ORS)** | Real road-following route computation |

---

## 4. How to Start the System

### Prerequisites
- Node.js 18+ and npm
- Java 17+ and Maven 3.9+
- Python 3.9+ with pip
- A Firebase project (credentials in `frontend/.env`)

### Step 1 — Start the AI Service
```bash
cd C:\RoadWatch\ai_service
python app.py
# Runs on http://localhost:5000
```

### Step 2 — Start the Backend API
```bash
cd C:\RoadWatch\backend
mvn spring-boot:run
# Runs on http://localhost:8080
# Wait for: "Started RoadwatchApplication"
```

### Step 3 — Start the Frontend
```bash
cd C:\RoadWatch\frontend
npm run dev
# Runs on http://localhost:5173
```

### Step 4 — Access the Dashboard
Open your browser and go to: `http://localhost:5173`

### Mobile Reporter (from phone)
1. Find your computer's local IP address: run `ipconfig` → look for **IPv4 Address** under WiFi
2. On your phone (same WiFi): open `http://[your-ip]:5173/report`

---

## 5. Feature-by-Feature Breakdown

---

### 5.1 Authentication

**What it is:** A login/signup screen that guards the entire dashboard.

**How it works:**
- Powered by **Firebase Authentication** (email/password)
- When the app loads, it checks Firebase for an existing session
- If no session exists, the AuthScreen is shown instead of the dashboard
- Successful login stores a session token in the browser; it persists across refreshes
- The user's email is displayed in the top bar once logged in
- A sign-out button is in the top bar (person icon → logout icon on hover)

**States:**
- `undefined` — auth is being checked (spinner shown)
- `null` — no user logged in (AuthScreen shown)
- `User object` — logged in (full dashboard shown)

---

### 5.2 Landing Page & Boot Screen

**What it is:** A cinematic intro sequence before the dashboard.

**How it works:**
- The landing page shows a hero banner with project tagline
- Clicking "Enter Dashboard" triggers the **Boot Screen** — a fake terminal window that types out system initialization messages one by one
- After all boot messages complete (~3.5 seconds), the dashboard fades in
- This is purely cosmetic — it sets the tone of an authoritative, high-tech platform

---

### 5.3 Live Dashboard Map

**What it is:** The central feature — an interactive dark-themed map showing all road issues in real time.

**How it works:**
- Built with **Leaflet** and **CartoDB Dark Matter** map tiles
- Issues are fetched from the backend every 15 seconds and overlaid as markers
- Clicking a marker opens a detailed popup
- The map auto-flies to a selected issue with animation
- Multiple overlay layers can be toggled on/off

**Controls (top-right panel):**
| Toggle | What it shows |
|---|---|
| Risk Layer | Dashed red circles around AI-predicted danger zones |
| Risk Heatmap | Color-blended canvas overlay (green → red) based on issue density |
| Health Index | Grid rectangles colored by road health score (green = healthy, red = critical) |

---

### 5.4 Issue Markers & Severity System

**What it is:** Every road issue detected is shown as a pulsing animated dot on the map.

**Severity Levels:**

| Level | Score Range | Color | Behavior |
|---|---|---|---|
| **MINOR** | 0.0 – 0.4 | Green `#3DDB6B` | Small dot, slow pulse |
| **WARNING** | 0.4 – 0.8 | Amber `#FFC857` | Medium dot, medium pulse, secondary ring |
| **CRITICAL** | 0.8 – 1.0 | Red `#FF3B3B` | Large dot, fast pulse, double ring, ripple |

**Score:** `severityScore` is a decimal from `0.0` (undamaged) to `1.0` (severe). Displayed as `x/10` in the UI.

**Marker popup shows:**
- Issue type (pothole, crack, waterlogging)
- Severity label and score bar
- AI Confidence percentage
- Coordinates (latitude, longitude)
- Time since reported ("2 hours ago")

**AI Confidence:** A deterministic score (61%–98%) derived from the issue's ID and severity. It simulates the confidence level of the AI damage classifier.

---

### 5.5 AI Risk Heatmap

**What it is:** A soft, blurred color overlay on the map that shows where road damage is concentrated.

**How it works:**
- Rendered on an HTML `<canvas>` element layered over the Leaflet map
- Each issue and each pre-defined hotspot cluster produces a radial gradient blob
- Blobs are colored red (high risk), amber (medium), or green (low)
- The canvas redraws every time the map moves or zooms
- Can be toggled on/off via the Layers panel

**Pre-loaded hotspots:** Chennai neighbourhoods (Anna Nagar, T. Nagar, Royapettah, etc.) and New York City zones are pre-seeded so the heatmap is non-empty even before user data is added.

---

### 5.6 Predictive Risk Layer

**What it is:** AI-predicted zones that are *likely* to deteriorate, shown as dashed red circles.

**How it works:**
- Fetched from `GET /api/predictions` when the toggle is first turned on
- Each prediction includes a location, a risk score, and a reason string
- Shown as `150m radius` dashed circles on the map
- Clicking a circle shows the AI reasoning ("High traffic area with prior damage history")

---

### 5.7 Road Health Index

**What it is:** A 0–100 score assigned to every ~1.1km² grid cell of the road network, showing the health of infrastructure in that zone.

**How it works:**

**Score Formula:**
```
Health Score = 100 - Σ(penalty × age_factor)

Where:
  CRITICAL issue → 25 points penalty
  WARNING issue  → 12 points penalty
  MINOR issue    →  5 points penalty
  age_factor = max(0.2, 1 - days_old / 90)   ← issues decay over 90 days
```

**Score Grades:**
| Score | Grade | Color |
|---|---|---|
| 80–100 | GOOD | Green |
| 60–79 | FAIR | Yellow-green |
| 40–59 | POOR | Amber |
| 20–39 | BAD | Orange-red |
| 0–19 | CRITICAL | Red |

**UI:**
- Map overlay: semi-transparent colored rectangles over each affected grid cell
- Floating panel (bottom-left): shows network average score, healthy/critical counts, and the 5 worst GPS coordinates with their scores

---

### 5.8 Route Recommender

**What it is:** A smart route planner that calculates the safest path between two points by avoiding roads with known damage.

**How it works:**
1. User activates the planner, then clicks two points on the map (Start → End)
2. The backend calls **OpenRouteService (ORS)** Directions API to get up to 3 real road-following routes
3. Each route is scored by proximity to known issues (weighted by severity)
4. Routes are sorted: Safest → Balanced → Fastest
5. All three are displayed as colored polylines; the user can switch between them

**Risk Scoring:**
- For each point on a route, check all issues within a 500m radius
- Score = Σ(severity × (1 - distance/500m)) for each nearby issue
- The route with the lowest total score is "Safest"

**UI Panel (floating, bottom-right):**
- Three tabbed cards showing route name, distance, duration, and risk score
- Colored route lines on map (green = selected route)

**ORS API:** A free routing engine that returns real road geometry (not straight lines). It knows about one-way streets, bridges, and road types.

---

### 5.9 Image Upload & AI Detection

**What it is:** Upload a photo of a road and the AI automatically classifies the damage type and severity.

**How it works:**
1. User clicks "Report Road Issue" and selects an image + enters GPS coordinates
2. The image is sent to `POST /api/issues/upload` on the backend
3. The backend forwards it to the Python AI service at `POST /api/detect`
4. OpenCV analyzes the image: edge detection, texture analysis, contour finding
5. Returns `{ type: "pothole", severity: 7 }` (severity on 1–10 scale)
6. The backend converts severity to 0.0–1.0 scale and saves the issue
7. Issue appears on the map within seconds

**Fallback:** If the AI service is offline, the issue is still saved with `type: "unknown"` and `severity: 0.0`. The system never rejects a report.

---

### 5.10 Mobile Sensor Reporter

**What it is:** A dedicated phone page that uses the phone's built-in accelerometer and GPS to automatically detect potholes while driving — no camera needed.

**Access:** Open `http://[your-computer-ip]:5173/report` on your phone.

**How it works:**

**Accelerometer Detection:**
- The phone's accelerometer measures Z-axis force (vertical) at ~60 readings/second
- A baseline is calculated using **Exponential Moving Average (EMA)** — this accounts for the phone's normal vibration while driving
- When a spike exceeds the baseline by a threshold, a pothole is logged

**Detection Thresholds:**
| Level | Spike (m/s²) | Color | Type Assigned |
|---|---|---|---|
| MINOR | > 2.5 | Green | crack |
| WARNING | > 5.0 | Amber | pothole |
| CRITICAL | > 9.0 | Red | pothole |

**Debounce:** After any detection, the system waits 2.2 seconds before allowing another — prevents a single bump registering multiple times.

**GPS:** `navigator.geolocation.watchPosition` tracks real-time location. Detections are only saved once GPS is locked.

**EMA Baseline:** `baseline = baseline × 0.95 + current × 0.05` — the baseline drifts slowly, so the system adapts to different roads and phone positions.

**G-Force Meter:** An SVG arc gauge in the UI shows the live spike value in real time.

**Voice Alerts (on the phone):** Each detection is spoken aloud: *"Critical road hazard! Pothole detected. Severity 8.2 out of 10."*

**How detections reach the map:**
1. Each detection POSTs to `POST /api/issues/report` on the backend
2. The backend saves it to Firestore
3. The dashboard polls every 15 seconds and pulls the new issue
4. The marker appears on the map

---

### 5.11 Trip Simulator

**What it is:** Simulates a vehicle driving along a route, generating real-time GPS telemetry with roughness ratings.

**How it works:**
- A simulated vehicle moves along a predefined path (Chennai → NYC and back)
- Every 2 seconds, it sends telemetry: `{ latitude, longitude, roughness: 0.0–1.0 }`
- The dashboard polls `/api/telemetry/trips` every 2 seconds while simulation is active
- Trip paths are drawn as colored polylines on the map (green = smooth, amber = bumpy, red = rough)

**Roughness:** A simulated measure of road vibration. `0.0` = perfectly smooth, `1.0` = extremely rough.

---

### 5.12 Real-Time Alert System

**What it is:** A notification system that fires when new road issues are detected.

**Components:**

**Toast Stack (top-right corner):**
- Floating notification cards that appear for new issues
- Up to 4 visible at once; older ones auto-dismiss after ~5 seconds
- Colored by severity, shows issue type, area, and score

**Alert History Panel:**
- The bell icon in the top bar opens a sliding history panel
- Stores the last 50 alerts from the current session
- A red badge on the bell shows the count of unread alerts

**Simulation Fallback:**
- If no real issues arrive for 28 seconds, a simulated fake issue is generated and alerted
- This keeps the dashboard feeling "live" even when the backend is quiet

**Incident Banner:**
- When the "SIMULATE" button is pressed, a large centered banner appears at the top of the screen
- This is in addition to the toast notification

---

### 5.13 Municipal PDF Report Generator

**What it is:** Generates a formatted, print-ready PDF document summarizing all current road issues — designed to be sent to city governments or maintenance departments.

**How to use:** Click "Generate PDF Report" in the sidebar Tools section.

**PDF Contents:**
1. **Header:** RoadWatch AI branding, generation date and time, "OFFICIAL REPORT" badge
2. **Executive Summary:** Four stat boxes (Total, Critical, Warning, Minor issues) + average severity bar
3. **Recommendations:** Auto-generated action items based on severity distribution
4. **Issue Register:** Full table with columns: #, Type, Level, Score (0–10), Latitude, Longitude, Date
5. **Footer (every page):** "RoadWatch AI · Infrastructure Intelligence Platform · CONFIDENTIAL" + page numbers

**Recommendations logic:**
- Critical issues → "require immediate repair within 48 hours"
- Warning issues → "schedule for repair within 2–4 weeks"
- Minor issues → "include in next routine maintenance cycle"

**File format:** `RoadWatch-Report-YYYY-MM-DD.pdf` — automatically downloaded.

---

### 5.14 Voice Alerts

**What it is:** The system announces new critical road hazards aloud using the browser's built-in Text-to-Speech engine.

**Dashboard voice alerts:**
- Fires when any new issue with severity > 0.7 (CRITICAL) is detected
- Announcement: *"Critical alert. Pothole in T. Nagar. Severity 9 out of 10. Immediate attention required."*
- Mute/unmute toggle: the speaker icon in the top bar

**Mobile reporter voice alerts:**
- Fires on every detection (minor, warning, or critical)
- CRITICAL: *"Critical road hazard! Pothole detected. Severity 8.2 out of 10."*
- WARNING: *"Warning. Pothole detected ahead. Severity 5.1."*
- MINOR: *"Minor crack detected."*
- Toggle button below the start/stop button

**Technology:** Uses the `window.speechSynthesis` Web API — no external service, works entirely in the browser. Previous speech is cancelled before new speech starts.

---

### 5.15 Intelligence Panel (Admin)

**What it is:** A data dashboard view showing charts and statistics about all road issues.

**Access:** Click "Intelligence Panel" in the sidebar navigation.

**Contents:**
- Bar charts and distribution graphs of issue types and severity
- Issue counts over time
- A breakdown of the road damage portfolio

**Built with:** Recharts (React charting library)

---

### 5.16 System Health Monitor

**What it is:** Live status indicators in the top bar showing whether each service is up or down.

**Services monitored:**
| Indicator | What it checks |
|---|---|
| **BACKEND** | Is the Spring Boot API reachable at :8080? |
| **AI SVC** | Is the Python AI service reachable at :5000? |
| **FIRESTORE** | Is the Firestore database responding? |

**States:**
- **Green (UP):** Fully operational
- **Amber (DEGRADED):** Running on fallback (e.g., AI offline → issues still saved with defaults)
- **Red (DOWN):** Unreachable

The `s` counter next to the refresh icon shows how many seconds ago the last health check ran. The system polls every 5 seconds.

**Fallback behavior:** If Firestore is down, the backend stores issues in memory. If the AI service is down, issues are saved with `type: unknown` and `severity: 0`. The system **never rejects a user's report** due to a downstream failure.

---

## 6. Glossary of Terms

| Term | Definition |
|---|---|
| **Severity Score** | A decimal (0.0–1.0) representing how damaged a road section is. 0 = perfect, 1 = extreme damage. Shown as X/10 in the UI. |
| **Pothole** | A bowl-shaped depression in a road surface caused by water damage and traffic. High-severity damage type. |
| **Crack** | A linear fracture in the road surface. Usually lower severity than potholes. |
| **Waterlogging** | Flooding or standing water on a road surface. Can hide potholes and cause vehicle damage. |
| **EMA (Exponential Moving Average)** | A mathematical filter that smooths a series of readings. Used to establish the "normal" vibration baseline on the mobile sensor, so spikes above it indicate real bumps. |
| **Debounce** | A technique that prevents a single physical event from firing multiple digital events. Here, one bump registers as one detection, not 20 readings. |
| **Accelerometer** | A sensor in smartphones that measures forces applied to the device in 3 axes (X, Y, Z). The Z-axis measures vertical movement — bumps. |
| **GPS Lock** | When the phone's GPS has acquired enough satellite signals to accurately determine latitude and longitude. Required before detections are saved. |
| **Severity Spike** | The difference between the current accelerometer Z-reading and the EMA baseline. Large spike = large bump. |
| **Heatmap** | A visualization technique where colors represent the intensity/density of a value across a geographic area. |
| **Road Health Index** | A score (0–100) assigned per grid cell of the road network, calculated from the number, severity, and age of issues in that area. |
| **Grid Cell** | A ~1.1km × 1.1km geographic square used to group nearby issues for the Road Health Index calculation. |
| **ORS (OpenRouteService)** | A free, open-source routing engine that computes real road-following paths between GPS coordinates. Used by the Route Recommender. |
| **Route Risk Score** | A number representing how many damage zones a route passes through, weighted by severity and proximity. Lower = safer. |
| **Firestore** | Google Cloud's NoSQL document database. RoadWatch uses it to store road issues persistently across sessions. |
| **Fallback Mode** | When a downstream service (AI, Firestore) is unavailable, the system continues operating with safe defaults instead of failing. |
| **Telemetry** | Sensor data transmitted from a moving vehicle. In RoadWatch, this refers to GPS + roughness data from the Trip Simulator. |
| **Roughness** | A 0.0–1.0 measure of how bumpy a road segment is, generated by the Trip Simulator. |
| **AI Confidence** | A percentage (61–98%) representing how certain the AI model is about its damage classification for a given issue. |
| **CartoDB Dark Matter** | The dark-themed map tile provider used by RoadWatch. Tiles are the background images of the map. |
| **Polyline** | A line drawn on the map connecting multiple GPS coordinates. Used for trip paths and planned routes. |
| **Toast Notification** | A small pop-up card that appears briefly to inform the user of an event, then disappears automatically. |
| **LAN IP** | Local Area Network IP — the IP address your computer has on your home/office WiFi. Phones on the same network can reach your dev server using this IP. |
| **CORS** | Cross-Origin Resource Sharing. A browser security rule. The backend allows all origins (`@CrossOrigin(origins = "*")`) so the frontend can call it freely. |
| **REST API** | Representational State Transfer — a standard way of structuring HTTP endpoints. RoadWatch backend follows REST conventions. |
| **Speech Synthesis** | The browser's built-in text-to-speech engine (`window.speechSynthesis`). No internet or external API required. |

---

## 7. Data Flow Diagrams

### Issue Created via Image Upload

```
User selects image + coordinates
         │
         ▼
  Frontend (React)
  POST /api/issues/upload
  { file, lat, lng }
         │
         ▼
  Backend (Spring Boot)
  → forwards image to Python AI
  POST http://localhost:5000/api/detect
         │
         ▼
  AI Service (Flask + OpenCV)
  → analyzes image
  → returns { type, severity }
         │
         ▼
  Backend builds RoadIssue object
  { id, type, lat, lng, severityScore, timestamp }
         │
         ▼
  Saves to Firestore (or in-memory)
         │
         ▼
  Returns HTTP 201 to frontend
         │
         ▼
  Frontend adds issue to map immediately
  Alert fires if severity > threshold
```

### Issue Created via Mobile Sensor

```
Phone accelerometer fires DeviceMotion event
         │
         ▼
  EMA baseline updated
  Spike = |z - baseline|
         │
         ▼
  Spike > 2.5 m/s² AND debounce clear?
         │
         ▼ YES
  GPS coordinates captured
  severity = min(1.0, spike / 15.0)
  type = spike > 5.0 ? "pothole" : "crack"
         │
         ├──▶ Voice alert spoken on phone
         ├──▶ Flash overlay shown on screen
         │
         ▼
  POST /api/issues/report
  { type, latitude, longitude, severityScore }
         │
         ▼
  Backend saves to Firestore
         │
         ▼
  Dashboard polling picks it up within 15 seconds
  Issue appears on map
```

---

## 8. API Reference

### Backend API (Spring Boot — Port 8080)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/issues` | Fetch all road issues |
| `POST` | `/api/issues/upload` | Upload image + GPS for AI detection |
| `POST` | `/api/issues/report` | Submit sensor-detected issue (no image) |
| `GET` | `/api/predictions` | Fetch AI risk prediction zones |
| `GET` | `/api/health` | System health status (backend, AI, Firestore) |
| `GET` | `/api/telemetry/trips` | Fetch live trip telemetry data |

### POST /api/issues/upload — Request
```
Content-Type: multipart/form-data
  file: [image file]
  lat:  13.0827   (decimal degrees)
  lng:  80.2707
```

### POST /api/issues/report — Request
```json
{
  "type": "pothole",
  "latitude": 13.08271,
  "longitude": 80.27065,
  "severityScore": 0.76
}
```

### GET /api/health — Response
```json
{
  "backend": "UP",
  "ai": "DOWN",
  "firestore": "UP"
}
```

### AI Service API (Python Flask — Port 5000)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/detect` | Analyze road image, return type + severity |

### POST /api/detect — Response
```json
{
  "type": "pothole",
  "severity": 7
}
```

---

## 9. Database & Storage

### Firestore Collections

**Collection: `road_issues`**

| Field | Type | Description |
|---|---|---|
| `id` | String | Auto-generated unique identifier |
| `type` | String | `"pothole"`, `"crack"`, `"waterlogging"`, `"unknown"` |
| `latitude` | Double | GPS latitude in decimal degrees |
| `longitude` | Double | GPS longitude in decimal degrees |
| `severityScore` | Double | 0.0–1.0 severity rating |
| `imageUrl` | String | URL of the uploaded image (or null for sensor reports) |
| `timestamp` | Long | Unix timestamp in milliseconds |

### In-Memory Fallback

If Firestore is unreachable, the backend stores issues in a `ConcurrentHashMap` in memory. Data is lost when the server restarts. The health check reports `firestore: "DOWN"` in this state.

---

## 10. Environment Variables

Located at: `frontend/.env`

| Variable | Description |
|---|---|
| `VITE_ORS_API_KEY` | OpenRouteService API key for route computation |
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain (e.g., `project.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket URL |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Analytics measurement ID |

**Important:** Never commit the `.env` file to a public repository. All `VITE_` prefixed variables are embedded into the browser bundle at build time.

---

*Document generated: April 2026*
*RoadWatch AI — Infrastructure Intelligence Platform*
