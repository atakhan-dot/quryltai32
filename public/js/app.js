// Глобальное состояние приложения
const state = {
  token: localStorage.getItem('kurultai_token') || null,
  lang: localStorage.getItem('kurultai_lang') || 'kz',
  currentUser: null,
  factions: [],
  kpiRules: [],
  leaderboard: [],
  adminUsers: [],
  activeView: 'home',
  activeAdminTab: 'users',
  selectedKpiUser: null,
  revealTargetUserId: null
};

// Тілдік аударма функциялары (i18n)
function t(key) {
  const lang = state.lang || 'kz';
  if (typeof translations !== 'undefined' && translations[lang] && translations[lang][key] !== undefined) {
    return translations[lang][key];
  }
  if (typeof translations !== 'undefined' && translations['ru'] && translations['ru'][key] !== undefined) {
    return translations['ru'][key];
  }
  return key;
}

function getRuleTitle(r) {
  if ((state.lang || 'kz') === 'kz' && typeof kpiRulesTranslationsKz !== 'undefined' && kpiRulesTranslationsKz[r.title]) {
    return kpiRulesTranslationsKz[r.title];
  }
  return r.title;
}

function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem('kurultai_lang', lang);
  applyTranslations();
  showToast(lang === 'kz' ? 'Қазақ тілі таңдалды 🇰🇿' : 'Выбран русский язык', 'info');
}

function applyTranslations() {
  const lang = state.lang || 'kz';
  document.documentElement.lang = lang === 'kz' ? 'kk' : 'ru';
  document.title = t('pageTitle');

  // Тіл ауыстырғыш батырмаларын жаңарту
  ['lang-btn-kz', 'mobile-lang-btn-kz'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lang === 'kz') {
      el.className = 'px-2.5 py-1 rounded-lg transition-smooth bg-amber-500 text-slate-950 font-black shadow-sm';
    } else {
      el.className = 'px-2.5 py-1 rounded-lg transition-smooth text-slate-300 hover:text-white';
    }
  });

  ['lang-btn-ru', 'mobile-lang-btn-ru'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lang === 'ru') {
      el.className = 'px-2.5 py-1 rounded-lg transition-smooth bg-amber-500 text-slate-950 font-black shadow-sm';
    } else {
      el.className = 'px-2.5 py-1 rounded-lg transition-smooth text-slate-300 hover:text-white';
    }
  });

  // data-i18n барлық элементтерін аудару
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val !== undefined && val !== null) {
      if (val.includes('<') && val.includes('>')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    }
  });

  // data-i18n-placeholder аудару
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = t(key);
    if (val) el.placeholder = val;
  });

  // Компоненттерді қайта сызу
  renderAuthHeader();
  renderFactions();
  renderKpiRules();
  renderLeaderboard();
  renderAnnouncements();
  populateKpiScoringRules();
  if (state.activeView === 'member') loadMemberCabinet();
  if (state.activeView === 'admin') {
    renderAdminUsersTable();
    renderAdminPendingTable();
    renderAdminAppeals();
  }
}

// ------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  applyTranslations();
  await checkAuth();
  await loadFactions();
  await loadKpiRules();
  await loadLeaderboard();
  await loadAnnouncements();

  // Открываем главную страницу по умолчанию
  navigate('home');
  applyTranslations();
});

