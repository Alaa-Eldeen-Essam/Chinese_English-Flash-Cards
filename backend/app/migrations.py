from sqlalchemy import text


def apply_sqlite_migrations(engine) -> None:
    if engine.dialect.name != "sqlite":
        return
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
            ("last_modified", "last_modified DATETIME"),
            ("pinyin_normalized", "pinyin_normalized TEXT"),
            ("hsk_level", "hsk_level INTEGER"),
            ("pos", "pos TEXT"),
            ("frequency", "frequency REAL")
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

        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dict_word_simplified ON dict_word (simplified)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dict_word_traditional ON dict_word (traditional)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dict_word_pinyin_norm ON dict_word (pinyin_normalized)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dict_word_hsk ON dict_word (hsk_level)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dict_word_pos ON dict_word (pos)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dict_word_freq ON dict_word (frequency)"))

        conn.execute(
            text(
                """
                UPDATE dict_word
                SET pinyin_normalized = lower(
                  replace(
                    replace(
                      replace(
                        replace(
                          replace(
                            replace(
                              replace(pinyin, '1', ''),
                              '2', ''),
                            '3', ''),
                          '4', ''),
                        '5', ''),
                      'u:', 'v'),
                    '\u00fc', 'v')
                )
                WHERE pinyin_normalized IS NULL AND pinyin IS NOT NULL
                """
            )
        )

        try:
            conn.execute(
                text(
                    """
                    CREATE VIRTUAL TABLE IF NOT EXISTS dict_word_fts
                    USING fts5(
                      simplified,
                      traditional,
                      pinyin,
                      meanings,
                      content='dict_word',
                      content_rowid='id'
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TRIGGER IF NOT EXISTS dict_word_ai
                    AFTER INSERT ON dict_word BEGIN
                      INSERT INTO dict_word_fts(rowid, simplified, traditional, pinyin, meanings)
                      VALUES (new.id, new.simplified, new.traditional, new.pinyin, new.meanings);
                    END;
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TRIGGER IF NOT EXISTS dict_word_ad
                    AFTER DELETE ON dict_word BEGIN
                      INSERT INTO dict_word_fts(dict_word_fts, rowid, simplified, traditional, pinyin, meanings)
                      VALUES('delete', old.id, old.simplified, old.traditional, old.pinyin, old.meanings);
                    END;
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TRIGGER IF NOT EXISTS dict_word_au
                    AFTER UPDATE ON dict_word BEGIN
                      INSERT INTO dict_word_fts(dict_word_fts, rowid, simplified, traditional, pinyin, meanings)
                      VALUES('delete', old.id, old.simplified, old.traditional, old.pinyin, old.meanings);
                      INSERT INTO dict_word_fts(rowid, simplified, traditional, pinyin, meanings)
                      VALUES (new.id, new.simplified, new.traditional, new.pinyin, new.meanings);
                    END;
                    """
                )
            )
            conn.execute(text("INSERT INTO dict_word_fts(dict_word_fts) VALUES('rebuild')"))
        except Exception:
            # FTS5 may not be available in some SQLite builds.
            pass
