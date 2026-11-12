import { describe, expect, it } from 'vitest';
import { parseTestOutput } from '../../scripts/test-output-summary.mjs';

describe('Vitest output summary', () => {
  it('parses a passing run without listing failures', () => {
    expect(parseTestOutput('Test Files  395 passed (395)\n      Tests  3792 passed | 2 skipped (3794)'))
      .toMatchObject({
        testFiles: { total: 395, passed: 395, failed: 0, unreported: 0 },
        tests: { total: 3794, passed: 3792, failed: 0, skipped: 2, unreported: 0 },
        failures: [],
      });
  });

  it('captures a compact failure list and worker errors', () => {
    expect(parseTestOutput([
      ' FAIL  tests/engine/story/example.test.ts > starts safely',
      ' Test Files  1 failed | 4 passed (7)',
      '      Tests  2 failed | 18 passed (25)',
      '     Errors  1 error',
    ].join('\n'))).toMatchObject({
      testFiles: { total: 7, passed: 4, failed: 1, unreported: 2 },
      tests: { total: 25, passed: 18, failed: 2, unreported: 5 },
      errors: 1,
      failures: [{ file: 'tests/engine/story/example.test.ts', test: 'starts safely' }],
    });
  });
});
