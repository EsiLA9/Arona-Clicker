/**
 * scripts/ui-callgraph.mjs —— UI 调用链 / 反向链静态分析
 *
 * 用途：回答「一次 DOM 重建是由谁、经过哪条链路触发的」。
 * 只用语法层（不做类型检查）：够快地扫全量 UI，定位过度刷新的入口。
 *
 * 用法：
 *   node scripts/ui-callgraph.mjs --summary
 *   node scripts/ui-callgraph.mjs --chains                        # 顶级调用链：事件入口 → 刷新/DOM 汇聚点
 *   node scripts/ui-callgraph.mjs --dom                           # DOM 写入点 + 刷新汇聚点反向链
 *   node scripts/ui-callgraph.mjs --reverse render,refreshPanels  # 反向链（谁调用它）
 *   node scripts/ui-callgraph.mjs --forward bindContactsActions   # 正向链（它调用谁）
 *   node scripts/ui-callgraph.mjs --hot                           # 入度 / DOM 写入热点
 *   node scripts/ui-callgraph.mjs --json graph.json               # 导出图
 *
 * 通用参数：
 *   --roots src/ui,src/arona-clicker   默认 src/ui
 *   --depth 10       正向链 / 链路搜索最大深度
 *   --paths 12       反向链最多打印路径数
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// --- 常量 ----------------------------------------------------------

/** 事件/订阅类调用：其内联回调视为「顶级入口」。 */
const LISTENER_CALLS = new Set(['addEventListener', 'on', 'onAny', 'subscribe', 'subscribeTo']);
/** 其余接受回调的高阶调用：内联回调只是作用域，不算入口。 */
const HIGHER_ORDER_CALLS = new Set(['forEach', 'map', 'filter', 'then', 'catch', 'finally', 'setTimeout', 'setInterval', 'queueMicrotask', 'requestAnimationFrame']);
/** DOM 写入：赋值型属性。 */
const DOM_WRITE_PROPS = new Set(['innerHTML', 'outerHTML', 'textContent', 'innerText', 'className']);
/** DOM 写入：方法型。 */
const DOM_WRITE_CALLS = new Set(['replaceChildren', 'appendChild', 'insertAdjacentHTML', 'insertAdjacentElement', 'remove', 'replaceWith', 'prepend', 'append', 'insertBefore', 'setHTML']);
/** 刷新语义：命中即视为「会造成界面重绘」的汇聚点。 */
const REFRESH_HINTS = new Set(['render', 'refreshPanels', 'refreshChatPanel', 'refreshLogPanel', 'scheduleRender', 'renderSelectorPage', 'renderInitSelect', 'renderGlobalEnhancementSelect', 'applyTheme', 'refreshLight', 'open', 'close']);

// --- 参数 ----------------------------------------------------------

function parseArgs(argv) {
  const args = { roots: ['src/ui'], depth: 10, paths: 12, json: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--roots') args.roots = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (a === '--depth') args.depth = Number(argv[++i]);
    else if (a === '--paths') args.paths = Number(argv[++i]);
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--reverse') args.reverse = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (a === '--forward') args.forward = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (a.startsWith('--')) args[a.slice(2)] = true;
  }
  return args;
}

// --- 收集与解析 -----------------------------------------------------

function collectFiles(roots) {
  const out = [];
  const walkDir = dir => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'dist' || entry === 'node_modules') continue;
        walkDir(full);
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        out.push(full);
      }
    }
  };
  for (const r of roots) walkDir(resolve(ROOT, r));
  return out;
}

const rel = p => relative(ROOT, p).split('\\').join('/');
const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
const nameText = name => (name && ts.isIdentifier(name) ? name.text : name?.text ?? '?');
const isExported = node => !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
/** Class.method → method */
const baseOf = short => short.slice(short.lastIndexOf('.') + 1);

