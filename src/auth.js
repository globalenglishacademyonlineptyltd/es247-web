import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
const COOKIE = 'es247_session';
function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
  return process.env.JWT_SECRET;
}
export const hashPassword = password => bcrypt.hash(password, 12);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);
export function createAccessToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, companyId: user.company_id ?? null },
    secret(), { expiresIn: '8h', issuer: 'es247', audience: 'es247-web' });
}
export function issueSession(res, user) {
  res.cookie(COOKIE, createAccessToken(user), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000, path: '/'
  });
}
export function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
}
export async function authenticate(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ error: 'Please sign in.' });
    const claims = jwt.verify(token, secret(), { issuer: 'es247', audience: 'es247-web' });
    const result = await pool.query('SELECT id,email,role,company_id,display_name,must_change_password,active FROM users WHERE id=$1', [claims.sub]);
    const user = result.rows[0];
    if (!user || !user.active) { clearSession(res); return res.status(401).json({ error: 'This account is inactive.' }); }
    req.user = user;
    next();
  } catch (err) {
    if (['JsonWebTokenError','TokenExpiredError'].includes(err.name)) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    next(err);
  }
}
export const requireRole = (...roles) => (req,res,next) => roles.includes(req.user?.role)
  ? next() : res.status(403).json({ error: 'You do not have permission to perform this action.' });
export function requirePasswordChanged(req,res,next) {
  if (req.user?.must_change_password && !['/me','/auth/change-password','/auth/logout'].includes(req.path))
    return res.status(403).json({ error: 'Change your temporary password before continuing.', code: 'PASSWORD_CHANGE_REQUIRED' });
  next();
}
