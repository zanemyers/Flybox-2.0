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

`@/*` maps to `src/*` — configured in `tsconfig.json`. All imports should use this alias rather than relative paths.

## Prisma

After any schema change in `db/schema.prisma`, regenerate the client:

```bash
npx prisma generate
```

The generated client outputs to `generated/prisma/`. It is regenerated automatically during `npm run build` and inside the Docker build.
