import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db, { initDb } from './db.js';
import { seedDemoData } from './seed.js';
import { encryptPassword, decryptPassword } from './crypto.js';
import {
  generateToken,
  authenticate,
  requireAdmin,
  requireModeratorOrAdmin,
  verifyAdminPassword
} from './auth.js';
import {
  generateMinistryReportBuffer,
  generateKpiSummaryReportBuffer
} from './export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Инициализируем БД
initDb();
seedDemoData();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// -------------------------------------------------------------
// ПУБЛИЧНЫЕ МАРШРУТЫ
// -------------------------------------------------------------

function getMinistriesData() {
  const factions = [
    {
      id: 'atqaru',
      name: '«Атқару»',
      rawName: 'Атқару',
      role: 'Управление исполнительными процессами',
      role_kz: 'Атқарушылық үдерістерді басқару',
      color: 'from-blue-600 to-indigo-700',
      badgeColor: 'bg-blue-100 text-blue-800',
      description: 'Управляет ключевыми исполнительными процессами школьного парламента, контролирует планы и организует общешкольные события.',
      description_kz: 'Мектеп парламентінің негізгі атқарушылық үдерістерін басқарады, жоспарларды қадағалайды және жалпымектептік шараларды ұйымдастырады.',
      duties: [
        'Подготовка ежемесячных отчётов и сводок для руководства',
        'Контроль выполнения утверждённых планов для министерств',
        'Инициирование и реализация масштабных школьных проектов',
        'Организация и проведение Единых дней Массовых действий',
        'Координация межведомственного взаимодействия'
      ],
      duties_kz: [
        'Басшылық үшін ай сайынғы есептер мен жиынтықтар дайындау',
        'Министрліктер үшін бекітілген жоспарлардың орындалуын бақылау',
        'Ауқымды мектеп жобаларын бастамалау және іске асыру',
        'Бұқаралық іс-қимылдардың Бірыңғай күндерін өткізу',
        'Ведомствоаралық өзара іс-қимылды үйлестіру'
      ]
    },
    {
      id: 'azamattyq',
      name: '«Азаматтық»',
      rawName: 'Азаматтық',
      role: 'Гражданские и общественные инициативы',
      role_kz: 'Азаматтық және қоғамдық бастамалар',
      color: 'from-amber-500 to-yellow-600',
      badgeColor: 'bg-amber-100 text-amber-800',
      description: 'Занимается патриотическим воспитанием, волонтёрством, правопорядком и решением социальных вопросов школы.',
      description_kz: 'Патриоттық тәрбие, еріктілер (волонтерлік) қозғалысы, құқықтық тәртіп және мектептің әлеуметтік мәселелерімен айналысады.',
      duties: [
        'Организация и координация волонтёрских акций',
        'Проведение патриотических и гражданско-просветительских мероприятий',
        'Взаимодействие с общественными организациями города',
        'Поддержка инициатив по школьному правопорядку и дисциплине',
        'Развитие культуры взаимоуважения и координация благотворительности'
      ],
      duties_kz: [
        'Волонтерлік акцияларды ұйымдастыру және үйлестіру',
        'Патриоттық және азаматтық-ағартушылық іс-шараларды өткізу',
        'Қаланың қоғамдық ұйымдарымен өзара іс-қимыл жасау',
        'Мектептегі тәртіп пен тәртіпті сақтау бастамаларын қолдау',
        'Өзара сыйластық мәдениетін дамыту және қайырымдылықты үйлестіру'
      ]
    },
    {
      id: 'bilimpaz',
      name: '«Білімпаз»',
      rawName: 'Білімпаз',
      role: 'Образование и интеллектуальное развитие',
      role_kz: 'Білім және зияткерлік даму',
      color: 'from-emerald-600 to-teal-700',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      description: 'Отвечает за развитие академической среды, проведение олимпиад, дебатов и профориентационную работу.',
      description_kz: 'Академиялық ортаны дамытуға, олимпиадалар, дебаттар өткізуге және кәсіптік бағдар беруге жауап береді.',
      duties: [
        'Организация интеллектуальных турниров, викторин и дебатов',
        'Профориентационные встречи со специалистами и выпускниками',
        'Поддержка научных и исследовательских проектов учащихся',
        'Сбор предложений по улучшению школьной учебной среды',
        'Популяризация чтения, самообразования и научных клубов'
      ],
      duties_kz: [
        'Зияткерлік турнирлер, викториналар мен пікірсайыстар ұйымдастыру',
        'Мамандармен және түлектермен кәсіптік бағдар беру кездесулері',
        'Оқушылардың ғылыми және зерттеу жобаларын қолдау',
        'Мектептің оқу ортасын жақсарту бойынша ұсыныстар жинау',
        'Кітап оқуды, өздігінен білім алуды және ғылыми үйірмелерді дәріптеу'
      ]
    },
    {
      id: 'madeniyet',
      name: '«Мәдениет»',
      rawName: 'Мәдениет',
      role: 'Творчество и культурная жизнь',
      role_kz: 'Шығармашылық және мәдени өмір',
      color: 'from-purple-600 to-pink-600',
      badgeColor: 'bg-purple-100 text-purple-800',
      description: 'Создает творческую атмосферу, организует праздники, выставки, фестивали и концерты школы.',
      description_kz: 'Шығармашылық атмосфера қалыптастырады, мектеп мерекелерін, көрмелерді, фестивальдер мен концерттерді ұйымдастырады.',
      duties: [
        'Организация школьных фестивалей, концертов и конкурсов талантов',
        'Разработка оригинальных сценариев мероприятий и координация репетиций',
        'Поддержка школьных творческих коллективов, хора, театра',
        'Организация художественных выставок и кинолекториев',
        'Оформление школьных культурно-досуговых зон'
      ],
      duties_kz: [
        'Мектеп фестивальдерін, концерттер мен дарындар байқауларын өткізу',
        'Іс-шаралардың сценарийлерін әзірлеу және дайындықтарды үйлестіру',
        'Мектептің шығармашылық ұжымдарын, хор мен театрды қолдау',
        'Көркемөнер көрмелері мен кинодәрістер ұйымдастыру',
        'Мектептің мәдени-демалыс аймақтарын безендіру'
      ]
    },
    {
      id: 'aqparat',
      name: '«Ақпарат медиа»',
      rawName: 'Ақпарат медиа',
      role: 'Информация и публичное освещение',
      role_kz: 'Ақпарат және қоғаммен байланыс',
      color: 'from-cyan-600 to-blue-500',
      badgeColor: 'bg-cyan-100 text-cyan-800',
      description: 'Официальный голос Курултая: фото/видео, социальные сети, дизайн афиш и взаимодействие со СМИ.',
      description_kz: 'Құрылтайдың ресми үні: фото/бейне, әлеуметтік желілер, афиша дизайны және бұқаралық ақпарат құралдарымен байланыс.',
      duties: [
        'Качественная фото- и видеосъёмка всех школьных событий',
        'Создание ярких афиш, постеров и инфографики',
        'Разработка контент-плана и ведение страниц Курултая',
        'Интервью с участниками, учителями и гостями',
        'Согласование публикаций с Президентом школы'
      ],
      duties_kz: [
        'Барлық мектеп оқиғаларын сапалы фото- және бейнетүсірілім жасау',
        'Тартымды афишалар, постерлер мен инфографикалар әзірлеу',
        'Контент-жоспар құру және Құрылтай парақшаларын жүргізу',
        'Қатысушылармен, мұғалімдермен және қонақтармен сұхбат алу',
        'Жарияланымдарды мектеп Президентімен келісу'
      ]
    },
    {
      id: 'eko',
      name: '«Эко қоғам»',
      rawName: 'Эко қоғам',
      role: 'Экология и устойчивое развитие',
      role_kz: 'Экология және тұрақты даму',
      color: 'from-green-600 to-emerald-700',
      badgeColor: 'bg-green-100 text-green-800',
      description: 'Курирует эко-проекты, озеленение школы и участие в национальной программе «Таза Қазақстан».',
      description_kz: 'Эко-жобаларды, мектепті көгалдандыруды және ұлттық «Таза Қазақстан» бағдарламасына қатысуды қадағалайды.',
      duties: [
        'Организация экологических субботников и акций раздельного сбора',
        'Участие в республиканских проектах «Таза Қазақстан»',
        'Озеленение кабинетов и уход за школьной территорией',
        'Просветительские экологические уроки и конкурсы',
        'Контроль за энергосбережением и бережным отношением к ресурсам'
      ],
      duties_kz: [
        'Экологиялық сенбіліктер мен бөлек қоқыс жинау акцияларын ұйымдастыру',
        '«Таза Қазақстан» республикалық жобаларына қатысу',
        'Кабинеттерді көгалдандыру және мектеп ауласын күтіп-ұстау',
        'Ағартушылық экологиялық сабақтар мен байқаулар өткізу',
        'Энергия үнемдеу мен ресурстарды ұқыпты пайдалануды қадағалау'
      ]
    },
    {
      id: 'salauat',
      name: '«Салауат»',
      rawName: 'Салауат',
      role: 'Здоровье и спорт',
      role_kz: 'Денсаулық және спорт',
      color: 'from-rose-600 to-orange-600',
      badgeColor: 'bg-rose-100 text-rose-800',
      description: 'Пропагандирует здоровый образ жизни, развивает спортивные секции и организует спартакиады.',
      description_kz: 'Салауатты өмір салтын насихаттайды, спорттық секцияларды дамытады және спартакиадалар өткізеді.',
      duties: [
        'Организация спортивных турниров, эстафет и дней здоровья',
        'Информационные кампании по профилактике вредных привычек',
        'Взаимодействие с учителями физкультуры и медпунктом',
        'Организация динамических пауз и гимнастики',
        'Популяризация активного досуга среди учащихся всех классов'
      ],
      duties_kz: [
        'Спорттық турнирлер, эстафеталар мен денсаулық күндерін ұйымдастыру',
        'Зиянды әдеттердің алдын алу бойынша ақпараттық науқандар жүргізу',
        'Дене шынықтыру мұғалімдерімен және медициналық бекетпен байланысу',
        'Сергіту жаттығулары мен динамикалық үзілістерді ұйымдастыру',
        'Оқушылар арасында белсенді демалысты дәріптеу'
      ]
    }
  ];

  const allApproved = db.prepare(`
    SELECT id, full_name, school_class, faction, role, kpi 
    FROM users 
    WHERE status = 'APPROVED'
    ORDER BY full_name ASC
  `).all();

  return factions.map(f => {
    const raw = f.rawName;
    const minister = allApproved.find(u => (u.faction === raw || u.faction === f.name) && u.role === 'MODERATOR');
    const members = allApproved.filter(u => u.faction === raw || u.faction === f.name);
    return {
      ...f,
      minister: minister || null,
      members_count: members.length,
      members: members,
      all_candidates: allApproved
    };
  });
}

