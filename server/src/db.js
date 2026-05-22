import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'vida-familiar.sqlite');

export const isPostgres = Boolean(process.env.DATABASE_URL);

let sqliteDb;
let pgPool;

if (isPostgres) {
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
  });
} else {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
}

export async function initDb() {
  if (isPostgres) {
    await exec(postgresSchema);
  } else {
    await exec(sqliteSchema);
    await migrateSqlite();
  }

  await seedUsers();
}

export async function all(sql, params = []) {
  if (isPostgres) {
    const result = await pgPool.query(toPostgres(sql), params);
    return result.rows;
  }
  return sqliteDb.prepare(sql).all(...params);
}

export async function get(sql, params = []) {
  if (isPostgres) {
    const result = await pgPool.query(toPostgres(sql), params);
    return result.rows[0] || null;
  }
  return sqliteDb.prepare(sql).get(...params) || null;
}

export async function run(sql, params = []) {
  if (isPostgres) {
    const result = await pgPool.query(toPostgres(sql), params);
    return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
  }
  return sqliteDb.prepare(sql).run(...params);
}

export async function exec(sql) {
  if (isPostgres) {
    await pgPool.query(sql);
    return;
  }
  sqliteDb.exec(sql);
}

export function getDbPath() {
  return isPostgres ? null : dbPath;
}

async function seedUsers() {
  const count = await get('SELECT COUNT(*) AS total FROM users');
  if (Number(count.total) > 0) return;

  const insertMe = isPostgres
    ? await get('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id', ['Minha conta', 'eu@example.com', bcrypt.hashSync('123456', 10), 'admin'])
    : await run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', ['Minha conta', 'eu@example.com', bcrypt.hashSync('123456', 10), 'admin']);
  const insertWife = isPostgres
    ? await get('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id', ['Esposa', 'esposa@example.com', bcrypt.hashSync('123456', 10), 'member'])
    : await run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', ['Esposa', 'esposa@example.com', bcrypt.hashSync('123456', 10), 'member']);

  const meId = insertMe.id || insertMe.lastInsertRowid;
  const wifeId = insertWife.id || insertWife.lastInsertRowid;

  await run('INSERT INTO profiles (user_id, owner_type, display_name) VALUES (?, ?, ?)', [meId, 'me', 'Minha Vida']);
  await run('INSERT INTO profiles (user_id, owner_type, display_name) VALUES (?, ?, ?)', [wifeId, 'wife', 'Vida da Esposa']);
  await run('INSERT INTO profiles (user_id, owner_type, display_name) VALUES (?, ?, ?)', [meId, 'shared', 'Vida do Casal']);
}

async function migrateSqlite() {
  const workoutColumns = sqliteDb.prepare('PRAGMA table_info(workouts)').all().map((column) => column.name);
  if (workoutColumns.length > 0 && !workoutColumns.includes('reps')) {
    sqliteDb.exec('ALTER TABLE workouts ADD COLUMN reps INTEGER NOT NULL DEFAULT 10;');
  }

  const dietColumns = sqliteDb.prepare('PRAGMA table_info(diet_entries)').all().map((column) => column.name);
  if (dietColumns.length > 0 && !dietColumns.includes('quantity')) {
    sqliteDb.exec('ALTER TABLE diet_entries ADD COLUMN quantity TEXT;');
  }
}

function toPostgres(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

const commonTables = `
  CREATE TABLE IF NOT EXISTS users (
    id {{id}},
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id {{id}},
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id {{id}},
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
    id {{id}},
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','monthly','yearly')),
    next_run_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS finances (
    id {{id}},
    title TEXT NOT NULL,
    owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
    visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    category TEXT NOT NULL,
    amount {{real}} NOT NULL,
    transaction_date TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS financial_goals (
    id {{id}},
    title TEXT NOT NULL,
    owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
    visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
    target_amount {{real}} NOT NULL,
    current_amount {{real}} NOT NULL DEFAULT 0,
    deadline TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS goals (
    id {{id}},
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
    id {{id}},
    title TEXT NOT NULL,
    owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
    visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
    estimated_value {{real}} DEFAULT 0,
    priority TEXT NOT NULL CHECK(priority IN ('low','medium','high')),
    status TEXT NOT NULL DEFAULT 'wanted' CHECK(status IN ('wanted','planned','purchased')),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notes (
    id {{id}},
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
    visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id {{id}},
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
    id {{id}},
    exercise TEXT NOT NULL,
    owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
    visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
    workout_date TEXT NOT NULL,
    sets INTEGER NOT NULL DEFAULT 3,
    reps INTEGER NOT NULL DEFAULT 10,
    weight {{real}} DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS diet_entries (
    id {{id}},
    food_name TEXT NOT NULL,
    owner_type TEXT NOT NULL CHECK(owner_type IN ('me','wife','shared')),
    visibility TEXT NOT NULL CHECK(visibility IN ('private','shared','readonly')),
    meal_date TEXT NOT NULL,
    quantity TEXT,
    grams {{real}} NOT NULL,
    carbs {{real}} DEFAULT 0,
    protein {{real}} DEFAULT 0,
    calories {{real}} DEFAULT 0,
    source TEXT DEFAULT 'manual',
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id {{id}},
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
    id {{id}},
    item_type TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL CHECK(permission IN ('private','shared','readonly')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS backups (
    id {{id}},
    filename TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

const sqliteSchema = commonTables
  .replaceAll('{{id}}', 'INTEGER PRIMARY KEY AUTOINCREMENT')
  .replaceAll('{{real}}', 'REAL');

const postgresSchema = commonTables
  .replaceAll('{{id}}', 'SERIAL PRIMARY KEY')
  .replaceAll('{{real}}', 'DOUBLE PRECISION')
  .replaceAll('created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP', 'created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP')
  .replaceAll('updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP', 'updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP');
