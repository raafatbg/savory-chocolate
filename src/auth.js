import crypto from 'node:crypto';
import { db } from './db.js';

const SESSION_COOKIE = 'sc_admin';
const SESSION_DAYS = 7;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export function adminCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
}

export function createSession(res, adminId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token, admin_id, expires_at) VALUES (?, ?, ?)').run(token, adminId, expires);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function destroySession(req, res) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(SESSION_COOKIE);
}

export function currentAdmin(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  return db.prepare(`
    SELECT a.id, a.username FROM sessions s JOIN admins a ON a.id = s.admin_id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, Date.now()) ?? null;
}

export function requireAdmin(req, res, next) {
  const admin = currentAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Please log in.' });
  req.admin = admin;
  next();
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

// Slows down password guessing: 10 failed attempts per IP per 15 minutes.
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;

export function loginBlocked(ip) {
  const entry = failures.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) return false;
  return entry.count >= 10;
}

export function recordLoginFailure(ip) {
  const entry = failures.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(ip, { first: Date.now(), count: 1 });
  else entry.count++;
}

export function clearLoginFailures(ip) {
  failures.delete(ip);
}