function buildGraph(files) {
  const defs = new Map();        // id -> def
  const byShort = new Map();     // short -> def[]（精确名）
  const byBase = new Map();      // method -> def[]（Class.method 的末段）
  const scope = [];
  const top = () => scope[scope.length - 1];

  const pushDef = (file, line, kind, short, exported, meta = {}) => {
    const id = `${file}:${line}:${short}`;
    const def = { id, short, file, line, kind, exported, calls: [], domWrites: [], entryKind: null, ...meta };
    defs.set(id, def);
    if (!byShort.has(short)) byShort.set(short, []);
    byShort.get(short).push(def);
    if (short.includes('.')) {
      const b = baseOf(short);
      if (!byBase.has(b)) byBase.set(b, []);
      byBase.get(b).push(def);
    }
    return def;
  };

  const recordCall = (sf, node) => {
    const from = defs.get(top());
    if (!from) return;
    let name = null;
    let obj = null;
    const expr = node.expression;
    if (ts.isIdentifier(expr)) name = expr.text;
    else if (ts.isPropertyAccessExpression(expr)) {
      name = expr.name.text;
      if (ts.isIdentifier(expr.expression)) obj = expr.expression.text;
    }
    if (name) from.calls.push({ name, obj, line: lineOf(sf, node) });
  };

  const recordDomWrite = (sf, node, kind) => {
    const from = defs.get(top());
    if (from) from.domWrites.push({ kind, line: lineOf(sf, node) });
  };

  const calleeName = node => ts.isPropertyAccessExpression(node.expression)
    ? node.expression.name.text
    : ts.isIdentifier(node.expression) ? node.expression.text : null;

  const visit = sf => {
    const recurse = node => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const file = rel(sf.fileName);
        const def = pushDef(file, lineOf(sf, node), 'function', node.name.text, isExported(node));
        scope.push(def.id);
        ts.forEachChild(node, recurse);
        scope.pop();
        return;
      }
      if (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)) {
        const file = rel(sf.fileName);
        const cls = node.parent && ts.isClassDeclaration(node.parent) ? nameText(node.parent.name) : '?';
        const short = ts.isConstructorDeclaration(node) ? `${cls}.constructor` : `${cls}.${nameText(node.name)}`;
        const def = pushDef(file, lineOf(sf, node), 'method', short, false);
        scope.push(def.id);
        ts.forEachChild(node, recurse);
        scope.pop();
        return;
      }
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
            const file = rel(sf.fileName);
            const def = pushDef(file, lineOf(sf, decl), 'arrow', nameText(decl.name), isExported(node));
            scope.push(def.id);
            ts.forEachChild(decl.initializer, recurse);
            scope.pop();
            return;
          }
        }
        ts.forEachChild(node, recurse);
        return;
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        if (ts.isPropertyAccessExpression(node.left) && DOM_WRITE_PROPS.has(node.left.name.text)) {
          recordDomWrite(sf, node, node.left.name.text);
        }
      }
      if (ts.isCallExpression(node)) {
        recordCall(sf, node);
        if (ts.isPropertyAccessExpression(node.expression) && DOM_WRITE_CALLS.has(node.expression.name.text)) {
          recordDomWrite(sf, node, `${node.expression.name.text}()`);
        }
        const owner = calleeName(node);
        for (const arg of node.arguments) {
          if (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)) continue;
          const file = rel(sf.fileName);
          const anonLine = lineOf(sf, arg);
          const def = pushDef(file, anonLine, 'callback', `anon@${anonLine}`, false);
          if (owner && LISTENER_CALLS.has(owner)) {
            const first = node.arguments[0];
            const evt = first && ts.isStringLiteral(first) ? first.text : '?';
            def.entryKind = `event:${owner}:${evt}`;
          }
          scope.push(def.id);
          ts.forEachChild(arg, recurse);
          scope.pop();
        }
        ts.forEachChild(node, recurse);
        return;
      }
      ts.forEachChild(node, recurse);
    };
    ts.forEachChild(sf, recurse);
  };

  for (const file of files) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    visit(sf);
  }

  /**
   * 调用名 → 目标定义，分强弱两档：
   *   强：同文件同名 / 同文件 Class.method / 全项目唯一 → 可靠边
   *   弱：跨文件且同名多定义（如多处 `x.render()`）→ 可能边，输出时标 `?`
   * 这样既不丢 `ctrl.render()` 这类真实跨文件调用，也能看出哪些边是猜的。
   */
  const resolve = (name, fromFile) => {
    const exact = byShort.get(name) ?? [];
    const byName = byBase.get(name) ?? [];
    const inFile = [...exact, ...byName].filter(d => d.file === fromFile);
    const uniq = new Map(inFile.map(d => [d.id, d]));
    if (uniq.size) return { strong: [...uniq.values()], weak: [] };
    const all = [...new Map([...byName, ...exact].map(d => [d.id, d])).values()];
    if (all.length === 1) return { strong: all, weak: [] };
    return { strong: [], weak: all };
  };

  const calleesById = new Map();
  const callersById = new Map();
  const weakCalleesById = new Map();
  const weakCallersById = new Map();
  const addEdge = (map, key, value) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  };
  for (const def of defs.values()) {
    for (const call of def.calls) {
      const { strong, weak } = resolve(call.name, def.file);
      for (const target of strong) {
        if (target.id === def.id) continue;
        addEdge(calleesById, def.id, target.id);
        addEdge(callersById, target.id, def.id);
      }
      for (const target of weak) {
        if (target.id === def.id) continue;
        if (calleesById.get(def.id)?.has(target.id)) continue;
        addEdge(weakCalleesById, def.id, target.id);
        addEdge(weakCallersById, target.id, def.id);
      }
    }
  }

  return { defs, byShort, byBase, calleesById, callersById, weakCalleesById, weakCallersById };
}

