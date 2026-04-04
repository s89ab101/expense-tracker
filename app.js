import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut as fbSignOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, onSnapshot, query, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// ── Firebase 設定 ──
const firebaseConfig = {
  apiKey: "AIzaSyD16FMKs6-NDdA8P18jgiL35noGExPRUcM",
  authDomain: "expense-tracker-d62bc.firebaseapp.com",
  projectId: "expense-tracker-d62bc",
  storageBucket: "expense-tracker-d62bc.firebasestorage.app",
  messagingSenderId: "437530037218",
  appId: "1:437530037218:web:d8620931a50631bad087bb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ── 分類資料 ──
const DEFAULT_EXPENSE_CATS = [
  {id:'food',      emoji:'🍱', name:'餐飲',   color:'#1D9E75'},
  {id:'transport', emoji:'🚇', name:'交通',   color:'#185FA5'},
  {id:'shopping',  emoji:'🛍', name:'購物',   color:'#D85A30'},
  {id:'entertainment',emoji:'🎮',name:'娛樂', color:'#534AB7'},
  {id:'medical',   emoji:'💊', name:'醫療',   color:'#A32D2D'},
  {id:'utility',   emoji:'💡', name:'帳單',   color:'#BA7517'},
  {id:'education', emoji:'📚', name:'教育',   color:'#3B6D11'},
  {id:'other',     emoji:'📝', name:'其他',   color:'#7a7872'},
];
const DEFAULT_INCOME_CATS = [
  {id:'salary',   emoji:'💼', name:'薪資', color:'#1D9E75'},
  {id:'bonus',    emoji:'🎁', name:'獎金', color:'#BA7517'},
  {id:'invest',   emoji:'📈', name:'投資', color:'#185FA5'},
  {id:'parttime', emoji:'🤝', name:'兼職', color:'#534AB7'},
  {id:'other',    emoji:'💰', name:'其他', color:'#7a7872'},
];
let EXPENSE_CATS = [...DEFAULT_EXPENSE_CATS];
let INCOME_CATS  = [...DEFAULT_INCOME_CATS];

const CAT_COLORS = ['#1D9E75','#185FA5','#D85A30','#534AB7','#A32D2D','#BA7517','#3B6D11','#7a7872','#0f7a5a','#c94c28'];
const CAT_EMOJIS = ['🍱','🚇','🛍','🎮','💊','💡','📚','📝','💼','🎁','📈','🤝','💰','☕','🏠','✈️','🎵','🐾','💄','🏋️','🍺','🎂','🚗','📱'];
const DEFAULT_BUDGETS = {food:8000,transport:3000,shopping:5000,entertainment:2000,medical:1500,utility:2000,education:2000};

// ── 狀態 ──
let currentUser = null;
let txs = [];
let budgets = {...DEFAULT_BUDGETS};
let currency = 'NT$';
let notify = true;
let curType = 'expense';
let selCat = 'food';
let curYear, curMonth;
let activeTab = 'home';
let unsubscribeTxs = null;
let unsubscribeBudgets = null;

// ── Auth：Email + 密碼（iOS Safari 100% 相容）──
window.doLogin = async (isRegister) => {
  const email = document.getElementById('inp-email').value.trim();
  const pass = document.getElementById('inp-pass').value;
  const name = document.getElementById('inp-name') ? document.getElementById('inp-name').value.trim() : '';

  if (!email || !pass) { showToast('請填寫帳號和密碼'); return; }
  if (pass.length < 6) { showToast('密碼至少需要 6 個字元'); return; }

  const btn = document.getElementById('auth-submit-btn');
  btn.textContent = '處理中…';
  btn.disabled = true;

  try {
    if (isRegister) {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      if (name) await updateProfile(result.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
  } catch(e) {
    btn.textContent = isRegister ? '註冊' : '登入';
    btn.disabled = false;
    const msgs = {
      'auth/email-already-in-use': '此 Email 已被註冊，請直接登入',
      'auth/user-not-found': '找不到此帳號，請先註冊',
      'auth/wrong-password': '密碼錯誤',
      'auth/invalid-email': 'Email 格式不正確',
      'auth/invalid-credential': '帳號或密碼錯誤',
      'auth/too-many-requests': '嘗試次數過多，請稍後再試',
      'auth/network-request-failed': '網路連線失敗',
    };
    showToast(msgs[e.code] || '錯誤：' + e.code);
  }
};

window.toggleAuthMode = () => {
  const isReg = document.getElementById('auth-mode').dataset.mode === 'register';
  setAuthMode(!isReg);
};

function setAuthMode(isRegister) {
  document.getElementById('auth-mode').dataset.mode = isRegister ? 'register' : 'login';
  document.getElementById('auth-title').textContent = isRegister ? '建立帳號' : '登入';
  document.getElementById('auth-submit-btn').textContent = isRegister ? '註冊' : '登入';
  document.getElementById('auth-toggle-text').textContent = isRegister ? '已有帳號？' : '還沒有帳號？';
  document.getElementById('auth-toggle-btn').textContent = isRegister ? '登入' : '免費註冊';
  const nameRow = document.getElementById('name-row');
  if (nameRow) nameRow.style.display = isRegister ? 'block' : 'none';
}

window.signOut = async () => {
  if (!confirm('確定要登出嗎？')) return;
  if (unsubscribeTxs) unsubscribeTxs();
  if (unsubscribeBudgets) unsubscribeBudgets();
  await fbSignOut(auth);
  txs = [];
  setAuthMode(false);
  document.getElementById('login-screen').classList.remove('hidden');
  showToast('已登出');
};

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    document.getElementById('login-screen').classList.add('hidden');
    setupUserUI(user);
    subscribeToData();
  } else {
    document.getElementById('login-screen').classList.remove('hidden');
  }
});

