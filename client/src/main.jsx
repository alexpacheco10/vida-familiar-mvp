import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Apple, Bell, CalendarDays, CheckCircle2, CircleDollarSign, ClipboardList, Dumbbell, Heart, LogOut, NotebookText, Plus, Target, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const ownerLabels = { me: 'Minha Vida', wife: 'Vida da Esposa', shared: 'Vida do Casal' };
const categoryLabels = { daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensal', eventual: 'Eventual' };
const priorityLabels = { low: 'Baixa', medium: 'Media', high: 'Alta' };

function api(token, path, options = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : undefined,
      ...options.headers
    }
  }).then(async (response) => {
    if (!response.ok) throw new Error((await response.json()).error || 'Erro na API');
    if (response.status === 204) return null;
    return response.json();
  }).catch((error) => {
    if (error instanceof TypeError) {
      throw new Error('API offline. O GitHub Pages hospeda apenas o frontend; para logar online e preciso hospedar o backend Node/Express.');
    }
    throw error;
  });
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [owner, setOwner] = useState('me');

  useEffect(() => {
    if (!token) return;
    api(token, '/me').then(({ user }) => setUser(user)).catch(() => setToken(null));
  }, [token]);

  function onLogin(auth) {
    localStorage.setItem('token', auth.token);
    setToken(auth.token);
    setUser(auth.user);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }

  if (!token) return <Login onLogin={onLogin} />;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Heart size={24} />
          <strong>Vida Familiar</strong>
        </div>
        <OwnerTabs owner={owner} setOwner={setOwner} />
        <nav>
          <NavButton icon={<Target />} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <NavButton icon={<ClipboardList />} label="Tarefas" active={view === 'tasks'} onClick={() => setView('tasks')} />
          <NavButton icon={<CircleDollarSign />} label="Financas" active={view === 'finances'} onClick={() => setView('finances')} />
          <NavButton icon={<CalendarDays />} label="Calendario" active={view === 'events'} onClick={() => setView('events')} />
          <NavButton icon={<Dumbbell />} label="Academia" active={view === 'workouts'} onClick={() => setView('workouts')} />
          <NavButton icon={<Apple />} label="Dieta" active={view === 'diet'} onClick={() => setView('diet')} />
          <NavButton icon={<Target />} label="Metas" active={view === 'goals'} onClick={() => setView('goals')} />
          <NavButton icon={<NotebookText />} label="Notas e desejos" active={view === 'notes'} onClick={() => setView('notes')} />
          <NavButton icon={<Bell />} label="Alertas" active={view === 'alerts'} onClick={() => setView('alerts')} />
        </nav>
        <button className="ghost" onClick={logout}><LogOut size={18} /> Sair</button>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span>{ownerLabels[owner]}</span>
            <h1>{titleFor(view)}</h1>
          </div>
          <p>{user?.name}</p>
        </header>
        {view === 'dashboard' && <Dashboard token={token} owner={owner} />}
        {view === 'tasks' && <Tasks token={token} owner={owner} />}
        {view === 'finances' && <Finances token={token} owner={owner} />}
        {view === 'events' && <Events token={token} owner={owner} />}
        {view === 'workouts' && <Workouts token={token} owner={owner} />}
        {view === 'diet' && <Diet token={token} owner={owner} />}
        {view === 'goals' && <Goals token={token} owner={owner} />}
        {view === 'notes' && <Notes token={token} owner={owner} />}
        {view === 'alerts' && <Alerts token={token} />}
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('eu@example.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      onLogin(await api(null, '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit} className="loginBox">
        <Heart size={34} />
        <h1>Vida Familiar</h1>
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha" type="password" />
        {error && <small className="error">{error}</small>}
        <button>Entrar</button>
        <small>Contas iniciais: eu@example.com e esposa@example.com. Senha: 123456.</small>
      </form>
    </main>
  );
}