// --- 查询 -----------------------------------------------------------

let graph;

let WEAK = false;   // --weak：把「跨文件同名多定义」的可能边也纳入

const calleesOf = id => [
  ...(graph.calleesById.get(id) ?? []),
  ...(WEAK ? (graph.weakCalleesById.get(id) ?? []) : []),
];
const callersOf = id => [
  ...(graph.callersById.get(id) ?? []),
  ...(WEAK ? (graph.weakCallersById.get(id) ?? []) : []),
];
const label = def => `${def.short}  (${def.file}:${def.line})`;
const isRefresh = def => REFRESH_HINTS.has(baseOf(def.short));
const targetsFor = name => graph.byShort.get(name) ?? graph.byBase.get(name) ?? [];

/** 顶级调用链：事件入口 → 可达的刷新 / DOM 汇聚点。 */
function chainsReport(maxDepth) {
  const entries = [...graph.defs.values()].filter(d => d.entryKind);
  console.log(`\n=== 顶级调用链（${entries.length} 个事件入口 → 刷新/DOM 汇聚点）===`);
  const grouped = new Map();
  for (const entry of entries) {
    const sinks = new Map();     // sinkKey -> depth
    const seen = new Set([entry.id]);
    let frontier = [{ id: entry.id, depth: 0 }];
    while (frontier.length) {
      const next = [];
      for (const node of frontier) {
        if (node.depth >= maxDepth) continue;
        for (const childId of calleesOf(node.id)) {
          const child = graph.defs.get(childId);
          const refresh = isRefresh(child);
          if ((refresh || child.domWrites.length) && !sinks.has(child.short)) {
            sinks.set(child.short, node.depth + 1);
          }
          if (seen.has(childId)) continue;
          seen.add(childId);
          next.push({ id: childId, depth: node.depth + 1 });
        }
      }
      frontier = next;
    }
    if (sinks.size === 0) continue;
    const key = [...sinks.keys()].sort().join(' | ');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  }
  const rows = [...grouped].sort((a, b) => b[1].length - a[1].length);
  for (const [key, list] of rows.slice(0, 25)) {
    console.log(`\n  ${list.length} 个入口 → ${key}`);
    for (const e of list.slice(0, 4)) console.log(`      ${label(e)}  [${e.entryKind}]`);
    if (list.length > 4) console.log(`      … 另 ${list.length - 4} 个`);
  }
}

