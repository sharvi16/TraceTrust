# TraceTrust 

> A real-time financial transparency platform that shows donors exactly where their money goes.

---

## The Problem

The NGO sector suffers from a deep crisis of accountability. Millions of donors contribute billions of rupees annually to charities and non-governmental organisations, yet have virtually no visibility into how their money is actually used. Reports are delayed by months, audits are opaque, and when a scandal does emerge — misappropriated funds, bloated admin costs, ghost expenses — donor trust collapses across the entire sector, not just the offending organisation.
This information asymmetry isn't just unfair — it's damaging. Well-run NGOs struggle to differentiate themselves from poorly managed ones because there is no real-time, machine-readable record that anyone can verify. Donors who want to give responsibly have no reliable signal. The result is reduced donations, misallocated charity, and a weakened civil society.

## Solution

TraceTrust is a full-stack financial transparency platform purpose-built for the NGO sector. Every rupee donated and every expense logged is recorded in an append-only audit trail. A publicly visible impact score — calculated from the ratio of program spending to total donations received — lets any visitor immediately gauge an NGO's financial health without needing to read a single PDF report.

Under the hood, a two-layer anomaly detection engine (rule-based heuristics + a per-NGO Isolation Forest ML model) continuously monitors transactions and flags suspicious activity in real time. NGO admins see their anomaly alerts instantly, super admins can resolve them, and every state change is logged. The result is a system where integrity is enforced by the platform, not just promised in a mission statement.

---

## Tech Stack

| Category | Technology |
|---|---|
| Frontend | React 19, Vite 7, React Router v6 |
| Styling | Tailwind CSS v4 |
| Charts | Chart.js, react-chartjs-2 |
| HTTP Client | Axios (with JWT interceptor) |
| Backend | Python 3.11, FastAPI 0.110 |
| ORM | SQLAlchemy 2.0 (DeclarativeBase) |
| Database | PostgreSQL 15 |
| Cache | Redis 7 (ConnectionPool, TTL=300s) |
| Auth | JWT (python-jose, HS256), passlib bcrypt |
| ML | scikit-learn IsolationForest, joblib |
| Containerisation | Docker, docker-compose |
| Settings | pydantic-settings (typed env vars) |

---

## Key Features

- **Multi-tenant NGO isolation** — every NGO admin can only see and modify their own organisation's data; JWT payload carries `ngo_id` and is verified on every write
- **Append-only audit trail (tamper-proof)** — all donation and expense mutations write to `audit_logs` with old/new values; no delete route exists
- **Real-time impact scoring with Redis caching** — impact scores are cached at `impact:{ngo_id}` with a 300-second TTL and invalidated automatically on every new donation logged
- **ML-based anomaly detection (Isolation Forest)** — each NGO gets its own model trained on its historical expense patterns; new expenses are scored against it in real time
- **Role-based access control** — three roles (Donor / NGO Admin / Super Admin) enforced as FastAPI dependency factories; frontend mirrors this with `ProtectedRoute`

---

## Setup Instructions

### Prerequisites
- Docker and docker-compose installed
- Node.js 20+ (for local frontend dev)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/tracetrust.git
cd tracetrust
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set secure values for `JWT_SECRET_KEY`, `POSTGRES_PASSWORD`, and the super admin credentials.

The `DATABASE_URL` should point to the `postgres` service when running via Docker:

```
DATABASE_URL=postgresql://postgres:password@postgres:5432/tracetrust
REDIS_URL=redis://redis:6379
```

### 3. Start all services

```bash
docker-compose up --build
```

This starts PostgreSQL, Redis, and the FastAPI backend with hot-reload enabled. Database tables are created automatically on first startup and the super admin account is seeded.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Open in browser

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API (interactive docs) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Service health check |
| POST | `/api/auth/register` | Public | Register as donor or NGO admin |
| POST | `/api/auth/login` | Public | Login, receive JWT |
| POST | `/api/auth/approve-ngo` | Super Admin | Approve a pending NGO registration |
| GET | `/api/auth/me` | Any user | Get current user profile |
| POST | `/api/donations/log` | NGO Admin | Log an incoming donation |
| GET | `/api/donations/my` | Donor | Get all donations made by the logged-in donor |
| GET | `/api/donations/ngo/{ngo_id}` | Public | Get all donations received by an NGO |
| POST | `/api/expenses/log` | NGO Admin | Log an expense (triggers anomaly checks) |
| GET | `/api/expenses/{ngo_id}` | Public | Get all expenses for an NGO with category summary |
| GET | `/api/impact/{ngo_id}` | Public | Get impact score for a specific NGO |
| GET | `/api/impact/all` | Public | Get impact scores for all approved NGOs |
| GET | `/api/impact/donor/my` | Donor | Get impact breakdown across all NGOs donated to |
| GET | `/api/anomaly/alerts/{ngo_id}` | NGO Admin / Super Admin | Get anomaly alerts for an NGO |
| PATCH | `/api/anomaly/resolve/{alert_id}` | Super Admin | Mark an anomaly alert as resolved |

---

## Impact Score Calculation

The impact score represents the percentage of donations that went directly toward the NGO's programs (food, medicine, education, and other direct activities), as opposed to overhead (salaries and admin costs).

```
Impact Score = (Program Expenses / Total Donations) × 100
```

**Grades:**

| Score | Grade |
|---|---|
| 80 – 100 | A (Excellent) |
| 60 – 79 | B (Good) |
| 40 – 59 | C (Fair) |
| 0 – 39 | D (Poor) |

**Example:** If an NGO receives ₹1,00,000 and spends ₹82,000 on programs and ₹18,000 on admin, the impact score is **82** (Grade A).

Scores are cached in Redis for 300 seconds. The cache is automatically invalidated whenever a new donation is logged, ensuring the score always reflects the latest data.

---

## Anomaly Detection

TraceTrust uses a two-layer detection system so that suspicious transactions are caught even before enough historical data exists to train a model.

### Layer 1 — Rule-Based Heuristics (instant, no training required)

| Rule | Threshold | Alert Message |
|---|---|---|
| Duplicate expense | Same amount logged ≥ 2 times within 24 hours | "Possible duplicate: same amount logged multiple times in 24 hours" |
| Overhead spike | Admin + salary costs exceed 40% of total donations | "Admin overhead exceeds 40% of total donations received" |
| Unusual hour | Expense logged between midnight and 6am or after 10pm | "Expense logged at unusual hour (HH:00)" |
| Large single expense | Single expense > 30% of total donations ever received | "Single expense exceeds 30% of total donations ever received" |

### Layer 2 — ML Model (Isolation Forest)

Once an NGO has logged at least 20 expenses, TraceTrust trains a per-NGO `IsolationForest` model (contamination=5%). The model learns the normal distribution of `[amount, hour_of_day, day_of_week, category]` for that specific NGO and scores each new expense against it. Model files are persisted to `ml/models/{ngo_id}_model.pkl` and retrained on every new expense.

Both layers run on every `POST /expenses/log` call. The API response includes an `anomalies_detected` list so the frontend can surface warnings immediately.

---

## Future Scope

- **Blockchain-based immutable ledger** — anchor audit log hashes to a public blockchain (e.g. Polygon) for cryptographic proof of tamper-resistance
- **UPI payment integration** — allow donors to donate directly through the platform with automatic transaction reconciliation
- **Government NGO registry API integration** — cross-verify NGO registration numbers against the DARPAN portal at registration time
- **Mobile app for field workers** — React Native app allowing field staff to log expenses via photo receipts, with OCR extraction of amount and vendor details

