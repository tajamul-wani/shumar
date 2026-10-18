# Shumār (شُمار)

A calorie and macro tracker built for Kashmiri and everyday food, delivered as an installable web app.

## Overview

- Logs food by grams or household units such as piece, cup and katori
- Calculates calories, protein, carbs, fat and sodium from values stored per 100 g
- Designed mobile first, with a dark theme called Koshur Nocturne

## Tech stack

| Area             | Tools                         |
| :--------------- | :---------------------------- |
| App              | React 19, TypeScript, Vite    |
| Styling          | Tailwind CSS v4               |
| Unit tests       | Vitest, React Testing Library |
| Database         | Supabase (PostgreSQL)         |
| Database tests   | pgTAP                         |
| End-to-end tests | Playwright, axe-core          |
| Lint and format  | oxlint, Prettier              |
| CI               | GitHub Actions                |

## Project structure

```
src/
  App.tsx            App shell
  index.css          Tailwind setup and design tokens
  lib/nutrition.ts   Nutrition math (unit conversion, scaling, totals, data checks)
  test/setup.ts      Test setup
supabase/
  config.toml        Local Supabase settings
  migrations/        Database schema changes, applied in order
  tests/database/    Row-level security tests (pgTAP)
e2e/                 Playwright end-to-end tests
.github/workflows/   CI pipeline
```

## Architecture

- **App:** a single-page React app built with Vite. `src/main.tsx` mounts `App`, and all styling comes from Tailwind classes backed by the tokens in `src/index.css`.
- **Nutrition math:** lives in `src/lib/nutrition.ts`, separate from the UI, so it can be tested on its own. Every food value is stored per 100 g. A serving is worked out as quantity × grams per unit (piece, cup, katori or grams), then scaled from the per-100 g values. Values keep full precision in calculations and are rounded only for display.
- **Data checks:** incoming food values can be sanity-checked by comparing the stated calories with the energy implied by protein, carbs and fat. Sodium is always handled in milligrams.
- **Database:** PostgreSQL on Supabase, defined by the migrations in `supabase/migrations/`. Row-level security is on for every table.

  | Table            | Holds                                                                                       | Who can access it                             |
  | :--------------- | :------------------------------------------------------------------------------------------ | :-------------------------------------------- |
  | `kashmiri_foods` | The food catalog, with values per 100 g and a source for every food                         | Anyone can read; nobody can write via the API |
  | `food_units`     | The weight in grams of one piece, cup or katori of a catalog food                           | Anyone can read; nobody can write via the API |
  | `user_logs`      | One row per logged food: meal, time, amount and the nutrients calculated when it was logged | Only the user who logged it                   |

## Getting started

### Prerequisites

- Node.js 22.12 or newer (the version is pinned in `.nvmrc`; run `nvm use`)
- npm
- Docker, for the local database

### Install and run

```bash
git clone https://github.com/tajamul-wani/shumar.git
cd shumar
nvm use
npm install
npm run dev
```

The app runs at http://localhost:5173.

### Local database

```bash
npx supabase start      # start the local database (the first run downloads its images)
npx supabase db reset   # rebuild it from the migrations
npx supabase stop       # stop it
```

While it runs, Supabase Studio is available at http://127.0.0.1:54323.

### Environment variables

Copy `.env.example` to `.env.local` and fill in the values. Ask a maintainer for access. Never commit `.env.local`.

| Variable          | Used for                                 |
| :---------------- | :--------------------------------------- |
| `LINEAR_API_KEY`  | Project task tracking (maintainers only) |
| `LINEAR_TEAM_KEY` | Project task tracking (maintainers only) |

## Scripts

| Command             | What it does                                                       |
| :------------------ | :----------------------------------------------------------------- |
| `npm run dev`       | Start the development server                                       |
| `npm run build`     | Type check and build for production                                |
| `npm run preview`   | Serve the production build locally                                 |
| `npm run lint`      | Run oxlint and check formatting                                    |
| `npm run format`    | Format all files with Prettier                                     |
| `npm run typecheck` | Run the TypeScript compiler                                        |
| `npm run test`      | Run unit tests with coverage                                       |
| `npm run test:db`   | Run the database security tests (needs the local database running) |
| `npm run test:e2e`  | Run end-to-end tests on phone, tablet and desktop                  |
| `npm run check`     | Lint, type check, unit tests and build in one go                   |

The first time you run end-to-end tests, install the browsers with `npx playwright install --with-deps chromium webkit`.

## Design system

Colors are defined once as tokens in `src/index.css` and used through Tailwind classes such as `bg-koshur-base` and `text-koshur-muted`. The default Tailwind palette is turned off, so only these tokens are available.

| Token                                            | Role                          |
| :----------------------------------------------- | :---------------------------- |
| `koshur-base`, `koshur-surface`, `koshur-border` | Background, cards, dividers   |
| `koshur-silk`, `koshur-muted`                    | Primary and secondary text    |
| `deficit-ring`                                   | Calories and primary actions  |
| `macro-protein`, `macro-carb`, `macro-fat`       | Protein, carbs and fat        |
| `alert-surplus`                                  | Over-target states and alerts |

## Contributing

- Work on a branch with a prefix that matches the work: `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/`, `perf/`, `style/`, `build/`, `ci/`, `data/`, `security/` or `hotfix/`.
- Write commit messages in the Conventional Commits style, for example `feat: add food search with household units`.
- Keep each commit to one logical change that builds and passes tests on its own.
- Run `npm run check` and the end-to-end tests before opening a pull request into `main`.
- CI must pass before a pull request is merged.

## License

Copyright © 2026 Tajamul Wani. All rights reserved.
