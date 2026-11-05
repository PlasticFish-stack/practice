const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve('.');

function createLoader(overrides = {}) {
  const cache = new Map();
  function load(input) {
    let file = path.resolve(root, input);
    if (!fs.existsSync(file)) file += '.ts';
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.ts');
    const key = path.relative(root, file).replaceAll('\\', '/');
    if (Object.hasOwn(overrides, key)) return overrides[key];
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(
      source,
      {
        exports,
        Error,
        URL,
        AbortController,
        setTimeout,
        clearTimeout,
        console: { log() {}, error: console.error },
        require(id) {
          if (id.endsWith('.vue')) return { default: { render: () => null } };
          if (id.startsWith('@/')) return load(path.join('src', id.slice(2)));
          if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id));
          return require(id);
        },
      },
      { filename: file },
    );
    return exports;
  }
  return load;
}
module.exports = { createLoader };