function setupUserUI(user) {
  const avatar = user.photoURL || '';
  const name = user.displayName || user.email || '使用者';

  if (avatar) {
    const img = document.getElementById('user-avatar');
    img.src = avatar; img.style.display = 'block';
    const lgImg = document.getElementById('profile-avatar-lg');
    lgImg.src = avatar; lgImg.style.display = 'block';
    document.getElementById('profile-avatar-fallback').style.display = 'none';
  }
  document.getElementById('profile-name').textContent = name;

  currency = localStorage.getItem('currency_' + user.uid) || 'NT$';
  notify = localStorage.getItem('notify_' + user.uid) !== 'false';
  document.getElementById('currency-sel').value = currency;
  document.getElementById('currency-prefix').textContent = currency;
  document.getElementById('notify-toggle').className = 'toggle-switch' + (notify ? '' : ' off');
  document.getElementById('currency-sel').onchange = (e) => {
    currency = e.target.value;
    localStorage.setItem('currency_' + user.uid, currency);
    document.getElementById('currency-prefix').textContent = currency;
    renderAll();
  };

  const now = new Date();
  curYear = now.getFullYear();
  curMonth = now.getMonth() + 1;
  document.getElementById('inp-date').value = now.toISOString().slice(0,10);
  updateMonthLabel();
  await loadCatsFromFirestore();
  renderCatsGrid();
}

// ── Firestore 即時監聽 ──
function subscribeToData() {
  if (!currentUser) return;
  setSyncState('syncing');

  const uid = currentUser.uid;

  if (unsubscribeTxs) unsubscribeTxs();
  const txRef = collection(db, 'users', uid, 'transactions');
  const txQuery = query(txRef, orderBy('date', 'desc'));
  unsubscribeTxs = onSnapshot(txQuery, snap => {
    txs = snap.docs.map(d => ({id: d.id, ...d.data()}));
    renderAll();
    setSyncState('ok');
  }, () => setSyncState('error'));

  if (unsubscribeBudgets) unsubscribeBudgets();
  const budgetRef = doc(db, 'users', uid, 'settings', 'budgets');
  unsubscribeBudgets = onSnapshot(budgetRef, snap => {
    if (snap.exists()) budgets = {...DEFAULT_BUDGETS, ...snap.data()};
    else budgets = {...DEFAULT_BUDGETS};
    if (activeTab === 'budget') renderBudget();
  });
}

function setSyncState(state) {
  const dot = document.getElementById('sync-dot');
  const text = document.getElementById('sync-text');
  dot.className = 'sync-dot' + (state === 'syncing' ? ' syncing' : state === 'error' ? ' error' : '');
  text.textContent = state === 'syncing' ? '同步中' : state === 'error' ? '離線' : '已同步';
}

