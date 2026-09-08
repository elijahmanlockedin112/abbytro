// Number formatting for scores and money.

/** Full score formatting: separators to 1e6, 1.23M/1.23B to 1e11, then scientific. */
export function fmtScore(n) {
  if (!Number.isFinite(n)) return n > 0 ? 'naneinf' : '0';
  n = Math.floor(n);
  const abs = Math.abs(n);
  if (abs < 1e6) return n.toLocaleString('en-US');
  if (abs < 1e9) return trim(n / 1e6) + 'M';
  if (abs < 1e11) return trim(n / 1e9) + 'B';
  return n.toExponential(2).replace('+', '');
}

/** Chips / mult readouts. Mult may be fractional. */
export function fmtNum(n) {
  if (!Number.isFinite(n)) return '?';
  const abs = Math.abs(n);
  if (abs >= 1e11) return n.toExponential(2).replace('+', '');
  if (abs >= 1e6) return fmtScore(n);
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function fmtMult(n) {
  const abs = Math.abs(n);
  if (abs >= 1e11) return n.toExponential(2).replace('+', '');
  if (abs >= 1e6) return fmtScore(n);
  if (Number.isInteger(n)) return String(n);
  return (Math.round(n * 100) / 100).toString();
}

export function fmtMoney(n) { return (n < 0 ? '-$' : '$') + Math.abs(Math.floor(n)); }

export function fmtX(n) { return '\u00d7' + fmtMult(n); }

function trim(v) {
  const s = v.toFixed(2);
  return s.replace(/\.?0+$/, '');
}
