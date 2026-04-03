// ──────────────── DATA ────────────────
const EXPENSE_CATS = [
  {id:'food',      emoji:'🍱', name:'餐飲',   color:'#1D9E75'},
  {id:'transport', emoji:'🚇', name:'交通',   color:'#185FA5'},
  {id:'shopping',  emoji:'🛍', name:'購物',   color:'#D85A30'},
  {id:'entertainment',emoji:'🎮',name:'娛樂', color:'#534AB7'},
  {id:'medical',   emoji:'💊', name:'醫療',   color:'#A32D2D'},
  {id:'utility',   emoji:'💡', name:'帳單',   color:'#BA7517'},
  {id:'education', emoji:'📚', name:'教育',   color:'#3B6D11'},
  {id:'other',     emoji:'📝', name:'其他',   color:'#7a7872'},
];
const INCOME_CATS = [
  {id:'salary',  emoji:'💼', name:'薪資', color:'#1D9E75'},
  {id:'bonus',   emoji:'🎁', name:'獎金', color:'#BA7517'},
  {id:'invest',  emoji:'📈', name:'投資', color:'#185FA5'},
  {id:'parttime',emoji:'🤝', name:'兼職', color:'#534AB7'},
  {id:'other',   emoji:'💰', name:'其他', color:'#7a7872'},
];
const DEFAULT_BUDGETS = {
  food:8000, transport:3000, shopping:5000,
  entertainment:2000, medical:1500, utility:2000, education:2000
};

let txs = [];
let budgets = {};
let currency = 'NT$';
let notify = true;
let curType = 'expense';
let selCat = 'food';
let curYear, curMonth;
let activeTab = 'home';

// ──────────────── INIT ────────────────
function init() {
  try { txs = JSON.parse(localStorage.getItem('txs') || '[]'); } catch(e) { txs = []; }
  try { budgets = JSON.parse(localStorage.getItem('budgets') || JSON.stringify(DEFAULT_BUDGETS)); } catch(e) { budgets = {...DEFAULT_BUDGETS}; }
  currency = localStorage.getItem('currency') || 'NT$';
  notify = localStorage.getItem('notify') !== 'false';
  document.getElementById('currency-sel').value = currency;
  document.getElementById('currency-prefix').textContent = currency;
  document.getElementById('notify-toggle').className = 'toggle-switch' + (notify ? '' : ' off');

  const now = new Date();
  curYear = now.getFullYear();
  curMonth = now.getMonth() + 1;
  document.getElementById('inp-date').value = now.toISOString().slice(0,10);

  if (!txs.length) loadSampleData();

  document.getElementById('currency-sel').onchange = (e) => {
    currency = e.target.value;
    localStorage.setItem('currency', currency);
    document.getElementById('currency-prefix').textContent = currency;
    renderAll();
  };

  updateMonthLabel();
  renderAll();
  renderCatsGrid();
}

function loadSampleData() {
  const y = curYear, m = String(curMonth).padStart(2,'0');
  txs = [
    {id:1,type:'income',amount:52000,cat:'salary',note:'四月薪資',date:`${y}-${m}-01`},
    {id:2,type:'expense',amount:130,cat:'food',note:'滷肉飯＋湯',date:`${y}-${m}-01`},
    {id:3,type:'expense',amount:48,cat:'transport',note:'捷運',date:`${y}-${m}-01`},
    {id:4,type:'expense',amount:850,cat:'shopping',note:'全聯採購',date:`${y}-${m}-02`},
    {id:5,type:'expense',amount:390,cat:'entertainment',note:'電影票',date:`${y}-${m}-02`},
    {id:6,type:'expense',amount:1280,cat:'utility',note:'電費帳單',date:`${y}-${m}-03`},
    {id:7,type:'expense',amount:240,cat:'food',note:'夜市晚餐',date:`${y}-${m}-03`},
    {id:8,type:'expense',amount:580,cat:'medical',note:'診所自費',date:`${y}-${m}-03`},
    {id:9,type:'income',amount:3200,cat:'parttime',note:'接案收入',date:`${y}-${m}-03`},
  ];
  save();
}

function save() {
  localStorage.setItem('txs', JSON.stringify(txs));
}

