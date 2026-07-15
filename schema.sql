DROP TABLE IF EXISTS entries;
DROP TABLE IF EXISTS habits;
DROP TABLE IF EXISTS settings;

CREATE TABLE habits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  emoji      TEXT    NOT NULL DEFAULT '',
  color      TEXT    NOT NULL DEFAULT '#22c55e',
  kind       TEXT    NOT NULL CHECK (kind IN ('check','number')),
  goal       REAL,
  goal_dir   TEXT    CHECK (goal_dir IN ('atLeast','atMost')),
  unit       TEXT    NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL DEFAULT 0,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);

CREATE TABLE entries (
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date     TEXT    NOT NULL,
  value    REAL,
  done     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (habit_id, date)
);

CREATE TABLE settings (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  title              TEXT    NOT NULL DEFAULT '12 Week Sprint',
  sprint_on          INTEGER NOT NULL DEFAULT 0,
  sprint_start       TEXT,
  sprint_len_days    INTEGER NOT NULL DEFAULT 84,
  edit_password_hash TEXT
);