// ------------------------------------------------------------------
// НАВИГАЦИЯ МЕЖДУ СТРАНИЦАМИ (SPA)
// ------------------------------------------------------------------
function navigate(viewName) {
  state.activeView = viewName;

  // Скрываем все секции
  document.querySelectorAll('.view-content').forEach(el => el.classList.add('hidden'));

  // Показываем нужную
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.remove('hidden');

  // Обновляем активный класс в меню
  document.querySelectorAll('.nav-link').forEach(btn => {
    if (btn.dataset.target === viewName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Загружаем данные в зависимости от открытой страницы
  if (viewName === 'factions') {
    if (!state.factions || state.factions.length === 0) {
      loadFactions();
    } else {
      renderFactions();
    }
  }
  if (viewName === 'kpi') renderKpiRules();
  if (viewName === 'leaderboard') renderLeaderboard();
  if (viewName === 'member') loadMemberCabinet();
  if (viewName === 'admin') loadAdminDashboard();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-navigation');
  const toggle = document.getElementById('mobile-menu-toggle');
  const isOpen = !menu.classList.contains('hidden');
  menu.classList.toggle('hidden', isOpen);
  toggle.setAttribute('aria-expanded', String(!isOpen));
  toggle.setAttribute('aria-label', isOpen ? 'Открыть меню' : 'Закрыть меню');
  toggle.innerHTML = `<i class="fa-solid fa-${isOpen ? 'bars' : 'xmark'}"></i>`;
}

function closeMobileMenu() {
  const menu = document.getElementById('mobile-navigation');
  const toggle = document.getElementById('mobile-menu-toggle');
  menu.classList.add('hidden');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Открыть меню');
  toggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
}

// ------------------------------------------------------------------
// АВТОРИЗАЦИЯ И ПРОФИЛЬ
// ------------------------------------------------------------------
async function checkAuth() {
  if (!state.token) {
    state.currentUser = null;
    renderAuthHeader();
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (res.ok) {
      state.currentUser = await res.json();
    } else {
      localStorage.removeItem('kurultai_token');
      state.token = null;
      state.currentUser = null;
    }
  } catch (e) {
    console.error('Ошибка проверки авторизации:', e);
  }

  renderAuthHeader();
}

function renderAuthHeader() {
  const container = document.getElementById('auth-buttons-container');
  const navMemberBtn = document.getElementById('nav-member-btn');
  const navAdminBtn = document.getElementById('nav-admin-btn');
  const mobileMemberBtn = document.getElementById('mobile-member-btn');
  const mobileAdminBtn = document.getElementById('mobile-admin-btn');

  if (!state.currentUser) {
    navMemberBtn.classList.add('hidden');
    navAdminBtn.classList.add('hidden');
    mobileMemberBtn.classList.add('hidden');
    mobileAdminBtn.classList.add('hidden');

    container.innerHTML = `
      <button onclick="openAuthModal('login')" class="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-white hover:bg-white/10 transition-smooth">
        ${t('btnLogin')}
      </button>
      <button onclick="openAuthModal('register')" class="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-smooth shadow-md shadow-amber-500/20 whitespace-nowrap">
        ${t('btnRegister')}
      </button>
    `;
    return;
  }

  // Пользователь авторизован
  navMemberBtn.classList.remove('hidden');
  mobileMemberBtn.classList.remove('hidden');

  const isAdminOrMod = state.currentUser.role === 'ADMIN' || state.currentUser.role === 'MODERATOR';
  if (isAdminOrMod) {
    navAdminBtn.classList.remove('hidden');
    mobileAdminBtn.classList.remove('hidden');
  } else {
    navAdminBtn.classList.add('hidden');
    mobileAdminBtn.classList.add('hidden');
  }

  const kpiColor = state.currentUser.kpi >= 50 ? 'text-emerald-400' : (state.currentUser.kpi < 0 ? 'text-rose-400' : 'text-amber-400');

  container.innerHTML = `
    <div class="flex items-center space-x-2 sm:space-x-3 bg-white/10 px-3 py-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
      <div class="text-right hidden sm:block">
        <div class="text-xs font-bold text-white">${state.currentUser.full_name}</div>
        <div class="text-[11px] text-slate-300">
          KPI: <span class="font-bold ${kpiColor}">${state.currentUser.kpi > 0 ? '+' : ''}${state.currentUser.kpi}</span>
        </div>
      </div>
      <button onclick="logout()" title="${t('logoutToast')}" class="w-8 h-8 rounded-xl bg-white/15 hover:bg-rose-500/30 hover:text-rose-300 text-slate-200 flex items-center justify-center transition-smooth text-xs">
        <i class="fa-solid fa-arrow-right-from-bracket"></i>
      </button>
    </div>
  `;
}

function logout() {
  localStorage.removeItem('kurultai_token');
  state.token = null;
  state.currentUser = null;
  renderAuthHeader();
  renderFactions();
  loadAnnouncements();
  navigate('home');
  showToast(t('logoutToast'), 'info');
}

// ------------------------------------------------------------------
// МОДАЛЬНОЕ ОКНО АВТОРИЗАЦИИ
// ------------------------------------------------------------------
function openAuthModal(tab = 'login') {
  document.getElementById('modal-auth').classList.remove('hidden');
  switchAuthTab(tab);
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');
  const tabLogin = document.getElementById('auth-tab-login');
  const tabReg = document.getElementById('auth-tab-register');

  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('reg-error').classList.add('hidden');
  document.getElementById('reg-success').classList.add('hidden');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    tabLogin.className = 'flex-1 py-4 font-bold text-sm text-center border-b-2 border-slate-900 text-slate-900';
    tabReg.className = 'flex-1 py-4 font-bold text-sm text-center border-b-2 border-transparent text-slate-500 hover:text-slate-900';
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    tabReg.className = 'flex-1 py-4 font-bold text-sm text-center border-b-2 border-amber-500 text-amber-900';
    tabLogin.className = 'flex-1 py-4 font-bold text-sm text-center border-b-2 border-transparent text-slate-500 hover:text-slate-900';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorBox = document.getElementById('login-error');

  errorBox.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      errorBox.textContent = data.error || 'Ошибка авторизации';
      errorBox.classList.remove('hidden');
      return;
    }

    state.token = data.token;
    state.currentUser = data.user;
    localStorage.setItem('kurultai_token', data.token);

    closeModal('modal-auth');
    renderAuthHeader();
    showToast(`Добро пожаловать, ${data.user.full_name}!`, 'success');

    if (data.user.role === 'ADMIN') {
      navigate('admin');
    } else {
      navigate('member');
    }
  } catch (err) {
    errorBox.textContent = 'Ошибка подключения к серверу';
    errorBox.classList.remove('hidden');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const full_name = document.getElementById('reg-fullname').value.trim();
  const iin = document.getElementById('reg-iin').value.trim();
  const school_class = document.getElementById('reg-class').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const faction = document.getElementById('reg-faction').value;
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  const errBox = document.getElementById('reg-error');
  const successBox = document.getElementById('reg-success');

  errBox.classList.add('hidden');
  successBox.classList.add('hidden');

  if (!/^\d{12}$/.test(iin)) {
    errBox.textContent = 'ИИН должен содержать ровно 12 цифр';
    errBox.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, iin, school_class, phone, faction, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      errBox.textContent = data.error || 'Ошибка при регистрации';
      errBox.classList.remove('hidden');
      return;
    }

    successBox.textContent = data.message;
    successBox.classList.remove('hidden');
    document.getElementById('form-register').reset();

    showToast('Заявка на регистрацию отправлена на проверку!', 'success');
  } catch (err) {
    errBox.textContent = 'Ошибка связи с сервером';
    errBox.classList.remove('hidden');
  }
}

// ------------------------------------------------------------------
// МИНИСТЕРСТВА (7 НАПРАВЛЕНИЙ)
// ------------------------------------------------------------------
async function loadFactions() {
  try {
    const res = await fetch('/api/public/factions');
    if (res.ok) {
      state.factions = await res.json();
    }
  } catch (e) {
    console.error('Ошибка загрузки министерств:', e);
  }
  renderFactions();
}

function renderFactions() {
  const container = document.getElementById('factions-container');
  if (!container) return;

  if (!state.factions || state.factions.length === 0) {
    container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i> ${(state.lang || 'kz') === 'kz' ? 'Министрліктер тізімі жүктелуде...' : 'Загрузка списка министерств...'}</div>`;
    return;
  }

  const isAdmin = state.currentUser && state.currentUser.role === 'ADMIN';
  const isKz = (state.lang || 'kz') === 'kz';

  container.innerHTML = state.factions.map(f => {
    const rawName = f.rawName || f.name.replace(/[«»]/g, '');
    const minister = f.minister;
    const roleText = isKz && f.role_kz ? f.role_kz : f.role;
    const descText = isKz && f.description_kz ? f.description_kz : f.description;
    const dutiesList = isKz && f.duties_kz ? f.duties_kz : (f.duties || []);

    return `
    <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-smooth flex flex-col justify-between group">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-extrabold px-3 py-1 rounded-full ${f.badgeColor}">
            ${f.name}
          </span>
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr ${f.color} text-white flex items-center justify-center text-sm shadow-md">
            <i class="fa-solid fa-building-columns"></i>
          </div>
        </div>

        <div>
          <h3 class="text-xl font-extrabold text-slate-900 group-hover:text-amber-600 transition-smooth">${f.name}</h3>
          <p class="text-xs font-semibold text-slate-500 mt-0.5">${roleText}</p>
        </div>

        <p class="text-xs text-slate-600 leading-relaxed">${descText}</p>

        <!-- БЛОК: РУКОВОДИТЕЛЬ / МИНИСТР -->
        <div class="pt-3 pb-1 border-t border-slate-100 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <i class="fa-solid fa-crown text-amber-500"></i> ${t('ministerHead')}
            </span>
            ${minister ? `
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                ${t('ministerActive')}
              </span>
            ` : `
              <span class="text-[10px] text-slate-400 font-medium italic">${t('ministerNotAssigned')}</span>
            `}
          </div>

          ${minister ? `
            <div class="flex items-center justify-between bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-2xl">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm shrink-0">
                  ${minister.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                </div>
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-900 truncate leading-tight">${minister.full_name}</div>
                  <div class="text-[10px] text-slate-500 font-medium">${minister.school_class} • KPI: <span class="font-bold text-emerald-600">${minister.kpi > 0 ? '+' : ''}${minister.kpi}</span></div>
                </div>
              </div>
              <button onclick="openDelegateIdCardModal(${minister.id})" title="${t('btnIdCard')}" class="p-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-700 text-xs border border-amber-200 shadow-xs transition-smooth shrink-0 ml-2">
                <i class="fa-solid fa-id-card"></i>
              </button>
            </div>
          ` : `
            <div class="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
              ${t('ministerEmptyText')}
            </div>
          `}

          <!-- ЕСЛИ ВОШЕЛ АДМИНИСТРАТОР: ВЫБОР МИНИСТРА ПРЯМО ТУТ -->
          ${isAdmin ? `
            <div class="bg-amber-50/40 p-2.5 rounded-2xl border border-amber-300/70 space-y-2 mt-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-extrabold uppercase tracking-wide text-amber-900 flex items-center gap-1">
                  <i class="fa-solid fa-user-gear text-amber-600"></i> ${t('assignMinisterTitle')}
                </span>
                <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">Администратор</span>
              </div>
              <div class="flex gap-1.5">
                <select id="select-minister-${rawName}" class="w-full text-xs bg-white border border-slate-300 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium">
                  <option value="">${t('assignMinisterDefault')}</option>
                  <optgroup label="«${rawName}» ${t('groupMembers')}">
                    ${(f.members || []).map(m => `
                      <option value="${m.id}" ${minister && minister.id === m.id ? 'selected' : ''}>
                        ${m.full_name} (${m.school_class}) [KPI: ${m.kpi > 0 ? '+' : ''}${m.kpi}] ${m.role === 'MODERATOR' ? '👑' : ''}
                      </option>
                    `).join('')}
                  </optgroup>
                  <optgroup label="${t('groupOthers')}">
                    ${(f.all_candidates || []).filter(c => !f.members || !f.members.some(m => m.id === c.id)).map(c => `
                      <option value="${c.id}" ${minister && minister.id === c.id ? 'selected' : ''}>
                        ${c.full_name} (${c.school_class}, «${c.faction}») [KPI: ${c.kpi > 0 ? '+' : ''}${c.kpi}]
                      </option>
                    `).join('')}
                  </optgroup>
                </select>
                <button onclick="handleAssignMinister('${rawName}')" title="${t('btnSaveChanges')}" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-smooth shrink-0 flex items-center gap-1">
                  <i class="fa-solid fa-check"></i>
                </button>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="pt-2 border-t border-slate-100">
          <div class="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">${t('dutiesTitle')}</div>
          <ul class="space-y-1.5 text-xs text-slate-600">
            ${dutiesList.map(d => `
              <li class="flex items-start gap-2">
                <i class="fa-solid fa-check text-emerald-500 text-[10px] mt-1 shrink-0"></i>
                <span>${d}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>

      <div class="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
        <button onclick="filterLeaderboardByFaction('${rawName}')" class="text-xs font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1">
          <span>${t('viewMembers')} (${f.members_count || 0})</span>
          <i class="fa-solid fa-arrow-right text-[10px]"></i>
        </button>
      </div>
    </div>
    `;
  }).join('');
}

async function handleAssignMinister(factionRawName) {
  const select = document.getElementById(`select-minister-${factionRawName}`);
  if (!select) return;
  const userId = select.value ? parseInt(select.value) : null;

  try {
    const res = await fetch('/api/admin/ministries/set-minister', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ faction: factionRawName, userId })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Ошибка назначения министра', 'error');
      return;
    }
    showToast(data.message, 'success');
    await loadFactions();
    if (state.currentUser && state.currentUser.role === 'ADMIN') {
      loadAdminUsers();
    }
  } catch (e) {
    showToast('Ошибка сети при назначении министра', 'error');
  }
}

function filterLeaderboardByFaction(factionName) {
  navigate('leaderboard');
  const sel = document.getElementById('leaderboard-faction-filter');
  if (sel) {
    sel.value = factionName;
    renderLeaderboard();
  }
}

// ------------------------------------------------------------------
// ПРАВИЛА И РЕГЛАМЕНТ KPI
// ------------------------------------------------------------------
async function loadKpiRules() {
  try {
    const res = await fetch('/api/public/kpi-rules');
    state.kpiRules = await res.json();
    renderKpiRules('ALL');
    populateKpiScoringRules();
  } catch (e) {
    console.error('Ошибка загрузки правил KPI:', e);
  }
}

function renderKpiRules(filter = 'ALL') {
  const tbody = document.getElementById('kpi-rules-tbody');
  if (!tbody) return;

  let rules = [...state.kpiRules];
  if (filter === 'PENALTY') {
    // Только штрафы: от наименьшего штрафа (-2) до наибольшего (-20)
    rules = rules.filter(r => r.points < 0 || r.type === 'PENALTY')
                 .sort((a, b) => b.points - a.points);
  } else if (filter === 'BONUS') {
    // Только поощрения: от самого большого (+15) к меньшему (+2)
    rules = rules.filter(r => r.points > 0 || r.type === 'BONUS')
                 .sort((a, b) => b.points - a.points);
  } else {
    // Все правила: сначала плюсы (от большего к меньшему), потом минусы (от малого штрафа к большому)
    const bonuses = rules.filter(r => r.points > 0).sort((a, b) => b.points - a.points);
    const penalties = rules.filter(r => r.points < 0).sort((a, b) => b.points - a.points);
    rules = [...bonuses, ...penalties];
  }

  tbody.innerHTML = rules.map(r => {
    const isBonus = r.points > 0;
    const badgeColor = isBonus ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
    const pointsStr = isBonus ? `+${r.points}` : `${r.points}`;
    const ruleTitle = getRuleTitle(r);

    return `
      <tr class="hover:bg-slate-50 transition-smooth">
        <td class="py-3.5 px-6 font-medium text-slate-800">${ruleTitle}</td>
        <td class="py-3.5 px-6 font-extrabold ${isBonus ? 'text-emerald-600' : 'text-rose-600'}">
          <span class="px-2.5 py-1 rounded-lg ${badgeColor} text-xs font-bold">${pointsStr} ${t('thPoints')}</span>
        </td>
        <td class="py-3.5 px-6">
          ${r.is_serious ? `<span class="text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">${t('seriousTag')}</span>` : `<span class="text-[11px] text-slate-400">${t('regularTag')}</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

function filterKpiRules(type) {
  document.querySelectorAll('.kpi-filter-btn').forEach(b => {
    if (b.dataset.filter === type) {
      b.className = 'kpi-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white';
    } else {
      b.className = 'kpi-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200';
    }
  });
  renderKpiRules(type);
}

// ------------------------------------------------------------------
// РЕЙТИНГ (LEADERBOARD)
// ------------------------------------------------------------------
async function loadLeaderboard() {
  try {
    const res = await fetch('/api/public/leaderboard');
    state.leaderboard = await res.json();
    renderLeaderboard();
  } catch (e) {
    console.error('Ошибка загрузки рейтинга:', e);
  }
}

function renderLeaderboard() {
  const tbody = document.getElementById('leaderboard-tbody');
  if (!tbody) return;

  const search = (document.getElementById('leaderboard-search')?.value || '').toLowerCase().trim();
  const factionFilter = document.getElementById('leaderboard-faction-filter')?.value || '';

  let list = state.leaderboard.filter(u => {
    const matchSearch = u.full_name.toLowerCase().includes(search) || u.school_class.toLowerCase().includes(search);
    const matchFaction = !factionFilter || u.faction.includes(factionFilter);
    return matchSearch && matchFaction;
  });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400 text-sm">${t('noRecords')}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((u, i) => {
    let rankBadge = `<span class="font-extrabold text-slate-500">#${i + 1}</span>`;
    if (i === 0) rankBadge = `<span class="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-extrabold flex items-center justify-center shadow-md mx-auto"><i class="fa-solid fa-crown text-xs"></i></span>`;
    if (i === 1) rankBadge = `<span class="w-8 h-8 rounded-xl bg-slate-300 text-slate-950 font-extrabold flex items-center justify-center shadow-md mx-auto">2</span>`;
    if (i === 2) rankBadge = `<span class="w-8 h-8 rounded-xl bg-amber-600/60 text-white font-extrabold flex items-center justify-center shadow-md mx-auto">3</span>`;

    // Статус по KPI
    let statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">${t('statusNormal')}</span>`;
    if (u.kpi >= 100) {
      statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><i class="fa-solid fa-award mr-1"></i>${t('statusCert')}</span>`;
    } else if (u.kpi <= -100 || u.serious_violations >= 3) {
      statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 badge-risk"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${t('statusRisk')}</span>`;
    } else if (u.kpi >= 50) {
      statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700">${t('statusLeader')}</span>`;
    }

    const kpiColor = u.kpi > 0 ? 'text-emerald-600 font-black' : (u.kpi < 0 ? 'text-rose-600 font-black' : 'text-slate-500 font-bold');

    return `
      <tr class="hover:bg-slate-50 transition-smooth">
        <td class="py-4 px-6 text-center">${rankBadge}</td>
        <td class="py-4 px-6 font-bold text-slate-900">
          <div class="flex items-center gap-2">
            <a href="javascript:void(0)" onclick="openUserProfileModal(${u.id})" class="hover:text-amber-600 hover:underline flex items-center gap-1.5 cursor-pointer">
              <span>${u.full_name}</span>
              <i class="fa-solid fa-address-card text-xs text-slate-400"></i>
            </a>
            ${u.role === 'ADMIN' ? `<span class="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">${t('rolePresident')}</span>` : ''}
            ${u.role === 'MODERATOR' ? `<span class="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">${t('roleMinister')}</span>` : ''}
          </div>
        </td>
        <td class="py-4 px-6 font-medium text-slate-600">${u.school_class}</td>
        <td class="py-4 px-6 font-medium text-slate-600">«${u.faction}»</td>
        <td class="py-4 px-6 text-center text-lg ${kpiColor}">${u.kpi > 0 ? '+' : ''}${u.kpi}</td>
        <td class="py-4 px-6">${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

// ------------------------------------------------------------------
// ЛИЧНЫЙ КАБИНЕТ УЧАСТНИКА
// ------------------------------------------------------------------
async function loadMemberCabinet() {
  if (!state.currentUser) return;

  const u = state.currentUser;
  const initials = u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2);

  document.getElementById('member-avatar-initials').textContent = initials;
  document.getElementById('member-profile-name').textContent = u.full_name;
  document.getElementById('member-profile-class').innerHTML = `<i class="fa-solid fa-graduation-cap mr-1"></i>${u.school_class}`;
  document.getElementById('member-profile-faction').innerHTML = `<i class="fa-solid fa-building-columns mr-1"></i>${t('thMinistry')} «${u.faction}»`;
  document.getElementById('member-profile-email').innerHTML = `<i class="fa-solid fa-envelope mr-1"></i>${u.email}`;

  const roleBadge = document.getElementById('member-role-badge');
  if (u.role === 'ADMIN') roleBadge.textContent = t('adminPresidentRole');
  else if (u.role === 'MODERATOR') roleBadge.textContent = t('adminMinisterRole');
  else roleBadge.textContent = t('roleMember');

  const kpiBadge = document.getElementById('member-kpi-badge');
  kpiBadge.textContent = (u.kpi > 0 ? '+' : '') + u.kpi;
  kpiBadge.className = u.kpi >= 50 ? 'text-3xl font-extrabold text-emerald-600' : (u.kpi < 0 ? 'text-3xl font-extrabold text-rose-600' : 'text-3xl font-extrabold text-slate-800');

  // Загружаем историю начислений
  try {
    const res = await fetch('/api/member/kpi-history', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const history = await res.json();
    renderMemberHistory(history);

    // Загружаем список штрафов для модалки апелляции
    populateAppealHistorySelect(history);
  } catch (e) {
    console.error('Ошибка истории:', e);
  }

  // Загружаем поданные апелляции
  try {
    const aRes = await fetch('/api/member/appeals', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const appeals = await aRes.json();
    renderMemberAppeals(appeals);
  } catch (e) {
    console.error('Ошибка апелляций:', e);
  }
}

function renderMemberHistory(history) {
  const container = document.getElementById('member-history-list');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">Начислений и штрафов пока нет. Стартовый баланс: 0.</div>`;
    return;
  }

  container.innerHTML = history.map(h => {
    const isBonus = h.points > 0;
    const dateFormatted = new Date(h.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });

    return `
      <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/60 transition-smooth">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl ${isBonus ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} flex items-center justify-center font-bold text-sm shrink-0">
            ${isBonus ? '+' : ''}${h.points}
          </div>
          <div>
            <div class="text-xs font-bold text-slate-800">${h.reason}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Кем: ${h.author_name} • ${dateFormatted}</div>
          </div>
        </div>
        <div class="text-right">
          <span class="text-xs font-black ${isBonus ? 'text-emerald-600' : 'text-rose-600'}">
            ${isBonus ? '+' : ''}${h.points} KPI
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function populateAppealHistorySelect(history) {
  const sel = document.getElementById('appeal-history-select');
  if (!sel) return;

  const penalties = history.filter(h => h.points < 0);
  if (penalties.length === 0) {
    sel.innerHTML = `<option value="">У вас нет штрафов для оспаривания</option>`;
    return;
  }

  sel.innerHTML = penalties.map(p => `
    <option value="${p.id}">Штраф ${p.points} баллов: ${p.reason.slice(0, 45)}...</option>
  `).join('');
}

function renderMemberAppeals(appeals) {
  const container = document.getElementById('member-appeals-list');
  if (!container) return;

  if (appeals.length === 0) {
    container.innerHTML = `<div class="text-slate-400 text-xs">Заявлений не подавалось</div>`;
    return;
  }

  container.innerHTML = appeals.map(a => {
    let statusTag = '<span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">На рассмотрении</span>';
    if (a.status === 'ACCEPTED') statusTag = '<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Удовлетворена (баллы возвращены)</span>';
    if (a.status === 'REJECTED') statusTag = '<span class="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">Отклонена</span>';

    return `
      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
        <div class="flex items-center justify-between mb-1">
          <span class="font-bold text-slate-700">Апелляция #${a.id}</span>
          ${statusTag}
        </div>
        <p class="text-slate-600 line-clamp-2">${a.reason}</p>
        ${a.admin_comment ? `<div class="mt-1 text-[11px] text-indigo-700 bg-indigo-50 p-1.5 rounded font-semibold">Ответ Президента: ${a.admin_comment}</div>` : ''}
      </div>
    `;
  }).join('');
}

function openAppealModal() {
  document.getElementById('modal-appeal').classList.remove('hidden');
}

async function submitAppeal() {
  const kpi_history_id = document.getElementById('appeal-history-select').value;
  const reason = document.getElementById('appeal-reason').value.trim();

  if (!reason) {
    showToast('Укажите причину апелляции', 'error');
    return;
  }

  try {
    const res = await fetch('/api/member/appeals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ kpi_history_id: kpi_history_id || null, reason })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Ошибка', 'error');
      return;
    }

    closeModal('modal-appeal');
    document.getElementById('appeal-reason').value = '';
    showToast('Апелляция успешно направлена в Аппарат Президента!', 'success');
    loadMemberCabinet();
  } catch (err) {
    showToast('Ошибка сервера', 'error');
  }
}

// ------------------------------------------------------------------
// ПАНЕЛЬ АДМИНИСТРАТОРА
// ------------------------------------------------------------------
async function loadAdminDashboard() {
  if (!state.currentUser) return;

  // 1. Статистика
  try {
    const sRes = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const stats = await sRes.json();

    document.getElementById('admin-stat-members').textContent = stats.totalMembers;
    document.getElementById('admin-stat-pending').textContent = stats.pendingCount;
    document.getElementById('admin-stat-avg').textContent = stats.avgKpi;
    document.getElementById('admin-stat-cert').textContent = stats.certificateCount;
    document.getElementById('admin-stat-risk').textContent = stats.riskCount;

    document.getElementById('admin-pending-badge').textContent = stats.pendingCount;
    document.getElementById('admin-appeals-badge').textContent = stats.pendingAppeals;
  } catch (e) {
    console.error('Ошибка загрузки статистики админки:', e);
  }

  // 2. Список участников
  await loadAdminUsers();

  // 3. Апелляции
  await loadAdminAppeals();
}

async function loadAdminUsers() {
  try {
    const res = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    state.adminUsers = await res.json();
    renderAdminUsersTable();
    renderAdminPendingTable();
  } catch (e) {
    console.error('Ошибка списка пользователей:', e);
  }
}

function renderAdminUsersTable() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  const search = (document.getElementById('admin-user-search')?.value || '').toLowerCase().trim();
  const factionFilter = document.getElementById('admin-faction-filter')?.value || '';
  const statusFilter = document.getElementById('admin-status-filter')?.value || '';
  const isSuperAdmin = state.currentUser.role === 'ADMIN';

  const list = state.adminUsers.filter(u => {
    const matchSearch = u.full_name.toLowerCase().includes(search) ||
           u.iin.includes(search) ||
           u.school_class.toLowerCase().includes(search);
    const matchFaction = !factionFilter || u.faction.includes(factionFilter);
    const matchStatus = !statusFilter || u.status === statusFilter;
    return matchSearch && matchFaction && matchStatus;
  });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400">${(state.lang || 'kz') === 'kz' ? 'Қатысушылар табылмады' : 'Участники не найдены'}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(u => {
    const isApproved = u.status === 'APPROVED';
    const isPending = u.status === 'PENDING';

    const statusBadge = isApproved
      ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">${t('statusFilterApproved')}</span>`
      : (isPending ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">${t('statusFilterPending')}</span>` : `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">${t('statusFilterRejected')}</span>`);

    const kpiColor = u.kpi > 0 ? 'text-emerald-600 font-extrabold' : (u.kpi < 0 ? 'text-rose-600 font-extrabold' : 'text-slate-500 font-bold');

    const roleBadge = u.role === 'ADMIN'
      ? `<span class="font-bold text-amber-700">${t('rolePresident')}</span>`
      : (u.role === 'MODERATOR' ? `<span class="font-bold text-indigo-700">${t('roleMinister')}</span>` : t('roleMember'));

    return `
      <tr class="hover:bg-slate-50 transition-smooth">
        <td class="py-3 px-4 font-bold text-slate-900">
          <div>${u.full_name}</div>
          <div class="text-[11px] text-slate-400">${u.email}</div>
        </td>
        <td class="py-3 px-4 font-mono text-xs font-semibold text-slate-700">${u.iin}</td>
        <td class="py-3 px-4 text-xs font-medium">${u.school_class}</td>
        <td class="py-3 px-4 text-xs font-medium">
          <span class="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold">«${u.faction}»</span>
        </td>
        <td class="py-3 px-4 text-xs">
          ${roleBadge}
        </td>
        <td class="py-3 px-4 text-center text-sm ${kpiColor}">${u.kpi > 0 ? '+' : ''}${u.kpi}</td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5 flex-wrap">
            ${isSuperAdmin ? `
              <button onclick="openKpiScoringModal(${u.id})" title="${(state.lang || 'kz') === 'kz' ? 'KPI баллдарын беру / шегеру' : 'Начислить/списать баллы KPI'}" class="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-smooth">
                <i class="fa-solid fa-plus-minus mr-0.5"></i>KPI
              </button>
              <button onclick="openEditUserModal(${u.id})" title="${(state.lang || 'kz') === 'kz' ? 'Профильді өңдеу және министрлікті өзгерту' : 'Редактировать профиль и сменить министерство'}" class="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs transition-smooth">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button onclick="openUserHistoryModal(${u.id})" title="${(state.lang || 'kz') === 'kz' ? 'KPI есептеу тарихы' : 'История начислений KPI'}" class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-smooth">
                <i class="fa-solid fa-clock-rotate-left"></i>
              </button>
              <button onclick="openDelegateIdCardModal(${u.id})" title="${t('btnIdCard')}" class="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs transition-smooth">
                <i class="fa-solid fa-id-card"></i>
              </button>
              <button onclick="openRevealPasswordModal(${u.id})" title="${(state.lang || 'kz') === 'kz' ? 'Шифрланған құпиясөзді көру' : 'Показать зашифрованный пароль'}" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-950 text-amber-400 text-xs transition-smooth">
                <i class="fa-solid fa-key"></i>
              </button>
              <button onclick="handleResetPasswordPrompt(${u.id})" title="${(state.lang || 'kz') === 'kz' ? 'Құпиясөзді жаңарту' : 'Сбросить пароль'}" class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-smooth">
                <i class="fa-solid fa-rotate-right"></i>
              </button>
              <button onclick="toggleUserModerator(${u.id}, '${u.role}')" title="${u.role === 'MODERATOR' ? ((state.lang || 'kz') === 'kz' ? 'Министр мәртебесін алып тастау' : 'Снять статус министра') : ((state.lang || 'kz') === 'kz' ? 'Министр етіп тағайындау' : 'Назначить министром')}" class="p-1.5 rounded-lg ${u.role === 'MODERATOR' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'} hover:bg-indigo-200 text-xs transition-smooth">
                <i class="fa-solid fa-user-shield"></i>
              </button>
              ${u.role !== 'ADMIN' ? `
                <button onclick="openDeleteUserModal(${u.id})" title="${(state.lang || 'kz') === 'kz' ? 'Құрылтайдан шығару' : 'Исключить с Курултая'}" class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs transition-smooth">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : ''}
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAdminPendingTable() {
  const tbody = document.getElementById('admin-pending-tbody');
  if (!tbody) return;

  const pending = state.adminUsers.filter(u => u.status === 'PENDING');

  if (pending.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400 text-sm">${(state.lang || 'kz') === 'kz' ? 'Модерацияға жаңа өтінімдер жоқ' : 'Новых заявок на модерацию нет'}</td></tr>`;
    return;
  }

  tbody.innerHTML = pending.map(u => `
    <tr class="hover:bg-slate-50 transition-smooth">
      <td class="py-3 px-4 font-bold text-slate-900">${u.full_name}</td>
      <td class="py-3 px-4 text-xs text-slate-600">${u.email}</td>
      <td class="py-3 px-4 font-mono text-xs">${u.iin}</td>
      <td class="py-3 px-4 text-xs">${u.school_class}</td>
      <td class="py-3 px-4 text-xs font-semibold text-amber-800">«${u.faction}»</td>
      <td class="py-3 px-4 text-right space-x-2">
        <button onclick="changeUserStatus(${u.id}, 'APPROVED')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-smooth">
          <i class="fa-solid fa-check mr-1"></i>${t('btnApprove')}
        </button>
        <button onclick="changeUserStatus(${u.id}, 'REJECTED')" class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition-smooth">
          <i class="fa-solid fa-xmark mr-1"></i>${t('btnReject')}
        </button>
      </td>
    </tr>
  `).join('');
}

async function changeUserStatus(userId, status) {
  try {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ status })
    });

    if (res.ok) {
      showToast((state.lang || 'kz') === 'kz' ? `Мәртебе жаңартылды: ${status === 'APPROVED' ? 'Бекітілді' : 'Қабылданбады'}` : `Статус обновлен: ${status === 'APPROVED' ? 'Одобрен' : 'Отклонен'}`, 'success');
      loadAdminDashboard();
    } else {
      showToast((state.lang || 'kz') === 'kz' ? 'Мәртебені өзгерту қатесі' : 'Ошибка смены статуса', 'error');
    }
  } catch (e) {
    showToast((state.lang || 'kz') === 'kz' ? 'Желі қатесі' : 'Ошибка сети', 'error');
  }
}

async function toggleUserModerator(userId, currentRole) {
  const newRole = currentRole === 'MODERATOR' ? 'MEMBER' : 'MODERATOR';
  try {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ role: newRole })
    });

    if (res.ok) {
      showToast((state.lang || 'kz') === 'kz' ? `Рөл жаңартылды: ${newRole === 'MODERATOR' ? 'Министр етіп тағайындалды' : 'Парламент мүшесі'}` : `Роль обновлена: ${newRole === 'MODERATOR' ? 'Назначен Министром' : 'Член Парламента'}`, 'success');
      loadAdminDashboard();
    } else {
      const err = await res.json();
      showToast(err.error || 'Қате / Ошибка', 'error');
    }
  } catch (e) {
    showToast((state.lang || 'kz') === 'kz' ? 'Желі қатесі' : 'Ошибка сети', 'error');
  }
}