// Список всех министерств / фракций с информацией о министрах
app.get('/api/public/factions', (req, res) => {
  res.json(getMinistriesData());
});

app.get('/api/public/ministries', (req, res) => {
  res.json(getMinistriesData());
});

// Список официальных критериев KPI (сначала плюсы от большего к меньшему, затем минусы от малого штрафа к большому)
app.get('/api/public/kpi-rules', (req, res) => {
  const rules = db.prepare(`
    SELECT * FROM kpi_rules 
    ORDER BY 
      CASE WHEN points > 0 THEN 0 ELSE 1 END,
      points DESC
  `).all();
  res.json(rules);
});

// Публичный рейтинг участников (только одобренные)
app.get('/api/public/leaderboard', (req, res) => {
  const leaderboard = db.prepare(`
    SELECT 
      id, full_name, faction, school_class, kpi, role, serious_violations
    FROM users 
    WHERE status = 'APPROVED'
    ORDER BY kpi DESC, full_name ASC
  `).all();
  res.json(leaderboard);
});

// Публичный профиль и официальное удостоверение (Мандат)
app.get('/api/public/users/:id/profile', (req, res) => {
  const { id } = req.params;
  const user = db.prepare(`
    SELECT id, full_name, faction, school_class, role, status, kpi, serious_violations, created_at
    FROM users
    WHERE id = ? AND status = 'APPROVED'
  `).get(id);

  if (!user) {
    return res.status(404).json({ error: 'Профиль участника не найден или еще не одобрен' });
  }

  const history = db.prepare(`
    SELECT points, reason, created_at FROM kpi_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 6
  `).all(id);

  const mandateNumber = `KZ-32-KRT-${String(user.id).padStart(4, '0')}`;

  res.json({
    ...user,
    school_name: 'Школа-гимназия №32',
    mandate_number: mandateNumber,
    recent_history: history
  });
});

