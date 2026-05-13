#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Check .env
if [ ! -f "$ROOT/.env" ]; then
    echo "Error: .env file not found. Run: cp .env.example .env  and add your ANTHROPIC_API_KEY"
    exit 1
fi

# Check prerequisites
MISSING=0
if ! command -v python3 &>/dev/null; then
    echo "Error: python3 is not installed. Download it from https://www.python.org/downloads/"
    MISSING=1
fi
if ! command -v bun &>/dev/null; then
    echo "Error: bun is not installed. Install it with: curl -fsSL https://bun.sh/install | bash"
    MISSING=1
fi
if [ $MISSING -eq 1 ]; then exit 1; fi

# Backend
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi
source .venv/bin/activate
echo "Installing backend dependencies..."
pip install -q -r requirements.txt
echo "Starting backend on http://127.0.0.1:8000"
uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Frontend
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    bun install
fi
echo "Starting frontend on http://localhost:5173"
VITE_BACKEND_URL=http://127.0.0.1:8000 bun run dev &
FRONTEND_PID=$!

echo ""
echo "App running at http://localhost:5173"
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM
wait
