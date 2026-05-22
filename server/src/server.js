import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { initDb } from './db.js';
import { router } from './routes.js';

initDb();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use('/api', router);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