// Список объявлений и распоряжений Президента Курултая и руководства
app.get('/api/public/announcements', (req, res) => {
  const list = db.prepare(`
    SELECT a.*, u.full_name as author_name, u.role as author_role, u.faction as author_faction
    FROM announcements a
    JOIN users u ON a.author_id = u.id
    ORDER BY a.created_at DESC
    LIMIT 10
  `).all();
  res.json(list);
});

// Создание объявления (Президент Курултая или Министры/Модераторы)
app.post('/api/admin/announcements', authenticate, requireModeratorOrAdmin, (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Заполните заголовок и текст объявления' });
  }

  db.prepare(`
    INSERT INTO announcements (title, content, author_id)
    VALUES (?, ?, ?)
  `).run(title.trim(), content.trim(), req.user.id);

  res.json({ message: 'Объявление успешно опубликовано' });
});

// Удаление объявления (Президент или автор-Модератор)
app.delete('/api/admin/announcements/:id', authenticate, requireModeratorOrAdmin, (req, res) => {
  const { id } = req.params;
  const item = db.prepare('SELECT author_id FROM announcements WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json({ error: 'Объявление не найдено' });
  }

  const isSuperAdmin = req.user.role === 'ADMIN' || req.user.email === 'atahanqydyr@gmail.com';
  if (!isSuperAdmin && item.author_id !== req.user.id) {
    return res.status(403).json({ error: 'Вы можете удалять только свои объявления' });
  }

  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
  res.json({ message: 'Объявление удалено' });
});

