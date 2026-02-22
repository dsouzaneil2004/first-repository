// Smart Expense Tracker functionality
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'smart_expense_transactions_v1';
  const THEME_KEY = 'smart_expense_theme_v1';
  const form = document.getElementById('transactionForm');
  const descEl = document.getElementById('description');
  const amountEl = document.getElementById('amount');
  // type buttons (replaces previous select)
  const typeIncomeBtn = document.getElementById('typeIncome');
  const typeExpenseBtn = document.getElementById('typeExpense');
  let selectedType = 'income';
  const historyList = document.getElementById('historyList');
  const balanceValue = document.getElementById('balanceValue');
  const incomeValue = document.getElementById('incomeValue');
  const expenseValue = document.getElementById('expenseValue');

  function lockPortraitOrientation(){
    try{
      if(window.screen && window.screen.orientation && typeof window.screen.orientation.lock === 'function'){
        window.screen.orientation.lock('portrait').catch(()=>{});
      }
    }catch(e){}
  }

  lockPortraitOrientation();

  let transactions = loadTransactions();

  // Amount increment/decrement controls (plus/minus buttons) with long-press support
  const amountPlusBtn = document.getElementById('amountPlus');
  const amountMinusBtn = document.getElementById('amountMinus');
  if(amountPlusBtn || amountMinusBtn){
    const getStep = () => {
      try{ return Math.max(parseFloat(amountEl.step) || 1, 0.01); }catch(e){ return 1; }
    };
    const changeAmount = (delta) => {
      const current = parseFloat(amountEl.value) || 0;
      const next = Math.max(0, +(current + delta).toFixed(2));
      amountEl.value = next;
      amountEl.dispatchEvent(new Event('input', { bubbles: true }));
      amountEl.focus();
    };

    // Long-press / auto repeat
    let autoTimer = null;
    let autoInterval = null;

    const startAuto = (delta) => {
      // immediate change
      changeAmount(delta);
      // after short delay, start repeating
      autoTimer = setTimeout(() => {
        // repeating interval
        autoInterval = setInterval(() => changeAmount(delta), 120);
      }, 400);
    };

    const stopAuto = () => {
      if(autoTimer){ clearTimeout(autoTimer); autoTimer = null; }
      if(autoInterval){ clearInterval(autoInterval); autoInterval = null; }
    };

    const attachControls = (btn, deltaFactory) => {
      // mouse
      btn.addEventListener('mousedown', (e)=>{ e.preventDefault(); startAuto(deltaFactory()); });
      window.addEventListener('mouseup', stopAuto);
      // touch
      btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); startAuto(deltaFactory()); }, { passive: false });
      window.addEventListener('touchend', stopAuto);
      // click as fallback (single step)
      btn.addEventListener('click', (e)=>{ e.preventDefault(); changeAmount(deltaFactory()); });
      // keyboard accessibility (Space/Enter)
      btn.addEventListener('keydown', (e)=>{
        if(e.key === ' ' || e.key === 'Enter'){
          e.preventDefault(); startAuto(deltaFactory());
        }
      });
      btn.addEventListener('keyup', (e)=>{
        if(e.key === ' ' || e.key === 'Enter') stopAuto();
      });
    };

    if(amountPlusBtn) attachControls(amountPlusBtn, getStep);
    if(amountMinusBtn) attachControls(amountMinusBtn, () => -getStep());
  }

  // Format number to INR currency (e.g., ₹1,23,456.00)
  function formatCurrencyINR(num){
    const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
    return formatter.format(num);
  }

  function saveTransactions(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    }catch(e){
      console.warn('Could not save to localStorage', e);
    }
  }

  function migrateTransactions(transactions){
    // Add dates to transactions that don't have them (from previous code versions)
    return transactions.map(t => {
      if(!t.date){
        t.date = new Date().toISOString();
      }
      return t;
    });
  }

  function loadTransactions(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return [];
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed)) return [];
      
      // Migrate old transactions to add dates
      const migrated = migrateTransactions(parsed);
      
      // Save back if any migrations happened
      if(migrated.some((t, i) => t.date !== parsed[i].date)){
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      }
      
      return migrated;
    }catch(e){
      return [];
    }
  }

  function applyTheme(theme){
    const allowedThemes = ['default', 'dark', 'nebula', 'cosmic', 'crimson', 'midnight', 'emerald', 'sunset', 'rose', 'slate'];
    const normalized = allowedThemes.includes(theme) ? theme : 'default';
    if(normalized === 'default') document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', normalized);
    try{ localStorage.setItem(THEME_KEY, normalized); }catch(e){}
  }

  function initSettingsMenu(){
    const toggleBtn = document.getElementById('settingsToggle');
    const menu = document.getElementById('settingsMenu');
    const themeSelect = document.getElementById('themeSelect');
    const resetThemeBtn = document.getElementById('resetThemeBtn');
    const resetAllBtn = document.getElementById('resetAllBtn');
    const clearDataBtn = document.getElementById('clearDataBtn');
    if(!toggleBtn || !menu || !themeSelect || !resetThemeBtn || !resetAllBtn || !clearDataBtn) return;

    const storedTheme = localStorage.getItem(THEME_KEY) || 'default';
    themeSelect.value = storedTheme;
    applyTheme(storedTheme);

    const closeMenu = () => {
      menu.classList.remove('open');
      document.body.classList.remove('settings-open');
      menu.setAttribute('aria-hidden', 'true');
      toggleBtn.setAttribute('aria-expanded', 'false');
    };

    const openMenu = () => {
      menu.classList.add('open');
      document.body.classList.add('settings-open');
      menu.setAttribute('aria-hidden', 'false');
      toggleBtn.setAttribute('aria-expanded', 'true');
    };

    toggleBtn.addEventListener('click', () => {
      if(menu.classList.contains('open')) closeMenu();
      else openMenu();
    });

    document.addEventListener('click', (e) => {
      if(!menu.contains(e.target) && !toggleBtn.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape') closeMenu();
    });

    themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

    resetThemeBtn.addEventListener('click', () => {
      themeSelect.value = 'default';
      applyTheme('default');
      closeMenu();
    });

    function showConfirmPopup(message, confirmText = 'Confirm'){
      const modal = document.getElementById('confirmModal');
      const messageEl = document.getElementById('confirmMessage');
      const cancelBtn = document.getElementById('confirmCancelBtn');
      const okBtn = document.getElementById('confirmOkBtn');
      if(!modal || !messageEl || !cancelBtn || !okBtn) return Promise.resolve(false);
      messageEl.textContent = message;
      okBtn.textContent = confirmText;
      modal.setAttribute('aria-hidden', 'false');
      return new Promise(resolve => {
        const cleanup = () => {
          modal.setAttribute('aria-hidden', 'true');
          okBtn.removeEventListener('click', onOk);
          cancelBtn.removeEventListener('click', onCancel);
          modal.removeEventListener('click', onBackdrop);
          document.removeEventListener('keydown', onKeydown);
        };
        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };
        const onBackdrop = (e) => { if(e.target === modal) onCancel(); };
        const onKeydown = (e) => { if(e.key === 'Escape') onCancel(); };
        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKeydown);
      });
    }

    resetAllBtn.addEventListener('click', async () => {
      const confirmed = await showConfirmPopup('Reset everything? This will clear all transactions and restore default settings.', 'Reset');
      if(!confirmed) return;
      try{
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(THEME_KEY);
        localStorage.removeItem('smart_expense_tutorial_seen_v1');
      }catch(e){}
      transactions = [];
      applyTheme('default');
      render();
      closeMenu();
      window.location.reload();
    });

    clearDataBtn.addEventListener('click', async () => {
      const confirmed = await showConfirmPopup('Clear all transactions from this app? This cannot be undone.', 'Clear Data');
      if(!confirmed) return;
      try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
      transactions = [];
      render();
      closeMenu();
    });
  }


  function addTransaction({description, amount, type}){
    const tx = {
      id: Date.now() + Math.floor(Math.random()*1000),
      description,
      amount: Math.abs(Number(amount)),
      type,
      date: new Date().toISOString()
    };
    transactions.unshift(tx);
    saveTransactions();
    render();
  }

  // Type button helpers - only visual selection, no disable
  function setSelectedType(type){
    selectedType = type;
    if(typeIncomeBtn && typeExpenseBtn){
      if(type === 'income'){
        typeIncomeBtn.classList.add('selected'); typeIncomeBtn.setAttribute('aria-pressed','true');
        typeExpenseBtn.classList.remove('selected'); typeExpenseBtn.setAttribute('aria-pressed','false');
      } else {
        typeExpenseBtn.classList.add('selected'); typeExpenseBtn.setAttribute('aria-pressed','true');
        typeIncomeBtn.classList.remove('selected'); typeIncomeBtn.setAttribute('aria-pressed','false');
      }
    }
  }

  function deleteTransaction(id){
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
    render();
  }

  function calculateSummary(){
    let income = 0, expense = 0;
    transactions.forEach(t => {
      if(t.type === 'income') income += Number(t.amount) || 0;
      else expense += Number(t.amount) || 0;
    });
    return { income, expense, balance: income - expense };
  }

  function categorizeExpense(description){
    const desc = (description || '').toLowerCase();
    if(desc.match(/food|eat|lunch|dinner|breakfast|restaurant|cafe|pizza|burger|coffee|snack|meal/)) return 'Food';
    if(desc.match(/travel|car|taxi|bus|train|flight|petrol|gas|fuel|bike|auto|ride/)) return 'Travel';
    if(desc.match(/bill|electricity|water|internet|phone|rent|mortgage|insurance/)) return 'Bills';
    if(desc.match(/shop|buy|clothing|dress|shoes|book|gift|purchase|mall/)) return 'Shopping';
    return 'Other';
  }

  function calculateInsights(){
    const expenses = transactions.filter(t => t.type === 'expense');
    if(expenses.length === 0) return null;

    // Find biggest transaction
    const biggest = expenses.reduce((max, t) => t.amount > max.amount ? t : max);

    // Calculate category breakdown
    const categories = {};
    expenses.forEach(t => {
      const cat = categorizeExpense(t.description);
      categories[cat] = (categories[cat] || 0) + t.amount;
    });
    
    // Find highest category
    const highestCat = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
    const highestCategory = highestCat ? highestCat[0] : null;
    const highestAmount = highestCat ? highestCat[1] : 0;

    return {
      biggest,
      highestCategory,
      highestAmount,
      expenseCount: expenses.length
    };
  }

  function renderInsights(){
    const insights = calculateInsights();
    const container = document.getElementById('insightsContent');
    
    if(!insights){
      container.innerHTML = '<div style="color:rgba(233,242,255,0.6);font-size:12px">Add expenses to see insights</div>';
      return;
    }

    const insight1 = `<div class="insight-item"><div class="insight-label">Highest:</div><div class="insight-value">${insights.highestCategory}</div></div>`;
    const insight2 = `<div class="insight-item"><div class="insight-label">Biggest:</div><div class="insight-value">${formatCurrencyINR(insights.biggest.amount)}</div></div>`;
    const insight3 = `<div class="insight-item"><div class="insight-label">Expenses:</div><div class="insight-value">${insights.expenseCount}</div></div>`;
    
    container.innerHTML = insight1 + insight2 + insight3;
  }

  function render(){
    // Render list
    historyList.innerHTML = '';
    transactions.forEach(t => {
      const li = document.createElement('li');
      li.className = 'transaction-item';
      li.dataset.id = t.id;
      li.innerHTML = `
        <div class="transaction-left">
          <div class="desc">${escapeHtml(t.description)}</div>
          <div class="meta">${t.type.charAt(0).toUpperCase() + t.type.slice(1)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="amount ${t.type === 'income' ? 'income':'expense'}">${formatCurrencyINR(t.amount)}</div>
          <button class="del" aria-label="Delete transaction">✕</button>
        </div>
      `;
      li.querySelector('.del').addEventListener('click', ()=> deleteTransaction(t.id));
      historyList.appendChild(li);
    });

    // Update summary
    const { income, expense, balance } = calculateSummary();
    balanceValue.textContent = formatCurrencyINR(balance);
    incomeValue.textContent = formatCurrencyINR(income);
    expenseValue.textContent = formatCurrencyINR(expense);

    // Update insights
    renderInsights();

    // Apply staggered animation to newly rendered items
    PageTransitions.animateCardEntrance();
  }

    // ===== PAGE TRANSITION SYSTEM =====
    // Handles smooth animated transitions when switching pages
    // Cards rise from bottom on enter, fade up on exit
    
    const PageTransitions = {
      DURATION: 500, // ms (matches CSS --page-transition-duration)
      STAGGER: 80,   // ms (matches CSS --card-stagger per card)
      
      // All elements that should animate during page transitions
      animatedSelector: '.summary-card, .card, .dashboard-card, .chart-card, .category-item, .insight-item, .transaction-item, .panel',
      
      // Apply stagger indices and animate cards rising from bottom
      animateCardEntrance() {
        const nodes = Array.from(document.querySelectorAll(this.animatedSelector));
        nodes.forEach((el, i) => {
          el.classList.add('card-enter');
          el.style.setProperty('--i', i);
        });
        // Trigger animation by removing card-enter class next frame
        requestAnimationFrame(() => {
          nodes.forEach(el => el.classList.remove('card-enter'));
        });
      },
      
      // Prepare page entrance: add page-enter state, wait for next frame, then animate in
      enterPage() {
        document.body.classList.add('page-enter');
        this.animateCardEntrance();
        
        requestAnimationFrame(() => {
          setTimeout(() => document.body.classList.remove('page-enter'), 30);
        });
      },
      
      // Animate page exit: fade all cards up, then navigate
      exitPage(href) {
        document.body.classList.add('page-exit');
        setTimeout(() => { window.location.href = href; }, this.DURATION);
      },
      
      // Set up click listeners for all navigation links
      initNavigationListeners() {
        document.querySelectorAll('a[href$=".html"]').forEach(link => {
          link.addEventListener('click', (e) => {
            // Allow new tab, modified clicks, and non-left-click
            if(e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            
            e.preventDefault();
            const href = link.href;
            
            // Play exit animation before navigating
            this.exitPage(href);
          });
        });
      },
      
      // Initialize all page transition behavior on load
      init() {
        this.enterPage();
        this.initNavigationListeners();
      }
    };

    // Start page transitions
    PageTransitions.init();

  form.addEventListener('submit', e => {
    e.preventDefault();
    const description = descEl.value.trim();
    const amountRaw = amountEl.value;
    const type = selectedType;

    // Validation: non-empty description and numeric, non-zero amount
    const amount = Number(amountRaw);
    if(!description){
      descEl.focus();
      return;
    }
    if(!isFinite(amount) || amount === 0){
      amountEl.focus();
      return;
    }

    addTransaction({ description, amount, type });
    form.reset();
    descEl.focus();
  });

  // wire up type button clicks
  if(typeIncomeBtn) typeIncomeBtn.addEventListener('click', ()=> setSelectedType('income'));
  if(typeExpenseBtn) typeExpenseBtn.addEventListener('click', ()=> setSelectedType('expense'));
  // initialize selection
  setSelectedType(selectedType);

  // small helper to avoid XSS in inserted text
  function escapeHtml(str){
    return String(str).replace(/[&"'<>]/g, function(s){
      return ({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'})[s];
    });
  }

  // initial render
  render();
  initSettingsMenu();

  // ensure we're at the top on load so header isn't obscured by browser UI
  try{ window.scrollTo(0,0); }catch(e){}

  // Smooth fading scrollbars: show when scrolling, hide otherwise
  function initScrollbarFade(){
    let timer = null;
    const SHOW_CLASS = 'show-scrollbar';
    const show = () => {
      document.body.classList.add(SHOW_CLASS);
      if(timer) clearTimeout(timer);
      timer = setTimeout(()=> document.body.classList.remove(SHOW_CLASS), 900);
    };

    // Listen to main scroll events
    window.addEventListener('scroll', show, { passive: true });

    // Also attach to any scrollable containers (history list, panels)
    const scrollables = Array.from(document.querySelectorAll('.history-list, .main-grid, .dashboard-content, .charts-grid'));
    scrollables.forEach(el => el.addEventListener('scroll', show, { passive: true }));

    // Expose for testing/debug if needed
    return { showNow: show };
  }

  // initialize scrollbar fade behavior
  initScrollbarFade();

  /* Tutorial: show once on first visit */
  const TUTORIAL_KEY = 'smart_expense_tutorial_seen_v1';
  const tutorialModal = document.getElementById('welcomeModal');
  const tutorialContent = document.getElementById('tutorialContent');
  const tutorialNext = document.getElementById('tutorialNext');
  const tutorialPrev = document.getElementById('tutorialPrev');
  const tutorialClose = document.querySelector('.tutorial-close');

  const tutorialSteps = [
    '<p>Welcome! This brief tour will help you get started.</p><p>The top summary cards show your balance, total income, and total expenses.</p>',
    '<p>Use the <strong>Add Transaction</strong> form to add items. Enter a description, amount, and choose <em>Income</em> or <em>Expense</em>.</p>',
    '<p>Your transactions appear in the <strong>Transaction History</strong>. Use the ✕ button to delete an entry. Changes persist locally on this device.</p>'
  ];
  let tutorialIndex = 0;

  function showTutorial(){
    if(!tutorialModal) return;
    tutorialModal.setAttribute('aria-hidden','false');
    updateTutorial();
  }

  function hideTutorial(){
    if(!tutorialModal) return;
    tutorialModal.setAttribute('aria-hidden','true');
    try{ localStorage.setItem(TUTORIAL_KEY, '1'); }catch(e){}
  }

  function updateTutorial(){
    if(!tutorialContent) return;
    tutorialContent.innerHTML = tutorialSteps[tutorialIndex];
    tutorialPrev.disabled = tutorialIndex === 0;
    tutorialNext.textContent = tutorialIndex === tutorialSteps.length - 1 ? 'Got it' : 'Next';
  }

  if(!localStorage.getItem(TUTORIAL_KEY)){
    showTutorial();
  }

  if(tutorialNext) tutorialNext.addEventListener('click', ()=>{
    if(tutorialIndex < tutorialSteps.length - 1){
      tutorialIndex++; updateTutorial();
    } else { hideTutorial(); }
  });
  if(tutorialPrev) tutorialPrev.addEventListener('click', ()=>{ if(tutorialIndex>0){tutorialIndex--; updateTutorial();} });
  if(tutorialClose) tutorialClose.addEventListener('click', hideTutorial);

});
