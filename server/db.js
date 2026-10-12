import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { encryptPassword } from './crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'kurultai.db');
const db = new Database(dbPath);

// Включаем поддержку внешних ключей и WAL-режим для надежности
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Инициализация таблиц
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      encrypted_password TEXT,
      full_name TEXT NOT NULL,
      iin TEXT NOT NULL,
      school_class TEXT NOT NULL,
      faction TEXT NOT NULL,
      role TEXT DEFAULT 'MEMBER',
      status TEXT DEFAULT 'PENDING',
      kpi INTEGER DEFAULT 0,
      serious_violations INTEGER DEFAULT 0,
      phone TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS kpi_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS appeals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kpi_history_id INTEGER,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      admin_comment TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(kpi_history_id) REFERENCES kpi_history(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS kpi_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      points INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'BONUS' or 'PENALTY'
      is_serious BOOLEAN DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Проверяем наличие Супер-Администратора
  const adminEmail = 'atahanqydyr@gmail.com';
  const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);

  if (!existingAdmin) {
    const defaultAdminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'AdminKurultai2026!';
    const passwordHash = bcrypt.hashSync(defaultAdminPassword, 10);
    const encryptedPass = encryptPassword(defaultAdminPassword);

    db.prepare(`
      INSERT INTO users (
        email, password_hash, encrypted_password, full_name, iin, school_class, faction, role, status, kpi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ADMIN', 'APPROVED', 100)
    `).run(
      adminEmail,
      passwordHash,
      encryptedPass,
      'Атахан Қыдыр (Президент Курултая)',
      '000000000000',
      'Администрация',
      'Атқару'
    );
    console.log(`[DB] Создан аккаунт Супер-Администратора: ${adminEmail} с паролем: ${defaultAdminPassword}`);
  }

  // Заполняем правила KPI, если таблица пуста
  const rulesCount = db.prepare('SELECT COUNT(*) as count FROM kpi_rules').get().count;
  if (rulesCount === 0) {
    const insertRule = db.prepare('INSERT INTO kpi_rules (title, points, type, is_serious) VALUES (?, ?, ?, ?)');
    
    // Штрафы из официального документа «Система КПИ Курылтай.docx»
    const defaultRules = [
      // Штрафы
      { title: 'Опоздал на собрание более чем на 10 минут без предупреждения', points: -2, type: 'PENALTY', is_serious: 0 },
      { title: 'Выполнил работу с существенными ошибками, требующими переделки', points: -3, type: 'PENALTY', is_serious: 0 },
      { title: 'Пропустил собрание без уважительной причины и предупреждения', points: -5, type: 'PENALTY', is_serious: 0 },
      { title: 'Самовольно покинул обязательное мероприятие', points: -5, type: 'PENALTY', is_serious: 0 },
      { title: 'Проявил неуважение к члену парламента', points: -10, type: 'PENALTY', is_serious: 1 },
      { title: 'Оскорбил участника парламента', points: -10, type: 'PENALTY', is_serious: 1 },
      { title: 'Сорвал заседание или мероприятие', points: -10, type: 'PENALTY', is_serious: 1 },
      { title: 'Распространил заведомо ложную информацию о работе парламента', points: -10, type: 'PENALTY', is_serious: 1 },
      { title: 'Не выполнил поручение без объяснения причин', points: -10, type: 'PENALTY', is_serious: 0 },
      { title: 'Сорвал дедлайн и не предупредил заранее', points: -10, type: 'PENALTY', is_serious: 0 },
      { title: 'Подрыв доверия', points: -10, type: 'PENALTY', is_serious: 1 },
      { title: 'Публикация материалов от имени школы/Курултая без согласования с Президентом', points: -15, type: 'PENALTY', is_serious: 1 },
      { title: 'Неоднократно игнорировал поручения', points: -15, type: 'PENALTY', is_serious: 1 },
      { title: 'Проявил неуважение к президенту школы', points: -20, type: 'PENALTY', is_serious: 1 },
      { title: 'Проявил неуважение к администрации или работникам школы', points: -20, type: 'PENALTY', is_serious: 1 },
      { title: 'Злоупотребление должностными полномочиями', points: -20, type: 'PENALTY', is_serious: 1 },

      // Поощрения
      { title: 'Помог другому участнику завершить задание', points: 2, type: 'BONUS', is_serious: 0 },
      { title: 'Взял на себя дополнительную ответственность', points: 2, type: 'BONUS', is_serious: 0 },
      { title: 'Посетил внеплановое необязательное заседание', points: 3, type: 'BONUS', is_serious: 0 },
      { title: 'Проявил уважительное и конструктивное отношение при споре', points: 3, type: 'BONUS', is_serious: 0 },
      { title: 'Подготовил качественный отчёт или документацию', points: 3, type: 'BONUS', is_serious: 0 },
      { title: 'Посетил мероприятие парламента в выходной день', points: 5, type: 'BONUS', is_serious: 0 },
      { title: 'Помог разрешить конфликт между участниками', points: 5, type: 'BONUS', is_serious: 0 },
      { title: 'Предложил решение существующей проблемы школы', points: 5, type: 'BONUS', is_serious: 0 },
      { title: 'Выполнил сложное или объёмное поручение', points: 5, type: 'BONUS', is_serious: 0 },
      { title: 'Проявление высокой инициативности и лояльности', points: 5, type: 'BONUS', is_serious: 0 },
      { title: 'Предложил инициативу, одобренную президентом', points: 10, type: 'BONUS', is_serious: 0 },
      { title: 'Предложил инициативу, успешно принятую к реализации', points: 15, type: 'BONUS', is_serious: 0 },
    ];

    const insertMany = db.transaction((rules) => {
      for (const r of rules) {
        insertRule.run(r.title, r.points, r.type, r.is_serious);
      }
    });
    insertMany(defaultRules);
    console.log(`[DB] Загружено ${defaultRules.length} регламентных правил KPI.`);
  }
}

export default db;
