# RoadWatch AI 🚀

A full-stack AI-powered road monitoring system. Use this dashboard to upload road images/videos, detect issues automatically, and visualize them on a geo-tagged map.

## Tech Stack
- **Frontend**: React (Vite), Google Maps API, Framer Motion, Lucide icons.
- **Backend**: Spring Boot 3.2.4 (Java 17).
- **AI Service**: Python 3.13, OpenCV, Flask.
- **Database**: Firebase Firestore.

## Getting Started

### 1. AI Service Setup
1. Navigate to `ai_service/`.
2. Run `python app.py`. (Service runs on port 5000)

### 2. Backend Setup
1. Place your Firebase `service-account.json` in `backend/src/main/resources/`.
2. Navigate to `backend/`.
3. Run `./mvnw spring-boot:run`. (Service runs on port 8080)

### 3. Frontend Setup
1. Navigate to `frontend/`.
2. Update `frontend/src/components/RoadMap.jsx` with your **Google Maps API Key**.
3. Run `npm run dev`.

## Features
- **Real AI Detection**: Uses OpenCV algorithms to detect potholes and cracks in uploaded media.
- **Modern Dashboard**: Glassmorphic UI with real-time stats.
- **Interactive Map**: Pins detected issues with color-coded severity (Score 1-10).
- **Geo-tagging**: Automatically tags issues with location data.
