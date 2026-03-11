# Setup Guide: Gemini AutoAgent v2

This guide will help you install all necessary components to run the Gemini AutoAgent on your system.

## Prerequisites

### 1. Node.js & NPM
The frontend and the Gemini CLI require Node.js.

#### **Windows (using winget):**
Open PowerShell as Administrator and run:
```powershell
winget install OpenJS.NodeJS
```

#### **Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install nodejs npm
```

### 2. Python 3
The backend requires Python 3.10 or higher.

#### **Windows (using winget):**
```powershell
winget install Python.Python.3.11
```

#### **Linux (Ubuntu/Debian):**
```bash
sudo apt install python3 python3-venv python3-pip
```

---

## Installation

### 1. Gemini CLI
The core of the agent is the Gemini CLI. Install it globally:
```bash
npm install -g @google/gemini-cli
```
*Note: Ensure your Gemini API Key is set in your environment variables as `GEMINI_API_KEY`.*

### 2. Project Setup
Clone the repository and run the automated setup:

**Linux:**
```bash
# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install
```

**Windows (PowerShell):**
```powershell
# Backend setup
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Frontend setup
cd ..\frontend
npm install
```

---

## Running the System

Use the provided start script (Linux/macOS):
```bash
./start.sh
```

On Windows, open two terminals:
1. **Terminal 1 (Backend):** `cd backend && .\venv\Scripts\Activate.ps1 && uvicorn main:app --port 8000`
2. **Terminal 2 (Frontend):** `cd frontend && npm run dev`

Open your browser at `http://localhost:5173`.
