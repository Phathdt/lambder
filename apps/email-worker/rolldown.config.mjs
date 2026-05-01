import { defineConfig } from 'rolldown';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../../dist/apps/email-worker/main.js');

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
    tsconfigFilename: false,
  },
  external: (id) => !isRelative(id) && !isWorkspace(id),
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  treeshake: true,
});
