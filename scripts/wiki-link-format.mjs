import fs from 'node:fs';
import path from 'node:path';

// The vault can be larger than the checkout. Archived notes still participate in
// name resolution even though their contents must not be edited or checked.
export function findVaultRoot(projectRoot) {
  let current = path.resolve(projectRoot);
  while (true) {
    if (fs.existsSync(path.join(current, '.obsidian'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(projectRoot);
    current = parent;
  }
}

export function markdownFiles(root, { skipArchives = false } = {}) {
  const result = [];
  function visit(dir, relative = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || (skipArchives && (
          ['node_modules', 'dist', 'web-dist'].includes(entry.name)
          || ['ai/archive', 'docs/archive', 'docs/plan-work/archive'].includes(name)
        ))) continue;
        visit(path.join(dir, entry.name), name);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        result.push(path.join(dir, entry.name));
      }
    }
  }
  if (fs.existsSync(root)) visit(root);
  return result;
}

export function buildWikiIndex(projectRoot, vaultRoot = findVaultRoot(projectRoot)) {
  const names = new Map();
  for (const file of markdownFiles(vaultRoot)) {
    const base = path.basename(file).replace(/\.md$/i, '').toLowerCase();
    if (!names.has(base)) names.set(base, []);
    names.get(base).push(path.resolve(file));
  }
  const wikiRoot = path.resolve(projectRoot, 'docs/docs-830');
  const wikiFiles = new Set(markdownFiles(wikiRoot).map(file => path.resolve(file)));
  const prefix = path.relative(vaultRoot, projectRoot).split(path.sep).join('/');
  return { projectRoot: path.resolve(projectRoot), vaultRoot: path.resolve(vaultRoot), vaultPrefix: prefix ? `${prefix}/` : '', names, wikiFiles };
}

export function projectWikiPath(name, index) {
  const local = index.vaultPrefix && name.startsWith(index.vaultPrefix)
    ? name.slice(index.vaultPrefix.length) : name;
  return local.startsWith('docs/docs-830/') ? local : null;
}

// Protect code fences, inline code and HTML comments, including their contents.
// Fenced blocks are processed line-by-line so a longer closing fence is accepted.
export function mapProse(text, transform) {
  let fence = null;
  let comment = false;
  return text.split(/(?<=\n)/).map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length
          && /^\s*$/.test(line.slice(marker[0].length))) fence = null;
      return line;
    }
    if (!comment && marker) { fence = marker[1]; return line; }
    let out = '', prose = '';
    const flush = () => { out += transform(prose); prose = ''; };
    for (let i = 0; i < line.length;) {
      if (comment) {
        const end = line.indexOf('-->', i);
        if (end < 0) { out += line.slice(i); break; }
        out += line.slice(i, end + 3); i = end + 3; comment = false; continue;
      }
      if (line.startsWith('<!--', i)) { flush(); comment = true; continue; }
      if (line[i] === '`') {
        const run = line.slice(i).match(/^`+/)[0];
        const end = line.indexOf(run, i + run.length);
        if (end !== -1) { flush(); out += line.slice(i, end + run.length); i = end + run.length; continue; }
      }
      prose += line[i++];
    }
    flush();
    return out;
  }).join('');
}

export function formatWikiLinks(text, index) {
  const issues = [];
  let changes = 0;
  const result = mapProse(text, prose => prose.replace(/(?<!\\)\[\[([^\[\]\r\n]+)\]\]/g, (whole, inner) => {
    const bar = inner.indexOf('|');
    const target = (bar < 0 ? inner : inner.slice(0, bar)).trim();
    const alias = bar < 0 ? null : inner.slice(bar + 1);
    const hash = target.indexOf('#');
    const name = (hash < 0 ? target : target.slice(0, hash)).trim();
    const anchor = hash < 0 ? '' : target.slice(hash);
    if (!name || name.includes('...')) return whole;
    const base = path.posix.basename(name).replace(/\.md$/i, '');
    const matches = index.names.get(base.toLowerCase()) ?? [];
    if (!name.includes('/')) {
      if (matches.length > 1 && matches.some(file => index.wikiFiles.has(file))) {
        issues.push(`裸链接 [[${inner}]] 与其他笔记同名，请明确目标路径`);
      }
      return whole;
    }
    // Only rewrite actual current Wiki files addressed from the project root.
    const local = projectWikiPath(name, index);
    if (!local) return whole;
    const candidate = path.resolve(index.projectRoot, local.endsWith('.md') ? local : `${local}.md`);
    if (!index.wikiFiles.has(candidate)) return whole;
    const unambiguous = matches.length === 1 && matches[0] === candidate;
    const outputTarget = unambiguous ? base : index.vaultPrefix + local.replace(/\.md$/i, '');
    const outputAlias = alias !== null ? alias : unambiguous ? null : base;
    const formatted = `[[${outputTarget}${anchor}${outputAlias === null ? '' : `|${outputAlias}`}]]`;
    if (formatted !== whole) changes++;
    return formatted;
  }));
  return { text: result, changes, issues };
}

export function activeMarkdownFiles(projectRoot) {
  const roots = ['docs', 'ai', 'ui-style'];
  const result = roots.flatMap(dir => markdownFiles(path.join(projectRoot, dir), { skipArchives: true })
    .filter(file => !['ai/archive/', 'docs/archive/', 'docs/plan-work/archive/']
      .some(prefix => path.relative(projectRoot, file).split(path.sep).join('/').startsWith(prefix))));
  const agents = path.join(projectRoot, 'AGENTS.md');
  if (fs.existsSync(agents)) result.push(agents);
  return result;
}
