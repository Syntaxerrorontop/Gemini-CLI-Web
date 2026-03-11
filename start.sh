#!/bin/bash

# Funktion zum Beenden aller Hintergrundprozesse bei Abbruch (Strg+C)
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

echo "------------------------------------------------"
echo "🚀 Starting Gemini AutoAgent System"
echo "------------------------------------------------"

# 1. Backend starten
echo "Starting Backend (FastAPI)..."
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# 2. Frontend starten
echo "Starting Frontend (Vite)..."
cd frontend
npm run dev -- --host &
FRONTEND_PID=$!
cd ..

echo "------------------------------------------------"
echo "✅ All services are running!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop everything."
echo "------------------------------------------------"

# Warten auf die Hintergrundprozesse
wait