/** 反向链：target ← … ← 入口。 */
function reverseChain(targets, maxPaths) {
  const start = [];
  for (const name of targets) for (const d of targetsFor(name)) start.push(d.id);
  console.log(`\n=== 反向链：${targets.join(' / ')} ===`);
  if (start.length === 0) { console.log('  （未找到目标）'); return; }
  const paths = [];
  const walk = (defId, path, depth, guard) => {
    if (paths.length >= maxPaths || depth > 12) return;
    const def = graph.defs.get(defId);
    const next = [defId, ...path];
    const callers = callersOf(defId).filter(c => !guard.has(c));
    if (callers.length === 0) { paths.push(next); return; }
    for (const callerId of callers) {
      if (def.exported && !graph.defs.get(callerId).exported && callerId.startsWith(def.file) === false) {
        // 跨文件调用导出函数：仍继续上溯，保证能到顶级入口
      }
      guard.add(callerId);
      walk(callerId, next, depth + 1, guard);
      guard.delete(callerId);
    }
  };
  for (const id of start) walk(id, [], 0, new Set([id]));
  if (paths.length === 0) console.log('  （无调用者：已是顶级入口）');
  // paths 形如 [入口, …, 目标]：从左到右即调用方向
  for (const p of paths) {
    console.log(`  ${p.map(id => graph.defs.get(id).short).join(' → ')}`);
    console.log(`      └ 目标 ${label(graph.defs.get(p[p.length - 1]))}   入口 ${label(graph.defs.get(p[0]))}`);
  }
  console.log(`  （共 ${paths.length} 条，上限 ${maxPaths}）`);
}

/** 正向链。 */
function forwardChain(names, maxDepth) {
  console.log(`\n=== 正向链：${names.join(' / ')} ===`);
  for (const name of names) {
    for (const def of targetsFor(name)) {
      console.log(`  ${label(def)}`);
      const seen = new Set([def.id]);
      const step = (defId, depth, prefix) => {
        if (depth > maxDepth) return;
        const children = calleesOf(defId);
        children.forEach((childId, index) => {
          const child = graph.defs.get(childId);
          const last = index === children.length - 1;
          const marks = [];
          if (child.domWrites.length) marks.push(`DOM×${child.domWrites.length}`);
          if (isRefresh(child)) marks.push('REFRESH');
          console.log(`${prefix}${last ? '└─ ' : '├─ '}${child.short}${marks.length ? `  <${marks.join(' ')}>` : ''}  (${child.file}:${child.line})`);
          if (seen.has(childId)) return;
          seen.add(childId);
          step(childId, depth + 1, `${prefix}${last ? '   ' : '│  '}`);
        });
      };
      step(def.id, 1, '    ');
    }
  }
}

/** DOM 写入点 + 刷新汇聚点反向链。 */
function domReport(maxPaths) {
  const writers = [...graph.defs.values()].filter(d => d.domWrites.length > 0);
  console.log(`\n=== DOM 写入点（${writers.length} 个函数，共 ${writers.reduce((n, d) => n + d.domWrites.length, 0)} 处）===`);
  for (const def of writers.sort((a, b) => b.domWrites.length - a.domWrites.length).slice(0, 12)) {
    const kinds = [...new Set(def.domWrites.map(w => w.kind))].join(', ');
    console.log(`  ${String(def.domWrites.length).padStart(3)} ✎  ${def.short.padEnd(40)} [${kinds}]  入度 ${callersOf(def.id).length}  ${def.file}:${def.line}`);
  }
  console.log('\n=== 刷新汇聚点反向链 ===');
  for (const name of ['UIController.render', 'UIController.refreshPanels', 'UIController.scheduleRender', 'refreshRevealIfChanged']) {
    reverseChain([name], Math.max(3, Math.floor(maxPaths / 2)));
  }
}

