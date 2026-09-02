import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engineRoot = path.join(root, 'src', 'engine');
const dataServicesRoot = path.join(root, 'src', 'data-services');
const forbiddenRoots = [
  path.join(root, 'src', 'ui'),
  path.join(root, 'src', 'data'),
  path.join(root, 'src', 'save'),
  path.join(root, 'src', 'arona-clicker'),
  path.join(root, 'src', 'data-services'),
];
// 迁移期允许少量旧入口作为兼容转发层；转发层本身不得被新代码继续扩散。
const compatibilityShims = new Set([
  path.join(engineRoot, 'image', 'image-store.ts'),
  path.join(engineRoot, 'image', 'resolve.ts'),
]);

function listTypeScriptFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listTypeScriptFiles(fullPath));
    else if (entry.isFile() && fullPath.endsWith('.ts')) files.push(fullPath);
  }
  return files;
}

function isWithin(filePath, directory) {
  const relative = path.relative(directory, filePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

const violations = [];
const importPattern = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

function checkBoundary(sourceRoot, forbidden, label) {
for (const filePath of listTypeScriptFiles(sourceRoot)) {
  const source = fs.readFileSync(filePath, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(filePath), specifier);
    const target = forbidden.find(directory => isWithin(resolved, directory));
    if (target && !(label === 'src/engine' && compatibilityShims.has(filePath))) {
      violations.push({
        file: path.relative(root, filePath),
        import: specifier,
        target: path.relative(root, target),
        label,
      });
    }
  }
}
}

checkBoundary(engineRoot, forbiddenRoots, 'src/engine');
checkBoundary(dataServicesRoot, [
  path.join(root, 'src', 'arona-clicker'),
  path.join(root, 'src', 'ui'),
  path.join(root, 'src', 'data'),
  path.join(root, 'src', 'save'),
], 'src/data-services');

if (violations.length > 0) {
  console.error('Architecture boundary violations:');
  for (const violation of violations) {
    console.error('- ' + violation.label + ': ' + violation.file + ' imports ' + violation.import + ' (' + violation.target + ')');
  }
  process.exit(1);
}

console.log('Architecture boundary check passed: src/engine and src/data-services have no forbidden outward imports.');
