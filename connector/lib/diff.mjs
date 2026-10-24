/** Small line diff (LCS) with 2 lines of context. */
export function lineDiff(a, b, file = "file") {
  const A = a.split("\n"), B = b.split("\n");
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push([" ", A[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push(["-", A[i++]]);
    else ops.push(["+", B[j++]]);
  }
  while (i < n) ops.push(["-", A[i++]]);
  while (j < m) ops.push(["+", B[j++]]);
  const out = [`--- a/${file}`, `+++ b/${file}`];
  ops.forEach(([t, l], k) => {
    const near = ops.slice(Math.max(0, k - 2), k + 3).some(([x]) => x !== " ");
    if (t !== " " || near) out.push(`${t}${l}`);
  });
  return out.join("\n").slice(0, 20000);
}
