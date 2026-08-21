# IDE Setup

## Recommended Extensions (VS Code)

| Extension                                                                                                  | Why                                                 |
|------------------------------------------------------------------------------------------------------------|-----------------------------------------------------|
| [Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)                                 | Linting and formatting (replaces ESLint + Prettier) |
| [Prisma](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)                                | Schema syntax highlighting and formatting           |
| [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) | Autocomplete for Tailwind and DaisyUI classes       |

## Biome as Default Formatter

Add to `.vscode/settings.json`:

```json
{
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "editor.formatOnSave": true
}
```

## Path Aliases

`@/*` maps to `src/*` — configured in `tsconfig.json`. Use the alias for anything crossing directories. Relative paths are fine for an asset sitting next to the module that re-exports it, as in `src/client/images/*/index.ts`.

## Prisma

After any schema change in `db/schema.prisma`, regenerate the client:

```bash
npx prisma generate
```

The generated client outputs to `generated/prisma/`, which is gitignored — so a fresh clone needs this before `npm run typecheck` or `npm run build` will pass. Neither script regenerates it; the `Dockerfile` runs `npx prisma generate` explicitly before building.

## Type Checking

Biome does not type-check. `npm run typecheck` runs `tsc --noEmit` over `src/`; the test tree has its own `tests/tsconfig.json`, which the root config excludes.