// ──────────────── FORMATTING ────────────────
function fmt(n) {
  const abs = Math.abs(Math.round(n));
  return currency + abs.toLocaleString('zh-TW');
}

function monthKey(y, m) { return y + '-' + String(m).padStart(2,'0'); }

function getTxMonth(y, m) {
  const k = monthKey(y, m);
  return txs.filter(t => t.date.startsWith(k));
}

// ──────────────── RENDER ────────────────
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
    const mmdd = date.slice(5).replace('-','/');
    return `<div class="tx-group">
      <div class="tx-date-row">
        <span class="tx-date-text">${mmdd} 週${wd}</span>
        <span class="tx-date-sum">${dayExp > 0 ? '-'+fmt(dayExp) : ''}</span>
      </div>
      ${items.map(t => {
        const cats = t.type==='expense' ? EXPENSE_CATS : INCOME_CATS;
        const cat = cats.find(c=>c.id===t.cat) || cats[cats.length-1];
        return `<div class="tx-item">
          <div class="tx-icon" style="background:${cat.color}20;">${cat.emoji}</div>
          <div class="tx-info">
            <div class="tx-name">${t.note || cat.name}</div>
            <div class="tx-cat">${cat.name}</div>
          </div>
          <div class="tx-amount ${t.type==='expense'?'neg':'pos'}">${t.type==='expense'?'-':'+'}${fmt(t.amount)}</div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

function renderChart() {
  // Monthly bars
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let m = curMonth - i, y = curYear;
    if (m <= 0) { m += 12; y--; }
    months.push({y, m});
  }
  const exps = months.map(({y,m}) => getTxMonth(y,m).filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
  const maxE = Math.max(...exps, 1);
  document.getElementById('monthly-bars').innerHTML = months.map(({y,m}, i) => {
    const isCur = y===curYear && m===curMonth;
    const h = Math.max(4, Math.round(exps[i]/maxE*70));
    return `<div class="bar-col">
      <div class="bar-fill" style="height:${h}px;background:${isCur?'var(--teal)':'var(--teal-light)'}"></div>
      <span class="bar-month">${m}月</span>
    </div>`;
  }).join('');

  // Donut
  const list = getTxMonth(curYear, curMonth).filter(t=>t.type==='expense');
  const catTotals = {};
  list.forEach(t => catTotals[t.cat] = (catTotals[t.cat]||0) + t.amount);
  const total = Object.values(catTotals).reduce((a,b)=>a+b,0) || 1;
  const sorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);

  const svg = document.getElementById('donut-svg');
  const legend = document.getElementById('donut-legend');

  if (!sorted.length) {
    svg.innerHTML = `<circle cx="55" cy="55" r="38" fill="none" stroke="var(--bg3)" stroke-width="18"/>`;
    legend.innerHTML = `<span style="font-size:12px;color:var(--text3);">本月無支出</span>`;
  } else {
    let angle = -90;
    const paths = sorted.map(([cat, amt]) => {
      const pct = amt / total;
      const sa = angle * Math.PI / 180;
      const ea = (angle + pct * 360) * Math.PI / 180;
      const x1 = 55 + 38*Math.cos(sa), y1 = 55 + 38*Math.sin(sa);
      const x2 = 55 + 38*Math.cos(ea), y2 = 55 + 38*Math.sin(ea);
      const lg = pct > 0.5 ? 1 : 0;
      const catObj = EXPENSE_CATS.find(c=>c.id===cat) || EXPENSE_CATS[EXPENSE_CATS.length-1];
      angle += pct * 360;
      return `<path d="M55 55 L${x1.toFixed(1)} ${y1.toFixed(1)} A38 38 0 ${lg} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${catObj.color}" opacity="0.88"/>`;
    });
    svg.innerHTML = paths.join('') + `<circle cx="55" cy="55" r="24" fill="var(--bg)"/>`;

    legend.innerHTML = sorted.slice(0,5).map(([cat, amt]) => {
      const catObj = EXPENSE_CATS.find(c=>c.id===cat) || EXPENSE_CATS[EXPENSE_CATS.length-1];
      const pct = Math.round(amt/total*100);
      return `<div class="legend-item">
        <div class="legend-dot" style="background:${catObj.color}"></div>
        <span>${catObj.emoji} ${catObj.name}</span>
        <span class="legend-pct">${pct}%</span>
      </div>`;
    }).join('');
  }

  // Progress
  document.getElementById('cat-progress').innerHTML = sorted.map(([cat, amt]) => {
    const catObj = EXPENSE_CATS.find(c=>c.id===cat) || EXPENSE_CATS[EXPENSE_CATS.length-1];
    const pct = Math.round(amt/total*100);
    return `<div class="prog-item">
      <div class="prog-header">
        <span class="prog-cat">${catObj.emoji} ${catObj.name}</span>
        <span class="prog-amt">${fmt(amt)} (${pct}%)</span>
      </div>
      <div class="prog-bar-bg"><div class="prog-bar-fill" style="width:${pct}%;background:${catObj.color};"></div></div>
    </div>`;
  }).join('') || `<div class="empty-state" style="padding:30px 0;"><div class="empty-emoji" style="font-size:32px;">📊</div><div class="empty-text">本月無支出資料</div></div>`;
}

