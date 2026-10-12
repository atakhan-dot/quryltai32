import * as XLSX from 'xlsx';
import db from './db.js';

/**
 * Генерирует буфер Excel для полного отчета Министерству
 */
export function generateMinistryReportBuffer() {
  const users = db.prepare(`
    SELECT 
      id, full_name, iin, school_class, faction, role, kpi, serious_violations, email, phone, status, created_at
    FROM users 
    WHERE status = 'APPROVED'
    ORDER BY faction ASC, full_name ASC
  `).all();

  const data = users.map((u, index) => ({
    '№': index + 1,
    'ФИО Учащегося': u.full_name,
    'ИИН': u.iin,
    'Класс': u.school_class,
    'Министерство': u.faction,
    'Должность': u.role === 'ADMIN' ? 'Президент Курултая' : u.role === 'MODERATOR' ? 'Министр' : 'Член Парламента',
    'Балл KPI': u.kpi,
    'Грубых нарушений': u.serious_violations,
    'Email': u.email,
    'Телефон': u.phone || '—',
    'Статус': u.kpi >= 100 ? 'Претендент на сертификат (+100)' : u.kpi <= -100 ? 'Подлежит исключению (-100)' : 'Действующий член'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Настройка ширины колонок
  worksheet['!cols'] = [
    { wch: 5 },  // №
    { wch: 30 }, // ФИО
    { wch: 15 }, // ИИН
    { wch: 10 }, // Класс
    { wch: 22 }, // Фракция
    { wch: 22 }, // Должность
    { wch: 12 }, // KPI
    { wch: 18 }, // Нарушений
    { wch: 25 }, // Email
    { wch: 15 }, // Телефон
    { wch: 30 }  // Статус
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Школа-гимназия №32');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Генерирует буфер Excel с сокращенной ведомостью KPI (только ФИО и КПИ)
 */
export function generateKpiSummaryReportBuffer() {
  const users = db.prepare(`
    SELECT full_name, kpi
    FROM users 
    WHERE status = 'APPROVED'
    ORDER BY kpi DESC, full_name ASC
  `).all();

  const data = users.map((u, index) => ({
    '№': index + 1,
    'ФИО': u.full_name,
    'Балл KPI': u.kpi
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 35 },
    { wch: 15 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Сводная ведомость KPI');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