// -------------------------------------------------------------
// АУТЕНТИФИКАЦИЯ
// -------------------------------------------------------------

// Регистрация нового члена
app.post('/api/auth/register', (req, res) => {
  const { full_name, email, iin, school_class, faction, password, phone } = req.body;

  if (!full_name || !email || !iin || !school_class || !faction || !password) {
    return res.status(400).json({ error: 'Пожалуйста, заполните все обязательные поля' });
  }

  // Валидация ИИН: ровно 12 цифр
  const cleanIin = String(iin).trim();
  if (!/^\d{12}$/.test(cleanIin)) {
    return res.status(400).json({ error: 'ИИН должен состоять ровно из 12 цифр' });
  }

  // Проверка уникальности email
  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existingEmail) {
    return res.status(400).json({ error: 'Пользователь с таким email уже зарегистрирован' });
  }

  // Проверка уникальности ИИН
  const existingIin = db.prepare('SELECT id FROM users WHERE iin = ?').get(cleanIin);
  if (existingIin) {
    return res.status(400).json({ error: 'Пользователь с таким ИИН уже зарегистрирован' });
  }

  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    // Шифруем пароль алгоритмом AES-256-GCM в защищенное хранилище
    const encryptedPass = encryptPassword(password);

    db.prepare(`
      INSERT INTO users (
        email, password_hash, encrypted_password, full_name, iin, school_class, faction, role, status, phone, kpi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'MEMBER', 'PENDING', ?, 0)
    `).run(
      email.trim().toLowerCase(),
      passwordHash,
      encryptedPass,
      full_name.trim(),
      cleanIin,
      school_class.trim(),
      faction.trim(),
      phone ? phone.trim() : ''
    );

    res.json({
      message: 'Заявка на регистрацию успешно подана! Ваш аккаунт ожидает подтверждения Администратором.'
    });
  } catch (error) {
    console.error('Ошибка при регистрации:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера при регистрации' });
  }
});

// Авторизация
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  if (user.status === 'PENDING') {
    return res.status(403).json({
      error: 'Ваш аккаунт находится на модерации. Администратор скоро подтвердит доступ.'
    });
  }

  if (user.status === 'REJECTED') {
    return res.status(403).json({
      error: 'Ваша заявка на регистрацию была отклонена Администратором.'
    });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      iin: user.iin,
      school_class: user.school_class,
      faction: user.faction,
      role: user.role,
      status: user.status,
      kpi: user.kpi,
      serious_violations: user.serious_violations
    }
  });
});