function switchAdminTab(tab) {
  state.activeAdminTab = tab;

  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    if (b.dataset.tab === tab) {
      b.className = 'admin-tab-btn px-4 py-2 rounded-xl text-sm font-bold bg-slate-900 text-white';
    } else {
      b.className = 'admin-tab-btn px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200';
    }
  });

  document.querySelectorAll('.admin-subview').forEach(v => v.classList.add('hidden'));
  const targetView = document.getElementById(`admin-subview-${tab}`);
  if (targetView) targetView.classList.remove('hidden');
}

// ------------------------------------------------------------------
// ВЫСТАВЛЕНИЕ БАЛЛОВ KPI (СУПЕР-АДМИН)
// ------------------------------------------------------------------
function populateKpiScoringRules() {
  const sel = document.getElementById('kpi-rule-select');
  if (!sel) return;

  const defaultOption = t('optionKpiManual') || '-- Выбрать из регламента (или ввести вручную) --';
  sel.innerHTML = `<option value="">${defaultOption}</option>` +
    state.kpiRules.map(r => {
      const title = getRuleTitle(r);
      return `
        <option value="${r.id}" data-points="${r.points}" data-serious="${r.is_serious}" data-title="${title}">
          [${r.points > 0 ? '+' : ''}${r.points}] ${title}
        </option>
      `;
    }).join('');
}

