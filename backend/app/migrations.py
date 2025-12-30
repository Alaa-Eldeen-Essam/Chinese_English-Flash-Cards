from sqlalchemy import text


def apply_sqlite_migrations(engine) -> None:
    migrations = {
        "users": [
            ("email", "email TEXT"),
            ("auth_provider", "auth_provider TEXT DEFAULT 'password'"),
            ("oauth_subject", "oauth_subject TEXT"),
            ("is_active", "is_active BOOLEAN DEFAULT 1"),
            ("last_modified", "last_modified DATETIME")
        ],
        "collections": [
            ("last_modified", "last_modified DATETIME")
        ],
        "cards": [
            ("last_modified", "last_modified DATETIME")
        ],
        "study_logs": [
            ("last_modified", "last_modified DATETIME")
        ],
        "dict_word": [
            ("last_modified", "last_modified DATETIME")
        ]
    }

    with engine.begin() as conn:
        for table, columns in migrations.items():
            result = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            existing = {row[1] for row in result}
            if not existing:
                continue
            for column_name, definition in columns:
                if column_name in existing:
                    continue
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {definition}"))

        if "users" in migrations:
            conn.execute(text("UPDATE users SET auth_provider = 'password' WHERE auth_provider IS NULL"))
            conn.execute(text("UPDATE users SET is_active = 1 WHERE is_active IS NULL"))