// ── 格式化 ──
function fmt(n) {
  return currency + Math.abs(Math.round(n)).toLocaleString('zh-TW');
}
function monthKey(y, m) { return y + '-' + String(m).padStart(2,'0'); }
function getTxMonth(y, m) {
  const k = monthKey(y, m);
  return txs.filter(t => t.date && t.date.startsWith(k));
}

// ── 渲染 ──
function renderAll() {
  renderHome();
  if (activeTab === 'chart') renderChart();
  if (activeTab === 'budget') renderBudget();
  if (activeTab === 'settings') renderSettings();
}

function updateMonthLabel() {
  document.getElementById('month-label').textContent = `${curYear}年${curMonth}月`;
}

function renderHome() {
  const list = getTxMonth(curYear, curMonth);
  const exp = list.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const inc = list.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const bal = inc - exp;
  document.getElementById('sum-exp').textContent = fmt(exp);
  document.getElementById('sum-inc').textContent = fmt(inc);
  const balEl = document.getElementById('sum-bal');
  balEl.textContent = (bal >= 0 ? '+' : '-') + fmt(bal);
  balEl.style.color = bal >= 0 ? 'var(--teal)' : 'var(--coral)';

  const container = document.getElementById('tx-list-container');
  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-emoji">📭</div><div class="empty-text">本月還沒有記錄<br>點擊下方 + 新增第一筆</div></div>`;
    return;
  }
  const grouped = {};
  [...list].sort((a,b) => b.date.localeCompare(a.date)).forEach(t => {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });
  container.innerHTML = Object.entries(grouped).map(([date, items]) => {
    const d = new Date(date + 'T00:00:00');
    const wd = ['日','一','二','三','四','五','六'][d.getDay()];
    const dayExp = items.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    return `<div class="tx-group">
      <div class="tx-date-row">
        <span class="tx-date-text">${date.slice(5).replace('-','/')} 週${wd}</span>
        <span class="tx-date-sum">${dayExp > 0 ? '-'+fmt(dayExp) : ''}</span>
      </div>
      ${items.map(t => {
        const cats = t.type==='expense' ? EXPENSE_CATS : INCOME_CATS;
        const cat = cats.find(c=>c.id===t.cat) || cats[cats.length-1];
        return `<div class="tx-item">
          <div class="tx-icon" style="background:${cat.color}20;">${cat.emoji}</div>
          <div class="tx-info"><div class="tx-name">${t.note || cat.name}</div><div class="tx-cat">${cat.name}</div></div>
          <div class="tx-amount ${t.type==='expense'?'neg':'pos'}">${t.type==='expense'?'-':'+'}${fmt(t.amount)}</div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

function renderChart() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let m = curMonth - i, y = curYear;
    if (m <= 0) { m += 12; y--; }
    months.push({y, m});
  }
  const exps = months.map(({y,m}) => getTxMonth(y,m).filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
  const maxE = Math.max(...exps, 1);
  document.getElementById('monthly-bars').innerHTML = months.map(({y,m},i) => {
    const isCur = y===curYear && m===curMonth;
    const h = Math.max(4, Math.round(exps[i]/maxE*70));
    return `<div class="bar-col"><div class="bar-fill" style="height:${h}px;background:${isCur?'var(--teal)':'var(--teal-light)'}"></div><span class="bar-month">${m}月</span></div>`;
  }).join('');

  const list = getTxMonth(curYear, curMonth).filter(t=>t.type==='expense');
  const catTotals = {};
  list.forEach(t => catTotals[t.cat] = (catTotals[t.cat]||0) + t.amount);
  const total = Object.values(catTotals).reduce((a,b)=>a+b,0) || 1;
  const sorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);

  const svg = document.getElementById('donut-svg');
  const legend = document.getElementById('donut-legend');
  if (!sorted.length) {
    svg.innerHTML = `<circle cx="55" cy="55" r="38" fill="none" stroke="var(--bg3)" stroke-width="18"/>`;
    legend.innerHTML = `<span style="font-size:12px;color:var(--text3)">本月無支出</span>`;
  } else {
    let angle = -90;
    const paths = sorted.map(([cat, amt]) => {
      const pct = amt/total;
      const sa = angle*Math.PI/180, ea = (angle+pct*360)*Math.PI/180;
      const x1=55+38*Math.cos(sa),y1=55+38*Math.sin(sa),x2=55+38*Math.cos(ea),y2=55+38*Math.sin(ea);
      const catObj = EXPENSE_CATS.find(c=>c.id===cat)||EXPENSE_CATS[EXPENSE_CATS.length-1];
      angle += pct*360;
      return `<path d="M55 55 L${x1.toFixed(1)} ${y1.toFixed(1)} A38 38 0 ${pct>.5?1:0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${catObj.color}" opacity="0.88"/>`;
    });
    svg.innerHTML = paths.join('') + `<circle cx="55" cy="55" r="24" fill="var(--bg)"/>`;
    legend.innerHTML = sorted.slice(0,5).map(([cat,amt]) => {
      const catObj=EXPENSE_CATS.find(c=>c.id===cat)||EXPENSE_CATS[EXPENSE_CATS.length-1];
      return `<div class="legend-item"><div class="legend-dot" style="background:${catObj.color}"></div><span>${catObj.emoji} ${catObj.name}</span><span class="legend-pct">${Math.round(amt/total*100)}%</span></div>`;
    }).join('');
  }
  document.getElementById('cat-progress').innerHTML = sorted.map(([cat,amt]) => {
    const catObj=EXPENSE_CATS.find(c=>c.id===cat)||EXPENSE_CATS[EXPENSE_CATS.length-1];
    const pct=Math.round(amt/total*100);
    return `<div class="prog-item"><div class="prog-header"><span class="prog-cat">${catObj.emoji} ${catObj.name}</span><span class="prog-amt">${fmt(amt)} (${pct}%)</span></div><div class="prog-bar-bg"><div class="prog-bar-fill" style="width:${pct}%;background:${catObj.color};"></div></div></div>`;
  }).join('') || `<div class="empty-state" style="padding:20px 0;"><div class="empty-emoji" style="font-size:32px;">📊</div><div class="empty-text">本月無支出資料</div></div>`;
}

