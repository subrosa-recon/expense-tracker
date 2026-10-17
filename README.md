# Personal Expense Tracker

A modern, fast, and local-first personal expense tracking web application. Designed for complete privacy, seamless cross-device synchronization over a private **Tailscale** mesh network, and zero external frontend dependencies.

---

## Features

- **Local-First & Private**: All data is stored locally in an embedded SQLite database (`database/expenses.db`). Zero telemetry, third-party cloud trackers, or external database hosting required.
- **Tailscale Mesh Networking**: Host the application on your computer and access it instantly from your smartphone, tablet, or secondary laptop on your Tailscale network—no port forwarding or public firewall exposure needed.
- **Live Financial Insights**: Real-time calculation of all-time expenditure, current month's spending, and top spending category.
- **Category Spending Breakdown**: Visual breakdown of your expenses across categories (Food, Transport, Utilities, Academic/Supplies, Personal, Other) with dynamic progress bars.
- **Smart Filtering & Search**:
  - Filter by calendar month (`YYYY-MM`).
  - Filter by category.
  - Instant debounced search querying titles and notes.
- **One-Click Launchers**: Automated setup and run scripts provided for both Windows (`run.bat`) and Linux/macOS (`run.sh`).
- **Clean Responsive UI**: Lightweight, mobile-friendly interface built with vanilla HTML5, CSS3, and modern JavaScript.

---

## Architecture & Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Backend** | Python 3, Flask, Flask-CORS | REST API endpoints, static file server, Tailscale IP detection |
| **Frontend** | HTML5, CSS3, Modern JavaScript | Vanilla implementation (No heavy build steps, Webpack, or npm dependencies) |
| **Database** | SQLite3 | Embedded database initialized automatically with indexed schema |
| **Networking** | Tailscale / Localhost | Binds to `0.0.0.0:5000` for private local and mesh network accessibility |

---

## Project Structure

```text
expense-tracker/
├── client/                     # Frontend client assets
│   ├── app.js                  # Application logic, Fetch API, and UI state management
│   ├── index.html              # Semantic HTML5 layout and accessibility markup
│   └── style.css               # Responsive styling, color variables, and layout system
├── database/                   # Database persistence layer
│   ├── expenses.db             # Auto-generated SQLite database (ignored by Git)
│   └── schema.sql              # Database table schema and performance indexes
├── server/                     # Backend API & server
│   ├── app.py                  # Flask REST API routes, Tailscale IP resolver, entry point
│   ├── db.py                   # SQLite connection helpers and schema initialization
│   └── requirements.txt        # Python backend dependencies
├── .gitignore                  # Git ignore rules for environments, databases, and plans
├── README.md                   # Project documentation
├── run.bat                     # Windows one-click startup launcher
└── run.sh                      # Linux/macOS startup launcher
```

---

## Getting Started

### Prerequisites

- **Python 3.8+** installed on your system.
- *(Optional)* **[Tailscale](https://tailscale.com/)** installed if you want to access the app across your devices.

---

### Method 1: One-Click Startup (Recommended)

#### On Windows:
Double-click `run.bat` or run:
```bat
run.bat
```

#### On Linux or macOS:
Make the script executable and run:
```bash
chmod +x run.sh
./run.sh
```

The script will automatically detect your virtual environment (`.venv`) or system Python and launch the server.

---

### Method 2: Manual Installation & Execution

1. **Clone or navigate to the repository**:
   ```bash
   cd expense-tracker
   ```

2. **Create and activate a Python virtual environment**:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install the dependencies**:
   ```bash
   pip install -r server/requirements.txt
   ```

4. **Start the server**:
   ```bash
   python server/app.py
   ```

5. **Open in your browser**:
   Navigate to [http://localhost:5000](http://localhost:5000)

---

## Cross-Device Access via Tailscale

If you have Tailscale running on your host machine, the server will detect your Tailscale IPv4 address on startup and display:

```text
=================================================================
  PERSONAL EXPENSE TRACKER - LOCAL & TAILSCALE SERVER
=================================================================
  • Host Bind:             0.0.0.0:5000
  • Localhost Access:      http://localhost:5000
  • Tailscale Mesh URL:    http://100.x.y.z:5000  (Phone/Tablet)
  • SQLite Database:       database/expenses.db
=================================================================
```

1. Install Tailscale on your mobile phone or tablet and log into the same account.
2. Open a browser on your phone and go to `http://<your-tailscale-ip>:5000` (e.g. `http://100.115.92.45:5000`).
3. You can now log and review your expenses directly from your phone while on the go!

---

## REST API Reference

All endpoints accept and return JSON.

### 1. Get Expenses
- **Endpoint**: `GET /api/expenses`
- **Query Parameters**:
  - `month` *(optional)*: Filter by `YYYY-MM` (e.g. `2026-10`)
  - `category` *(optional)*: Filter by category (e.g. `Food`, `Transport`)
  - `search` *(optional)*: Case-insensitive search on title and notes
- **Response**: Array of expense objects:
  ```json
  [
    {
      "id": 1,
      "title": "Lunch with team",
      "amount": 25.50,
      "category": "Food",
      "expense_date": "2026-10-18",
      "notes": "Chicken Rice stall",
      "created_at": "2026-10-18 12:30:00"
    }
  ]
  ```

### 2. Add an Expense
- **Endpoint**: `POST /api/expenses`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "title": "Bus ticket",
    "amount": 4.50,
    "category": "Transport",
    "expense_date": "2026-10-18",
    "notes": "Commute to work"
  }
  ```
- **Response**: `201 Created` with the created expense object.

### 3. Delete an Expense
- **Endpoint**: `DELETE /api/expenses/<id>`
- **Response**:
  ```json
  {
    "message": "Expense deleted",
    "id": 1
  }
  ```

### 4. Summary & Metrics
- **Endpoint**: `GET /api/summary?month=YYYY-MM`
- **Response**:
  ```json
  {
    "total_spend": 320.75,
    "monthly_spend": 145.20,
    "top_category": "Food",
    "category_breakdown": {
      "Food": 85.00,
      "Transport": 40.20,
      "Utilities": 20.00
    }
  }
  ```

---

## Database Schema

The SQLite schema initializes automatically on first run via `database/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount >= 0),
    category TEXT NOT NULL,
    expense_date TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
```

---

## License

This project is licensed under the [MIT License](LICENSE).
