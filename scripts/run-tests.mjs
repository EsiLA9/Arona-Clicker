import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTestOutput } from './test-output-summary.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const artifactDir = path.join(projectRoot, '.test-artifacts');
const logFile = path.join(artifactDir, 'latest.log');
const summaryFile = path.join(artifactDir, 'latest-summary.json');
const vitestCli = path.join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs');

await mkdir(artifactDir, { recursive: true });
const log = createWriteStream(logFile, { flags: 'w' });
let spawnError;

function capture(chunk) {
  log.write(chunk);
}

const child = spawn(process.execPath, [vitestCli, 'run', ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: ['inherit', 'pipe', 'pipe'],
});

child.stdout.on('data', capture);
child.stderr.on('data', capture);

child.once('error', error => { spawnError = error; });

child.once('close', async (code, signal) => {
  log.end();
  await new Promise(resolve => log.once('close', resolve));
  const output = await readFile(logFile, 'utf8');
  const parsed = parseTestOutput(output);
  const result = {
    generatedAt: new Date().toISOString(),
    status: spawnError ? 'error' : code === 0 ? 'passed' : 'failed',
    exitCode: code ?? null,
    signal: signal ?? null,
    ...parsed,
    fullLog: '.test-artifacts/latest.log',
  };
  await writeFile(summaryFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  if (spawnError) {
    console.error(`Vitest could not start: ${spawnError.message}`);
    console.error('Summary: .test-artifacts/latest-summary.json');
    process.exitCode = 1;
    return;
  }

  const fileCounts = `${parsed.testFiles.passed} passed, ${parsed.testFiles.failed} failed`;
  const testCounts = `${parsed.tests.passed} passed, ${parsed.tests.failed} failed`;
  const unreported = [
    parsed.testFiles.unreported && `${parsed.testFiles.unreported} files unreported`,
    parsed.tests.unreported && `${parsed.tests.unreported} tests unreported`,
    parsed.tests.skipped && `${parsed.tests.skipped} tests skipped`,
  ].filter(Boolean).join(', ');
  const errors = parsed.errors ? `, ${parsed.errors} worker/errors` : '';
  if (code === 0) {
    console.log(`Vitest passed. Files: ${fileCounts}; tests: ${testCounts}${unreported ? `; ${unreported}` : ''}${errors}.`);
    console.log('Summary: .test-artifacts/latest-summary.json');
    console.log('Full log: .test-artifacts/latest.log');
    return;
  }

  console.error(`Vitest failed${signal ? ` (${signal})` : ` (exit ${code ?? 1})`}.`);
  console.error(`Files: ${fileCounts}; tests: ${testCounts}${unreported ? `; ${unreported}` : ''}${errors}.`);
  const failedFiles = [...new Set(parsed.failures.map(failure => failure.file).filter(Boolean))];
  if (failedFiles.length) console.error(`Failed files: ${failedFiles.slice(0, 8).join(', ')}`);
  if (parsed.omittedFailureCount) console.error(`Additional failures: ${parsed.omittedFailureCount}`);
  console.error('Summary: .test-artifacts/latest-summary.json');
  console.error('Full log: .test-artifacts/latest.log');
  process.exitCode = code ?? 1;
});
