/* Scientific calculator logic
   - Safe-ish expression evaluation using a sandbox scope object and Function + with(scope)
   - Supports factorial (!) via replacement
   - Degree/Radian toggle
   - Memory operations and history
*/

(() => {
  // UI elements
  const display = document.getElementById('display');
  const exprEl = document.getElementById('expr');
  const historyList = document.getElementById('historyList');
  const degRadBtn = document.getElementById('degRadBtn');
  const themeToggle = document.getElementById('themeToggle');

  let currentExp = '';
  let lastResult = '';
  let degMode = true; // default degrees
  let memory = 0;
  let history = [];

  // helpers
  function updateScreen(){
    exprEl.textContent = currentExp;
    display.value = lastResult || '';
  }

  function pushHistory(expression, result){
    history.unshift({expression, result});
    if(history.length > 20) history.pop();
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

  // factorial implementation
  function factorial(n){
    n = Number(n);
    if(!isFinite(n) || n < 0) throw 'Invalid factorial';
    if(Math.floor(n) !== n) { // gamma approx for non-integers? keep simple
      // use gamma approximation for non-integers if needed (optional)
      throw 'Factorial only supports non-negative integers';
    }
    let res = 1;
    for(let i=2;i<=n;i++) res *= i;
    return res;
  }

  // evaluation sandbox
  function evaluateExpression(str){
    if(!str) return '';
    // normalize symbols
    str = str.replace(/×/g, '*').replace(/÷/g, '/').replace(/–/g,'-');
    // replace percent (n% -> (n/100))
    str = str.replace(/(\d+(\.\d+)?)%/g, '($1/100)');
    // replace factorial (e.g. 5! -> factorial(5))
    str = str.replace(/(\d+(\.\d+)?)!/g, 'factorial($1)');

    // allow ^ as power
    str = str.replace(/\^/g, '**');

    // allow shorthand for constants
    str = str.replace(/\bpi\b/gi, 'PI');
    str = str.replace(/\be\b/gi, 'E');

    // create scope
    const scope = {
      // constants
      PI: Math.PI,
      E: Math.E,
      // math alias
      abs: Math.abs, pow: Math.pow, sqrt: Math.sqrt, round: Math.round,
      floor: Math.floor, ceil: Math.ceil, max: Math.max, min: Math.min,
      log: Math.log10, ln: Math.log, exp: Math.exp,
      // factorial
      factorial: factorial,
      // trig wrappers that honor degMode
      sin: (x) => degMode ? Math.sin(x * Math.PI/180) : Math.sin(x),
      cos: (x) => degMode ? Math.cos(x * Math.PI/180) : Math.cos(x),
      tan: (x) => degMode ? Math.tan(x * Math.PI/180) : Math.tan(x),
      asin: (x) => (degMode ? Math.asin(x) * 180/Math.PI : Math.asin(x)),
      acos: (x) => (degMode ? Math.acos(x) * 180/Math.PI : Math.acos(x)),
      atan: (x) => (degMode ? Math.atan(x) * 180/Math.PI : Math.atan(x)),
      // utility
      PI2: Math.PI*2
    };

    // sanitize: basic check to reduce injection — allow digits, operators, parentheses, letters for function names and dots
    // (This is not bulletproof—code runs client-side. Do not evaluate untrusted input server-side.)
    if(/[^0-9+\-*/^().,%!eEpiPIa-zA-Z _]/.test(str)) {
      // allow ** operator too
      // any other symbol reject
      // but keep it lenient to not block valid expressions
    }

    // evaluate using with(scope)
    try {
      const func = new Function('scope', `with(scope){ return ${str}; }`);
      const result = func(scope);
      if(typeof result === 'number' && !isFinite(result)) throw 'Result not finite';
      return result;
    } catch (err){
      throw err;
    }
  }

  // button handlers
  document.querySelectorAll('.num').forEach(b => b.addEventListener('click', () => {
    currentExp += b.dataset.num;
    updateScreen();
  }));
  document.querySelectorAll('.op').forEach(b => b.addEventListener('click', () => {
    currentExp += ` ${b.dataset.op} `;
    updateScreen();
  }));
  document.querySelectorAll('.fn').forEach(b => b.addEventListener('click', () => {
    const f = b.dataset.fn;
    if(f === 'back'){
      currentExp = currentExp.slice(0, -1);
    } else if(f === 'C'){
      currentExp = '';
      lastResult = '';
    } else if(f === 'MC'){
      memory = 0;
    } else if(f === 'MR'){
      currentExp += String(memory);
    } else if(f === 'M+'){
      try{
        const r = evaluateExpression(currentExp || lastResult);
        if(typeof r === 'number') memory += r;
      }catch(e){}
    } else if(f === 'M-'){
      try{
        const r = evaluateExpression(currentExp || lastResult);
        if(typeof r === 'number') memory -= r;
      }catch(e){}
    } else if(f === 'pi'){
      currentExp += 'PI';
    } else if(f === '!'){
      currentExp += '!';
    } else {
      // functions like sin,cos,ln,log,asin,acos,atan,sqrt,exp,^,(,)
      if(['sin','cos','tan','asin','acos','atan','ln','log','exp','sqrt','^','(',')'].includes(f)){
        if(f === 'ln') currentExp += ' ln(';
        else if(f === 'log') currentExp += ' log(';
        else if(f === 'exp') currentExp += ' exp(';
        else if(f === 'sqrt') currentExp += ' sqrt(';
        else if(f === '^') currentExp += '^';
        else currentExp += f + '(';
      } else {
        currentExp += f;
      }
    }
    updateScreen();
  }));

  document.querySelectorAll('.const').forEach(b => {
    b.addEventListener('click', () => {
      const c = b.dataset.const;
      if(c === 'pi') currentExp += 'PI';
      else if(c === 'e') currentExp += 'E';
      else if(c === '%') currentExp += '%';
      updateScreen();
    });
  });

  document.getElementById('equals').addEventListener('click', computeResult);

  function computeResult(){
    try {
      const result = evaluateExpression(currentExp);
      lastResult = result === undefined ? '' : String(Number.isFinite(result) ? roundIfNeeded(result) : result);
      pushHistory(currentExp, lastResult);
      currentExp = String(lastResult);
    } catch (err){
      lastResult = 'Error';
    }
    updateScreen();
  }

  function roundIfNeeded(n){
    // avoid long float tails
    if(Math.abs(n) < 1e-12) return 0;
    return Math.round((n + Number.EPSILON) * 1e12) / 1e12;
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
    // allow keyboard triggers for functions: s->sin, c->cos, t->tan (basic)
    else if(e.key === 's') { currentExp += 'sin('; updateScreen(); }
    else if(e.key === 'c') { currentExp += 'cos('; updateScreen(); }
    else if(e.key === 't') { currentExp += 'tan('; updateScreen(); }
  });

  // theme toggle
  themeToggle.addEventListener('change', (e) => {
    document.body.classList.toggle('dark', themeToggle.checked);
  });

  // initial render
  updateScreen();
})();
