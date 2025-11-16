/* Full-featured scientific calculator script
   - evaluateExpression uses a scoped Function with a safe-ish scope object
   - supports factorial, percent, ^ operator, DEG/RAD toggle
   - memory and history
*/

(() => {
  // Elements
  const display = document.getElementById('display');
  const exprEl = document.getElementById('expr');
  const historyList = document.getElementById('historyList');
  const degRadBtn = document.getElementById('degRadBtn');
  const themeToggle = document.getElementById('themeToggle');
  const equalsBtn = document.getElementById('equals');

  let currentExp = '';
  let lastResult = '';
  let degMode = true;
  let memory = 0;
  let history = [];

  // UI update
  function updateScreen(){
    exprEl.textContent = currentExp;
    display.value = lastResult || '';
  }

  function pushHistory(expression, result){
    history.unshift({expression, result});
    if(history.length > 30) history.pop();
    renderHistory();
  }

  function renderHistory(){
    historyList.innerHTML = '';
    history.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.expression} = ${item.result}`;
      li.addEventListener('click', () => {
        currentExp = item.expression;
        lastResult = item.result;
        updateScreen();
      });
      historyList.appendChild(li);
    });
  }

  // Factorial for integers
  function factorial(n){
    n = Number(n);
    if(!isFinite(n) || n < 0) throw 'Invalid factorial';
    if(Math.floor(n) !== n) throw 'Factorial supports non-negative integers';
    let res = 1;
    for(let i=2;i<=n;i++) res *= i;
    return res;
  }

  // rounding helper
  function roundIfNeeded(n){
    if(typeof n !== 'number' || !isFinite(n)) return n;
    if(Math.abs(n) < 1e-12) return 0;
    return Math.round((n + Number.EPSILON) * 1e12) / 1e12;
  }

  // Evaluate expression with scoped math
  function evaluateExpression(str){
    if(!str) return '';
    // normalize
    str = String(str).replace(/×/g, '*').replace(/÷/g, '/').replace(/–/g,'-').trim();

    // replace percentage: 50% -> (50/100)
    str = str.replace(/(\d+(\.\d+)?)%/g, '($1/100)');

    // factorial: 5! -> factorial(5)
    str = str.replace(/(\d+(\.\d+)?)!/g, 'factorial($1)');

    // allow ^ as power
    str = str.replace(/\^/g, '**');

    // constants
    str = str.replace(/\bpi\b/gi, 'PI');
    str = str.replace(/\be\b(?![a-z])/gi, 'E');

    // scope
    const scope = {
      PI: Math.PI,
      E: Math.E,
      abs: Math.abs,
      pow: Math.pow,
      sqrt: Math.sqrt,
      round: Math.round,
      floor: Math.floor,
      ceil: Math.ceil,
      max: Math.max,
      min: Math.min,
      log: (x) => Math.log10(x),
      ln: (x) => Math.log(x),
      exp: (x) => Math.exp(x),
      factorial: factorial,
      sin: (x) => degMode ? Math.sin(x * Math.PI/180) : Math.sin(x),
      cos: (x) => degMode ? Math.cos(x * Math.PI/180) : Math.cos(x),
      tan: (x) => degMode ? Math.tan(x * Math.PI/180) : Math.tan(x),
      asin: (x) => (degMode ? Math.asin(x) * 180/Math.PI : Math.asin(x)),
      acos: (x) => (degMode ? Math.acos(x) * 180/Math.PI : Math.acos(x)),
      atan: (x) => (degMode ? Math.atan(x) * 180/Math.PI : Math.atan(x))
    };

    // basic sanitization: allow letters (for function names), digits, operators, parentheses, dot, whitespace
    // (client-side only — do not eval untrusted server-side)
    if(/[^0-9+\-*/^().,%!eEpiPIa-zA-Z _]/.test(str)){
      // keep lenient but you can reject here if necessary
    }

    try {
      const fn = new Function('scope', `with(scope){ return ${str}; }`);
      const result = fn(scope);
      if(typeof result === 'number') return roundIfNeeded(result);
      return result;
    } catch (err){
      throw err;
    }
  }

  // Button wiring
  document.querySelectorAll('.btn.num').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.num ?? b.textContent;
    currentExp += v;
    updateScreen();
  }));

  document.querySelectorAll('.btn.op').forEach(b => b.addEventListener('click', () => {
    if(b.dataset.op) currentExp += ` ${b.dataset.op} `;
    else currentExp += b.getAttribute('data-action') || b.textContent;
    updateScreen();
  }));

  document.querySelectorAll('.btn.func').forEach(b => b.addEventListener('click', () => {
    const fn = b.dataset.fn ?? b.textContent;
    if(fn === '!') currentExp += '!';
    else if(fn === 'sqrt') currentExp += ' sqrt(';
    else if(fn === 'exp') currentExp += ' exp(';
    else if(fn === 'ln') currentExp += ' ln(';
    else if(fn === 'log') currentExp += ' log(';
    else currentExp += fn + '(';
    updateScreen();
  }));

  // memory
  document.querySelectorAll('.btn.mem').forEach(b => b.addEventListener('click', () => {
    const op = b.dataset.mem;
    if(op === 'MC') memory = 0;
    else if(op === 'MR') { currentExp += String(memory); }
    else if(op === 'M+') {
      try { const r = evaluateExpression(currentExp || lastResult); if(typeof r === 'number') memory += r; } catch(e){}
    }
    else if(op === 'M-') {
      try { const r = evaluateExpression(currentExp || lastResult); if(typeof r === 'number') memory -= r; } catch(e){}
    }
    updateScreen();
  }));

  // consts
  document.querySelectorAll('.btn.const').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.const;
    if(c === 'pi') currentExp += 'PI';
    else if(c === 'e') currentExp += 'E';
    else if(c === '%') currentExp += '%';
    updateScreen();
  }));

  // clear & delete
  document.querySelectorAll('.btn.clear').forEach(b => b.addEventListener('click', () => {
    currentExp = '';
    lastResult = '';
    updateScreen();
  }));
  document.querySelectorAll('.btn.del').forEach(b => b.addEventListener('click', () => {
    currentExp = currentExp.slice(0, -1);
    updateScreen();
  }));

  // equals
  equalsBtn.addEventListener('click', computeResult);

  function computeResult(){
    try {
      const res = evaluateExpression(currentExp);
      lastResult = (res === undefined) ? '' : String(res);
      pushHistory(currentExp, lastResult);
      currentExp = String(lastResult);
    } catch (err){
      lastResult = 'Error';
    }
    updateScreen();
  }

  // deg/rad toggle
  degRadBtn.addEventListener('click', () => {
    degMode = !degMode;
    degRadBtn.textContent = degMode ? 'DEG' : 'RAD';
    degRadBtn.classList.toggle('active', !degMode);
  });

  // keyboard support
  window.addEventListener('keydown', (e) => {
    if(e.key >= '0' && e.key <= '9') { currentExp += e.key; updateScreen(); }
    else if(['+','-','/','*','.','(',')'].includes(e.key)) { currentExp += e.key; updateScreen(); }
    else if(e.key === 'Enter') { computeResult(); }
    else if(e.key === 'Backspace') { currentExp = currentExp.slice(0, -1); updateScreen(); }
    else if(e.key === '%') { currentExp += '%'; updateScreen(); }
    else if(e.key === 's') { currentExp += 'sin('; updateScreen(); }
    else if(e.key === 'c') { currentExp += 'cos('; updateScreen(); }
    else if(e.key === 't') { currentExp += 'tan('; updateScreen(); }
    // allow Shift+6 for ^ maybe, but users can press ^ on keyboards
  });

  // theme toggle
  themeToggle.addEventListener('change', (e) => {
    document.body.classList.toggle('dark', themeToggle.checked);
  });

  // initial
  updateScreen();
})();