function Dashboard({ token, owner }) {
  const [summary, setSummary] = useState(null);
  useEffect(() => { api(token, '/dashboard/summary').then(setSummary); }, [token]);
  const chartData = Object.entries(summary?.finances.expensesByCategory || {}).map(([name, value]) => ({ name, value }));
  const scopedToday = summary?.today.tasks.filter((task) => task.owner_type === owner) || [];

  return (
    <section className="grid dashboard">
      <Metric title="Tarefas hoje" value={scopedToday.length} />
      <Metric title="Tarefas na semana" value={summary?.week.tasks.length || 0} />
      <Metric title="Eventos no mes" value={summary?.month.events.length || 0} />
      <Metric title="Saldo geral" value={money(summary?.finances.balance || 0)} />
      <div className="panel wide">
        <h2>Gastos por categoria</h2>
        <ResponsiveContainer height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value) => money(value)} />
            <Bar dataKey="value" fill="#2f6f73" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="panel">
        <h2>Resumo do dia</h2>
        <List rows={scopedToday} empty="Nenhuma tarefa vencendo hoje." />
      </div>
    </section>
  );
}

function Tasks({ token, owner }) {
  const [rows, setRows] = useCrud(token, '/tasks', owner);
  const [filters, setFilters] = useState({ status: '', priority: '', category: '' });
  const visible = rows.filter((row) => {
    if (row.owner_type !== owner) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.priority && row.priority !== filters.priority) return false;
    if (filters.category && row.category !== filters.category) return false;
    return true;
  });

  return (
    <section className="stack">
      <TaskForm token={token} owner={owner} onCreated={(row) => setRows([row, ...rows])} />
      <div className="filters">
        <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">Todas categorias</option>
          {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Todos status</option>
          <option value="pending">Pendente</option>
          <option value="completed">Concluida</option>
        </select>
        <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
          <option value="">Todas prioridades</option>
          {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="cards">{visible.map((task) => <TaskCard key={task.id} task={task} token={token} onChange={() => refresh(token, '/tasks', setRows)} />)}</div>
    </section>
  );
}

function TaskForm({ token, owner, onCreated }) {
  const [form, setForm] = useState({ title: '', category: 'daily', priority: 'medium', due_date: '', recurrence: 'none', visibility: owner === 'shared' ? 'shared' : 'private' });
  async function submit(event) {
    event.preventDefault();
    const row = await api(token, '/tasks', { method: 'POST', body: JSON.stringify(withVisibility(form, owner, { owner_type: owner, status: 'pending' })) });
    setForm({ ...form, title: '', due_date: '' });
    onCreated(row);
  }
  return <Form title="Nova tarefa" owner={owner} form={form} setForm={setForm} onSubmit={submit} fields={['title', 'category', 'priority', 'due_date', 'recurrence', 'visibility']} />;
}

function TaskCard({ task, token, onChange }) {
  async function toggle() {
    await api(token, `/tasks/${task.id}/toggle`, { method: 'PATCH' });
    onChange();
  }
  async function edit() {
    const title = window.prompt('Editar titulo da tarefa', task.title);
    if (!title || title === task.title) return;
    await api(token, `/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ title }) });
    onChange();
  }
  async function del() {
    await api(token, `/tasks/${task.id}`, { method: 'DELETE' });
    onChange();
  }
  return (
    <article className={`card priority-${task.priority}`}>
      <button className="icon" onClick={toggle} title="Concluir"><CheckCircle2 size={19} /></button>
      <div onDoubleClick={edit} title="Clique duas vezes para editar">
        <h3 className={task.status === 'completed' ? 'done' : ''}>{task.title}</h3>
        <p>{categoryLabels[task.category]} | {priorityLabels[task.priority]} | {task.due_date || 'sem prazo'} | recorrencia: {task.recurrence}</p>
      </div>
      <button className="icon danger" onClick={del} title="Excluir"><Trash2 size={18} /></button>
    </article>
  );
}

function Finances({ token, owner }) {
  const [rows, setRows] = useCrud(token, '/finances', owner);
  const [goals, setGoals] = useCrud(token, '/financial_goals', owner);
  const balance = rows.filter((row) => row.owner_type === owner).reduce((sum, row) => sum + (row.type === 'income' ? row.amount : -row.amount), 0);
  const chartData = Object.entries(rows.filter((row) => row.type === 'expense' && row.owner_type === owner).reduce((acc, row) => ({ ...acc, [row.category]: (acc[row.category] || 0) + row.amount }), {})).map(([name, value]) => ({ name, value }));

  return (
    <section className="grid">
      <Metric title="Saldo" value={money(balance)} />
      <FinanceForm token={token} owner={owner} onCreated={(row) => setRows([row, ...rows])} />
      <FinancialGoalForm token={token} owner={owner} onCreated={(row) => setGoals([row, ...goals])} />
      <div className="panel wide">
        <h2>Gastos</h2>
        <ResponsiveContainer height={240}>
          <BarChart data={chartData}><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(value) => money(value)} /><Bar dataKey="value" fill="#ad5d4e" radius={[6, 6, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </div>
      <ListPanel title="Lancamentos" rows={rows.filter((row) => row.owner_type === owner)} render={(row) => `${row.title} - ${money(row.amount)} (${row.type})`} />
      <ListPanel title="Metas financeiras" rows={goals.filter((row) => row.owner_type === owner)} render={(row) => `${row.title} - ${money(row.current_amount)} de ${money(row.target_amount)}`} />
    </section>
  );
}

function FinanceForm({ token, owner, onCreated }) {
  const [form, setForm] = useState({ title: '', type: 'expense', category: 'Casa', amount: 0, transaction_date: today(), visibility: owner === 'shared' ? 'shared' : 'private' });
  async function submit(event) {
    event.preventDefault();
    const row = await api(token, '/finances', { method: 'POST', body: JSON.stringify(withVisibility(form, owner, { owner_type: owner, amount: Number(form.amount) })) });
    onCreated(row);
  }
  return <Form title="Novo lancamento" owner={owner} form={form} setForm={setForm} onSubmit={submit} fields={['title', 'type', 'category', 'amount', 'transaction_date', 'visibility']} />;
}

function FinancialGoalForm({ token, owner, onCreated }) {
  const [form, setForm] = useState({ title: '', target_amount: 5000, current_amount: 0, deadline: '', visibility: owner === 'shared' ? 'shared' : 'private' });
  async function submit(event) {
    event.preventDefault();
    const row = await api(token, '/financial_goals', { method: 'POST', body: JSON.stringify(withVisibility(form, owner, { owner_type: owner, target_amount: Number(form.target_amount), current_amount: Number(form.current_amount) })) });
    onCreated(row);
  }
  return <Form title="Meta financeira" owner={owner} form={form} setForm={setForm} onSubmit={submit} fields={['title', 'target_amount', 'current_amount', 'deadline', 'visibility']} />;
}

function Events({ token, owner }) {
  const [rows, setRows] = useCrud(token, '/events', owner);
  const [form, setForm] = useState({ title: '', description: '', event_date: today(), visibility: owner === 'shared' ? 'shared' : 'private' });
  async function submit(event) {
    event.preventDefault();
    const row = await api(token, '/events', { method: 'POST', body: JSON.stringify(withVisibility(form, owner, { owner_type: owner })) });
    setRows([row, ...rows]);
  }
  return (
    <section className="grid">
      <Form title="Novo compromisso" owner={owner} form={form} setForm={setForm} onSubmit={submit} fields={['title', 'description', 'event_date', 'visibility']} />
      <ListPanel title="Calendario simples" rows={rows.filter((row) => row.owner_type === owner)} render={(row) => `${row.event_date.slice(0, 10)} - ${row.title}`} />
    </section>
  );
}

function Workouts({ token, owner }) {
  const [rows, setRows] = useCrud(token, '/workouts', owner);
  const [form, setForm] = useState({
    exercise: '',
    workout_date: today(),
    sets: 3,
    reps: 10,
    weight: '',
    notes: '',
    visibility: owner === 'shared' ? 'shared' : 'private'
  });
  const visibleRows = rows
    .filter((row) => row.owner_type === owner)
    .sort((a, b) => b.workout_date.localeCompare(a.workout_date) || b.id - a.id);
  const grouped = groupByDate(visibleRows, 'workout_date');

  async function submit(event) {
    event.preventDefault();
    const row = await api(token, '/workouts', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        owner_type: owner,
        visibility: owner === 'shared' ? 'shared' : form.visibility,
        sets: Number(form.sets),
        reps: Number(form.reps),
        weight: Number(form.weight || 0)
      })
    });
    setRows([row, ...rows]);
    setForm({ ...form, exercise: '', weight: '', notes: '' });
  }

  async function del(id) {
    await api(token, `/workouts/${id}`, { method: 'DELETE' });
    refresh(token, '/workouts', setRows);
  }

  return (
    <section className="grid">
      <form className="panel form" onSubmit={submit}>
        <h2>Registrar treino do dia</h2>
        <input value={form.workout_date} type="date" onChange={(event) => setForm({ ...form, workout_date: event.target.value })} />
        <input value={form.exercise} onChange={(event) => setForm({ ...form, exercise: event.target.value })} placeholder="Exercicio feito" required />
        <div className="inlineFields">
          <input value={form.sets} type="number" min="1" onChange={(event) => setForm({ ...form, sets: event.target.value })} placeholder="Series" />
          <input value={form.reps} type="number" min="1" onChange={(event) => setForm({ ...form, reps: event.target.value })} placeholder="Repeticoes" />
          <input value={form.weight} type="number" min="0" step="0.5" onChange={(event) => setForm({ ...form, weight: event.target.value })} placeholder="Peso em kg" />
        </div>
        <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Observacao opcional" />
        {owner !== 'shared' && (
          <select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
            <option value="private">Privado</option>
            <option value="shared">Compartilhado</option>
            <option value="readonly">Somente leitura</option>
          </select>
        )}
        <button><Plus size={18} /> Salvar exercicio</button>
      </form>
      <div className="panel wide">
        <h2>Historico diario</h2>
        {!Object.keys(grouped).length && <p className="muted">Nenhum exercicio registrado ainda.</p>}
        <div className="workoutDays">
          {Object.entries(grouped).map(([date, items]) => (
            <section className="workoutDay" key={date}>
              <h3>{weekday(date)} - {formatDate(date)}</h3>
              <div className="workoutRows">
                {items.map((item) => (
                  <article className="workoutRow" key={item.id}>
                    <strong>{item.exercise}</strong>
                    <span>{item.sets} series</span>
                    <span>{item.reps} repeticoes</span>
                    <span>{Number(item.weight || 0)} kg</span>
                    {item.notes && <small>{item.notes}</small>}
                    <button className="icon danger" onClick={() => del(item.id)} title="Excluir"><Trash2 size={18} /></button>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

function Diet({ token, owner }) {
  const [rows, setRows] = useCrud(token, '/diet_entries', owner);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    food_name: '',
    meal_date: today(),
    quantity: '',
    grams: 100,
    carbs: 0,
    protein: 0,
    calories: 0,
    source: 'manual',
    visibility: owner === 'shared' ? 'shared' : 'private'
  });
  const visibleRows = rows
    .filter((row) => row.owner_type === owner)
    .sort((a, b) => b.meal_date.localeCompare(a.meal_date) || b.id - a.id);
  const grouped = groupByDate(visibleRows, 'meal_date');
  const todayRows = visibleRows.filter((row) => row.meal_date === form.meal_date);
  const totals = sumDiet(todayRows);

  useEffect(() => {
    const term = form.food_name.trim();
    if (form.source !== 'typing' || term.length < 2) {
      if (term.length < 2) setResults([]);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const foods = await api(token, `/foods/search?q=${encodeURIComponent(term)}`);
        if (!active) return;
        setResults(foods);
        if (foods[0]) {
          setForm((current) => {
            if (current.source !== 'typing' || current.food_name.trim() !== term) return current;
            return foodToForm(current, foods[0]);
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 700);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.food_name, form.source, token]);

  function chooseFood(food) {
    setForm((current) => foodToForm(current, food));
  }

  function changeGrams(value) {
    const nextGrams = Number(value || 0);
    const currentGrams = Number(form.grams || 100) || 100;
    setForm({
      ...form,
      grams: value,
      carbs: roundMacro(Number(form.carbs || 0) * nextGrams / currentGrams),
      protein: roundMacro(Number(form.protein || 0) * nextGrams / currentGrams),
      calories: roundMacro(Number(form.calories || 0) * nextGrams / currentGrams)
    });
  }

  async function submit(event) {
    event.preventDefault();
    const row = await api(token, '/diet_entries', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        owner_type: owner,
        visibility: owner === 'shared' ? 'shared' : form.visibility,
        quantity: form.quantity,
        grams: Number(form.grams),
        carbs: Number(form.carbs),
        protein: Number(form.protein),
        calories: Number(form.calories)
      })
    });
    setRows([row, ...rows]);
    setForm({ ...form, food_name: '', quantity: '', carbs: 0, protein: 0, calories: 0, source: 'manual' });
    setResults([]);
  }

  async function del(id) {
    await api(token, `/diet_entries/${id}`, { method: 'DELETE' });
    refresh(token, '/diet_entries', setRows);
  }

  return (
    <section className="grid">
      <form className="panel form" onSubmit={submit}>
        <h2>Adicionar refeicao</h2>
        <input value={form.meal_date} type="date" onChange={(event) => setForm({ ...form, meal_date: event.target.value })} />
        <input value={form.food_name} onChange={(event) => setForm({ ...form, food_name: event.target.value, source: 'typing' })} placeholder="Alimento" required />
        {loading && <p className="muted">Buscando informacoes nutricionais...</p>}
        {form.source === 'openfoodfacts' && <p className="muted">Valores preenchidos automaticamente pela Open Food Facts.</p>}
        <div className="foodResults">
          {results.slice(1).map((food) => (
            <button type="button" key={`${food.name}-${food.brand}`} onClick={() => chooseFood(food)}>
              <strong>{food.name}</strong>
              <span>{food.brand || 'Open Food Facts'} | 100g: {food.carbs_100g}g carb, {food.protein_100g}g prot, {food.calories_100g} kcal</span>
            </button>
          ))}
        </div>
        <div className="inlineFields two">
          <label className="macroField">
            <span>Quantidade</span>
            <input value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="Ex: 2 unidades" />
          </label>
          <label className="macroField">
            <span>Gramas</span>
            <input value={form.grams} type="number" min="1" step="1" onChange={(event) => changeGrams(event.target.value)} placeholder="100" required />
          </label>
        </div>
        <div className="inlineFields">
          <label className="macroField">
            <span>Carboidrato</span>
            <input value={form.carbs} type="number" min="0" step="0.1" onChange={(event) => setForm({ ...form, carbs: event.target.value, source: 'manual' })} placeholder="0 g" />
          </label>
          <label className="macroField">
            <span>Proteina</span>
            <input value={form.protein} type="number" min="0" step="0.1" onChange={(event) => setForm({ ...form, protein: event.target.value, source: 'manual' })} placeholder="0 g" />
          </label>
          <label className="macroField">
            <span>Calorias</span>
            <input value={form.calories} type="number" min="0" step="1" onChange={(event) => setForm({ ...form, calories: event.target.value, source: 'manual' })} placeholder="0 kcal" />
          </label>
        </div>
        {owner !== 'shared' && (
          <select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
            <option value="private">Privado</option>
            <option value="shared">Compartilhado</option>
            <option value="readonly">Somente leitura</option>
          </select>
        )}
        <button><Plus size={18} /> Salvar alimento</button>
      </form>
      <div className="metric"><span>Total da data selecionada</span><strong>{Math.round(totals.calories)} kcal</strong><p>{roundMacro(totals.carbs)}g carb | {roundMacro(totals.protein)}g prot</p></div>
      <div className="panel wide">
        <h2>Historico da dieta</h2>
        {!Object.keys(grouped).length && <p className="muted">Nenhum alimento registrado ainda.</p>}
        <div className="workoutDays">
          {Object.entries(grouped).map(([date, items]) => (
            <section className="workoutDay" key={date}>
              <h3>{weekday(date)} - {formatDate(date)}</h3>
              <div className="dietRows">
                {items.map((item) => (
                  <article className="dietRow" key={item.id}>
                    <strong>{item.food_name}</strong>
                    <span>{item.quantity || '-'}</span>
                    <span>{Number(item.grams)}g</span>
                    <span>{Number(item.carbs)}g carb</span>
                    <span>{Number(item.protein)}g prot</span>
                    <span>{Number(item.calories)} kcal</span>
                    <button className="icon danger" onClick={() => del(item.id)} title="Excluir"><Trash2 size={18} /></button>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

function Goals({ token, owner }) {
  const [goals, setGoals] = useCrud(token, '/goals', owner);
  const [wishes, setWishes] = useCrud(token, '/wishlists', owner);
  return (
    <section className="grid">
      <SimpleCreate title="Meta pessoal/casal" endpoint="/goals" token={token} owner={owner} fields={{ title: '', status: 'active', deadline: '', visibility: owner === 'shared' ? 'shared' : 'private' }} onCreated={(row) => setGoals([row, ...goals])} />
      <SimpleCreate title="Desejo de consumo" endpoint="/wishlists" token={token} owner={owner} fields={{ title: '', estimated_value: 0, priority: 'medium', status: 'wanted', visibility: owner === 'shared' ? 'shared' : 'private' }} onCreated={(row) => setWishes([row, ...wishes])} />
      <ListPanel title="Metas" rows={goals.filter((row) => row.owner_type === owner)} render={(row) => `${row.title} - ${row.status} - ${row.deadline || 'sem prazo'}`} />
      <ListPanel title="Desejos" rows={wishes.filter((row) => row.owner_type === owner)} render={(row) => `${row.title} - ${money(row.estimated_value)} - ${priorityLabels[row.priority]}`} />
    </section>
  );
}

function Notes({ token, owner }) {
  const [notes, setNotes] = useCrud(token, '/notes', owner);
  return (
    <section className="grid">
      <SimpleCreate title="Nova anotacao" endpoint="/notes" token={token} owner={owner} fields={{ title: '', body: '', visibility: owner === 'shared' ? 'shared' : 'private' }} onCreated={(row) => setNotes([row, ...notes])} />
      <ListPanel title="Anotacoes" rows={notes.filter((row) => row.owner_type === owner)} render={(row) => `${row.title}: ${row.body}`} />
    </section>
  );
}

function Alerts({ token }) {
  const [rows, setRows] = useState([]);
  const [backups, setBackups] = useState([]);
  useEffect(() => { refresh(token, '/notifications', setRows); refresh(token, '/backups', setBackups); }, [token]);
  async function generate() { setRows(await api(token, '/notifications/generate', { method: 'POST', body: JSON.stringify({ days: 3 }) })); }
  async function backup() { await api(token, '/backups', { method: 'POST' }); refresh(token, '/backups', setBackups); }
  return (
    <section className="grid">
      <div className="panel actions"><button onClick={generate}><Bell size={18} /> Gerar alertas</button><button onClick={backup}><Plus size={18} /> Criar backup</button></div>
      <ListPanel title="Notificacoes" rows={rows} render={(row) => `${row.title} - ${row.message}`} />
      <ListPanel title="Backups" rows={backups} render={(row) => row.filename} />
    </section>
  );
}

function Form({ title, owner, form, setForm, onSubmit, fields }) {
  const visibleFields = owner === 'shared' ? fields.filter((field) => field !== 'visibility') : fields;
  return (
    <form className="panel form" onSubmit={onSubmit}>
      <h2>{title}</h2>
      {visibleFields.map((field) => <Field key={field} field={field} form={form} setForm={setForm} />)}
      <button><Plus size={18} /> Salvar</button>
    </form>
  );
}

function Field({ field, form, setForm }) {
  const value = form[field] ?? '';
  const update = (next) => setForm({ ...form, [field]: next });
  if (field === 'category') return <select value={value} onChange={(e) => update(e.target.value)}>{Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
  if (field === 'priority') return <select value={value} onChange={(e) => update(e.target.value)}>{Object.entries(priorityLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
  if (field === 'visibility') return <select value={value} onChange={(e) => update(e.target.value)}><option value="private">Privado</option><option value="shared">Compartilhado</option><option value="readonly">Somente leitura</option></select>;
  if (field === 'type') return <select value={value} onChange={(e) => update(e.target.value)}><option value="expense">Despesa</option><option value="income">Receita</option></select>;
  if (field === 'recurrence') return <select value={value} onChange={(e) => update(e.target.value)}><option value="none">Sem recorrencia</option><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="yearly">Anual</option></select>;
  if (field === 'body' || field === 'description') return <textarea value={value} onChange={(e) => update(e.target.value)} placeholder={label(field)} />;
  const type = field.includes('date') || field === 'deadline' ? 'date' : field.includes('amount') || field.includes('value') ? 'number' : 'text';
  return <input value={value} type={type} step="0.01" onChange={(e) => update(e.target.value)} placeholder={label(field)} required={field === 'title'} />;
}

function SimpleCreate({ title, endpoint, token, owner, fields, onCreated }) {
  const [form, setForm] = useState(fields);
  async function submit(event) {
    event.preventDefault();
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, key.includes('amount') || key.includes('value') ? Number(value) : value]));
    onCreated(await api(token, endpoint, { method: 'POST', body: JSON.stringify(withVisibility(payload, owner, { owner_type: owner })) }));
  }
  return <Form title={title} owner={owner} form={form} setForm={setForm} onSubmit={submit} fields={Object.keys(fields)} />;
}

function useCrud(token, endpoint) {
  const [rows, setRows] = useState([]);
  useEffect(() => { refresh(token, endpoint, setRows); }, [token, endpoint]);
  return [rows, setRows];
}

function refresh(token, endpoint, setter) {
  return api(token, endpoint).then(setter);
}

function NavButton({ icon, label, active, onClick }) {
  return <button className={active ? 'active' : ''} onClick={onClick}>{React.cloneElement(icon, { size: 18 })}<span>{label}</span></button>;
}

function OwnerTabs({ owner, setOwner }) {
  return <div className="ownerTabs">{Object.entries(ownerLabels).map(([key, label]) => <button key={key} className={owner === key ? 'active' : ''} onClick={() => setOwner(key)}>{label}</button>)}</div>;
}

function Metric({ title, value }) {
  return <div className="metric"><span>{title}</span><strong>{value}</strong></div>;
}

function ListPanel({ title, rows, render }) {
  return <div className="panel"><h2>{title}</h2><List rows={rows} render={render} /></div>;
}

function List({ rows, render = (row) => row.title, empty = 'Nada cadastrado ainda.' }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  return <ul className="list">{rows.map((row) => <li key={row.id}>{render(row)}</li>)}</ul>;
}

function titleFor(view) {
  return { dashboard: 'Resumo', tasks: 'Tarefas', finances: 'Financas', events: 'Calendario', workouts: 'Academia', diet: 'Dieta', goals: 'Metas e desejos', notes: 'Notas', alerts: 'Alertas e backup' }[view];
}

function label(field) {
  return field.replaceAll('_', ' ');
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function groupByDate(rows, field) {
  return rows.reduce((groups, row) => {
    const date = row[field];
    groups[date] = groups[date] || [];
    groups[date].push(row);
    return groups;
  }, {});
}

function formatDate(dateText) {
  return new Date(`${dateText}T00:00:00`).toLocaleDateString('pt-BR');
}

function weekday(dateText) {
  return new Date(`${dateText}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' });
}

function roundMacro(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function sumDiet(rows) {
  return rows.reduce((sum, row) => ({
    carbs: sum.carbs + Number(row.carbs || 0),
    protein: sum.protein + Number(row.protein || 0),
    calories: sum.calories + Number(row.calories || 0)
  }), { carbs: 0, protein: 0, calories: 0 });
}

function foodToForm(current, food) {
  const grams = Number(current.grams || 100);
  return {
    ...current,
    food_name: food.brand ? `${food.name} - ${food.brand}` : food.name,
    carbs: roundMacro(food.carbs_100g * grams / 100),
    protein: roundMacro(food.protein_100g * grams / 100),
    calories: roundMacro(food.calories_100g * grams / 100),
    source: 'openfoodfacts'
  };
}

function withVisibility(form, owner, extras = {}) {
  return {
    ...form,
    ...extras,
    visibility: owner === 'shared' ? 'shared' : form.visibility
  };
}

createRoot(document.getElementById('root')).render(<App />);
