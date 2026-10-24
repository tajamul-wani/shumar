# Shumār (شُمار)

A calorie and macro tracker for Kashmiri and everyday food. It runs in the browser and installs on a phone like an app.

## Overview

- Six questions work out a daily calorie and macro target from cited formulas.
- Sign in with Google. Each person's food logs are private to them.
- Log food by searching or from recent foods, in grams or household units such as piece, cup and katori.
- Every food value comes from a named source and is stored per 100 g.

## Tech stack

| Area            | Tools                                                       |
| :-------------- | :---------------------------------------------------------- |
| App             | React 19, TypeScript, Vite, wouter                          |
| Styling         | Tailwind CSS v4, Lucide React icons                         |
| Fonts           | Manrope, Noto Nastaliq Urdu (self-hosted with Fontsource)   |
| Database        | Supabase (PostgreSQL) with row-level security               |
| Sign-in         | Supabase Auth with Google                                   |
| Food data       | USDA FoodData Central (public domain), imported with Python |
| Tests           | Vitest, React Testing Library, pgTAP, Playwright, axe-core  |
| Lint and format | oxlint, Prettier                                            |
| CI              | GitHub Actions                                              |

## Project structure

```text
src/
  firstRun/     What signed-out visitors see: the welcome screen and the first-run questions
  screens/      The signed-in screens
  today/, log/  Parts of the Today screen and the log sheet
  shell/        Navigation and the frame around every screen
  components/   Shared building blocks
  lib/          Logic kept apart from the screens: nutrition math, targets, food search, logging
  auth/, theme/ The session and the theme, shared with every screen
scripts/        USDA importer, design-token check, security headers, CI helpers
supabase/       Migrations and database tests
e2e/            End-to-end tests
```

## Getting started

You need Node.js 22.12 or newer (`nvm use` reads `.nvmrc`), npm, Docker for the local Supabase stack, and Python 3 for the importer's tests.

```bash
git clone https://github.com/tajamul-wani/shumar.git
cd shumar
nvm use
npm install
```

Copy `.env.example` to `.env.local` and fill in the values (ask a maintainer). Never commit `.env.local`.

| Variable                        | Used for                                                     |
| :------------------------------ | :----------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | The Supabase project address                                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The Supabase publishable key. Never put the secret key here. |
| `LINEAR_API_KEY`                | Task tracking (maintainers only)                             |
| `LINEAR_TEAM_KEY`               | Task tracking (maintainers only)                             |

Start the local Supabase stack (the first run downloads its images), then the app at http://localhost:5173:

```bash
npx supabase start
npm run dev
```

### Scripts

| Command             | What it does                                                |
| :------------------ | :---------------------------------------------------------- |
| `npm run dev`       | Start the development server                                |
| `npm run build`     | Type check and build for production, with security headers  |
| `npm run preview`   | Serve the production build locally                          |
| `npm run lint`      | Check design tokens, run oxlint and check formatting        |
| `npm run format`    | Format all files with Prettier                              |
| `npm run typecheck` | Run the TypeScript compiler                                 |
| `npm run test`      | Run the unit tests with coverage, then the importer's tests |
| `npm run test:db`   | Run the database security tests                             |
| `npm run test:e2e`  | Run the end-to-end tests                                    |
| `npm run check`     | Lint, type check, unit tests and build                      |

## Testing

- `npm run check` needs nothing running. `npm run test:db` and `npm run test:e2e` need the local Supabase stack.
- End-to-end tests run on an Android phone, an iPhone, a tablet and a desktop, in both themes, with accessibility checks. The first time, install the browsers with `npx playwright install --with-deps chromium webkit`.
- A pull request into `main` must pass lint and types, unit, database, end-to-end, a security scan and CodeQL.

## Architecture

Shumār is a single-page React app. The data lives in Supabase, and row-level security keeps each person's data private.

