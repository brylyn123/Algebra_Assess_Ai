const GREEK_MAP = {
  alpha: '\\alpha',
  beta: '\\beta',
  gamma: '\\gamma',
  delta: '\\delta',
  epsilon: '\\epsilon',
  zeta: '\\zeta',
  eta: '\\eta',
  theta: '\\theta',
  iota: '\\iota',
  kappa: '\\kappa',
  lambda: '\\lambda',
  mu: '\\mu',
  nu: '\\nu',
  xi: '\\xi',
  pi: '\\pi',
  rho: '\\rho',
  sigma: '\\sigma',
  tau: '\\tau',
  upsilon: '\\upsilon',
  phi: '\\phi',
  chi: '\\chi',
  psi: '\\psi',
  omega: '\\omega',
  Gamma: '\\Gamma',
  Delta: '\\Delta',
  Theta: '\\Theta',
  Lambda: '\\Lambda',
  Xi: '\\Xi',
  Pi: '\\Pi',
  Sigma: '\\Sigma',
  Phi: '\\Phi',
  Psi: '\\Psi',
  Omega: '\\Omega',
};

const FUNCTION_MAP = {
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  log: '\\log',
  ln: '\\ln',
  exp: '\\exp',
  lim: '\\lim',
  max: '\\max',
  min: '\\min',
  inf: '\\inf',
  sup: '\\sup',
};

const SYMBOL_MAP = {
  '>=': '\\geq',
  '<=': '\\leq',
  '!=': '\\neq',
  '<>': '\\neq',
  '==': '=',
  '!=': '\\neq',
  '=>': '\\Rightarrow',
  '<=': '\\Leftarrow',
  '<=>': '\\Leftrightarrow',
  '...': '\\ldots',
  '...': '\\cdots',
  '+/-': '\\pm',
  '+-': '\\pm',
  'xx': '\\times',
  '÷÷': '\\div',
  'oo': '\\infty',
  'inf': '\\infty',
  'deg': '\\deg',
  '|=': '\\models',
  '|-': '\\vdash',
  '->_': '\\rightarrow',
  '->_': '\\longrightarrow',
  '<-_': '\\leftarrow',
  '<--_': '\\longleftarrow',
};

function convertGreekWords(text) {
  return text.replace(/\b([A-Za-z]+)\b/g, (match) => {
    if (GREEK_MAP[match]) return GREEK_MAP[match];
    return match;
  });
}

function convertInlineSubscriptSuperscript(text) {
  text = text.replace(/\^(\w+)/g, (_, content) => {
    if (content.length === 1) return `^{${content}}`;
    return `^{${content}}`;
  });

  text = text.replace(/_(\w+)/g, (_, content) => {
    if (content.length === 1) return `_{${content}}`;
    return `_{${content}}`;
  });

  return text;
}

function convertFractions(text) {
  text = text.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, '\\frac{$1}{$2}');
  text = text.replace(/\(([^()]+)\)\/(\w+)/g, '\\frac{$1}{$2}');
  text = text.replace(/(\w+)\/\(([^()]+)\)/g, '\\frac{$1}{$2}');
  text = text.replace(/(\w+(?:\^{[^}]+})?(?:_{[^}]+})?)\/(\w+(?:\^{[^}]+})?(?:_{[^}]+})?)/g, '\\frac{$1}{$2}');
  return text;
}

function convertFunctions(text) {
  let result = text;
  for (const [name, latex] of Object.entries(FUNCTION_MAP)) {
    const regex = new RegExp(`\\b${name}\\s*\\(`, 'g');
    result = result.replace(regex, `${latex}(`);
  }
  return result;
}

function convertOperators(text) {
  let result = text;
  const operators = Object.keys(SYMBOL_MAP).sort((a, b) => b.length - a.length);
  for (const op of operators) {
    const escaped = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), SYMBOL_MAP[op]);
  }
  return result;
}

function convertSquareRoot(text) {
  return text.replace(/\bsqrt\s*\(([^)]+)\)/g, '\\sqrt{$1}');
}

function convertAbsolute(text) {
  return text.replace(/\|([^|]+)\|/g, '\\left|$1\\right|');
}

function convertPowers(text) {
  text = text.replace(/(\d+)\^(\d+)/g, '$1^{$2}');
  return text;
}

export function autoConvertToLatex(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return rawInput || '';

  let text = rawInput;

  text = convertFractions(text);
  text = convertSquareRoot(text);
  text = convertFunctions(text);
  text = convertInlineSubscriptSuperscript(text);
  text = convertOperators(text);
  text = convertGreekWords(text);
  text = convertAbsolute(text);
  text = convertPowers(text);

  return text;
}

export function getQuickTypeHints() {
  return [
    { label: 'Fraction', example: '(x+1)/2', becomes: '\\frac{x+1}{2}' },
    { label: 'Square root', example: 'sqrt(x)', becomes: '\\sqrt{x}' },
    { label: 'Power', example: 'x^2', becomes: 'x^{2}' },
    { label: 'Subscript', example: 'x_n', becomes: 'x_{n}' },
    { label: 'Greek letters', example: 'alpha + beta', becomes: '\\alpha + \\beta' },
    { label: 'Greater/equal', example: 'x >= 3', becomes: 'x \\geq 3' },
    { label: 'Not equal', example: 'x != 0', becomes: 'x \\neq 0' },
    { label: 'Infinity', example: 'x -> oo', becomes: 'x \\to \\infty' },
  ];
}
