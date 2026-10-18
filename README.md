# Quantitative OSINT Blockchain Engine (QOBE)

QOBE is a professional forensic tool designed to bridge the gap between unstructured Open Source Intelligence (OSINT) and high-velocity blockchain ledger data. It utilizes a quantitative approach to predictively link anonymous crypto-wallets to real-world identities.

## 🚀 Architecture Overview

The system is built as a decoupled, asynchronous platform to handle the computational intensity of forensic analysis.

### Backend (Python/FastAPI)
- **API Layer**: FastAPI orchestration that triggers analysis jobs and serves results.
- **Task Queue**: Celery + Redis for asynchronous execution of the forensic pipeline.
- **Forensic Engine**: 
  - **Extraction**: Regex and LLM-based marker extraction from OSINT feeds.
  - **Graph Analysis**: NetworkX-based community detection and hub identification.
  - **Timing Analysis**: Statistical permutation testing to correlate social posts with on-chain bursts.
  - **Scoring**: Bayesian fusion of signals into a final probability score.
- **Persistence**: A Repository-patterned data layer using SQLite (dev) / PostgreSQL (prod) with JSONB for flexible artifact storage.

### Frontend (React/TypeScript)
- **War Room**: A high-density dashboard for case management.
- **Forensic Matrix**: Interactive graph visualization of tainted funds.
- **Analyst Copilot**: Gemini-powered AI analyst that synthesizes evidence into professional reports.
- **Analysis Control**: Real-time job tracking and target-wallet triggering.

---

## 🛠️ Setup & Installation

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- Redis Server (Required for async tasks)

### 2. Backend Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your API keys:
# ETHERSCAN_API_KEY, GITHUB_API_TOKEN, GEMINI_API_KEY
```

### 3. Launching the System
You must run three separate processes:

**A. The Redis Broker** (Start your local redis server)
```bash
redis-server
```

**B. The Celery Worker** (Handles the heavy lifting)
```bash
# Run from project root
celery -A backend.worker.celery_app worker --loglevel=info
```

**C. The API Server**
```bash
# Run from project root
python backend/main.py
```

**D. The Frontend**
```bash
npm install
npm run dev
```

---

## 📂 Folder Structure

```text
.
├── backend/              # API and Orchestration
│   ├── main.py           # FastAPI Application & Endpoints
│   ├── worker.py         # Celery Task definitions
│   ├── repository.py     # DB Access Layer (Repository Pattern)
│   ├── osint_clients.py  # Live API clients (GitHub, etc.)
│   └── etherscan_client.py # Blockchain data acquisition
├── engine/               # Core Forensic Mathematical Models
│   ├── extract.py        # OSINT Marker Extraction
│   ├── graph.py          # Ledger Graph Analysis
│   ├── timing.py         # Temporal Correlation Engine
│   └── scoring.py        # Bayesian Fusion & Scoring
├── src/                  # React Frontend
│   ├── components/       # UI Components (War Room, Copilot, etc.)
│   ├── api.ts            # Frontend API Client
│   └── App.tsx           # Main Application Logic
├── data/                 # Local Storage (used as fallback/dev)
├── docs/                 # Technical documentation
└── tests/                # Forensic Engine Unit Tests
```

## 🛡️ Security Note
This tool is designed for authorized forensic investigation. Ensure all API keys are kept secure and not committed to version control.
