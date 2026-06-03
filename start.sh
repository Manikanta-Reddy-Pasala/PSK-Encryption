#!/bin/bash
# Start script for Omni Installer

# Kill any existing processes
kill $(lsof -t -i :8000) 2>/dev/null || true
kill $(lsof -t -i :3000) 2>/dev/null || true

echo "Setting up environment..."
cd backend
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt > /dev/null 2>&1
cd ../frontend
if [ ! -d "node_modules" ]; then
  npm install > /dev/null 2>&1
fi
cd ..

echo "Starting Omni Installer Backend..."
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!

echo "Starting Omni Installer Frontend..."
cd ../frontend
npm run dev -- --port 3000 > ../frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Both servers are running."
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"

# Trap SIGINT and SIGTERM to kill background processes
trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM

# Sleep indefinitely so the script stays alive and trap works
while true; do sleep 1; done
