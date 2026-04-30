import { defineConfig } from 'rolldown';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../../dist/apps/products-api/main.js');
const pkg = JSON.parse(readFileSync(resolve(HERE, 'package.json'), 'utf8'));
// Inline workspace @lambder/* packages; externalize all other module specifiers.
const isWorkspace = (id) => id.startsWith('@lambder/');
const isRelative = (id) => id.startsWith('.') || id.startsWith('/');

export default defineConfig({
  input: 'src/main.ts',
  output: {
    file: OUT,
    format: 'esm',
    sourcemap: true,
    inlineDynamicImports: true,
  },
  platform: 'node',
  resolve: {
    conditionNames: ['node', 'import', 'default'],
    extensionAlias: { '.js': ['.ts', '.tsx', '.js'] },
  },
  external: (id) => !isRelative(id) && !isWorkspace(id),
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  treeshake: true,
});
