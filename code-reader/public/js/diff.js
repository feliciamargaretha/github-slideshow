// Line diff (LCS). Small inputs only: components are capped at a few hundred lines.
export function diffLines(a, b) {
  const A = a.split('\n'), B = b.split('\n');
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i][j] = A[i].trim() === B[j].trim() ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i].trim() === B[j].trim()) { out.push({ type: 'same', a: i + 1, b: j + 1, text: B[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', a: i + 1, text: A[i] }); i++; }
    else { out.push({ type: 'add', b: j + 1, text: B[j] }); j++; }
  }
  while (i < n) { out.push({ type: 'del', a: i + 1, text: A[i] }); i++; }
  while (j < m) { out.push({ type: 'add', b: j + 1, text: B[j] }); j++; }
  return out;
}