function openKpiScoringModal(userId) {
  const user = state.adminUsers.find(u => u.id === userId);
  if (!user) return;

  state.selectedKpiUser = user;
  document.getElementById('kpi-target-user-name').textContent = user.full_name;
  document.getElementById('kpi-target-user-meta').textContent = `Класс: ${user.school_class} • Министерство «${user.faction}» • Текущий KPI: ${user.kpi}`;

  document.getElementById('kpi-rule-select').value = '';
  document.getElementById('kpi-custom-points').value = '';
  document.getElementById('kpi-custom-reason').value = '';
  document.getElementById('kpi-is-serious').checked = false;

  document.getElementById('modal-kpi-scoring').classList.remove('hidden');
}

function handleKpiRuleSelect(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;

  const points = opt.dataset.points;
  const isSerious = opt.dataset.serious === '1';
  const title = opt.dataset.title;

  document.getElementById('kpi-custom-points').value = points;
  document.getElementById('kpi-custom-reason').value = title;
  document.getElementById('kpi-is-serious').checked = isSerious;
}

async function submitKpiChange() {
  if (!state.selectedKpiUser) return;

  const points = document.getElementById('kpi-custom-points').value;
  const reason = document.getElementById('kpi-custom-reason').value.trim();
  const is_serious = document.getElementById('kpi-is-serious').checked;

  if (!points || !reason) {
    showToast('Укажите баллы и причину', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${state.selectedKpiUser.id}/kpi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ points, reason, is_serious })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Ошибка', 'error');
      return;
    }

    closeModal('modal-kpi-scoring');
    showToast(data.message, 'success');
    loadAdminDashboard();
    loadLeaderboard();
  } catch (e) {
    showToast('Ошибка сети', 'error');
  }
}

