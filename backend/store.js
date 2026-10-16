// store.js - the only place that touches disk.
//
// Two things worth knowing:
//   1. the menu is read on nearly every request, so it is cached in memory
//      and reloaded only when the file's mtime changes
//   2. writes go to a temp file first and are then renamed, so a crash
//      halfway through can never leave a half-written JSON file

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'data');
const cache = new Map(); // name -> { mtimeMs, data }

function file(name) {
  return path.join(DIR, `${name}.json`);
}

function read(name) {
  const p = file(name);
  if (!fs.existsSync(p)) return [];

  const { mtimeMs } = fs.statSync(p);
  const hit = cache.get(name);
  if (hit && hit.mtimeMs === mtimeMs) return hit.data;

  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  cache.set(name, { mtimeMs, data });
  return data;
}

function write(name, data) {
  const p = file(name);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, p);
  cache.delete(name);
  return data;
}

/**
 * Read, change, write in one step.
 * Everything that edits shared data should go through this, so two
 * requests cannot read the same list and then both write it back.
 */
function update(name, fn) {
  const current = read(name);
  const next = fn(structuredClone(current));
  return write(name, next);
}

const readMenu = () => read('menu');
const writeMenu = (menu) => write('menu', menu);

module.exports = { read, write, update, readMenu, writeMenu };
