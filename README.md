# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## Code checks

```sh
pnpm lint       # Check Vue, TypeScript, JavaScript, mock services and tests
pnpm lint:fix   # Apply safe automatic ESLint fixes
pnpm build      # Type-check with vue-tsc and build with Vite
pnpm test       # Run unit and API tests
pnpm test:e2e   # Run browser tests
```

ESLint uses `eslint.config.mjs` with JavaScript/TypeScript recommended rules and Vue 3 essential rules. It preserves the existing formatting style. Generated declarations, build output and test artifacts are excluded; lint fails on any warning or error. Browser and Node globals are scoped to the relevant files. The VS Code ESLint extension is listed in workspace recommendations.

## Git hooks

Husky is configured through the `prepare` script and installed after dependency setup. Each commit runs `pnpm lint` against the project; errors or warnings stop the commit. The hook only checks files and does not automatically modify or stage them. Run `pnpm lint:fix` yourself when needed.
