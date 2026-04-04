function tap(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('touchend', e => { e.preventDefault(); fn(e); }, { passive: false });
  el.addEventListener('click', fn);
}

document.addEventListener('DOMContentLoaded', () => {
  tap('auth-submit-btn', () => {
    const isReg = document.getElementById('auth-mode').dataset.mode === 'register';
    window.doLogin(isReg);
  });
  tap('auth-toggle-btn', () => window.toggleAuthMode());
  tap('btn-prev-month',  () => window.changeMonth(-1));
  tap('btn-next-month',  () => window.changeMonth(1));
  tap('btn-today',       () => window.jumpToToday());
  tap('fab',             () => window.openAddSheet());
  tap('overlay',         () => window.closeSheets());
  tap('type-exp',        () => window.setType('expense'));
  tap('type-inc',        () => window.setType('income'));
  tap('add-submit-btn',  () => window.addTx());
  tap('btn-edit-budget',   () => window.editBudgetSheet());
  tap('budget-submit-btn', () => window.saveBudgets());
  tap('btn-notify', () => window.toggleNotify());
  tap('btn-export', () => window.exportData());
  tap('btn-clear',  () => window.confirmClear());
  tap('btn-logout', () => window.signOut());
  ['home','chart','budget','settings'].forEach(n => tap('tab-'+n, () => window.switchTab(n)));
  tap('custom-cat-submit', () => window.addCustomCat());
  ['inp-email','inp-pass','inp-name'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        window.doLogin(document.getElementById('auth-mode').dataset.mode === 'register');
      }
    });
  });
});