function renderBudget() {
  const list = getTxMonth(curYear, curMonth).filter(t=>t.type==='expense');
  const spent = {};
  list.forEach(t => spent[t.cat]=(spent[t.cat]||0)+t.amount);
  document.getElementById('budget-list').innerHTML = Object.entries(budgets).map(([cat,budget]) => {
    const catObj=EXPENSE_CATS.find(c=>c.id===cat);
    if (!catObj) return '';
    const s=spent[cat]||0, pct=Math.min(100,Math.round(s/budget*100));
    const over=s>budget, warn=!over&&pct>80;
    const barColor=over?'var(--red)':warn?'var(--amber)':'var(--teal)';
    return `<div class="budget-card">
      <div class="budget-header"><div class="budget-cat-name">${catObj.emoji} ${catObj.name}</div><div class="budget-amounts">${fmt(s)} / ${fmt(budget)}</div></div>
      <div class="budget-bar-bg"><div class="budget-bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
      <div class="budget-note" style="color:${over?'var(--red)':warn?'var(--amber)':'var(--text3)'};">${over?'⚠ 超出預算 '+fmt(s-budget):'剩餘 '+fmt(budget-s)}</div>
    </div>`;
  }).join('');
}

function renderSettings() {
  if (!currentUser) return;
  const list = getTxMonth(curYear, curMonth);
  const exp = list.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const inc = list.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  document.getElementById('profile-sub').textContent =
    `${curYear}年${curMonth}月 · ${list.length}筆 · 結餘${inc-exp>=0?'+':'-'}${fmt(inc-exp)}`;
}

// ── 導航 ──
window.switchTab = (name) => {
  activeTab = name;
  ['home','chart','budget','settings'].forEach(n => {
    document.getElementById('screen-'+n).classList.toggle('active', n===name);
    document.getElementById('tab-'+n).classList.toggle('active', n===name);
  });
  document.getElementById('fab').classList.toggle('hidden', name!=='home');
  if (name==='chart') renderChart();
  if (name==='budget') renderBudget();
  if (name==='settings') renderSettings();
};

window.changeMonth = (dir) => {
  curMonth += dir;
  if (curMonth > 12) { curMonth=1; curYear++; }
  if (curMonth < 1)  { curMonth=12; curYear--; }
  updateMonthLabel(); renderHome();
};

window.jumpToToday = () => {
  const now = new Date();
  curYear=now.getFullYear(); curMonth=now.getMonth()+1;
  updateMonthLabel(); renderHome();
};

