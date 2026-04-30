import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/main.ts',
  output: {
    file: 'dist/main.mjs',
    format: 'esm',
    sourcemap: true,
    inlineDynamicImports: true,
  },
  platform: 'node',
  resolve: {
    conditionNames: ['node', 'import', 'default'],
  },
  external: [
    /^@node-rs\/argon2-/,
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  treeshake: true,
});
