import os
import sqlite3

# Define paths relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_DIR = os.path.join(BASE_DIR, '..', 'database')
DATABASE_PATH = os.path.join(DATABASE_DIR, 'expenses.db')
SCHEMA_PATH = os.path.join(DATABASE_DIR, 'schema.sql')


def get_db_connection():
    """Establish and return a connection to the SQLite database with Row factory."""
    os.makedirs(DATABASE_DIR, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON;')
    return conn


def init_db():
    """Initialize the database using the schema.sql file."""
    if not os.path.exists(SCHEMA_PATH):
        raise FileNotFoundError(f"Schema file not found at {SCHEMA_PATH}")

    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        schema_sql = f.read()

    conn = get_db_connection()
    try:
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()


if __name__ == '__main__':
    init_db()
    print(f"Database initialized successfully at: {DATABASE_PATH}")
