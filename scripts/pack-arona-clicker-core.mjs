// ============================================================
// scripts/pack-arona-clicker-core.mjs
// 将 datapack/AronaClickerCore/ 文件夹打包为 arona-clicker-core.zip
// （内部保留 AronaClickerCore/ 前缀目录，与 README §8 示例一致）。
// 用法：node scripts/pack-arona-clicker-core.mjs
// ============================================================

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'datapack', 'AronaClickerCore');
const outPath = join(root, 'datapack', 'arona-clicker-core.zip');

/** 递归收集目录下所有 .json 文件（相对 srcDir 的路径）。 */
function collectJsonFiles(dir, base = '') {
  const results = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    let isDir = true;
    try {
      isDir = readdirSync(full).length >= 0;
    } catch {
      isDir = false;
    }
    if (isDir) {
      results.push(...collectJsonFiles(full, rel));
    } else if (/\.json$/i.test(name)) {
      results.push(rel);
    }
  }
  return results;
}

const files = collectJsonFiles(srcDir).sort();
if (files.length === 0) {
  console.error(`[pack] 未在 ${srcDir} 找到任何 .json 文件`);
  process.exit(1);
}

const zip = new JSZip();
for (const rel of files) {
  zip.file(`AronaClickerCore/${rel}`, readFileSync(join(srcDir, rel)));
}

const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buffer);
console.log(`[pack] 已打包 ${files.length} 个 json 分片 → ${outPath} (${buffer.length} bytes)`);