// ------------------------------------------------------------------
// ЗОНА БЕЗОПАСНОСТИ: РАСШИФРОВКА И ПРОСМОТР ПАРОЛЯ
// ------------------------------------------------------------------
function openRevealPasswordModal(userId) {
  state.revealTargetUserId = userId;
  document.getElementById('reveal-admin-password').value = '';
  document.getElementById('reveal-error').classList.add('hidden');
  document.getElementById('reveal-step-auth').classList.remove('hidden');
  document.getElementById('reveal-step-result').classList.add('hidden');

  document.getElementById('modal-reveal-password').classList.remove('hidden');
}

async function confirmRevealPassword() {
  const adminPassword = document.getElementById('reveal-admin-password').value;
  const errBox = document.getElementById('reveal-error');
  errBox.classList.add('hidden');

  if (!adminPassword) {
    errBox.textContent = 'Введите ваш пароль администратора';
    errBox.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${state.revealTargetUserId}/reveal-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ adminPassword })
    });

    const data = await res.json();

    if (!res.ok) {
      errBox.textContent = data.error || 'Неверный пароль администратора';
      errBox.classList.remove('hidden');
      return;
    }

    // Успешно расшифровано!
    document.getElementById('reveal-user-name').textContent = data.full_name;
    document.getElementById('reveal-user-email').textContent = data.email;
    document.getElementById('reveal-result-password').textContent = data.password;

    document.getElementById('reveal-step-auth').classList.add('hidden');
    document.getElementById('reveal-step-result').classList.remove('hidden');
  } catch (e) {
    errBox.textContent = 'Ошибка связи с сервером';
    errBox.classList.remove('hidden');
  }
}

