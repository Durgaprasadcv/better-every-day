CREATE TABLE devices (
 uid TEXT NOT NULL, id TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE,
 subscription TEXT NOT NULL, PRIMARY KEY(uid,id)
);
CREATE TABLE reminders (
 uid TEXT NOT NULL, id TEXT NOT NULL, device TEXT NOT NULL,
 due_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(uid,id)
);
CREATE INDEX reminder_due ON reminders(status,due_at,lease_until);
