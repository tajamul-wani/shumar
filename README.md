# Shumār (شُمار)

A calorie and macro tracker built for Kashmiri and everyday food, delivered as an installable web app.

**Contents:** [Overview](#overview) · [Tech stack](#tech-stack) · [Project structure](#project-structure) · [Getting started](#getting-started) · [Scripts](#scripts) · [Testing](#testing) · [Architecture](#architecture) · [Design system](#design-system) · [Contributing](#contributing) · [License](#license)

## Overview

- People sign in with their Google account, and each person's food logs are private to them.
- Food is logged by grams or by household units such as piece, cup and katori.
- Calories, protein, carbs, fat and sodium are calculated from values stored per 100 g.
- The layout is mobile first, with dark and light themes (Koshur Nocturne) that follow the device by default.

## Tech stack

| Area             | Tools                                                      |
| :--------------- | :--------------------------------------------------------- |
| App              | React 19, TypeScript, Vite                                 |
| Styling          | Tailwind CSS v4                                            |
| Routing          | wouter                                                     |
| Icons            | Lucide React                                               |
| Fonts            | Manrope, Noto Nastaliq Urdu (self-hosted with Fontsource)  |
| Database         | Supabase (PostgreSQL) with row-level security              |
| Sign-in          | Supabase Auth with Google, through `@supabase/supabase-js` |
| Unit tests       | Vitest, React Testing Library                              |
| Database tests   | pgTAP                                                      |
| End-to-end tests | Playwright, axe-core                                       |
| Lint and format  | oxlint, Prettier                                           |
| CI               | GitHub Actions                                             |

## Project structure

```
src/
  App.tsx                  Sign-in, then the screens by address (/, /trends, /you, /log)
  main.tsx                 Creates the Supabase client and mounts the app inside its providers
  index.css                Tailwind setup and design tokens
  auth/                    Session state shared with every screen (AuthProvider, useAuth)
  theme/                   The theme choice shared with every screen (ThemeProvider, useTheme)
  shell/                   The frame around every screen: side navigation, tab bar and add button
  screens/                 One file per screen: SignIn, Today, Trends, You and Add food
  components/              Shared building blocks, such as Button
  lib/
    supabase.ts            Supabase client setup, which refuses secret keys
    auth.ts                Google sign-in and sign-out
    account.ts             The name, initial and sign-in method shown on the You screen
    dates.ts               Date formats, such as the Today heading
    nutrition.ts           Nutrition math: unit conversion, scaling, totals and data checks
    theme.ts               Dark and light theme handling
public/
  theme-init.js            Applies the theme before the page first draws
scripts/
  check-design-tokens.mjs  Blocks off-token colors, fonts and sizes
  security-headers.ts      HTTP security headers, including the Content Security Policy
  bundle-secrets.ts        Finds anything that looks like a secret in the build output
supabase/
  config.toml              Local Supabase settings
  migrations/              Database schema changes, applied in order
  tests/database/          Row-level security and privilege tests (pgTAP)
e2e/                       End-to-end tests, run against the local Supabase stack
.github/workflows/         CI pipeline
```

## Getting started

### Prerequisites

- Node.js 22.12 or newer. The major version is pinned in `.nvmrc`, so `nvm use` picks it up.
- npm
- Docker, for the local Supabase stack

### 1. Install

```bash
git clone https://github.com/tajamul-wani/shumar.git
cd shumar
nvm use
npm install
```

### 2. Add environment variables

Copy `.env.example` to `.env.local` and fill in the values. Ask a maintainer for access. Never commit `.env.local`.

| Variable                        | Used for                                                    |
| :------------------------------ | :---------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | The Supabase project address, needed to run and build       |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The Supabase publishable key. Never put the secret key here |
| `LINEAR_API_KEY`                | Project task tracking (maintainers only)                    |
| `LINEAR_TEAM_KEY`               | Project task tracking (maintainers only)                    |

### 3. Start the local Supabase stack

The database and end-to-end tests run against a local copy of Supabase in Docker.

```bash
npx supabase start      # start it (the first run downloads its images)
npx supabase status     # show its addresses and local keys
npx supabase db reset   # rebuild the database from the migrations
npx supabase stop       # stop it
```

While it runs, Supabase Studio is at http://127.0.0.1:54323.

### 4. Run the app

```bash
npm run dev
```

The app runs at http://localhost:5173.

## Scripts

| Command             | What it does                                                       |
| :------------------ | :----------------------------------------------------------------- |
| `npm run dev`       | Start the development server                                       |
| `npm run build`     | Type check and build for production, with the security headers     |
| `npm run preview`   | Serve the production build locally, with the same security headers |
| `npm run lint`      | Check design tokens, run oxlint and check formatting               |
| `npm run format`    | Format all files with Prettier                                     |
| `npm run typecheck` | Run the TypeScript compiler                                        |
| `npm run test`      | Run unit tests with coverage                                       |
| `npm run test:db`   | Run the database security tests                                    |
| `npm run test:e2e`  | Run the end-to-end tests                                           |
| `npm run check`     | Lint, type check, unit tests and build in one go                   |

## Testing

| Layer             | Command                             | What it covers                                                                                        | Needs local Supabase |
| :---------------- | :---------------------------------- | :---------------------------------------------------------------------------------------------------- | :------------------- |
| Lint and types    | `npm run lint`, `npm run typecheck` | Code style, type errors and off-token design values                                                   | No                   |
| Unit              | `npm run test`                      | Nutrition math, theme handling, sign-in helpers, the key check and the security headers               | No                   |
| Database security | `npm run test:db`                   | Each user can reach only their own logs, and each role has exactly the table privileges it needs      | Yes                  |
| End to end        | `npm run test:e2e`                  | Sign-in, sign-out, layout, accessibility and the security policy, plus data isolation through the API | Yes                  |

- End-to-end tests run on a phone (Android and iPhone), a tablet and a 1440 px desktop, in both dark and light themes.
- They always build the app against the local Supabase stack, never a hosted project, into `dist-e2e/` so your own build in `dist/` is left alone. Each run signs up fresh test users there, so no Google account is needed.
- The first time, install the browsers with `npx playwright install --with-deps chromium webkit`.
- CI runs five jobs on every pull request: Lint and types, Unit tests, Database security tests, End-to-end tests and Security scan (dependency audit and a secret scan of the full history). All five must pass before a pull request can merge.

## Architecture

### App and sign-in

Shumār is a single-page React app built with Vite. All styling comes from Tailwind classes backed by the tokens in `src/index.css`.

Each screen has its own address, handled by wouter, so the back button, reloads and shared links all work. Unknown addresses go to Today. `src/shell/AppShell.tsx` draws the frame: a tab bar with Today, Trends and You plus a floating add button on phones and tablets, and side navigation from 1024 px up. After a change of screen, focus moves to the new screen's heading for keyboard and screen reader users.

Google sign-in runs through Supabase Auth with the PKCE flow. The app sends the visitor to Google, Supabase handles the reply, and the session comes back to the app. `src/auth/AuthProvider.tsx` keeps the current session available to every screen and follows Supabase as it refreshes or ends it.

Signing out clears the session and everything cached under the `shumar-cache:` prefix from the device. Only the theme choice stays.

### Keys and security

- The app only ever holds the project address and the publishable key, which are public by design. Row-level security is what protects each user's data.
- `src/lib/supabase.ts` refuses to start with a secret key, and the build fails if anything that looks like a secret ends up in its output.
- `npm run build` writes `dist/_headers` from `scripts/security-headers.ts`. The Content Security Policy allows code, styles and fonts from this site only, and network calls only to this site and its Supabase project.

### Database

PostgreSQL on Supabase, defined by the migrations in `supabase/migrations/`. Row-level security is on for every table, and each table grants the app roles only the privileges they need.

| Table            | Holds                                                                                       | Who can access it                             |
| :--------------- | :------------------------------------------------------------------------------------------ | :-------------------------------------------- |
| `kashmiri_foods` | The food catalog, with values per 100 g and a source for every food                         | Anyone can read; nobody can write via the API |
| `food_units`     | The weight in grams of one piece, cup or katori of a catalog food                           | Anyone can read; nobody can write via the API |
| `user_logs`      | One row per logged food: meal, time, amount and the nutrients calculated when it was logged | Only the user who logged it                   |

### Nutrition math

The math lives in `src/lib/nutrition.ts`, separate from the UI, so it can be tested on its own.

- Every food value is stored per 100 g. A serving is worked out as quantity × grams per unit (piece, cup, katori or grams), then scaled from the per-100 g values.
- Values keep full precision in calculations and are rounded only for display.
- Incoming food values can be sanity-checked by comparing the stated calories with the energy implied by protein, carbs and fat. Sodium is always handled in milligrams.

### Theme

`public/theme-init.js` sets the theme before the page draws, from the saved choice or the device setting, so it never flashes the wrong theme. `src/theme/ThemeProvider.tsx` then keeps it in step with the choice and, for System, with the device, and matches the browser's status bar color. The choice is made on the You screen, or with the theme button in the desktop side navigation. Only the choice (system, light or dark) is stored, in `localStorage`.

## Design system

All colors, fonts, type sizes and font weights are defined once as tokens in `src/index.css` and used through Tailwind classes such as `bg-koshur-base`, `text-body` and `font-semibold`. Tailwind's default palette, type scale, fonts and weights are turned off, so only these tokens exist. `npm run lint` fails if a component uses anything else, or if the status bar colors drift from the tokens.

Every color token has a dark and a light value, switched by the `data-theme` attribute on the page.

| Token                                            | Role                          |
| :----------------------------------------------- | :---------------------------- |
| `koshur-base`, `koshur-surface`, `koshur-border` | Background, cards, dividers   |
| `koshur-silk`, `koshur-muted`                    | Primary and secondary text    |
| `deficit-ring`                                   | Calories and primary actions  |
| `macro-protein`, `macro-carb`, `macro-fat`       | Protein, carbs and fat        |
| `alert-surplus`                                  | Over-target states and alerts |

| Type token     | Size and line height                    | Use                  |
| :------------- | :-------------------------------------- | :------------------- |
| `text-caption` | 12 / 16 px                              | Labels, chart axes   |
| `text-body-sm` | 14 / 20 px                              | Secondary text       |
| `text-body`    | 16 / 24 px                              | Default text, inputs |
| `text-title`   | 20 / 28 px                              | Card titles          |
| `text-heading` | 24 / 32 px                              | Screen titles        |
| `text-display` | 32 / 40 px, and 40 / 48 px from tablets | The calorie number   |

Weights are `font-normal` (400), `font-medium` (500) and `font-semibold` (600). Text uses `font-sans` (Manrope). `font-wordmark` (Noto Nastaliq Urdu) is only for the شُمار wordmark.

## Contributing

1. Branch from `main` with a prefix that matches the work: `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/`, `perf/`, `style/`, `build/`, `ci/`, `data/`, `security/` or `hotfix/`.
2. Keep each commit to one logical change that builds and passes tests on its own. Write messages in the Conventional Commits style, for example `feat: add food search with household units`.
3. Before opening a pull request into `main`, run `npm run check`, `npm run test:db` and `npm run test:e2e`.
4. All five CI jobs must pass before a pull request is merged.

## License

Copyright © 2026 Tajamul Wani. All rights reserved.