function renderBudget() {
  const list = getTxMonth(curYear, curMonth).filter(t=>t.type==='expense');
  const spent = {};
  list.forEach(t => spent[t.cat] = (spent[t.cat]||0) + t.amount);

  document.getElementById('budget-list').innerHTML = Object.entries(budgets).map(([cat, budget]) => {
    const catObj = EXPENSE_CATS.find(c=>c.id===cat);
    if (!catObj) return '';
    const s = spent[cat] || 0;
    const pct = Math.min(100, Math.round(s/budget*100));
    const over = s > budget;
    const warn = !over && pct > 80;
    const barColor = over ? 'var(--red)' : warn ? 'var(--amber)' : 'var(--teal)';
    const noteColor = over ? 'var(--red)' : warn ? 'var(--amber)' : 'var(--text3)';
    const note = over ? `⚠ 超出預算 ${fmt(s-budget)}` : `剩餘 ${fmt(budget-s)}`;
    return `<div class="budget-card">
      <div class="budget-header">
        <div class="budget-cat-name">${catObj.emoji} ${catObj.name}</div>
        <div class="budget-amounts">${fmt(s)} / ${fmt(budget)}</div>
      </div>
      <div class="budget-bar-bg"><div class="budget-bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
      <div class="budget-note" style="color:${noteColor};">${note}</div>
    </div>`;
  }).join('');
}

function renderSettings() {
  const list = getTxMonth(curYear, curMonth);
  const exp = list.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const inc = list.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const days = new Set(list.map(t=>t.date)).size;
  document.getElementById('profile-sub').textContent =
    `${curYear}年${curMonth}月 · ${list.length}筆 · ${days}天 · 結餘${inc-exp >= 0 ? '+':'-'}${fmt(inc-exp)}`;
}

// ──────────────── NAV ────────────────
function switchTab(name) {
  activeTab = name;
  ['home','chart','budget','settings'].forEach(n => {
    const screen = document.getElementById('screen-'+n);
    const tab = document.getElementById('tab-'+n);
    screen.classList.toggle('active', n===name);
    tab.classList.toggle('active', n===name);
  });
  document.getElementById('fab').classList.toggle('hidden', name !== 'home');
  if (name==='chart') renderChart();
  if (name==='budget') renderBudget();
  if (name==='settings') renderSettings();
}

function changeMonth(dir) {
  curMonth += dir;
  if (curMonth > 12) { curMonth = 1; curYear++; }
  if (curMonth < 1) { curMonth = 12; curYear--; }
  updateMonthLabel();
  renderHome();
}

function jumpToToday() {
  const now = new Date();
  curYear = now.getFullYear();
  curMonth = now.getMonth()+1;
  updateMonthLabel();
  renderHome();
}

// ──────────────── ADD TX ────────────────
function openAddSheet() {
  const now = new Date();
  document.getElementById('inp-date').value = now.toISOString().slice(0,10);
  document.getElementById('inp-amount').value = '';
  document.getElementById('inp-note').value = '';
  curType = 'expense'; selCat = 'food';
  document.getElementById('type-exp').className = 'type-btn active exp';
  document.getElementById('type-inc').className = 'type-btn inc';
  renderCatsGrid();
  openSheet('add-sheet');
  setTimeout(() => document.getElementById('inp-amount').focus(), 350);
}

