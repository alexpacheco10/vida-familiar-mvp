import { db } from './db.js';

const allowedTables = {
  tasks: ['title', 'description', 'owner_type', 'visibility', 'category', 'priority', 'status', 'due_date', 'recurrence', 'completed_at'],
  finances: ['title', 'owner_type', 'visibility', 'type', 'category', 'amount', 'transaction_date'],
  financial_goals: ['title', 'owner_type', 'visibility', 'target_amount', 'current_amount', 'deadline'],
  goals: ['title', 'owner_type', 'visibility', 'status', 'deadline'],
  wishlists: ['title', 'owner_type', 'visibility', 'estimated_value', 'priority', 'status'],
  notes: ['title', 'body', 'owner_type', 'visibility'],
  events: ['title', 'description', 'owner_type', 'visibility', 'event_date'],
  workouts: ['exercise', 'owner_type', 'visibility', 'workout_date', 'sets', 'reps', 'weight', 'notes'],
  diet_entries: ['food_name', 'owner_type', 'visibility', 'meal_date', 'quantity', 'grams', 'carbs', 'protein', 'calories', 'source']
};

export function canSee(row, user) {
  if (!row) return false;
  if (row.visibility !== 'private') return true;
  if (row.owner_type === 'shared') return true;
  if (user.role === 'admin') return true;
  return row.created_by === user.id;
}

export function list(table, query, user) {
  const rows = db.prepare(`SELECT * FROM ${table} ORDER BY created_at DESC`).all();
  return rows.filter((row) => canSee(row, user)).filter((row) => {
    if (query.owner_type && row.owner_type !== query.owner_type) return false;
    if (query.status && row.status !== query.status) return false;
    if (query.priority && row.priority !== query.priority) return false;
    if (query.category && row.category !== query.category) return false;
    return true;
  });
}

export function getById(table, id, user) {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  return canSee(row, user) ? row : null;
}

export function create(table, payload, user) {
  const fields = allowedTables[table].filter((field) => payload[field] !== undefined);
  const columns = [...fields, 'created_by'];
  const placeholders = columns.map(() => '?').join(', ');
  const values = [...fields.map((field) => payload[field]), user.id];
  const result = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(result.lastInsertRowid);
}

export function update(table, id, payload, user) {
  const current = getById(table, id, user);
  if (!current) return null;
  if (current.visibility === 'readonly' && current.created_by !== user.id && user.role !== 'admin') {
    const error = new Error('Item somente leitura.');
    error.status = 403;
    throw error;
  }

  const fields = allowedTables[table].filter((field) => payload[field] !== undefined);
  if (fields.length === 0) return current;
  const assignments = fields.map((field) => `${field} = ?`).join(', ');
  db.prepare(`UPDATE ${table} SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...fields.map((field) => payload[field]), id);
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
}

export function remove(table, id, user) {
  const current = getById(table, id, user);
  if (!current) return false;
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return true;
}

export function upsertRecurringTask(task) {
  if (!task.recurrence || task.recurrence === 'none') return;
  const exists = db.prepare('SELECT id FROM recurring_tasks WHERE task_id = ?').get(task.id);
  const nextRunDate = task.due_date || new Date().toISOString().slice(0, 10);
  if (exists) {
    db.prepare('UPDATE recurring_tasks SET frequency = ?, next_run_date = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?')
      .run(task.recurrence, nextRunDate, task.id);
  } else {
    db.prepare('INSERT INTO recurring_tasks (task_id, frequency, next_run_date) VALUES (?, ?, ?)')
      .run(task.id, task.recurrence, nextRunDate);
  }
}