- **Signed out**, `src/firstRun/` asks the first-run questions and shows the daily target. The answers stay on the device until sign-in and are wiped at sign-out.
- **Calculations** live in `src/lib/`, apart from the screens: `nutrition.ts` (food values), `targets.ts` (daily targets) and `today.ts` (the day's totals). See How the numbers are worked out.
- **Food search** is one database function, `search_foods(query)`: our own catalog first, then USDA foods. The app keeps the day's searches on the device.
- **Keys:** the app holds only the project address and the publishable key. `npm run build` writes the security headers from `scripts/security-headers.ts`.

| Table             | Holds                                                        | Who can access it                             |
| :---------------- | :----------------------------------------------------------- | :-------------------------------------------- |
| `kashmiri_foods`  | Our own food catalog, per 100 g, with a source for each food | Anyone can read; nobody can write via the API |
| `food_units`      | Grams in one piece, cup or katori of a catalog food          | Anyone can read; nobody can write via the API |
| `user_logs`       | One row per food logged, with the nutrients at that moment   | Only the person who logged it                 |
| `profiles`        | Each person's first-run answers                              | Only that person                              |
| `usda_releases`   | Which USDA files are loaded, with each file's SHA-256        | Signed-in people can read                     |
| `usda_foods`      | About 7,100 USDA foods, per 100 g                            | Signed-in people can read                     |
| `usda_portions`   | USDA household portions in grams                             | Signed-in people can read                     |
| `search_synonyms` | Local food words mapped to USDA wording                      | Signed-in people can read                     |

To import a new USDA release: update the file name and SHA-256 in `DATASETS` in `scripts/usda/import_usda.py`, run `python3 scripts/usda/import_usda.py supabase/migrations/<timestamp>_usda_foods_data.sql`, then update the expected counts in `supabase/tests/database/usda_data.test.sql`.

## How the numbers are worked out

### Food values

- Every food is stored per 100 g of the food as eaten. A serving is amount × the grams in one unit (piece, cup, katori, or 1 for grams), and each nutrient is its per-100 g value × grams ÷ 100.
- A log keeps the values worked out when it was saved, so a later change to a food never rewrites anyone's history.
- Values keep full precision and are rounded only for display: whole kcal and mg, macros to one decimal place.
- The day's totals add up its logs. The sodium alert shows past 2,000 mg a day, the World Health Organization's limit for adults.
- Values come only from named sources: our own measured recipes for Kashmiri dishes, and USDA FoodData Central. The importer leaves out foods with a missing value and flags foods whose calories are more than 20% off their protein, carbs and fat at 4, 4 and 9 kcal per gram.

### Daily targets

`src/lib/targets.ts` turns the first-run answers into daily targets, for adults 18 and over. Each number has its source in a comment next to it.

| Step           | How it works                                                                                      | Source                                                     |
| :------------- | :------------------------------------------------------------------------------------------------ | :--------------------------------------------------------- |
| Resting energy | 10 × kg + 6.25 × cm - 5 × age, then + 5 for men or - 161 for women                                | Mifflin-St Jeor, 1990                                      |
| Daily energy   | Resting energy × 1.40, 1.53, 1.76 or 2.25, from sedentary to very active                          | ICMR-NIN 2020 for sedentary, FAO/WHO/UNU 2004 for the rest |
| Goal           | 300, 500 or 750 kcal less to lose 0.25, 0.5 or 0.75 kg a week; 10% more to gain; the same to keep | NIH 1998, AHA/ACC/TOS 2013, Iraki et al. 2019              |
| Safety floor   | Never below 1,200 kcal for women or 1,500 for men, and never above daily energy                   | AHA/ACC/TOS 2013                                           |
| Protein        | 1.6 g per kg of body weight, or 2.2 g for body recomposition, at most 35% of calories             | Morton et al. 2018, ISSN 2017, Iraki et al. 2019, IOM 2005 |
| Fat and carbs  | Fat is 25% of calories, and carbs get the rest                                                    | IOM 2005, WHO                                              |

## Design system

Colors, fonts, type sizes and weights are tokens in `src/index.css`, used through Tailwind classes such as `bg-koshur-base` and `text-body`. Tailwind's defaults are turned off, and `npm run lint` fails on anything else. Every color has a dark and a light value.

| Color token                                      | Role                          |
| :----------------------------------------------- | :---------------------------- |
| `koshur-base`, `koshur-surface`, `koshur-border` | Background, cards, dividers   |
| `koshur-silk`, `koshur-muted`                    | Primary and secondary text    |
| `deficit-ring`                                   | Calories and primary actions  |
| `macro-protein`, `macro-carb`, `macro-fat`       | Protein, carbs and fat        |
| `alert-surplus`                                  | Over-target states and alerts |

Type sizes: `text-caption` (12 px), `text-body-sm` (14), `text-body` (16), `text-title` (20), `text-heading` (24) and `text-display` (32, or 40 from tablets). Weights: 400, 500 and 600. Text uses Manrope; Noto Nastaliq Urdu is only for the شُمار wordmark.

## Contributing

1. Branch from `main`, named `<prefix>/<short-description>`, such as `feat/food-search`:

   | Prefix      | For                                        |
   | :---------- | :----------------------------------------- |
   | `feat/`     | A new feature                              |
   | `fix/`      | A bug fix                                  |
   | `hotfix/`   | An urgent fix to the live app              |
   | `security/` | Row-level security, sign-in, keys, headers |
   | `refactor/` | Restructuring with no change in behaviour  |
   | `perf/`     | Speed                                      |
   | `style/`    | Visual styling only                        |
   | `docs/`     | Documentation                              |
   | `test/`     | Tests                                      |
   | `chore/`    | Tooling, dependencies and config           |
   | `build/`    | The build and the installable app setup    |
   | `ci/`       | GitHub Actions                             |
   | `data/`     | Food values in `kashmiri_foods`            |

2. Keep each commit to one change that builds and passes its tests on its own. Write the message in the Conventional Commits style, saying what was done: `feat: added food search with household units`.
3. Before opening a pull request into `main`, run `npm run check`, `npm run test:db` and `npm run test:e2e`.
4. Title the pull request with the branch's prefix and what it did, in about 70 characters: `feat: added food search with household units`. Its description has exactly three sections: **What we did** (the work and how it was built), **Why** and **What this solves**, with no commit lists or test results.
5. All six checks must pass before a maintainer merges it. Small fixes go into related work rather than their own pull request, unless they are urgent (`hotfix/` or `security/`).

## License

Copyright © 2026 Tajamul Wani. All rights reserved.
