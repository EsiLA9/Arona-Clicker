import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';

const script = path.resolve('scripts/archive-docs.mjs');
const temporary: string[] = [];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-docs-'));
  temporary.push(root);
  const put = (name: string, content: string | Buffer = '内容') => {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    return full;
  };
  const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  return { root, put, run, archive: path.join(root, 'ai/archive/history.zip') };
}
afterEach(() => { for (const root of temporary.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('compressed document archive CLI', () => {
  it('keeps inspection read-only before the first input and accepts staged retired documents', () => {
    const { put, run, archive } = fixture();
    expect(run('list').status).toBe(0);
    expect(fs.existsSync(archive)).toBe(false);
    const source = put('ai/archive/inbox/retired/old.md', '旧材料');
    expect(run('add', 'ai/archive/inbox/retired').status).toBe(0);
    expect(fs.existsSync(source)).toBe(false);
    expect(run('read', 'ai/archive/inbox/retired/old.md').stdout).toBe('旧材料');
  });

  it('appends UTF-8 documents and binary evidence to one ZIP, then reads without extraction', async () => {
    const { root, put, run, archive } = fixture();
    const task = put('ai/plan/task-demo.md', '# 已完成\n归档正文');
    expect(run('add', 'ai/plan/task-demo.md').status).toBe(0);
    expect(fs.existsSync(task)).toBe(false);
    const binary = Buffer.from([0, 255, 128, 1]);
    put('ai/plan/demo-units/evidence.bin', binary);
    put('ai/plan/demo-units/记录.md', '记录');
    expect(run('add', 'ai/plan/demo-units').status).toBe(0);
    expect(fs.existsSync(path.join(root, 'ai/plan/demo-units'))).toBe(false);
    const zip = await JSZip.loadAsync(fs.readFileSync(archive), { checkCRC32: true });
    expect(await zip.file('ai/plan/demo-units/evidence.bin')!.async('nodebuffer')).toEqual(binary);
    expect(run('list').stdout).toContain('ai/plan/task-demo.md');
    expect(run('list', 'ai/plan/demo-units/').stdout).not.toContain('task-demo');
    expect(run('read', 'ai/plan/task-demo.md').stdout).toBe('# 已完成\n归档正文');
    expect(run('read', 'missing').status).toBe(1);
    expect(fs.readdirSync(path.join(root, 'ai/archive'))).toEqual(['history.zip']);
  });

  it('rejects a duplicate without changing the archive or deleting the new source', () => {
    const { put, run, archive } = fixture();
    put('ai/plan/task.md', '原文');
    expect(run('add', 'ai/plan/task.md').status).toBe(0);
    const original = fs.readFileSync(archive);
    const source = put('ai/plan/task.md', '新文');
    expect(run('add', 'ai/plan/task.md').status).toBe(1);
    expect(fs.readFileSync(source, 'utf8')).toBe('新文');
    expect(fs.readFileSync(archive)).toEqual(original);
  });

  it.each(['ai/plan/00-index.md', 'docs/docs-830/current.md', 'ai/plan', '../outside.md'])('refuses an unsafe or active source %s', source => {
    const { put, run } = fixture();
    const file = put('ai/plan/00-index.md');
    expect(run('add', source).status).toBe(1);
    expect(fs.existsSync(file)).toBe(true);
  });

  it('preserves sources when the existing ZIP is corrupt or another writer holds the lock', () => {
    const { put, run, archive } = fixture();
    const source = put('ai/plan/task.md');
    put('ai/archive/history.zip', 'broken ZIP');
    expect(run('add', 'ai/plan/task.md').status).toBe(1);
    expect(fs.readFileSync(archive, 'utf8')).toBe('broken ZIP');
    expect(fs.existsSync(source)).toBe(true);
    put('ai/archive/history.zip.lock', 'locked');
    expect(run('add', 'ai/plan/task.md').status).toBe(1);
    expect(fs.existsSync(source)).toBe(true);
  });

  it('leaves an existing temporary archive and source intact rather than overwriting either', () => {
    const { put, run } = fixture();
    const source = put('ai/plan/task.md');
    const pending = put('ai/archive/history.zip.tmp', 'pending');
    expect(run('add', 'ai/plan/task.md').status).toBe(1);
    expect(fs.existsSync(source)).toBe(true);
    expect(fs.readFileSync(pending, 'utf8')).toBe('pending');
  });

  it('rejects a source reached through a directory junction or symlink', () => {
    const { root, put, run } = fixture();
    const target = put('elsewhere/task.md');
    fs.mkdirSync(path.join(root, 'ai/plan'), { recursive: true });
    fs.symlinkSync(path.dirname(target), path.join(root, 'ai/plan/linked'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(run('add', 'ai/plan/linked').status).toBe(1);
    expect(fs.existsSync(target)).toBe(true);
  });
});
