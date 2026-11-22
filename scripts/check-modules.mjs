#!/usr/bin/env node
/* Статическая проверка проекта без браузера:
   - каждый import указывает на существующий файл
   - каждый именованный import реально экспортируется целью
   - локальные href/src из HTML и иконки манифеста существуют
   Ловит ровно тот класс ошибок, из-за которого система не стартует. */
import {readFileSync, existsSync, statSync, readdirSync} from 'node:fs';
import {join, dirname, resolve, relative} from 'node:path';

const ROOT = process.cwd();
const errors = [];
const ok = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.js') || name.endsWith('.mjs')) out.push(p);
  }
  return out;
}

function exportsOf(src) {
  const names = new Set();
  if (/export\s+default\b/.test(src)) names.add('default');
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim().split(/\s+as\s+/).pop().trim();
      if (t) names.add(t);
    }
  }
  return names;
}

const jsDir = join(ROOT, 'js');
if (!existsSync(jsDir)) {
  console.error('✗ Папка js/ не найдена');
  process.exit(1);
}

const files = walk(jsDir);
const cache = new Map();
const readExports = (file) => {
  if (!cache.has(file)) cache.set(file, exportsOf(readFileSync(file, 'utf8')));
  return cache.get(file);
};

let importCount = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  for (const m of src.matchAll(/^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
    importCount++;
    const clause = m[1].trim();
    const spec = m[2];
    if (!spec.startsWith('.') && !spec.startsWith('/')) {
      errors.push(`${rel}: внешний пакет «${spec}» — проект должен быть без зависимостей`);
      continue;
    }
    const target = resolve(dirname(file), spec);
    if (!existsSync(target)) {
      errors.push(`${rel}: не найден модуль «${spec}»`);
      continue;
    }
    const available = readExports(target);
    const braced = clause.match(/\{([\s\S]*)\}/);
    if (braced) {
      for (const part of braced[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        if (!name) continue;
        if (!available.has(name)) {
          errors.push(`${rel}: «${spec}» не экспортирует «${name}»`);
        }
      }
    }
    const defaultImport = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, '').trim();
    if (defaultImport && !defaultImport.startsWith('*') && !available.has('default')) {
      errors.push(`${rel}: «${spec}» не имеет export default (импорт «${defaultImport}»)`);
    }
  }
}
ok.push(`модулей: ${files.length}, импортов проверено: ${importCount}`);

/* локальные ссылки из HTML */
const htmlRefs = [];
for (const page of ['index.html', '404.html']) {
  const p = join(ROOT, page);
  if (!existsSync(p)) { errors.push(`нет файла ${page}`); continue; }
  const src = readFileSync(p, 'utf8');
  for (const m of src.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/g)) {
    const href = m[1];
    if (/^(https?:|data:|mailto:|#|\/\/)/.test(href)) continue;
    htmlRefs.push([page, href.split('?')[0].split('#')[0]]);
  }
}
for (const [page, href] of htmlRefs) {
  if (!href) continue;
  if (!existsSync(join(ROOT, href))) errors.push(`${page}: не найден ресурс «${href}»`);
}
ok.push(`ссылок из HTML проверено: ${htmlRefs.length}`);

/* манифест */
const mp = join(ROOT, 'manifest.webmanifest');
if (!existsSync(mp)) errors.push('нет manifest.webmanifest');
else {
  try {
    const man = JSON.parse(readFileSync(mp, 'utf8'));
    for (const key of ['name', 'short_name', 'start_url', 'display', 'icons']) {
      if (!man[key]) errors.push(`manifest: нет поля «${key}»`);
    }
    for (const ic of man.icons || []) {
      if (!existsSync(join(ROOT, ic.src))) errors.push(`manifest: не найдена иконка «${ic.src}»`);
    }
    if (!existsSync(join(ROOT, man.start_url.replace(/^\.\//, '')))) {
      errors.push(`manifest: start_url «${man.start_url}» не существует`);
    }
    ok.push(`манифест: ${man.name} · display=${man.display}`);
  } catch (e) {
    errors.push('manifest: невалидный JSON — ' + e.message);
  }
}

/* service worker */
if (!existsSync(join(ROOT, 'sw.js'))) errors.push('нет sw.js');
else ok.push('service worker на месте');

for (const line of ok) console.log('✓ ' + line);
if (errors.length) {
  console.error('\n✗ Ошибки сборки:');
  for (const e of errors) console.error('  · ' + e);
  process.exit(1);
}
console.log('\n✓ Проект готов к публикации');