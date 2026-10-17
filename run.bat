@echo off
echo Starting Personal Expense Tracker Server...
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" "server\app.py"
) else (
    python "server\app.py"
)
pause
