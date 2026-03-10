# Masterplan Velo Bucharest 🚲
Hackathon project — digital infrastructure planning tool for Bucharest bike lanes.

## Stack
- ArcGIS Online (data, maps, routing, dashboards)
- FastAPI (citizen issues backend)
- React (admin platform)
- Expo/React Native (citizen app)
- Python/Mesa (AI simulation)

## Quick Start
1. Copy `.env.example` → `.env` and fill in ArcGIS credentials
2. `cd backend && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt && python run.py`
3. `cd admin-platform && npm install && npm start`
4. `cd citizen-app && npm install && npx expo start`

## Ports
| Service | Port |
|---|---|
| Backend API | 8000 |
| Admin Platform | 3000 |
| Citizen App (Expo) | 19006 |
| AI Engine | 8001 |
