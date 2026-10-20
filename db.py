import os
import pymysql
import pymysql.cursors


def get_connection():
    """Create and return a new MySQL connection using env vars."""
    return pymysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", 3306)),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        database=os.environ.get("DB_NAME", "job_market_db"),
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )
