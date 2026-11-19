interface TestCounts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  unreported: number;
}

export function parseTestOutput(output: string): {
  testFiles: TestCounts;
  tests: TestCounts;
  errors: number;
  failures: { file: string | null; test: string | null }[];
  omittedFailureCount: number;
};