// Текущий профиль
app.get('/api/auth/me', authenticate, (req, res) => {
  const { password_hash, encrypted_password, ...safeUser } = req.user;
  res.json(safeUser);
});

// -------------------------------------------------------------
// ЛИЧНЫЙ КАБИНЕТ УЧАСТНИКА
// -------------------------------------------------------------

// История начислений KPI пользователя
app.get('/api/member/kpi-history', authenticate, (req, res) => {
  const history = db.prepare(`
    SELECT 
      h.id, h.points, h.reason, h.created_at, u.full_name as author_name
    FROM kpi_history h
    JOIN users u ON h.created_by = u.id
    WHERE h.user_id = ?
    ORDER BY h.created_at DESC
  `).all(req.user.id);

  res.json(history);
});

// Подача апелляции на начисление штрафа (в течение 3 дней по регламенту)
app.post('/api/member/appeals', authenticate, (req, res) => {
  const { kpi_history_id, reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Укажите письменное обоснование для апелляции' });
  }

  db.prepare(`
    INSERT INTO appeals (user_id, kpi_history_id, reason, status)
    VALUES (?, ?, ?, 'PENDING')
  `).run(req.user.id, kpi_history_id || null, reason.trim());

  res.json({ message: 'Апелляция успешно направлена в Аппарат Президента' });
});

// Список апелляций текущего пользователя
app.get('/api/member/appeals', authenticate, (req, res) => {
  const appeals = db.prepare(`
    SELECT a.*, h.reason as kpi_reason, h.points as kpi_points
    FROM appeals a
    LEFT JOIN kpi_history h ON a.kpi_history_id = h.id
    WHERE a.user_id = ?
    ORDER BY a.created_at DESC
  `).all(req.user.id);

  res.json(appeals);
});

// -------------------------------------------------------------
// ПАНЕЛЬ АДМИНИСТРАТОРА
// -------------------------------------------------------------

// Сводная статистика для дашборда
app.get('/api/admin/stats', authenticate, requireModeratorOrAdmin, (req, res) => {
  const totalMembers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'APPROVED'").get().count;
  const pendingCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'PENDING'").get().count;
  const avgKpi = db.prepare("SELECT ROUND(AVG(kpi), 1) as avg FROM users WHERE status = 'APPROVED'").get().avg || 0;
  const riskCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'APPROVED' AND (kpi <= -100 OR serious_violations >= 3)").get().count;
  const certificateCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'APPROVED' AND kpi >= 100").get().count;
  const pendingAppeals = db.prepare("SELECT COUNT(*) as count FROM appeals WHERE status = 'PENDING'").get().count;

  res.json({
    totalMembers,
    pendingCount,
    avgKpi,
    riskCount,
    certificateCount,
    pendingAppeals
  });
});

// Список всех пользователей
app.get('/api/admin/users', authenticate, requireModeratorOrAdmin, (req, res) => {
  const isSuperAdmin = req.user.role === 'ADMIN' || req.user.email === 'atahanqydyr@gmail.com';

  const users = db.prepare(`
    SELECT 
      id, email, full_name, iin, school_class, faction, role, status, kpi, serious_violations, phone, created_at
    FROM users
    ORDER BY status DESC, full_name ASC
  `).all();

  // Модераторам маскируем часть ИИН в целях приватности
  const sanitized = users.map(u => {
    if (!isSuperAdmin && u.iin) {
      return {
        ...u,
        iin: u.iin.slice(0, 4) + '****' + u.iin.slice(8)
      };
    }
    return u;
  });

  res.json(sanitized);
});

// Подтверждение или отклонение заявки
app.post('/api/admin/users/:id/status', authenticate, requireModeratorOrAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус' });
  }

  db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
  res.json({ message: `Статус пользователя изменен на ${status}` });
});

