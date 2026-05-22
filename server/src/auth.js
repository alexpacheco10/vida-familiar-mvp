import jwt from 'jsonwebtoken';
import { db } from './db.js';

const secret = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, { expiresIn: '7d' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login necessario.' });

  try {
    const payload = jwt.verify(token, secret);
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Usuario nao encontrado.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Sessao invalida.' });
  }
}
