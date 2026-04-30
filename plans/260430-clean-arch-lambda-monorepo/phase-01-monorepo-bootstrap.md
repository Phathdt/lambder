# Phase 01 — Monorepo Bootstrap

## Context Links
- Parent: [plan.md](./plan.md)
- Tools: pnpm 9.x, Turborepo 2.x, TypeScript 5.6+, Rolldown (latest), Biome (lint+format)

## Overview
- **Priority**: P0 (blocker for all later phases)
- **Status**: Not started
- Stand up the empty monorepo skeleton: pnpm workspaces, Turborepo task graph, shared tsconfig presets, code style, and a "hello world" Rolldown bundle target so we can validate the build pipeline before pulling in real apps.

## Key Insights
- pnpm + Turborepo is the lightest stack for serverless monorepos (no Nx overhead).
- Rolldown is API-compatible enough with Rollup to use familiar config; we only ship it for production builds. Dev uses `tsx` watch for sub-100ms reloads.
- Use **Biome** instead of ESLint+Prettier — single tool, Rust-fast, zero config drift.

## Requirements
- Functional
  - `pnpm install` works at root and resolves workspace deps via `workspace:*`
  - `pnpm turbo run build` traverses workspace correctly
  - `pnpm turbo run lint` and `pnpm turbo run typecheck` pass on empty packages
- Non-functional
  - Zero deprecation warnings
  - `.gitignore` excludes `node_modules`, `dist`, `.turbo`, `.serverless`, `.env`, `.claude_sessions`

## Architecture
```
lambder/
├── package.json              # root: only devDeps + scripts
├── pnpm-workspace.yaml       # apps/*  packages/*
├── turbo.json                # pipeline: build, lint, typecheck, test, dev
├── biome.json                # lint+format config
├── tsconfig.base.json        # strict, ESNext, NodeNext resolution
├── packages/tsconfig/        # presets: base.json, lib.json, app.json
└── .gitignore
```

## Files to Create
- `/Users/admin/Documents/Dev/lambder/package.json`
- `/Users/admin/Documents/Dev/lambder/pnpm-workspace.yaml`
- `/Users/admin/Documents/Dev/lambder/turbo.json`
- `/Users/admin/Documents/Dev/lambder/biome.json`
- `/Users/admin/Documents/Dev/lambder/tsconfig.base.json`
- `/Users/admin/Documents/Dev/lambder/packages/tsconfig/package.json`
- `/Users/admin/Documents/Dev/lambder/packages/tsconfig/base.json`
- `/Users/admin/Documents/Dev/lambder/packages/tsconfig/lib.json`
- `/Users/admin/Documents/Dev/lambder/packages/tsconfig/app.json`
- `/Users/admin/Documents/Dev/lambder/.gitignore`
- `/Users/admin/Documents/Dev/lambder/.nvmrc` → `22`
- `/Users/admin/Documents/Dev/lambder/.env.example`

## Implementation Steps

### 1. Root `package.json`
```json
{
  "name": "lambder",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules .turbo"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "rolldown": "latest",
    "tsx": "^4.19.0",
    "turbo": "^2.2.0",
    "typescript": "^5.6.0"
  }
}
```

### 2. `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 3. `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".serverless/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "clean": { "cache": false }
  }
}
```

### 4. `tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "sourceMap": true,
    "lib": ["ES2023"]
  }
}
```

### 5. `packages/tsconfig` presets
- `base.json` extends `../../tsconfig.base.json`
- `lib.json` adds `composite: true`, `outDir: dist`
- `app.json` adds `noEmit: true` (apps are bundled by Rolldown)

### 6. `biome.json` (concise)
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "files": { "ignore": ["dist", ".turbo", ".serverless", "node_modules"] },
  "linter": { "rules": { "recommended": true } },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "always" } }
}
```

### 7. `.gitignore` essentials
```
node_modules
dist
.turbo
.serverless
coverage
.env
.env.*.local
.claude_sessions
.DS_Store
*.log
```

### 8. Rolldown smoke test
- Create `apps/_smoke/src/handler.ts` that exports a dummy `handler(event)` returning `{ statusCode: 200, body: 'ok' }`.
- Add `apps/_smoke/rolldown.config.ts` bundling to `dist/handler.mjs` with `format: 'esm'`, `platform: 'node'`, externals `['@aws-sdk/*']`.
- Verify `pnpm --filter _smoke build` produces a single-file ESM bundle < 100kb.
- Delete `_smoke` after Phase 06 validates real bundling.

## Todo List
- [ ] Init root `package.json`, `pnpm-workspace.yaml`, `turbo.json`
- [ ] Add `tsconfig.base.json` + `packages/tsconfig` presets
- [ ] Configure Biome
- [ ] Add `.gitignore`, `.nvmrc`, `.env.example`
- [ ] Create Rolldown smoke-test app and validate output
- [ ] `pnpm install && pnpm turbo run build` runs clean

## Success Criteria
- `pnpm install` exits 0 with no warnings
- `pnpm build` and `pnpm lint` pass on empty workspace
- Smoke-test bundle is single ESM file, runs `node dist/handler.mjs` without throwing

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Rolldown breaking changes | Pin to a known-good version; smoke test catches regressions |
| Biome rules too strict | Start with `recommended` only, customize after real code lands |

## Next Steps
- Phase 02: Build the shared `core`, `infra`, `contracts` packages on top of this skeleton.