// Назначение роли Модератора (только Главный Админ)
app.post('/api/admin/users/:id/role', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['ADMIN', 'MODERATOR', 'MEMBER'].includes(role)) {
    return res.status(400).json({ error: 'Недопустимая роль' });
  }

  // Защита от случайного снятия роли у главного аккаунта
  const targetUser = db.prepare('SELECT email FROM users WHERE id = ?').get(id);
  if (targetUser && targetUser.email === 'atahanqydyr@gmail.com' && role !== 'ADMIN') {
    return res.status(400).json({ error: 'Нельзя изменить роль главного администратора' });
  }

  db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, id);
  res.json({ message: `Роль пользователя изменена на ${role}` });
});

// НАЧИСЛЕНИЕ / СПИСАНИЕ KPI (ТОЛЬКО СУПЕР-АДМИН)
app.post('/api/admin/users/:id/kpi', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { points, reason, is_serious } = req.body;

  const numPoints = parseInt(points, 10);
  if (isNaN(numPoints) || numPoints === 0) {
    return res.status(400).json({ error: 'Укажите корректное ненулевое количество баллов' });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Укажите основание начисления/штрафа' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  // Ограничиваем шкалу от -100 до +100 согласно регламенту
  let newKpi = user.kpi + numPoints;
  if (newKpi > 100) newKpi = 100;
  if (newKpi < -100) newKpi = -100;

  const newViolations = (is_serious && numPoints < 0) ? user.serious_violations + 1 : user.serious_violations;

  const executeTransaction = db.transaction(() => {
    // 1. Запись в историю
    db.prepare(`
      INSERT INTO kpi_history (user_id, points, reason, created_by)
      VALUES (?, ?, ?, ?)
    `).run(id, numPoints, reason.trim(), req.user.id);

    // 2. Обновление баланса пользователя
    db.prepare(`
      UPDATE users 
      SET kpi = ?, serious_violations = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newKpi, newViolations, id);
  });

  executeTransaction();

  res.json({
    message: `Баллы успешно обновлены: ${numPoints > 0 ? '+' : ''}${numPoints}`,
    newKpi,
    serious_violations: newViolations
  });
});

// Сброс пароля пользователя в 1 клик администратором
app.post('/api/admin/users/:id/reset-password', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const pass = newPassword && newPassword.trim() ? newPassword.trim() : 'Kurultai2026!';
  const passwordHash = bcrypt.hashSync(pass, 10);
  const encryptedPass = encryptPassword(pass);

  db.prepare(`
    UPDATE users 
    SET password_hash = ?, encrypted_password = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(passwordHash, encryptedPass, id);

  res.json({
    message: 'Пароль успешно сброшен!',
    newPassword: pass
  });
});

// КЛЮЧЕВАЯ ФУНКЦИЯ: РАСШИФРОВКА И ПРОСМОТР ПАРОЛЯ ИЗ ХРАНИЛИЩА
// Требует повторной аутентификации паролем Супер-Администратора!
app.post('/api/admin/users/:id/reveal-password', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { adminPassword } = req.body;

  if (!adminPassword) {
    return res.status(400).json({ error: 'Введите пароль администратора для подтверждения доступа' });
  }

  // Строгая проверка пароля Супер-Администратора
  const isMatch = verifyAdminPassword(req.user.id, adminPassword);
  if (!isMatch) {
    return res.status(403).json({ error: 'Неверный пароль администратора! Доступ запрещен.' });
  }

  const targetUser = db.prepare('SELECT full_name, email, encrypted_password FROM users WHERE id = ?').get(id);
  if (!targetUser) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  if (!targetUser.encrypted_password) {
    return res.status(400).json({ error: 'Для данного пользователя пароль не сохранен в зашифрованном хранилище' });
  }

  try {
    const originalPassword = decryptPassword(targetUser.encrypted_password);
    res.json({
      full_name: targetUser.full_name,
      email: targetUser.email,
      password: originalPassword
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка при расшифровке данных' });
  }
});

// Редактирование профиля пользователя (ФИО, Класс, Фракция, Телефон, ИИН)
app.post('/api/admin/users/:id/edit', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { full_name, school_class, faction, phone, iin } = req.body;

  if (!full_name || !school_class || !faction) {
    return res.status(400).json({ error: 'Заполните обязательные поля (ФИО, Класс, Фракция)' });
  }

  db.prepare(`
    UPDATE users 
    SET full_name = ?, school_class = ?, faction = ?, phone = ?, iin = COALESCE(?, iin), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(full_name.trim(), school_class.trim(), faction.trim(), phone ? phone.trim() : '', iin ? iin.trim() : null, id);

  res.json({ message: 'Данные участника успешно обновлены' });
});

// Быстрая смена министерства участника
app.post('/api/admin/users/:id/faction', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { faction } = req.body;

  if (!faction) {
    return res.status(400).json({ error: 'Укажите новое министерство' });
  }

  const clean = faction.replace(/[«»]/g, '').trim();
  db.prepare('UPDATE users SET faction = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(clean, id);
  res.json({ message: `Министерство успешно изменено на «${clean}»` });
});

// Назначить или снять Министра министерства (Супер-Администратор)
app.post('/api/admin/ministries/set-minister', authenticate, requireAdmin, (req, res) => {
  const { faction, userId } = req.body;
  if (!faction) {
    return res.status(400).json({ error: 'Не указано министерство' });
  }

  const rawFaction = faction.replace(/[«»]/g, '').trim();

  // Снимаем статус министра с текущих руководителей данного министерства
  db.prepare(`
    UPDATE users 
    SET role = 'MEMBER', updated_at = CURRENT_TIMESTAMP 
    WHERE (faction = ? OR faction = ?) AND role = 'MODERATOR'
  `).run(rawFaction, `«${rawFaction}»`);

  if (userId) {
    const user = db.prepare('SELECT id, full_name, faction, role, status FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    // Назначаем пользователя Министром и закрепляем за этим министерством
    db.prepare(`
      UPDATE users 
      SET role = 'MODERATOR', faction = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(rawFaction, userId);

    return res.json({ 
      success: true, 
      message: `Пользователь ${user.full_name} успешно назначен Министром министерства «${rawFaction}»!` 
    });
  }

  return res.json({ 
    success: true, 
    message: `Министр министерства «${rawFaction}» снят с должности.` 
  });
});

// УДАЛЕНИЕ УЧАСТНИКА С КУРУЛТАЯ (СТРОГО С ПАРОЛЕМ АДМИНИСТРАТОРА)
app.post('/api/admin/users/:id/delete', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { adminPassword } = req.body;

  if (!adminPassword) {
    return res.status(400).json({ error: 'Введите пароль администратора для подтверждения удаления' });
  }

  const isMatch = verifyAdminPassword(req.user.id, adminPassword);
  if (!isMatch) {
    return res.status(403).json({ error: 'Неверный пароль администратора! Удаление отменено.' });
  }

  const targetUser = db.prepare('SELECT id, full_name, email FROM users WHERE id = ?').get(id);
  if (!targetUser) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  // Защита от удаления главного администратора
  if (targetUser.email === 'atahanqydyr@gmail.com' || targetUser.id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя удалить главного администратора системы' });
  }

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM kpi_history WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM appeals WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });

  transaction();
  res.json({ message: `Пользователь «${targetUser.full_name}» исключен и удален из базы данных` });
});

