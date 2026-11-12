function countsFromLine(line) {
  if (!line) return { total: 0, passed: 0, failed: 0, skipped: 0, unreported: 0 };
  const counts = { total: Number(line.match(/\((\d+)\)/)?.[1] ?? 0), passed: 0, failed: 0, skipped: 0, unreported: 0 };
  for (const [, count, status] of line.matchAll(/(\d+)\s+(passed|failed|skipped|todo|pending)/g)) {
    if (status === 'passed' || status === 'failed') counts[status] += Number(count);
    else counts.skipped += Number(count);
  }
  if (!counts.total) counts.total = counts.passed + counts.failed + counts.skipped;
  counts.unreported = Math.max(0, counts.total - counts.passed - counts.failed - counts.skipped);
  return counts;
}

export function parseTestOutput(output) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '');
  const lastLine = label => [...clean.matchAll(new RegExp(`^\\s*${label}\\s+([^\\r\\n]+)`, 'gm'))].at(-1)?.[1];
  const failures = [...clean.matchAll(/^\s*FAIL\s+([^\r\n]+)/gm)].map(([, line]) => {
    const file = line.match(/(?:tests|tools)\/[^\s>\[]+/)?.[0] ?? null;
    const test = line.includes(' > ') ? line.slice(line.indexOf(' > ') + 3).replace(/\s+\[.*$/, '') : null;
    return { file, test };
  });

  return {
    testFiles: countsFromLine(lastLine('Test Files')),
    tests: countsFromLine(lastLine('Tests')),
    errors: Number(lastLine('Errors')?.match(/(\d+)\s+errors?/)?.[1] ?? 0),
    failures: failures.slice(0, 12),
    omittedFailureCount: Math.max(0, failures.length - 12),
  };
}
