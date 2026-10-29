import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { activeMarkdownFiles, buildWikiIndex, findVaultRoot, formatWikiLinks } from '../../scripts/wiki-link-format.mjs';

const tempDirs: string[] = [];
function fixture() {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-links-'));
  tempDirs.push(vault);
  const project = path.join(vault, 'project');
  const put = (relative: string, content = '') => {
    const file = path.join(vault, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  fs.mkdirSync(path.join(vault, '.obsidian'));
  put('project/docs/docs-830/unique.md');
  put('project/docs/docs-830/section/00-INDEX.md');
  put('project/ai/archive/00-index.md', '[[docs/docs-830/unique]]');
  put('other/unique-collision.md');
  return { vault, project, put };
}
afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe('WikiLink formatting', () => {
  it('uses the whole vault for collisions while preserving anchors and explicit aliases', () => {
    const { vault, project, put } = fixture();
    put('other/UNIQUE.md');
    const index = buildWikiIndex(project);
    expect(findVaultRoot(project)).toBe(vault);
    const result = formatWikiLinks([
      '[[docs/docs-830/unique]]',
      '[[docs/docs-830/unique#Part|自定义]]',
      '[[docs/docs-830/section/00-INDEX]]',
    ].join('\n'), index);
    expect(result.text).toBe([
      '[[project/docs/docs-830/unique|unique]]',
      '[[project/docs/docs-830/unique#Part|自定义]]',
      '[[project/docs/docs-830/section/00-INDEX|00-INDEX]]',
    ].join('\n'));
    expect(result.issues).toEqual([]);
    expect(formatWikiLinks(result.text, index).changes).toBe(0);
  });

  it('shortens unique targets, keeps links in code and comments, and reports ambiguous bare names', () => {
    const { project } = fixture();
    const index = buildWikiIndex(project);
    const source = [
      '[[docs/docs-830/unique#Heading]] [[docs/docs-830/unique|可读名称]]',
      '`[[docs/docs-830/unique]]` \\[[docs/docs-830/unique]]',
      '```md', '[[docs/docs-830/unique]]', '````',
      '~~~', '[[docs/docs-830/unique]]', '~~~',
      '<!-- [[docs/docs-830/unique]] -->',
      '[[00-INDEX]]',
    ].join('\n');
    const result = formatWikiLinks(source, index);
    expect(result.text).toContain('[[unique#Heading]] [[unique|可读名称]]');
    expect(result.text).toContain('`[[docs/docs-830/unique]]` \\[[docs/docs-830/unique]]');
    expect(result.text).toContain('```md\n[[docs/docs-830/unique]]\n````');
    expect(result.text).toContain('~~~\n[[docs/docs-830/unique]]\n~~~');
    expect(result.text).toContain('<!-- [[docs/docs-830/unique]] -->');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain('00-INDEX');
    expect(activeMarkdownFiles(project).some(file => file.includes('archive'))).toBe(false);
  });

  it('checks formatting, preserves archived content and catches a newly introduced collision', () => {
    const { project, put } = fixture();
    put('project/AGENTS.md', '[[docs/docs-830/unique]]');
    const formatter = path.join(process.cwd(), 'scripts/format-doc-links.mjs');
    const checker = path.join(process.cwd(), 'scripts/check-docs.mjs');
    const run = (script: string, ...args: string[]) => spawnSync(process.execPath, [script, ...args], {
      cwd: project, encoding: 'utf8',
    });
    expect(run(checker).status).toBe(1);
    expect(run(formatter, '--write').status).toBe(0);
    expect(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8')).toBe('[[unique]]');
    expect(fs.readFileSync(path.join(project, 'ai/archive/00-index.md'), 'utf8')).toBe('[[docs/docs-830/unique]]');
    expect(run(checker).status).toBe(0);
    put('project/ai/archive/unique.md');
    const ambiguous = run(checker);
    expect(ambiguous.status).toBe(1);
    expect(ambiguous.stdout).toContain('裸链接 [[unique]]');
    expect(run(formatter, '--write').status).toBe(1);
    expect(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8')).toBe('[[unique]]');
    put('project/AGENTS.md', '[[docs/docs-830/unique]]');
    expect(run(formatter, '--write').status).toBe(0);
    expect(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8')).toBe('[[project/docs/docs-830/unique|unique]]');
    expect(run(checker).status).toBe(0);
  });
});
