import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'vida-familiar.sqlite');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
      visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
      category TEXT NOT NULL CHECK(category IN ('daily','weekly','monthly','eventual')),
      priority TEXT NOT NULL CHECK(priority IN ('low','medium','high')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed')),
      due_date TEXT,
      recurrence TEXT DEFAULT 'none' CHECK(recurrence IN ('none','daily','weekly','monthly','yearly')),
      completed_at TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recurring_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','monthly','yearly')),
      next_run_date TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS finances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
      visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      transaction_date TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS financial_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
      visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
      target_amount REAL NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0,
      deadline TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
      visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
      status TEXT NOT NULL DEFAULT 'active',
      deadline TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wishlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
      visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
      estimated_value REAL DEFAULT 0,
      priority TEXT NOT NULL CHECK(priority IN ('low','medium','high')),
      status TEXT NOT NULL DEFAULT 'wanted' CHECK(status IN ('wanted','planned','purchased')),
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
      visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
      visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
      event_date TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise TEXT NOT NULL,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
      visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
      workout_date TEXT NOT NULL,
      sets INTEGER NOT NULL DEFAULT 3,
      reps INTEGER NOT NULL DEFAULT 10,
      weight REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS diet_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_name TEXT NOT NULL,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
      visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
      meal_date TEXT NOT NULL,
      quantity TEXT,
      grams REAL NOT NULL,
      carbs REAL DEFAULT 0,
      protein REAL DEFAULT 0,
      calories REAL DEFAULT 0,
      source TEXT DEFAULT 'manual',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
      visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
      notify_at TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shared_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission TEXT NOT NULL CHECK(permission IN ('private','shared','readonly')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedUsers();
  migrateDb();
}

function seedUsers() {
  const count = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  if (count > 0) return;

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `);
  const me = insertUser.run('Minha conta', 'eu@example.com', bcrypt.hashSync('123456', 10), 'admin').lastInsertRowid;
  const wife = insertUser.run('Esposa', 'esposa@example.com', bcrypt.hashSync('123456', 10), 'member').lastInsertRowid;

  const insertProfile = db.prepare('INSERT INTO profiles (user_id, owner_type, display_name) VALUES (?, ?, ?)');
  insertProfile.run(me, 'me', 'Minha Vida');
  insertProfile.run(wife, 'wife', 'Vida da Esposa');
  insertProfile.run(me, 'shared', 'Vida do Casal');
}

export function getDbPath() {
  return dbPath;
}

function migrateDb() {
  const workoutColumns = db.prepare("PRAGMA table_info(workouts)").all().map((column) => column.name);
  if (workoutColumns.length > 0 && !workoutColumns.includes('reps')) {
    db.exec('ALTER TABLE workouts ADD COLUMN reps INTEGER NOT NULL DEFAULT 10;');
  }

  const dietColumns = db.prepare("PRAGMA table_info(diet_entries)").all().map((column) => column.name);
  if (dietColumns.length > 0 && !dietColumns.includes('quantity')) {
    db.exec('ALTER TABLE diet_entries ADD COLUMN quantity TEXT;');
  }
}
