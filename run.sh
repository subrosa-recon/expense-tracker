#!/usr/bin/env bash
set -e
echo "Starting Personal Expense Tracker Server..."
if [ -f ".venv/bin/python" ]; then
    "./.venv/bin/python" "server/app.py"
else
    python3 "server/app.py"
fi