// ── 新增記帳 ──
window.openAddSheet = () => {
  document.getElementById('inp-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('inp-amount').value = '';
  document.getElementById('inp-note').value = '';
  curType='expense'; selCat='food';
  document.getElementById('type-exp').className='type-btn active exp';
  document.getElementById('type-inc').className='type-btn inc';
  renderCatsGrid();
  openSheet('add-sheet');
  setTimeout(() => document.getElementById('inp-amount').focus(), 350);
};

window.setType = (t) => {
  curType=t;
  document.getElementById('type-exp').className='type-btn'+(t==='expense'?' active exp':' exp');
  document.getElementById('type-inc').className='type-btn'+(t==='income'?' active inc':' inc');
  selCat=t==='expense'?'food':'salary';
  renderCatsGrid();
};

function renderCatsGrid() {
  const cats = curType==='expense' ? EXPENSE_CATS : INCOME_CATS;
  const grid = document.getElementById('cats-grid');
  grid.innerHTML = cats.map(c =>
    `<button class="cat-btn${c.id===selCat?' sel':''}" data-cat="${c.id}">
      <span class="cat-emoji-large">${c.emoji}</span><span>${c.name}</span>
    </button>`
  ).join('') +
  `<button class="cat-btn" id="add-cat-btn" style="border-style:dashed;">
    <span class="cat-emoji-large">＋</span><span>新增</span>
  </button>`;

  grid.querySelectorAll('.cat-btn[data-cat]').forEach(btn => {
    const select = (e) => {
      e.preventDefault();
      selCat = btn.dataset.cat;
      renderCatsGrid();
    };
    btn.addEventListener('touchend', select, {passive:false});
    btn.addEventListener('click', select);
  });
  const addBtn = document.getElementById('add-cat-btn');
  if (addBtn) {
    addBtn.addEventListener('touchend', (e) => { e.preventDefault(); openCustomCatSheet(); }, {passive:false});
    addBtn.addEventListener('click', openCustomCatSheet);
  }
}
window.renderCatsGrid = renderCatsGrid;

window.addTx = async () => {
  if (!currentUser) return;
  const amt = parseFloat(document.getElementById('inp-amount').value);
  if (!amt || amt <= 0) { document.getElementById('inp-amount').style.borderBottomColor='var(--red)'; setTimeout(()=>document.getElementById('inp-amount').style.borderBottomColor='',1000); return; }
  const note = document.getElementById('inp-note').value.trim();
  const date = document.getElementById('inp-date').value || new Date().toISOString().slice(0,10);
  const id = Date.now().toString();
  setSyncState('syncing');
  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'transactions', id), {
      type: curType, amount: amt, cat: selCat, note, date, createdAt: Date.now()
    });
    closeSheets();
    showToast(curType==='expense'?'已記錄支出 '+fmt(amt):'已記錄收入 '+fmt(amt));
  } catch(e) {
    showToast('儲存失敗，請檢查網路');
    setSyncState('error');
  }
};

// ── 自訂分類 ──
function openCustomCatSheet() {
  closeSheets();
  const type = curType;
  const cats = type==='expense' ? EXPENSE_CATS : INCOME_CATS;

  document.getElementById('custom-cat-title').textContent = (type==='expense'?'支出':'收入') + '分類管理';

  // render existing cats
  renderCustomCatList(type);

  // reset add form
  document.getElementById('new-cat-name').value = '';
  document.getElementById('new-cat-type').value = type;
  selectedNewEmoji = '⭐';
  selectedNewColor = CAT_COLORS[0];
  renderEmojiPicker();
  renderColorPicker();

  openSheet('custom-cat-sheet');
}

let selectedNewEmoji = '⭐';
let selectedNewColor = CAT_COLORS[0];

