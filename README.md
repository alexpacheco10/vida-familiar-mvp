# Vida Familiar MVP

Sistema web para administrar vida pessoal, vida da esposa e vida do casal. O MVP usa React no front-end, Node.js com Express no back-end e SQLite local.

## Funcionalidades

- Login separado para duas contas iniciais.
- Areas: Minha Vida, Vida da Esposa e Vida do Casal.
- Tarefas com categoria, prioridade, prazo, status, recorrencia e filtros.
- Dashboard com resumo do dia, semana, mes e saldo.
- Calendario simples de compromissos.
- Controle financeiro com receitas, despesas, saldo e grafico por categoria.
- Aba Academia para registrar exercicios diarios com series, repeticoes e peso.
- Aba Dieta para buscar automaticamente alimentos na Open Food Facts Brasil e registrar quantidade, gramas, carboidratos, proteinas e calorias.
- Metas financeiras, metas gerais, desejos de consumo e anotacoes.
- Visibilidade por item: privado, compartilhado ou somente leitura.
- Notificacoes simples para tarefas proximas do vencimento.
- Backup manual do banco SQLite.

## Estrutura

```text
.
├── client/              # React + Vite
│   └── src/
│       ├── main.jsx
│       └── styles.css
├── server/              # Express + SQLite
│   └── src/
│       ├── auth.js
│       ├── db.js
│       ├── repositories.js
│       ├── routes.js
│       └── server.js
└── README.md
```

## Banco de dados

O banco fica em `server/data/vida-familiar.sqlite` e e criado automaticamente ao iniciar a API. As tabelas principais sao:

- `users`
- `profiles`
- `tasks`
- `recurring_tasks`
- `finances`
- `financial_goals`
- `goals`
- `wishlists`
- `notes`
- `events`
- `workouts`
- `diet_entries`
- `notifications`
- `shared_items`
- `backups`

Todos os registros principais possuem `owner_type`, `visibility`, `created_at` e `updated_at`.

## Como rodar localmente

Requisitos:

- Node.js 24 ou superior.
- npm.

Instale as dependencias:

```bash
npm.cmd install
npm.cmd --prefix server install
npm.cmd --prefix client install
```

Crie o arquivo de ambiente:

```bash
copy server\.env.example server\.env
```

Rode a API:

```bash
npm.cmd --prefix server run dev
```

Em outro terminal, rode o front-end:

```bash
npm.cmd --prefix client run dev
```

Acesse:

- Front-end: `http://localhost:5173`
- API: `http://localhost:4000`

## Publicacao online

O GitHub Pages hospeda apenas o front-end React. Ele nao executa o back-end Node.js nem o banco SQLite. Por isso, no link do GitHub Pages o login so funcionara depois que a API estiver hospedada em outro servico.

Opcoes simples para hospedar a API:

- Render
- Railway
- Fly.io
- VPS propria

Depois de hospedar a API, configure o front-end com a variavel:

```bash
VITE_API_URL=https://sua-api-online.com/api
```

Em seguida gere um novo build e publique novamente no GitHub Pages.

Contas iniciais:

- `eu@example.com` / `123456`
- `esposa@example.com` / `123456`

## Rotas principais da API

- `POST /api/auth/login`
- `GET /api/dashboard/summary`
- `GET|POST /api/tasks`
- `PUT|DELETE /api/tasks/:id`
- `PATCH /api/tasks/:id/toggle`
- `POST /api/recurring_tasks/run`
- `GET|POST /api/finances`
- `GET|POST /api/financial_goals`
- `GET|POST /api/goals`
- `GET|POST /api/wishlists`
- `GET|POST /api/notes`
- `GET|POST /api/events`
- `GET|POST /api/workouts`
- `GET|POST /api/diet_entries`
- `GET /api/foods/search?q=arroz`
- `GET /api/notifications`
- `POST /api/notifications/generate`
- `POST /api/backups`

## Melhorias futuras

- Criar tela de edicao completa para todos os registros.
- Gerar tarefas futuras automaticamente a partir de `recurring_tasks`.
- Adicionar notificacoes por e-mail, push ou WhatsApp.
- Criar permissoes mais granulares por usuario em `shared_items`.
- Adicionar anexos, etiquetas e busca global.
- Criar importacao/exportacao em CSV ou Excel.
- Adicionar testes automatizados da API e componentes.
- Trocar SQLite por PostgreSQL quando houver uso multiusuario intenso.

## Evolucao para mobile

O caminho mais simples e reaproveitar a API Express e criar um app em React Native com Expo. As telas atuais ja estao separadas por dominios, entao voce pode migrar modulo por modulo: login, dashboard, tarefas, financas, calendario e notas. Para notificacoes reais no celular, use Expo Notifications ou Firebase Cloud Messaging. Para funcionamento offline, adicione armazenamento local no app e sincronizacao com a API quando houver internet.
