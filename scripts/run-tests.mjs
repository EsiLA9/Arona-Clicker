import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const artifactDir = path.join(projectRoot, '.test-artifacts');
const logFile = path.join(artifactDir, 'latest.log');
const vitestCli = path.join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs');

await mkdir(artifactDir, { recursive: true });
const log = createWriteStream(logFile, { flags: 'w' });
const recentChunks = [];
let recentLength = 0;
const maxRecentLength = 16_000;
let spawnError;

function capture(chunk) {
  log.write(chunk);
  recentChunks.push(chunk);
  recentLength += chunk.length;
  while (recentLength > maxRecentLength && recentChunks.length > 1) {
    recentLength -= recentChunks.shift().length;
  }
}

function tailText() {
  return Buffer.concat(recentChunks).toString('utf8');
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

  if (spawnError) {
    console.error(`Vitest could not start: ${spawnError.message}`);
    console.error('See .test-artifacts/latest.log for captured output.');
    process.exitCode = 1;
    return;
  }

  const summary = tailText().match(/Test Files[^\r\n]*(?:\r?\n\s*Tests[^\r\n]*)?/m)?.[0]?.trim();
  if (code === 0) {
    console.log(summary ? `Vitest passed. ${summary.replace(/\r?\n\s*/, ' · ')}` : 'Vitest passed.');
    console.log('Full output: .test-artifacts/latest.log');
    return;
  }

  console.error(`Vitest failed${signal ? ` (${signal})` : ` (exit ${code ?? 1})`}.`);
  console.error('Recent output:');
  console.error(tailText());
  console.error('Full output: .test-artifacts/latest.log');
  process.exitCode = code ?? 1;
});