function setType(t) {
  curType = t;
  document.getElementById('type-exp').className = 'type-btn' + (t==='expense'?' active exp':' exp');
  document.getElementById('type-inc').className = 'type-btn' + (t==='income'?' active inc':' inc');
  selCat = t==='expense' ? 'food' : 'salary';
  renderCatsGrid();
}

function renderCatsGrid() {
  const cats = curType==='expense' ? EXPENSE_CATS : INCOME_CATS;
  document.getElementById('cats-grid').innerHTML = cats.map(c =>
    `<button class="cat-btn${c.id===selCat?' sel':''}" onclick="selCat='${c.id}';renderCatsGrid()">
      <span class="cat-emoji-large">${c.emoji}</span>
      <span>${c.name}</span>
    </button>`
  ).join('');
}

function addTx() {
  const amt = parseFloat(document.getElementById('inp-amount').value);
  if (!amt || amt <= 0) { shake('inp-amount'); return; }
  const note = document.getElementById('inp-note').value.trim();
  const date = document.getElementById('inp-date').value || new Date().toISOString().slice(0,10);
  txs.push({ id: Date.now(), type: curType, amount: amt, cat: selCat, note, date });
  save();
  closeSheets();
  renderHome();
  showToast(curType === 'expense' ? '已記錄支出 ' + fmt(amt) : '已記錄收入 ' + fmt(amt));
}

function shake(id) {
  const el = document.getElementById(id);
  el.style.animation = 'none';
  el.style.borderColor = 'var(--red)';
  setTimeout(() => { el.style.borderColor = ''; }, 1000);
}

// ──────────────── BUDGET ────────────────
function editBudgetSheet() {
  document.getElementById('budget-edit-fields').innerHTML = EXPENSE_CATS.slice(0,7).map(c =>
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
}

function saveBudgets() {
  EXPENSE_CATS.slice(0,7).forEach(c => {
    const val = parseFloat(document.getElementById('b-'+c.id)?.value || 0);
    if (!isNaN(val)) budgets[c.id] = val;
  });
  localStorage.setItem('budgets', JSON.stringify(budgets));
  closeSheets();
  renderBudget();
  showToast('預算已更新');
}

// ──────────────── SETTINGS ACTIONS ────────────────
function toggleNotify() {
  notify = !notify;
  localStorage.setItem('notify', notify);
  document.getElementById('notify-toggle').className = 'toggle-switch' + (notify ? '' : ' off');
  showToast(notify ? '提醒已開啟' : '提醒已關閉');
}

function exportData() {
  const header = 'date,type,category,note,amount\n';
  const rows = txs.map(t => {
    const cats = t.type==='expense'?EXPENSE_CATS:INCOME_CATS;
    const cat = cats.find(c=>c.id===t.cat)||{name:t.cat};
    return `${t.date},${t.type==='expense'?'支出':'收入'},${cat.name},${t.note||''},${t.amount}`;
  }).join('\n');
  const blob = new Blob(['\uFEFF'+header+rows], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = '記帳本_export.csv'; a.click();
  showToast('CSV 已匯出');
}

function confirmClear() {
  if (confirm('確定要清除所有記帳資料？\n此操作無法復原。')) {
    txs = []; save(); renderHome(); showToast('已清除所有資料');
  }
}

function openSearch() { showToast('搜尋功能開發中'); }

// ──────────────── SHEET / OVERLAY ────────────────
function openSheet(id) {
  document.getElementById('overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}

function closeSheets() {
  document.getElementById('overlay').classList.remove('open');
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open'));
}

// ──────────────── TOAST ────────────────
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2200);
}

// ──────────────── SWIPE GESTURES ────────────────
let touchStartX = 0, touchStartY = 0;
const tabs = ['home','chart','budget','settings'];
document.getElementById('screens').addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, {passive:true});
document.getElementById('screens').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    const idx = tabs.indexOf(activeTab);
    if (dx < 0 && idx < tabs.length-1) switchTab(tabs[idx+1]);
    if (dx > 0 && idx > 0) switchTab(tabs[idx-1]);
  }
}, {passive:true});

// ──────────────── SERVICE WORKER ────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ──────────────── START ────────────────
document.addEventListener('DOMContentLoaded', init);
