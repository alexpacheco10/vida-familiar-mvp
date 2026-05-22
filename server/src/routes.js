import express from 'express';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { all, get, getDbPath, isPostgres, run } from './db.js';
import { requireAuth, signToken } from './auth.js';
import { create, getById, list, remove, update, upsertRecurringTask } from './repositories.js';

export const router = express.Router();

const resources = ['tasks', 'finances', 'financial_goals', 'goals', 'wishlists', 'notes', 'events', 'workouts', 'diet_entries'];

const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha invalidos.' });
  }
  res.json({
    token: signToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

for (const resource of resources) {
  router.get(`/${resource}`, requireAuth, asyncHandler(async (req, res) => {
    res.json(await list(resource, req.query, req.user));
  }));

  router.get(`/${resource}/:id`, requireAuth, asyncHandler(async (req, res) => {
    const row = await getById(resource, req.params.id, req.user);
    if (!row) return res.status(404).json({ error: 'Registro nao encontrado.' });
    res.json(row);
  }));

  router.post(`/${resource}`, requireAuth, asyncHandler(async (req, res) => {
    const row = await create(resource, req.body, req.user);
    if (resource === 'tasks') await upsertRecurringTask(row);
    res.status(201).json(row);
  }));

  router.put(`/${resource}/:id`, requireAuth, asyncHandler(async (req, res) => {
    try {
      const row = await update(resource, req.params.id, req.body, req.user);
      if (!row) return res.status(404).json({ error: 'Registro nao encontrado.' });
      if (resource === 'tasks') await upsertRecurringTask(row);
      res.json(row);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  }));

  router.delete(`/${resource}/:id`, requireAuth, asyncHandler(async (req, res) => {
    if (!await remove(resource, req.params.id, req.user)) return res.status(404).json({ error: 'Registro nao encontrado.' });
    res.status(204).end();
  }));
}

router.patch('/tasks/:id/toggle', requireAuth, asyncHandler(async (req, res) => {
  const task = await getById('tasks', req.params.id, req.user);
  if (!task) return res.status(404).json({ error: 'Tarefa nao encontrada.' });
  const status = task.status === 'completed' ? 'pending' : 'completed';
  const row = await update('tasks', req.params.id, {
    status,
    completed_at: status === 'completed' ? new Date().toISOString() : null
  }, req.user);
  res.json(row);
}));

router.post('/recurring_tasks/run', requireAuth, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await all(`
    SELECT recurring_tasks.*, tasks.title, tasks.description, tasks.owner_type, tasks.visibility,
           tasks.category, tasks.priority, tasks.created_by
    FROM recurring_tasks
    JOIN tasks ON tasks.id = recurring_tasks.task_id
    WHERE recurring_tasks.next_run_date <= ?
  `, [today]);

  const created = [];
  for (const row of rows) {
    const task = await create('tasks', {
      title: row.title,
      description: row.description,
      owner_type: row.owner_type,
      visibility: row.visibility,
      category: row.category,
      priority: row.priority,
      status: 'pending',
      due_date: today,
      recurrence: 'none'
    }, req.user);
    created.push(task);

    const next = nextDate(row.next_run_date, row.frequency);
    await run('UPDATE recurring_tasks SET next_run_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next, row.id]);
  }

  res.json({ created });
}));

router.get('/foods/search', requireAuth, async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2) return res.json([]);

  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '8',
    fields: 'product_name,product_name_pt,generic_name_pt,brands,nutriments,serving_size'
  });

  try {
    const response = await fetch(`https://br.openfoodfacts.org/cgi/search.pl?${params}`, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'VidaFamiliarMVP/1.0 (local app)'
      }
    });
    if (!response.ok) throw new Error('Open Food Facts indisponivel.');
    const data = await response.json();
    const products = (data.products || [])
      .map((product) => {
        const nutriments = product.nutriments || {};
        const name = product.product_name_pt || product.product_name || product.generic_name_pt;
        return {
          name: name || 'Alimento sem nome',
          brand: product.brands || '',
          serving_size: product.serving_size || '',
          carbs_100g: numberOrZero(nutriments.carbohydrates_100g),
          protein_100g: numberOrZero(nutriments.proteins_100g),
          calories_100g: numberOrZero(nutriments['energy-kcal_100g'] || nutriments.energy_kcal_100g)
        };
      })
      .filter((product) => product.name && (product.carbs_100g || product.protein_100g || product.calories_100g));

    res.json(products);
  } catch (error) {
    res.status(502).json({ error: 'Nao foi possivel buscar alimentos agora. Voce ainda pode cadastrar manualmente.' });
  }
});

