INSERT INTO habits (name, emoji, color, kind, goal, goal_dir, unit, sort, created_at) VALUES
  ('YouTube video',   '🎬', '#ef4444', 'check',  NULL, NULL,      '',     0, '2026-07-15'),
  ('LinkedIn post',   '💼', '#3b82f6', 'check',  NULL, NULL,      '',     1, '2026-07-15'),
  ('Exercise',        '🏋️', '#22c55e', 'check',  NULL, NULL,      '',     2, '2026-07-15'),
  ('Learn something', '📚', '#a855f7', 'check',  NULL, NULL,      '',     3, '2026-07-15'),
  ('Agency work',     '🚀', '#f59e0b', 'check',  NULL, NULL,      '',     4, '2026-07-15'),
  ('Pushups',         '💪', '#14b8a6', 'number', 50,   'atLeast', 'reps', 5, '2026-07-15'),
  ('Upwork outreach', '📨', '#06b6d4', 'number', 5,    'atLeast', '',     6, '2026-07-15'),
  ('Morning run',     '🏃', '#84cc16', 'number', 3,    'atLeast', 'km',   7, '2026-07-15');

INSERT INTO settings (id, title, sprint_on, sprint_len_days) VALUES
  (1, '12 Week Sprint', 0, 84);
