import datetime
import os
import subprocess
import sys
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# Ensure server directory is in sys.path for robust imports
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from db import get_db_connection, init_db

# Static files directory for client UI
CLIENT_DIR = os.path.abspath(os.path.join(SERVER_DIR, '..', 'client'))

app = Flask(__name__, static_folder=CLIENT_DIR, static_url_path='')
CORS(app)

# Guarantee schema initialization on startup
init_db()


@app.route('/', methods=['GET'])
def index():
    """Serves index.html if present; otherwise returns API status placeholder."""
    index_file = os.path.join(CLIENT_DIR, 'index.html')
    if os.path.exists(index_file):
        return send_from_directory(CLIENT_DIR, 'index.html')
    return jsonify({
        "status": "ok",
        "message": "Expense Tracker API is running. Waiting for Stage 4 client files."
    }), 200


@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    """Fetch expenses with optional month, category, and search filters."""
    month = request.args.get('month', '').strip()
    category = request.args.get('category', '').strip()
    search = request.args.get('search', '').strip()

    query = "SELECT * FROM expenses WHERE 1=1"
    params = []

    if month:
        query += " AND expense_date LIKE ?"
        params.append(f"{month}%")

    if category and category.lower() != 'all':
        query += " AND category = ?"
        params.append(category)

    if search:
        query += " AND (title LIKE ? OR notes LIKE ?)"
        wildcard_search = f"%{search}%"
        params.extend([wildcard_search, wildcard_search])

    query += " ORDER BY expense_date DESC, id DESC"

    conn = get_db_connection()
    try:
        rows = conn.execute(query, params).fetchall()
        expenses = [dict(row) for row in rows]
        return jsonify(expenses), 200
    finally:
        conn.close()


@app.route('/api/expenses', methods=['POST'])
def add_expense():
    """Create a new expense record with validation."""
    data = request.get_json(silent=True) or {}

    title = data.get('title')
    amount = data.get('amount')
    category = data.get('category')
    expense_date = data.get('expense_date')
    notes = data.get('notes', '')

    # Required field validation
    if not title or not str(title).strip():
        return jsonify({"error": "Title is required and cannot be empty"}), 400

    if not category or not str(category).strip():
        return jsonify({"error": "Category is required and cannot be empty"}), 400

    if not expense_date or not str(expense_date).strip():
        return jsonify({"error": "Expense date is required and cannot be empty"}), 400

    if amount is None or str(amount).strip() == '':
        return jsonify({"error": "Amount is required"}), 400

    try:
        amount_val = float(amount)
        if amount_val < 0:
            return jsonify({"error": "Amount must be greater than or equal to 0"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Amount must be a valid number"}), 400

    clean_title = str(title).strip()
    clean_amount = round(amount_val, 2)
    clean_category = str(category).strip()
    clean_date = str(expense_date).strip()
    clean_notes = str(notes).strip() if notes is not None else ''

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            '''
            INSERT INTO expenses (title, amount, category, expense_date, notes)
            VALUES (?, ?, ?, ?, ?)
            ''',
            (clean_title, clean_amount, clean_category, clean_date, clean_notes)
        )
        conn.commit()
        new_id = cursor.lastrowid
        new_row = conn.execute('SELECT * FROM expenses WHERE id = ?', (new_id,)).fetchone()
        return jsonify(dict(new_row)), 201
    finally:
        conn.close()


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    """Delete an expense record by its ID."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM expenses WHERE id = ?', (expense_id,))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"error": "Expense not found"}), 404
        return jsonify({"message": "Expense deleted", "id": expense_id}), 200
    finally:
        conn.close()


@app.route('/api/summary', methods=['GET'])
def get_summary():
    """Calculate aggregated metrics: total_spend, monthly_spend, top_category, category_breakdown."""
    month = request.args.get('month', '').strip()
    if not month:
        month = datetime.date.today().strftime('%Y-%m')

    conn = get_db_connection()
    try:
        # Total spend across all records
        total_row = conn.execute(
            "SELECT COALESCE(ROUND(SUM(amount), 2), 0.0) AS total FROM expenses"
        ).fetchone()
        total_spend = float(total_row['total']) if total_row else 0.0

        # Monthly spend for the target YYYY-MM
        monthly_row = conn.execute(
            "SELECT COALESCE(ROUND(SUM(amount), 2), 0.0) AS monthly FROM expenses WHERE expense_date LIKE ?",
            (f"{month}%",)
        ).fetchone()
        monthly_spend = float(monthly_row['monthly']) if monthly_row else 0.0

        # Top category by all-time spending
        top_cat_row = conn.execute(
            """
            SELECT category, SUM(amount) AS total_cat
            FROM expenses
            GROUP BY category
            ORDER BY total_cat DESC
            LIMIT 1
            """
        ).fetchone()
        top_category = top_cat_row['category'] if top_cat_row else "None"

        # Category breakdown across all expenses
        breakdown_rows = conn.execute(
            """
            SELECT category, ROUND(SUM(amount), 2) AS total_cat
            FROM expenses
            GROUP BY category
            ORDER BY total_cat DESC
            """
        ).fetchall()
        category_breakdown = {row['category']: float(row['total_cat']) for row in breakdown_rows}

        return jsonify({
            "total_spend": total_spend,
            "monthly_spend": monthly_spend,
            "top_category": top_category,
            "category_breakdown": category_breakdown
        }), 200
    finally:
        conn.close()


@app.route('/<path:filename>', methods=['GET'])
def serve_static(filename):
    """Serve static client assets (HTML, CSS, JS, etc.)."""
    if filename.startswith('api/'):
        return jsonify({"error": "Endpoint not found"}), 404
    file_path = os.path.join(CLIENT_DIR, filename)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(CLIENT_DIR, filename)
    return jsonify({"error": "File not found"}), 404


def get_tailscale_ip():
    """Detect local Tailscale IPv4 address if available."""
    try:
        output = subprocess.check_output(["tailscale", "ip", "-4"], text=True, stderr=subprocess.DEVNULL)
        ip = output.strip().splitlines()[0].strip()
        if ip:
            return ip
    except Exception:
        pass
    return None


if __name__ == '__main__':
    tailscale_ip = get_tailscale_ip()
    db_relative_path = os.path.relpath(os.path.join(SERVER_DIR, '..', 'database', 'expenses.db'))

    print("\n" + "=" * 65)
    print("  PERSONAL EXPENSE TRACKER - LOCAL & TAILSCALE SERVER")
    print("=" * 65)
    print("  • Host Bind:             0.0.0.0:5000")
    print("  • Localhost Access:      http://localhost:5000")
    if tailscale_ip:
        print(f"  • Tailscale Mesh URL:    http://{tailscale_ip}:5000  (Phone/Tablet)")
    else:
        print("  • Tailscale Mesh URL:    Tailscale not detected (http://100.x.y.z:5000)")
    print(f"  • SQLite Database:       {db_relative_path}")
    print("=" * 65 + "\n")

    app.run(host='0.0.0.0', port=5000, debug=True)
