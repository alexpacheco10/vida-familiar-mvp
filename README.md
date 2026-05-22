# Vida Familiar MVP

Sistema web para administrar vida pessoal, vida da esposa e vida do casal. O MVP usa React no front-end, Node.js com Express no back-end, SQLite localmente e PostgreSQL em producao quando `DATABASE_URL` estiver configurada.

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
- Backup manual do banco SQLite local e registro de backup no PostgreSQL em producao.

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

Localmente, o banco fica em `server/data/vida-familiar.sqlite` e e criado automaticamente ao iniciar a API. Em producao, configure `DATABASE_URL` para usar PostgreSQL. As tabelas principais sao:

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

## Publicacao online recomendada

O GitHub Pages hospeda apenas o front-end React. Ele nao executa o back-end Node.js. A melhor opcao para este projeto e manter o front-end no GitHub Pages e hospedar a API no Render com PostgreSQL.

Este repositorio ja possui `render.yaml`, que cria:

- um servico web Node para a API
- um banco PostgreSQL
- as variaveis principais de ambiente

Passos:

1. Acesse Render e crie um novo Blueprint apontando para este repositorio.
2. Aguarde o Render criar o servico `vida-familiar-api` e o banco `vida-familiar-db`.
3. Copie a URL publica da API, por exemplo `https://vida-familiar-api.onrender.com`.
4. No GitHub, va em `Settings > Secrets and variables > Actions > Variables`.
5. Crie a variavel `VITE_API_URL` com o valor:

```bash
https://vida-familiar-api.onrender.com/api
```

6. Rode novamente o workflow `Deploy GitHub Pages` ou faca um novo push.

Depois disso, o login do GitHub Pages passa a usar a API online.

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
- Melhorar rotinas de backup automatico do PostgreSQL no provedor de hospedagem.

## Evolucao para mobile

O caminho mais simples e reaproveitar a API Express e criar um app em React Native com Expo. As telas atuais ja estao separadas por dominios, entao voce pode migrar modulo por modulo: login, dashboard, tarefas, financas, calendario e notas. Para notificacoes reais no celular, use Expo Notifications ou Firebase Cloud Messaging. Para funcionamento offline, adicione armazenamento local no app e sincronizacao com a API quando houver internet.