// Просмотр истории начислений конкретного участника в админке
app.get('/api/admin/users/:id/history', authenticate, requireModeratorOrAdmin, (req, res) => {
  const { id } = req.params;
  const history = db.prepare(`
    SELECT 
      h.id, h.points, h.reason, h.created_at, u.full_name as author_name
    FROM kpi_history h
    JOIN users u ON h.created_by = u.id
    WHERE h.user_id = ?
    ORDER BY h.created_at DESC
  `).all(id);

  res.json(history);
});

// МАССОВОЕ НАЧИСЛЕНИЕ БАЛЛОВ ВСЕЙ ФРАКЦИИ
app.post('/api/admin/factions/bulk-kpi', authenticate, requireAdmin, (req, res) => {
  const { faction, points, reason, is_serious } = req.body;

  const numPoints = parseInt(points, 10);
  if (isNaN(numPoints) || numPoints === 0 || !reason || !faction) {
    return res.status(400).json({ error: 'Заполните все поля (фракция, баллы, причина)' });
  }

  const members = db.prepare("SELECT id, kpi, serious_violations FROM users WHERE faction = ? AND status = 'APPROVED'").all(faction);
  if (members.length === 0) {
    return res.status(400).json({ error: 'В этой фракции нет одобренных участников' });
  }

  const transaction = db.transaction(() => {
    for (const m of members) {
      let newKpi = Math.min(100, Math.max(-100, m.kpi + numPoints));
      let newViolations = (is_serious && numPoints < 0) ? m.serious_violations + 1 : m.serious_violations;

      db.prepare(`
        INSERT INTO kpi_history (user_id, points, reason, created_by)
        VALUES (?, ?, ?, ?)
      `).run(m.id, numPoints, `[Фракция «${faction}»] ${reason}`, req.user.id);

      db.prepare(`
        UPDATE users SET kpi = ?, serious_violations = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(newKpi, newViolations, m.id);
    }
  });

  transaction();
  res.json({ message: `Баллы (${numPoints > 0 ? '+' : ''}${numPoints}) успешно начислены всем участникам фракции «${faction}» (${members.length} чел.)` });
});

// Просмотр апелляций в админке
app.get('/api/admin/appeals', authenticate, requireModeratorOrAdmin, (req, res) => {
  const appeals = db.prepare(`
    SELECT 
      a.id, a.user_id, a.reason, a.status, a.admin_comment, a.created_at,
      u.full_name, u.faction, u.school_class,
      h.points as original_points, h.reason as original_reason
    FROM appeals a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN kpi_history h ON a.kpi_history_id = h.id
    ORDER BY a.status DESC, a.created_at DESC
  `).all();

  res.json(appeals);
});

// Рассмотрение апелляции
app.post('/api/admin/appeals/:id/resolve', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status, admin_comment, revert_points } = req.body;

  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(id);
  if (!appeal) {
    return res.status(404).json({ error: 'Апелляция не найдена' });
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE appeals 
      SET status = ?, admin_comment = ?, resolved_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, admin_comment || '', id);

    // Если апелляция удовлетворена и требуется возврат баллов
    if (status === 'ACCEPTED' && revert_points && appeal.kpi_history_id) {
      const historyItem = db.prepare('SELECT * FROM kpi_history WHERE id = ?').get(appeal.kpi_history_id);
      if (historyItem && historyItem.points < 0) {
        const refundPoints = Math.abs(historyItem.points);
        // Зачисляем баллы обратно
        db.prepare(`
          INSERT INTO kpi_history (user_id, points, reason, created_by)
          VALUES (?, ?, ?, ?)
        `).run(appeal.user_id, refundPoints, `Возврат баллов по апелляции #${appeal.id}: ${historyItem.reason}`, req.user.id);

        const targetUser = db.prepare('SELECT kpi FROM users WHERE id = ?').get(appeal.user_id);
        const newKpi = Math.min(100, targetUser.kpi + refundPoints);
        db.prepare('UPDATE users SET kpi = ? WHERE id = ?').run(newKpi, appeal.user_id);
      }
    }
  });

  transaction();
  res.json({ message: 'Апелляция успешно обработана' });
});

// -------------------------------------------------------------
// ЭКСПОРТ В EXCEL
// -------------------------------------------------------------

// Полный отчет для Министерства
app.get('/api/export/ministry', authenticate, requireAdmin, (req, res) => {
  try {
    const buffer = generateMinistryReportBuffer();
    const filename = `Otchet_Ministerstvo_Shkola_32_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Ошибка экспорта отчета Министерства:', error);
    res.status(500).json({ error: 'Не удалось сформировать отчет' });
  }
});

// Сводная ведомость KPI (только ФИО и КПИ, как запросил пользователь)
app.get('/api/export/kpi-summary', authenticate, requireAdmin, (req, res) => {
  try {
    const buffer = generateKpiSummaryReportBuffer();
    const filename = `Vedomost_KPI_Shkola_32_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Ошибка экспорта ведомости KPI:', error);
    res.status(500).json({ error: 'Не удалось сформировать ведомость' });
  }
});

// Любой другой маршрут отдаем на главный index.html (SPA)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🇰🇿 Сервер Портала Школьного Курултая запущен!`);
  console.log(`🌐 Адрес: http://localhost:${PORT}`);
  console.log(`👑 Главный Администратор: atahanqydyr@gmail.com`);
  console.log(`=======================================================`);
});
