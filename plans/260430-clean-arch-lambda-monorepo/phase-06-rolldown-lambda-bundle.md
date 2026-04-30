# Phase 06 — Rolldown Bundling for Lambda

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [phase-04](./phase-04-auth-api.md), [phase-05](./phase-05-products-api.md)

## Overview
- **Priority**: P0
- **Status**: Not started
- Produce minimal, fast-cold-start ESM bundles per app using Rolldown. Output `dist/handler.mjs` ready to be zipped by Serverless Framework.

## Key Insights
- Lambda Node 22 supports ESM natively. Bundle as `format: 'esm'`, `platform: 'node'`, target `node22`.
- Externalize what's already on Lambda or supplied via Layer: `@aws-sdk/*` (Lambda has SDK v3 v3.x preinstalled? — **NO**, only v2 preinstalled; for v3 we bundle but tree-shake aggressively). Decision: **bundle** only AWS SDK clients we use; don't externalize.
- **Native modules** (`argon2`, possibly `pg-native`): cannot be bundled JS-side. Two options:
  - (A) Use pure-JS alternatives (`@noble/hashes/argon2` for argon2id) — simpler, slower hash.
  - (B) Build inside `public.ecr.aws/lambda/nodejs:22` container and copy `node_modules/argon2/build/Release/*.node` into zip via Serverless `package.patterns`.
  - **Decision**: Start with (A) `@node-rs/argon2` (prebuilt N-API binary, ships per-arch) — single package, no compile step.

## Requirements
- Functional
  - `pnpm --filter auth-api build` → `apps/auth-api/dist/handler.mjs` (single file, < 5MB)
  - `pnpm --filter products-api build` → `apps/products-api/dist/handler.mjs`
  - Source maps emitted next to bundles
  - Bundles run on Node 22 ESM with no `require` errors
- Non-functional
  - Build time per app < 10s on warm cache
  - Tree-shaking removes unused infra adapters (e.g., products-api shouldn't ship signup use case)

## Architecture

### Per-app rolldown config
```ts
// apps/auth-api/rolldown.config.ts
import { defineConfig } from 'rolldown';
export default defineConfig({
  input: 'src/handler.ts',
  output: {
    file: 'dist/handler.mjs',
    format: 'esm',
    sourcemap: true,
    inlineDynamicImports: true,
  },
  platform: 'node',
  resolve: { conditionNames: ['node', 'import', 'default'] },
  external: [
    // node built-ins are auto-external
    /^@node-rs\/argon2-/,        // platform-specific binaries — keep external + ship via Serverless layer
  ],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  treeshake: true,
});
```

### Native module strategy for `@node-rs/argon2`
- The package resolves to `@node-rs/argon2-linux-x64-gnu` (or arm64) at runtime.
- Mark all `@node-rs/argon2-*` packages as **external** so Rolldown doesn't try to bundle them.
- Add them to `package.patterns` in `serverless.yml` (or rely on `serverless-esbuild`/`include` mechanism).
- Alternatively: build them into a Lambda Layer (documented in phase-07).

### Source map handling
- Lambda doesn't read source maps automatically. Set `NODE_OPTIONS=--enable-source-maps` env in `serverless.yml`.

## Files to Create
- `apps/auth-api/rolldown.config.ts`
- `apps/products-api/rolldown.config.ts`
- `scripts/build-app.sh` — wrapper: `rolldown -c && du -sh dist/handler.mjs`
- Per-app `package.json` script: `"build": "rolldown -c rolldown.config.ts"`

## Implementation Steps
1. Add `rolldown` as dev dep at root (already in phase 01).
2. Write rolldown configs.
3. Build both apps; inspect bundle sizes; if any > 5MB, audit with `--stats` to find offenders.
4. Run bundle: `node apps/auth-api/dist/handler.mjs` (after wrapping with a fake `event`/`context` script) — should not throw on import.
5. Document size budget in plan.md.

### Bundle size budget
| App | Target | Stretch |
|---|---|---|
| auth-api | < 3 MB | < 1.5 MB |
| products-api | < 2 MB | < 1 MB |

## Todo List
- [ ] Rolldown config per app
- [ ] Validate bundle runs in Node 22 standalone
- [ ] Confirm tree-shaking (no `signup` symbols in products-api bundle)
- [ ] Document native-module strategy in repo `docs/lambda-native-modules.md`

## Success Criteria
- Both bundles are single ESM files
- `node --enable-source-maps -e "import('./apps/auth-api/dist/handler.mjs')"` succeeds
- `grep -l 'signup' apps/products-api/dist/handler.mjs` returns nothing

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Rolldown ESM/CJS interop with `pg` (CJS) | Rolldown handles CJS interop; verified by smoke test |
| `@node-rs/argon2` arch mismatch (mac dev → linux Lambda) | Use `--platform=linux/arm64` Docker for prod build OR install both arch via `optionalDependencies` |

## Next Steps
- Phase 07 hands these bundles to Serverless Framework.