function renderCustomCatList(type) {
  const cats = type==='expense' ? EXPENSE_CATS : INCOME_CATS;
  const defaultIds = (type==='expense' ? DEFAULT_EXPENSE_CATS : DEFAULT_INCOME_CATS).map(c=>c.id);
  document.getElementById('custom-cat-list').innerHTML = cats.map(c => {
    const isDefault = defaultIds.includes(c.id);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border);">
      <div style="width:36px;height:36px;border-radius:10px;background:${c.color}20;display:flex;align-items:center;justify-content:center;font-size:18px;">${c.emoji}</div>
      <span style="flex:1;font-size:14px;font-weight:500;color:var(--text);">${c.name}</span>
      ${isDefault
        ? `<span style="font-size:11px;color:var(--text3);padding:2px 8px;background:var(--bg3);border-radius:10px;">預設</span>`
        : `<button onclick="deleteCustomCat('${c.id}','${type}')" style="font-size:18px;color:var(--red);padding:4px 8px;">🗑</button>`
      }
    </div>`;
  }).join('');
}

function renderEmojiPicker() {
  document.getElementById('emoji-picker').innerHTML = CAT_EMOJIS.map(e =>
    `<button style="font-size:22px;width:40px;height:40px;border-radius:10px;background:${e===selectedNewEmoji?'var(--teal-light)':'var(--bg2)'};border:${e===selectedNewEmoji?'1.5px solid var(--teal)':'0.5px solid var(--border)'};cursor:pointer;" data-emoji="${e}">${e}</button>`
  ).join('');
  document.getElementById('emoji-picker').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { selectedNewEmoji = btn.dataset.emoji; renderEmojiPicker(); });
  });
}

function renderColorPicker() {
  document.getElementById('color-picker').innerHTML = CAT_COLORS.map(c =>
    `<button style="width:32px;height:32px;border-radius:50%;background:${c};border:${c===selectedNewColor?'3px solid var(--text)':'2px solid transparent'};cursor:pointer;" data-color="${c}"></button>`
  ).join('');
  document.getElementById('color-picker').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { selectedNewColor = btn.dataset.color; renderColorPicker(); });
  });
}

window.deleteCustomCat = async (id, type) => {
  if (!currentUser) return;
  if (type==='expense') EXPENSE_CATS = EXPENSE_CATS.filter(c=>c.id!==id);
  else INCOME_CATS = INCOME_CATS.filter(c=>c.id!==id);
  await saveCatsToFirestore();
  renderCustomCatList(type);
  showToast('已刪除分類');
};

window.addCustomCat = async () => {
  const name = document.getElementById('new-cat-name').value.trim();
  const type = document.getElementById('new-cat-type').value;
  if (!name) { document.getElementById('new-cat-name').style.borderColor='var(--red)'; setTimeout(()=>document.getElementById('new-cat-name').style.borderColor='',1000); return; }
  const id = 'custom_' + Date.now();
  const newCat = { id, emoji: selectedNewEmoji, name, color: selectedNewColor };
  if (type==='expense') EXPENSE_CATS = [...EXPENSE_CATS.filter(c=>c.id!=='other'), newCat, EXPENSE_CATS.find(c=>c.id==='other')].filter(Boolean);
  else INCOME_CATS = [...INCOME_CATS.filter(c=>c.id!=='other'), newCat, INCOME_CATS.find(c=>c.id==='other')].filter(Boolean);
  await saveCatsToFirestore();
  document.getElementById('new-cat-name').value = '';
  selectedNewEmoji = '⭐';
  renderEmojiPicker();
  renderCustomCatList(type);
  showToast('已新增分類：' + name);
};

async function saveCatsToFirestore() {
  if (!currentUser) return;
  try {
    await setDoc(doc(db,'users',currentUser.uid,'settings','categories'), {
      expense: EXPENSE_CATS, income: INCOME_CATS
    });
  } catch(e) { showToast('分類儲存失敗'); }
}

async function loadCatsFromFirestore() {
  if (!currentUser) return;
  try {
    const { getDoc } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js");
    const snap = await getDoc(doc(db,'users',currentUser.uid,'settings','categories'));
    if (snap.exists()) {
      const data = snap.data();
      if (data.expense && data.expense.length) EXPENSE_CATS = data.expense;
      if (data.income && data.income.length) INCOME_CATS = data.income;
    }
  } catch(e) {}
}
window.editBudgetSheet = () => {
  document.getElementById('budget-edit-fields').innerHTML = EXPENSE_CATS.slice(0,7).map(c=>
    `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <span style="font-size:20px;width:28px;">${c.emoji}</span>
      <span style="flex:1;font-size:14px;font-weight:500;">${c.name}</span>
      <div style="display:flex;align-items:center;gap:4px;">
        <span style="font-size:13px;color:var(--text3);">NT$</span>
        <input id="b-${c.id}" type="number" value="${budgets[c.id]||0}" style="width:80px;font-size:14px;font-weight:600;text-align:right;border:0.5px solid var(--border2);background:var(--bg2);border-radius:8px;padding:7px 8px;color:var(--text);outline:none;"/>
      </div>
    </div>`
  ).join('');
  openSheet('budget-sheet');
};

window.saveBudgets = async () => {
  if (!currentUser) return;
  const newB = {};
  EXPENSE_CATS.slice(0,7).forEach(c => {
    const v=parseFloat(document.getElementById('b-'+c.id)?.value||0);
    if (!isNaN(v)) newB[c.id]=v;
  });
  try {
    await setDoc(doc(db,'users',currentUser.uid,'settings','budgets'), newB);
    budgets={...newB};
    closeSheets(); renderBudget(); showToast('預算已更新');
  } catch(e) { showToast('儲存失敗'); }
};

// ── 設定 ──
window.toggleNotify = () => {
  if (!currentUser) return;
  notify=!notify;
  localStorage.setItem('notify_'+currentUser.uid, notify);
  document.getElementById('notify-toggle').className='toggle-switch'+(notify?'':' off');
  showToast(notify?'提醒已開啟':'提醒已關閉');
};

window.exportData = () => {
  const header='date,type,category,note,amount\n';
  const rows=txs.map(t=>{
    const cats=t.type==='expense'?EXPENSE_CATS:INCOME_CATS;
    const cat=cats.find(c=>c.id===t.cat)||{name:t.cat};
    return `${t.date},${t.type==='expense'?'支出':'收入'},${cat.name},${t.note||''},${t.amount}`;
  }).join('\n');
  const blob=new Blob(['\uFEFF'+header+rows],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='記帳本_export.csv'; a.click();
  showToast('CSV 已匯出');
};

window.confirmClear = async () => {
  if (!currentUser) return;
  if (!confirm('確定要清除所有記帳資料？\n此操作無法復原。')) return;
  setSyncState('syncing');
  try {
    const batch=writeBatch(db);
    txs.forEach(t => batch.delete(doc(db,'users',currentUser.uid,'transactions',t.id)));
    await batch.commit();
    showToast('已清除所有資料');
  } catch(e) { showToast('清除失敗'); setSyncState('error'); }
};

// ── Sheet / Overlay ──
function openSheet(id) {
  document.getElementById('overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}
window.closeSheets = () => {
  document.getElementById('overlay').classList.remove('open');
  document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('open'));
};

// ── Toast ──
let toastTimer;
function showToast(msg) {
  const el=document.getElementById('toast');
  el.textContent=msg; el.style.opacity='1'; el.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(-50%) translateY(20px)'; },2200);
}

// ── 滑動切換 ──
const tabs=['home','chart','budget','settings'];
let touchStartX=0, touchStartY=0;
document.getElementById('screens').addEventListener('touchstart',e=>{touchStartX=e.touches[0].clientX;touchStartY=e.touches[0].clientY;},{passive:true});
document.getElementById('screens').addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-touchStartX;
  const dy=e.changedTouches[0].clientY-touchStartY;
  if (Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5){
    const idx=tabs.indexOf(activeTab);
    if (dx<0&&idx<tabs.length-1) switchTab(tabs[idx+1]);
    if (dx>0&&idx>0) switchTab(tabs[idx-1]);
  }
},{passive:true});

// ── URL 快速記帳 ──
const params=new URLSearchParams(window.location.search);
if (params.get('quick')==='1') {
  onAuthStateChanged(auth, user => {
    if (user) setTimeout(()=>{
      openAddSheet();
      const amt=params.get('amount'), cat=params.get('cat'), note=params.get('note'), type=params.get('type')||'expense';
      setType(type);
      if (amt) document.getElementById('inp-amount').value=amt;
      if (note) document.getElementById('inp-note').value=decodeURIComponent(note);
      if (cat) { selCat=cat; renderCatsGrid(); }
    },600);
  });
}

// ── 暴露函式給 bind.js 使用 ──
window.changeMonth = changeMonth;
window.jumpToToday = jumpToToday;
window.openAddSheet = openAddSheet;
window.closeSheets = closeSheets;
window.setType = setType;
window.addTx = addTx;
window.editBudgetSheet = editBudgetSheet;
window.saveBudgets = saveBudgets;
window.toggleNotify = toggleNotify;
window.exportData = exportData;
window.confirmClear = confirmClear;
window.switchTab = switchTab;
window.addCustomCat = addCustomCat;
window.deleteCustomCat = deleteCustomCat;
window.renderCatsGrid = renderCatsGrid;

// ── Service Worker ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