router.get('/dashboard/summary', requireAuth, asyncHandler(async (req, res) => {
  const tasks = await list('tasks', {}, req.user);
  const finances = await list('finances', {}, req.user);
  const events = await list('events', {}, req.user);
  const today = new Date();
  const isoToday = today.toISOString().slice(0, 10);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const month = isoToday.slice(0, 7);

  const balance = finances.reduce((sum, item) => sum + (item.type === 'income' ? item.amount : -item.amount), 0);
  const expensesByCategory = finances
    .filter((item) => item.type === 'expense')
    .reduce((acc, item) => ({ ...acc, [item.category]: (acc[item.category] || 0) + item.amount }), {});

  res.json({
    today: {
      tasks: tasks.filter((task) => task.due_date === isoToday && task.status !== 'completed'),
      events: events.filter((event) => event.event_date.slice(0, 10) === isoToday)
    },
    week: {
      tasks: tasks.filter((task) => task.due_date && task.due_date <= weekEnd.toISOString().slice(0, 10)),
      events: events.filter((event) => event.event_date.slice(0, 10) <= weekEnd.toISOString().slice(0, 10))
    },
    month: {
      tasks: tasks.filter((task) => task.due_date?.startsWith(month)),
      events: events.filter((event) => event.event_date.startsWith(month))
    },
    finances: { balance, expensesByCategory }
  });
}));

router.post('/notifications/generate', requireAuth, asyncHandler(async (req, res) => {
  const days = Number(req.body.days || 3);
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  const tasks = (await list('tasks', {}, req.user)).filter((task) => {
    return task.status !== 'completed' && task.due_date && task.due_date <= limit.toISOString().slice(0, 10);
  });

  for (const task of tasks) {
    const exists = await get('SELECT id FROM notifications WHERE item_type = ? AND item_id = ? AND read_at IS NULL', ['task', task.id]);
    if (!exists) {
      await run(`
        INSERT INTO notifications (item_type, item_id, title, message, owner_type, visibility, notify_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['task', task.id, `Tarefa proxima: ${task.title}`, `Vence em ${task.due_date}`, task.owner_type, task.visibility, task.due_date]);
    }
  }
  res.json(await listNotifications(req.user));
}));

router.get('/notifications', requireAuth, asyncHandler(async (req, res) => {
  res.json(await listNotifications(req.user));
}));

router.patch('/notifications/:id/read', requireAuth, asyncHandler(async (req, res) => {
  await run('UPDATE notifications SET read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

router.post('/backups', requireAuth, asyncHandler(async (req, res) => {
  if (isPostgres) {
    const filename = `postgres-backup-${new Date().toISOString()}`;
    await run('INSERT INTO backups (filename, created_by) VALUES (?, ?)', [filename, req.user.id]);
    return res.json({ filename, note: 'Em producao com PostgreSQL, use backups do provedor do banco.' });
  }

  const backupDir = path.join(path.dirname(getDbPath()), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
  const target = path.join(backupDir, filename);
  fs.copyFileSync(getDbPath(), target);
  await run('INSERT INTO backups (filename, created_by) VALUES (?, ?)', [target, req.user.id]);
  res.json({ filename: target });
}));

router.get('/backups', requireAuth, asyncHandler(async (req, res) => {
  res.json(await all('SELECT * FROM backups ORDER BY created_at DESC'));
}));

async function listNotifications(user) {
  return (await all('SELECT * FROM notifications ORDER BY notify_at ASC')).filter((row) => {
    if (row.visibility !== 'private') return true;
    if (user.role === 'admin') return true;
    return row.owner_type !== 'me';
  });
}

function nextDate(dateText, frequency) {
  const date = new Date(`${dateText}T00:00:00`);
  if (frequency === 'daily') date.setDate(date.getDate() + 1);
  if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
  if (frequency === 'yearly') date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function numberOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}
