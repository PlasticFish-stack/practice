# Vue development

Per the user's preference, use the installed skills from `vuejs-ai/skills` when working on Vue in this project. Resolve the applicable `SKILL.md` from the current session's skill catalog (usually `$CODEX_HOME/skills/` or `~/.codex/skills/`) before applying it; do not assume a developer-specific absolute path.

- Vue components and architecture: `vue-best-practices`.
- Routing, stores, tests, debugging, JSX, and reusable composables: use `vue-router-best-practices`, `vue-pinia-best-practices`, `vue-testing-best-practices`, `vue-debug-guides`, `vue-jsx-best-practices`, and `create-adaptable-composable` respectively when relevant.
- Use `vue-options-api-best-practices` only when maintaining Options API code; preserve this project's Composition API and TypeScript conventions.
- Check installed dependency versions before applying version-specific advice. Do not downgrade dependencies to match a skill's examples.

# Code formatting

- Use the repository's Prettier configuration in `.prettierrc.json` for source, styles, tests and configuration files.
- After editing supported files, run `pnpm exec prettier --write <edited-files>` before handing the work back. Keep functions, Vue attributes and CSS declarations readable instead of packing multiple statements onto one line.
- Prefer named script handlers for template events that perform multiple operations.
- Run `pnpm format:check` and `pnpm lint` before committing. Generated files and build/test artifacts remain excluded by `.prettierignore`.
