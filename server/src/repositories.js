import { all, get, isPostgres, run } from './db.js';

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

export async function list(table, query, user) {
  const rows = await all(`SELECT * FROM ${table} ORDER BY created_at DESC`);
  return rows.filter((row) => canSee(row, user)).filter((row) => {
    if (query.owner_type && row.owner_type !== query.owner_type) return false;
    if (query.status && row.status !== query.status) return false;
    if (query.priority && row.priority !== query.priority) return false;
    if (query.category && row.category !== query.category) return false;
    return true;
  });
}

export async function getById(table, id, user) {
  const row = await get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return canSee(row, user) ? row : null;
}

export async function create(table, payload, user) {
  const fields = allowedTables[table].filter((field) => payload[field] !== undefined);
  const columns = [...fields, 'created_by'];
  const placeholders = columns.map(() => '?').join(', ');
  const values = [...fields.map((field) => payload[field]), user.id];
  if (isPostgres) {
    return get(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`, values);
  }
  const result = await run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
  return get(`SELECT * FROM ${table} WHERE id = ?`, [result.lastInsertRowid]);
}

export async function update(table, id, payload, user) {
  const current = await getById(table, id, user);
  if (!current) return null;
  if (current.visibility === 'readonly' && current.created_by !== user.id && user.role !== 'admin') {
    const error = new Error('Item somente leitura.');
    error.status = 403;
    throw error;
  }

  const fields = allowedTables[table].filter((field) => payload[field] !== undefined);
  if (fields.length === 0) return current;
  const assignments = fields.map((field) => `${field} = ?`).join(', ');
  await run(`UPDATE ${table} SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...fields.map((field) => payload[field]), id]);
  return get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
}

export async function remove(table, id, user) {
  const current = await getById(table, id, user);
  if (!current) return false;
  await run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  return true;
}

export async function upsertRecurringTask(task) {
  if (!task.recurrence || task.recurrence === 'none') return;
  const exists = await get('SELECT id FROM recurring_tasks WHERE task_id = ?', [task.id]);
  const nextRunDate = task.due_date || new Date().toISOString().slice(0, 10);
  if (exists) {
    await run('UPDATE recurring_tasks SET frequency = ?, next_run_date = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?', [task.recurrence, nextRunDate, task.id]);
  } else {
    await run('INSERT INTO recurring_tasks (task_id, frequency, next_run_date) VALUES (?, ?, ?)', [task.id, task.recurrence, nextRunDate]);
  }
}