function copyRevealedPassword() {
  const pass = document.getElementById('reveal-result-password').textContent;
  navigator.clipboard.writeText(pass);
  showToast('Пароль скопирован в буфер обмена', 'success');
}

async function handleResetPasswordPrompt(userId) {
  const newPass = prompt('Введите новый пароль для пользователя (или оставьте пустым для генерации "Kurultai2026!"):');
  if (newPass === null) return; // Отмена

  try {
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ newPassword: newPass })
    });

    const data = await res.json();
    if (res.ok) {
      alert(`Пароль успешно сброшен на: ${data.newPassword}\nСообщите его ученику.`);
      showToast('Пароль сброшен', 'success');
    } else {
      showToast(data.error || 'Ошибка', 'error');
    }
  } catch (e) {
    showToast('Ошибка сети', 'error');
  }
}

// ------------------------------------------------------------------
// АПЕЛЛЯЦИИ В АДМИНКЕ
// ------------------------------------------------------------------
async function loadAdminAppeals() {
  try {
    const res = await fetch('/api/admin/appeals', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const appeals = await res.json();
    renderAdminAppeals(appeals);
  } catch (e) {
    console.error('Ошибка загрузки апелляций в админке:', e);
  }
}

function renderAdminAppeals(appeals) {
  const container = document.getElementById('admin-appeals-container');
  if (!container) return;

  if (appeals.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm">Поступивших апелляций нет</div>`;
    return;
  }

  container.innerHTML = appeals.map(a => {
    const isPending = a.status === 'PENDING';
    const isSuperAdmin = state.currentUser.role === 'ADMIN';

    return `
      <div class="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50 transition-smooth">
        <div class="space-y-1 max-w-2xl">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-900">${a.full_name}</span>
            <span class="text-xs text-slate-500">(${a.school_class}, «${a.faction}»)</span>
            ${isPending ? '<span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">Ожидает ответа</span>' : (a.status === 'ACCEPTED' ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Удовлетворена</span>' : '<span class="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">Отклонена</span>')}
          </div>
          ${a.original_reason ? `<div class="text-xs text-rose-700 bg-rose-50 px-2 py-1 rounded inline-block font-medium">Оспариваемый штраф: ${a.original_points} KPI за «${a.original_reason}»</div>` : ''}
          <p class="text-xs text-slate-700 leading-relaxed font-normal bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <strong>Обоснование ученика:</strong> ${a.reason}
          </p>
          ${a.admin_comment ? `<div class="text-xs text-indigo-700 font-medium">Решение Президента: ${a.admin_comment}</div>` : ''}
        </div>

        ${isPending && isSuperAdmin ? `
          <div class="flex items-center gap-2 shrink-0">
            <button onclick="resolveAppealPrompt(${a.id}, 'ACCEPTED')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-smooth">
              <i class="fa-solid fa-check mr-1"></i>Удовлетворить & вернуть баллы
            </button>
            <button onclick="resolveAppealPrompt(${a.id}, 'REJECTED')" class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition-smooth">
              <i class="fa-solid fa-xmark mr-1"></i>Отклонить
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function resolveAppealPrompt(appealId, status) {
  const comment = prompt(status === 'ACCEPTED' ? 'Комментарий к решению (например, "Принято во внимание"): ' : 'Причина отклонения:');
  if (comment === null) return;

  try {
    const res = await fetch(`/api/admin/appeals/${appealId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        status,
        admin_comment: comment,
        revert_points: status === 'ACCEPTED'
      })
    });

    if (res.ok) {
      showToast('Апелляция успешно обработана', 'success');
      loadAdminDashboard();
      loadLeaderboard();
    }
  } catch (e) {
    showToast('Ошибка сервера', 'error');
  }
}

// ------------------------------------------------------------------
// ЭКСПОРТ В EXCEL
// ------------------------------------------------------------------
async function downloadMinistryExcel() {
  try {
    showToast('Формирование отчета для Министерства...', 'info');
    const res = await fetch('/api/export/ministry', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка экспорта');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Otchet_Ministerstvo_Kurultai_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Отчет Министерства успешно скачан в Excel!', 'success');
  } catch (e) {
    showToast('Ошибка при скачивании файла', 'error');
  }
}

async function downloadKpiSummaryExcel() {
  try {
    showToast('Формирование сводной ведомости ФИО + KPI...', 'info');
    const res = await fetch('/api/export/kpi-summary', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка экспорта');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vedomost_KPI_FIO_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Сводная ведомость KPI успешно скачана!', 'success');
  } catch (e) {
    showToast('Ошибка при скачивании файла', 'error');
  }
}

// ------------------------------------------------------------------
// УТИЛИТЫ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ------------------------------------------------------------------
function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-rose-600' : 'bg-slate-900');

  toast.className = `${bg} text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-semibold transform transition-all duration-300 opacity-0 translate-y-2`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-info')} text-sm"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Плавное появление
  setTimeout(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  }, 10);

  // Плавное исчезновение через 3.5 секунды
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ------------------------------------------------------------------
// РЕДАКТИРОВАНИЕ ПОЛЬЗОВАТЕЛЯ И СМЕНА ФРАКЦИИ
// ------------------------------------------------------------------
function openEditUserModal(userId) {
  const user = state.adminUsers.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('edit-user-id').value = user.id;
  document.getElementById('edit-user-fullname').value = user.full_name;
  document.getElementById('edit-user-faction').value = user.faction;
  document.getElementById('edit-user-class').value = user.school_class;
  document.getElementById('edit-user-phone').value = user.phone || '';
  document.getElementById('edit-user-iin').value = user.iin || '';

  document.getElementById('modal-edit-user').classList.remove('hidden');
}

async function submitEditUser() {
  const id = document.getElementById('edit-user-id').value;
  const full_name = document.getElementById('edit-user-fullname').value.trim();
  const faction = document.getElementById('edit-user-faction').value;
  const school_class = document.getElementById('edit-user-class').value.trim();
  const phone = document.getElementById('edit-user-phone').value.trim();
  const iin = document.getElementById('edit-user-iin').value.trim();

  if (!full_name || !faction || !school_class) {
    showToast('Заполните обязательные поля', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${id}/edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ full_name, faction, school_class, phone, iin })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Ошибка сохранения', 'error');
      return;
    }

    closeModal('modal-edit-user');
    showToast(data.message, 'success');
    loadAdminDashboard();
    loadLeaderboard();
  } catch (e) {
    showToast('Ошибка сети', 'error');
  }
}

// ------------------------------------------------------------------
// УДАЛЕНИЕ УЧАСТНИКА С КУРУЛТАЯ (СТРОГО С ПАРОЛЕМ АДМИНИСТРАТОРА)
// ------------------------------------------------------------------
let deleteTargetUserId = null;

function openDeleteUserModal(userId) {
  const user = state.adminUsers.find(u => u.id === userId);
  if (!user) return;

  deleteTargetUserId = userId;
  document.getElementById('delete-user-fullname').textContent = user.full_name;
  document.getElementById('delete-user-meta').textContent = `Класс: ${user.school_class} • Министерство «${user.faction}» • KPI: ${user.kpi}`;
  document.getElementById('delete-admin-password').value = '';
  document.getElementById('delete-error').classList.add('hidden');

  document.getElementById('modal-delete-user').classList.remove('hidden');
}

async function submitDeleteUser() {
  if (!deleteTargetUserId) return;

  const adminPassword = document.getElementById('delete-admin-password').value;
  const errBox = document.getElementById('delete-error');
  errBox.classList.add('hidden');

  if (!adminPassword) {
    errBox.textContent = 'Введите ваш пароль администратора для подтверждения!';
    errBox.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${deleteTargetUserId}/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ adminPassword })
    });

    const data = await res.json();
    if (!res.ok) {
      errBox.textContent = data.error || 'Ошибка удаления';
      errBox.classList.remove('hidden');
      return;
    }

    closeModal('modal-delete-user');
    showToast(data.message, 'success');
    loadAdminDashboard();
    loadLeaderboard();
  } catch (e) {
    errBox.textContent = 'Ошибка сети';
    errBox.classList.remove('hidden');
  }
}

// ------------------------------------------------------------------
// ПРОСМОТР ИСТОРИИ KPI КОНКРЕТНОГО УЧАСТНИКА
// ------------------------------------------------------------------
async function openUserHistoryModal(userId) {
  const user = state.adminUsers.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('user-history-subtitle').textContent = `${user.full_name} (${user.school_class}, «${user.faction}») • Текущий KPI: ${user.kpi > 0 ? '+' : ''}${user.kpi}`;
  const listContainer = document.getElementById('user-history-list');
  listContainer.innerHTML = '<div class="text-center py-6 text-slate-400 text-xs">Загрузка истории...</div>';

  document.getElementById('modal-user-history').classList.remove('hidden');

  try {
    const res = await fetch(`/api/admin/users/${userId}/history`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const history = await res.json();

    if (history.length === 0) {
      listContainer.innerHTML = '<div class="text-center py-6 text-slate-400 text-xs">У данного участника пока нет записей о баллах.</div>';
      return;
    }

    listContainer.innerHTML = history.map(h => {
      const isBonus = h.points > 0;
      const dateFormatted = new Date(h.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });

      return `
        <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div class="flex items-center gap-3">
            <span class="w-9 h-9 rounded-xl ${isBonus ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} flex items-center justify-center font-bold text-xs shrink-0">
              ${isBonus ? '+' : ''}${h.points}
            </span>
            <div>
              <div class="text-xs font-bold text-slate-800">${h.reason}</div>
              <div class="text-[11px] text-slate-400 mt-0.5">Кем: ${h.author_name} • ${dateFormatted}</div>
            </div>
          </div>
          <span class="text-xs font-black ${isBonus ? 'text-emerald-600' : 'text-rose-600'}">
            ${isBonus ? '+' : ''}${h.points}
          </span>
        </div>
      `;
    }).join('');
  } catch (e) {
    listContainer.innerHTML = '<div class="text-center py-6 text-rose-500 text-xs">Ошибка загрузки истории</div>';
  }
}

// ------------------------------------------------------------------
// МАССОВОЕ НАЧИСЛЕНИЕ ВСЕЙ ФРАКЦИИ
// ------------------------------------------------------------------
function openBulkKpiModal() {
  const sel = document.getElementById('bulk-kpi-rule-select');
  if (sel) {
    const defaultOption = t('optionKpiManual') || '-- Выбрать из регламента (или ввести вручную) --';
    sel.innerHTML = `<option value="">${defaultOption}</option>` +
      state.kpiRules.map(r => {
        const title = getRuleTitle(r);
        return `
          <option value="${r.id}" data-points="${r.points}" data-serious="${r.is_serious}" data-title="${title}">
            [${r.points > 0 ? '+' : ''}${r.points}] ${title}
          </option>
        `;
      }).join('');
  }

  document.getElementById('bulk-custom-points').value = '';
  document.getElementById('bulk-custom-reason').value = '';
  document.getElementById('bulk-is-serious').checked = false;

  document.getElementById('modal-bulk-kpi').classList.remove('hidden');
}

function handleBulkKpiRuleSelect(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;

  document.getElementById('bulk-custom-points').value = opt.dataset.points;
  document.getElementById('bulk-custom-reason').value = opt.dataset.title;
  document.getElementById('bulk-is-serious').checked = opt.dataset.serious === '1';
}

async function submitBulkKpi() {
  const faction = document.getElementById('bulk-faction-select').value;
  const points = document.getElementById('bulk-custom-points').value;
  const reason = document.getElementById('bulk-custom-reason').value.trim();
  const is_serious = document.getElementById('bulk-is-serious').checked;

  if (!faction || !points || !reason) {
    showToast('Заполните министерство, баллы и причину', 'error');
    return;
  }

  try {
    const res = await fetch('/api/admin/factions/bulk-kpi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ faction, points, reason, is_serious })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Ошибка', 'error');
      return;
    }

    closeModal('modal-bulk-kpi');
    showToast(data.message, 'success');
    loadAdminDashboard();
    loadLeaderboard();
  } catch (e) {
    showToast('Ошибка сети', 'error');
  }
}

// ------------------------------------------------------------------
// ОБЪЯВЛЕНИЯ И РАСПОРЯЖЕНИЯ ПРЕЗИДЕНТА
// ------------------------------------------------------------------
async function loadAnnouncements() {
  try {
    const res = await fetch('/api/public/announcements');
    const list = await res.json();
    renderAnnouncements(list);
  } catch (e) {
    console.error('Ошибка объявлений:', e);
  }
}

function renderAnnouncements(list) {
  const container = document.getElementById('home-announcements-list');
  const createBtn = document.getElementById('admin-create-ann-btn');
  if (!container) return;

  // Публиковать могут ТОЛЬКО Президент (ADMIN) и Министры/Модераторы (MODERATOR)
  const canPublish = !!(state.currentUser && (state.currentUser.role === 'ADMIN' || state.currentUser.role === 'MODERATOR'));
  const isSuperAdmin = !!(state.currentUser && state.currentUser.role === 'ADMIN');

  if (createBtn) {
    if (canPublish) {
      createBtn.classList.remove('hidden');
    } else {
      createBtn.classList.add('hidden');
    }
  }

  if (list.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 py-2">Распоряжений и объявлений пока нет.</div>`;
    return;
  }

  container.innerHTML = list.map(a => {
    const dateFormatted = new Date(a.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
    const canDeleteThis = isSuperAdmin || (state.currentUser && state.currentUser.id === a.author_id);
    const authorRoleText = a.author_role === 'ADMIN' 
      ? `Аппарат Президента • ${a.author_name}` 
      : `Министерство «${a.author_faction || 'Курултай'}» • ${a.author_name}`;

    return `
      <div class="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
        <div class="flex items-center justify-between">
          <div class="text-xs font-black text-slate-900">${a.title}</div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-slate-400">${dateFormatted}</span>
            ${canDeleteThis ? `<button onclick="deleteAnnouncement(${a.id})" class="text-slate-400 hover:text-rose-600 text-xs p-1" title="Удалить объявление"><i class="fa-solid fa-trash-can"></i></button>` : ''}
          </div>
        </div>
        <p class="text-xs text-slate-600 leading-relaxed">${a.content}</p>
        <div class="text-[10px] text-amber-700 font-semibold pt-1">${authorRoleText}</div>
      </div>
    `;
  }).join('');
}

function openCreateAnnouncementModal() {
  const canPublish = !!(state.currentUser && (state.currentUser.role === 'ADMIN' || state.currentUser.role === 'MODERATOR'));
  if (!canPublish) {
    showToast('Публикация доступна только Президенту и Модераторам', 'error');
    return;
  }
  document.getElementById('ann-title').value = '';
  document.getElementById('ann-content').value = '';
  document.getElementById('modal-create-announcement').classList.remove('hidden');
}

async function submitAnnouncement() {
  const canPublish = !!(state.currentUser && (state.currentUser.role === 'ADMIN' || state.currentUser.role === 'MODERATOR'));
  if (!canPublish) {
    showToast('Публикация доступна только Президенту и Модераторам', 'error');
    return;
  }

  const title = document.getElementById('ann-title').value.trim();
  const content = document.getElementById('ann-content').value.trim();

  if (!title || !content) {
    showToast('Заполните заголовок и текст', 'error');
    return;
  }

  try {
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ title, content })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Ошибка', 'error');
      return;
    }

    closeModal('modal-create-announcement');
    showToast('Распоряжение опубликовано!', 'success');
    loadAnnouncements();
  } catch (e) {
    showToast('Ошибка сети', 'error');
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('Удалить это объявление?')) return;
  try {
    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      showToast('Объявление удалено', 'info');
      loadAnnouncements();
    }
  } catch (e) {
    showToast('Ошибка сети', 'error');
  }
}

// ------------------------------------------------------------------
// ЛИЧНОЕ ДЕЛО / ПРОФИЛЬ УЧАСТНИКА
// ------------------------------------------------------------------
async function openUserProfileModal(userId) {
  try {
    const res = await fetch(`/api/public/users/${userId}/profile`);
    if (!res.ok) {
      showToast((state.lang || 'kz') === 'kz' ? 'Профильді жүктеу мүмкін болмады' : 'Не удалось загрузить профиль', 'error');
      return;
    }
    const p = await res.json();

    const initials = p.full_name.split(' ').map(n => n[0]).join('').slice(0, 2);
    document.getElementById('profile-modal-avatar').textContent = initials;
    document.getElementById('profile-modal-fullname').textContent = p.full_name;
    document.getElementById('profile-modal-class').textContent = p.school_class;
    document.getElementById('profile-modal-faction').textContent = `«${p.faction}»`;

    const roleText = p.role === 'ADMIN' ? t('rolePresident') : (p.role === 'MODERATOR' ? t('roleMinister') : t('roleMember'));
    document.getElementById('profile-modal-role').textContent = roleText;
    document.getElementById('profile-modal-mandate-num').textContent = p.mandate_number;

    const kpiEl = document.getElementById('profile-modal-kpi');
    kpiEl.textContent = (p.kpi > 0 ? '+' : '') + p.kpi;
    kpiEl.className = p.kpi >= 50 ? 'text-xl font-black text-emerald-600 mt-0.5' : (p.kpi < 0 ? 'text-xl font-black text-rose-600 mt-0.5' : 'text-xl font-black text-slate-700 mt-0.5');

    document.getElementById('profile-modal-violations').textContent = p.serious_violations;

    let statusText = t('statusNormal');
    if (p.kpi >= 100) statusText = `🏆 ${t('statusCert')}`;
    else if (p.kpi <= -100 || p.serious_violations >= 3) statusText = `⚠️ ${t('statusRisk')}`;
    else if (p.kpi >= 50) statusText = `⭐ ${t('statusLeader')}`;
    document.getElementById('profile-modal-status-badge').textContent = statusText;

    const histList = document.getElementById('profile-modal-history-list');
    if (p.recent_history && p.recent_history.length > 0) {
      histList.innerHTML = p.recent_history.map(h => {
        const reasonText = (state.lang || 'kz') === 'kz' && window.kpiRulesTranslationsKz && window.kpiRulesTranslationsKz[h.reason]
          ? window.kpiRulesTranslationsKz[h.reason]
          : h.reason;
        return `
          <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-slate-700">${reasonText}</span>
            <span class="font-bold ${h.points > 0 ? 'text-emerald-600' : 'text-rose-600'}">${h.points > 0 ? '+' : ''}${h.points}</span>
          </div>
        `;
      }).join('');
    } else {
      histList.innerHTML = `<div class="text-slate-400 py-1">${t('noRecords')}</div>`;
    }

    // Кнопка перехода к служебному удостоверению
    document.getElementById('profile-modal-open-mandate-btn').onclick = () => {
      closeModal('modal-user-profile');
      openDelegateIdCardModal(userId);
    };

    document.getElementById('modal-user-profile').classList.remove('hidden');
  } catch (e) {
    showToast((state.lang || 'kz') === 'kz' ? 'Профильді жүктеу қатесі' : 'Ошибка загрузки профиля', 'error');
  }
}

// ------------------------------------------------------------------
// ОФИЦИАЛЬНОЕ СЛУЖЕБНОЕ УДОСТОВЕРЕНИЕ (КУӘЛІК)
// ------------------------------------------------------------------
async function openDelegateIdCardModal(userId) {
  try {
    const res = await fetch(`/api/public/users/${userId}/profile`);
    if (!res.ok) {
      showToast((state.lang || 'kz') === 'kz' ? 'Куәлікті жүктеу мүмкін болмады' : 'Не удалось загрузить удостоверение', 'error');
      return;
    }
    const p = await res.json();

    const initials = p.full_name.split(' ').map(n => n[0]).join('').slice(0, 2);
    document.getElementById('mandate-card-avatar').textContent = initials;
    document.getElementById('mandate-card-number').textContent = `№ ${p.mandate_number}`;
    document.getElementById('mandate-card-name').textContent = p.full_name;
    document.getElementById('mandate-card-faction').textContent = `«${p.faction}»`;

    const classSuffix = (state.lang || 'kz') === 'kz' ? 'СЫНЫП' : 'КЛАСС';
    document.getElementById('mandate-card-class').textContent = `${p.school_class} ${classSuffix}`;

    const roleName = p.role === 'ADMIN' ? t('mandateRolePresident') : (p.role === 'MODERATOR' ? t('mandateRoleMinister') : t('mandateRoleMember'));
    document.getElementById('mandate-card-role').textContent = roleName;

    document.getElementById('modal-delegate-mandate').classList.remove('hidden');
  } catch (e) {
    showToast((state.lang || 'kz') === 'kz' ? 'Куәлікті жүктеу қатесі' : 'Ошибка загрузки удостоверения', 'error');
  }
}

function printDelegateMandate() {
  window.print();
}
