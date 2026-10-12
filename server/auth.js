import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'kurultai-jwt-school-token-secret-2026';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      full_name: user.full_name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Получаем актуального пользователя из БД
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Недействительный или истекший токен' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user && (req.user.role === 'ADMIN' || req.user.email === 'atahanqydyr@gmail.com')) {
    return next();
  }
  return res.status(403).json({ error: 'Доступ разрешен только Главному Администратору' });
}

export function requireModeratorOrAdmin(req, res, next) {
  if (req.user && (req.user.role === 'ADMIN' || req.user.role === 'MODERATOR' || req.user.email === 'atahanqydyr@gmail.com')) {
    return next();
  }
  return res.status(403).json({ error: 'Доступ разрешен только Администраторам и Модераторам' });
}

/**
 * Проверка пароля Администратора при доступе к секретным данным
 */
export function verifyAdminPassword(adminId, passwordToVerify) {
  const admin = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(adminId);
  if (!admin) return false;
  return bcrypt.compareSync(passwordToVerify, admin.password_hash);
}
