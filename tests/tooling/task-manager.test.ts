import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

it('generates a task with concrete planning prompts and marks the scaffold as unfinished', () => {
  const artifacts = path.resolve('.test-artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  const root = fs.mkdtempSync(path.join(artifacts, 'task-manager-'));
  try {
    for (const relative of ['scripts/task-manager.mjs', 'ai/guide/templates/execution-task.md']) {
      const target = path.join(root, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.resolve(relative), target);
    }
    const planDir = path.join(root, 'ai/plan');
    fs.mkdirSync(planDir, { recursive: true });
    const indexPath = path.join(planDir, '00-index.md');
    fs.writeFileSync(indexPath, '| Task | 状态 | 下一步 |\n| --- | --- | --- |\n');

    const result = spawnSync(process.execPath, [path.join(root, 'scripts/task-manager.mjs'),
      'newTask', 'concrete-plan', '具体调整'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const task = fs.readFileSync(path.join(planDir, 'task-0001-concrete-plan.md'), 'utf8');
    expect(task).toContain('# Task：具体调整');
    expect(task).toContain('## 当前依据与改动方案');
    for (const prompt of ['当前依据：', '具体调整：', '衔接与验证：', '待核实：']) {
      expect(task).toContain(prompt);
    }
    expect(fs.readFileSync(indexPath, 'utf8')).toContain(
      '| [[ai/plan/task-0001-concrete-plan]] | 待处理 | 补全当前依据与具体改动方案 |');
    expect(result.stdout).toContain('已生成待补全骨架');
  } finally {
    if (path.dirname(root) !== artifacts) throw new Error('Unexpected task fixture path');
    fs.rmSync(root, { recursive: true, force: true });
  }
});
