import bcrypt from 'bcryptjs';
import db from './db.js';
import { encryptPassword } from './crypto.js';

export function seedDemoData() {
  const count = db.prepare('SELECT COUNT(*) as count FROM users WHERE email != ?').get('atahanqydyr@gmail.com').count;
  if (count > 0) return; // Уже есть данные

  console.log('[SEED] Заполнение демонстрационными участниками Курултая...');

  const demoUsers = [
    {
      full_name: 'Нұрлан Әлішер Ерболұлы',
      email: 'alisher.n@school.kz',
      iin: '080315501234',
      school_class: '11 «А»',
      faction: 'Атқару',
      role: 'MODERATOR',
      status: 'APPROVED',
      kpi: 45,
      password: 'User123!',
      phone: '+7 777 123 4567'
    },
    {
      full_name: 'Серік Дарина Бауыржанқызы',
      email: 'darina.s@school.kz',
      iin: '090120601987',
      school_class: '10 «Б»',
      faction: 'Мәдениет',
      role: 'MODERATOR',
      status: 'APPROVED',
      kpi: 70,
      password: 'User123!',
      phone: '+7 778 234 5678'
    },
    {
      full_name: 'Омаров Санжар Қанатұлы',
      email: 'sanzhar.o@school.kz',
      iin: '081105502345',
      school_class: '11 «В»',
      faction: 'Білімпаз',
      role: 'MEMBER',
      status: 'APPROVED',
      kpi: 100, // Претендент на сертификат!
      password: 'User123!',
      phone: '+7 771 345 6789'
    },
    {
      full_name: 'Жұмағали Диас Айдарұлы',
      email: 'dias.zh@school.kz',
      iin: '091225504567',
      school_class: '9 «А»',
      faction: 'Эко қоғам',
      role: 'MEMBER',
      status: 'APPROVED',
      kpi: 25,
      password: 'User123!',
      phone: '+7 775 567 8901'
    },
    {
      full_name: 'Тұрсынов Бекзат Саматұлы',
      email: 'bekzat.t@school.kz',
      iin: '080718505678',
      school_class: '11 «Б»',
      faction: 'Салауат',
      role: 'MEMBER',
      status: 'APPROVED',
      kpi: -15,
      password: 'User123!',
      phone: '+7 707 678 9012'
    },
    {
      full_name: 'Ибраев Мансур Темірланұлы',
      email: 'mansur.i@school.kz',
      iin: '090909506789',
      school_class: '10 «В»',
      faction: 'Азаматтық',
      role: 'MEMBER',
      status: 'PENDING', // Ожидает модерации
      kpi: 0,
      password: 'User123!',
      phone: '+7 747 789 0123'
    }
  ];

  const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('atahanqydyr@gmail.com');
  const adminId = admin ? admin.id : 1;

  for (const u of demoUsers) {
    const pHash = bcrypt.hashSync(u.password, 10);
    const encPass = encryptPassword(u.password);
    const info = db.prepare(`
      INSERT INTO users (
        email, password_hash, encrypted_password, full_name, iin, school_class, faction, role, status, kpi, phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      u.email, pHash, encPass, u.full_name, u.iin, u.school_class, u.faction, u.role, u.status, u.kpi, u.phone
    );

    if (u.kpi !== 0) {
      db.prepare(`
        INSERT INTO kpi_history (user_id, points, reason, created_by)
        VALUES (?, ?, ?, ?)
      `).run(
        info.lastInsertRowid,
        u.kpi,
        u.kpi > 0 ? 'Стартовые баллы за активное участие в проектах фракции' : 'Штраф за пропуск обязательных заседаний',
        adminId
      );
    }
  }

  const annCount = db.prepare('SELECT COUNT(*) as count FROM announcements').get().count;
  if (annCount === 0) {
    db.prepare(`
      INSERT INTO announcements (title, content, author_id)
      VALUES (?, ?, ?)
    `).run(
      'Старт работы Школьного Курултая Школы-гимназии №32',
      'Приветствуем всех делегатов и руководителей фракций! С 1-го числа каждого месяца распоряжением Президента школы утверждается сводная таблица KPI. Просьба руководителям фракций сдать планы работы на текущий месяц.',
      adminId
    );
  }

  console.log('[SEED] Успешно добавлено 7 участников и стартовое объявление!');
}
