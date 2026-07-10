---
name: Orval codegen breaks with js-yaml v5
description: pnpm override range for js-yaml must stay on v4, or `pnpm --filter @workspace/api-spec run codegen` fails
---

If `pnpm-workspace.yaml` has a `js-yaml` override/catalog range like `">=4.2.0"`, pnpm can resolve it to v5.x, which changed its module format to pure ESM. Orval's codegen pipeline imports `js-yaml` via a CJS-style default import and breaks with an ESM interop error when v5 is resolved.

**Why:** Hit this when a `pnpm install` picked up js-yaml v5 under a loose `>=4.2.0` override, silently breaking `orval` codegen with an opaque module error.

**How to apply:** Keep the override pinned to `^4.2.0` (caret, not `>=`) so pnpm never resolves past the v4 line. If codegen starts failing with a js-yaml-related ESM/default-export error, check this override first before debugging orval itself.