/** 热点。 */
function hotReport() {
  const rows = [...graph.defs.values()].map(d => ({
    def: d,
    fanIn: callersOf(d.id).length,
    fanOut: new Set(d.calls.map(c => c.name)).size,
    dom: d.domWrites.length,
  }));
  console.log('\n=== 入度最高（改动影响面最大）===');
  for (const r of rows.sort((a, b) => b.fanIn - a.fanIn).slice(0, 12)) {
    console.log(`  ${String(r.fanIn).padStart(3)} ←  ${r.def.short.padEnd(44)} ${r.def.file}:${r.def.line}`);
  }
  console.log('\n=== DOM 写入最密集 ===');
  for (const r of rows.filter(x => x.dom > 0).sort((a, b) => b.dom - a.dom).slice(0, 12)) {
    console.log(`  ${String(r.dom).padStart(3)} ✎  ${r.def.short.padEnd(44)} ${r.def.file}:${r.def.line}`);
  }
  console.log('\n=== 顶级入口 ===');
  const entries = rows.filter(r => r.fanIn === 0 || r.def.entryKind);
  const byKind = new Map();
  for (const e of entries) {
    const k = e.def.entryKind ?? 'root(无调用者)';
    byKind.set(k, (byKind.get(k) ?? 0) + 1);
  }
  console.log(`  共 ${entries.length} 个`);
  for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${String(n).padStart(3)} ×  ${k}`);
  }
}

function summary() {
  const defs = [...graph.defs.values()];
  console.log('=== UI 调用图概览 ===');
  console.log(`  文件：${[...new Set(defs.map(d => d.file))].length}`);
  console.log(`  定义（函数/方法/回调）：${defs.length}`);
  console.log(`  调用边（可靠）：${[...graph.calleesById.values()].reduce((n, s) => n + s.size, 0)}`);
  console.log(`  调用边（弱，跨文件同名多定义；加 --weak 纳入）：${[...graph.weakCalleesById.values()].reduce((n, s) => n + s.size, 0)}`);
  console.log(`  DOM 写入点：${defs.reduce((n, d) => n + d.domWrites.length, 0)}（分布在 ${defs.filter(d => d.domWrites.length).length} 个函数）`);
  console.log(`  顶级入口：${defs.filter(d => callersOf(d.id).length === 0 || d.entryKind).length}（事件回调 ${defs.filter(d => d.entryKind).length}）`);
  const weakTop = [...new Set([...graph.weakCallersById].map(([id, s]) => graph.defs.get(id).short))].slice(0, 8);
  if (weakTop.length) console.log(`  弱边汇聚点示例：${weakTop.join(', ')}`);
}

// --- main -----------------------------------------------------------

const args = parseArgs(process.argv.slice(2));
const files = collectFiles(args.roots);
graph = buildGraph(files);
WEAK = !!args.weak;

if (args.json) {
  const payload = {
    generatedAt: new Date().toISOString(),
    files: files.map(rel),
    defs: [...graph.defs.values()].map(d => ({
      id: d.id, short: d.short, file: d.file, line: d.line, kind: d.kind,
      exported: d.exported, entryKind: d.entryKind,
      callees: calleesOf(d.id).map(id => graph.defs.get(id).short),
      callers: callersOf(d.id).map(id => graph.defs.get(id).short),
      domWrites: d.domWrites.length,
    })),
  };
  writeFileSync(resolve(ROOT, args.json), JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[ui-callgraph] wrote ${args.json}`);
}

const onlyJson = args.json && !args.summary && !args.chains && !args.dom && !args.hot && !args.reverse && !args.forward;
if (!onlyJson) summary();
if (args.chains) chainsReport(args.depth);
if (args.dom) domReport(args.paths);
if (args.hot) hotReport();
if (args.reverse) reverseChain(args.reverse, args.paths);
if (args.forward) forwardChain(args.forward, args.depth);
