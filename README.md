# Shumār (شُمار)

A calorie and macro tracker for Kashmiri and everyday food. It runs in the browser and installs on a phone like an app.

## Overview

- Sign in with Google. Each person's food logs are private to them.
- Find a food by searching or from your recent foods, then add it to a meal in grams or in household units such as piece, cup and katori.
- Calories, protein, carbs, fat and sodium are worked out from values stored per 100 g, and every value comes from a named source.
- Works on phones, tablets and computers, in dark and light themes that follow the device by default.

## Tech stack

| Area             | Tools                                                       |
| :--------------- | :---------------------------------------------------------- |
| App              | React 19, TypeScript, Vite                                  |
| Styling          | Tailwind CSS v4                                             |
| Routing          | wouter                                                      |
| Icons            | Lucide React                                                |
| Fonts            | Manrope, Noto Nastaliq Urdu (self-hosted with Fontsource)   |
| Database         | Supabase (PostgreSQL) with row-level security               |
| Sign-in          | Supabase Auth with Google, through `@supabase/supabase-js`  |
| Food data        | USDA FoodData Central (public domain), imported with Python |
| Unit tests       | Vitest, React Testing Library                               |
| Database tests   | pgTAP                                                       |
| End-to-end tests | Playwright, axe-core                                        |
| Lint and format  | oxlint, Prettier                                            |
| CI               | GitHub Actions                                              |

## Project structure

<details>
<summary>Show the folders and main files</summary>

```text
src/
  App.tsx                  Sign-in, then the screens by address (/, /trends, /you, /log, /log/edit/<id>, /sources)
  main.tsx                 Creates the Supabase client and starts the app
  index.css                Tailwind setup and design tokens
  auth/                    The signed-in session, shared with every screen
  theme/                   The theme choice, shared with every screen
  shell/                   The frame around every screen: side navigation, tab bar and add button
  today/                   Parts of the Today screen: the calories card, review card and meals list
  screens/                 One file per signed-in screen: Today, Trends, You, Add food, Edit food and Sources
  firstRun/                What signed-out visitors see: the welcome screen and the first-run questions
  components/              Shared building blocks: Button, Chip, RadioCard and Alert
  log/                     Parts of the log sheet: search as you type, food rows and the chosen food
  lib/
    supabase.ts            Supabase client setup, which refuses secret keys
    auth.ts                Google sign-in and sign-out
    account.ts             The name, initial and sign-in method shown on the You screen
    dates.ts               Date formats and the local calendar day
    foodSearch.ts          Food search: checks every result and keeps the day's searches
    foodDisplay.ts         How foods and amounts read in the log sheet
    meals.ts               The five meals and which one the log sheet opens on
    logs.ts                Checks an amount and saves a food log with its nutrients
    dayLogs.ts             Reads, changes, removes and restores the foods a person has logged
    today.ts               The day's totals, meals, sodium alert and calorie ring
    recentFoods.ts         The foods added most recently, kept on the device
    deviceStorage.ts       Device storage, or nothing when the browser blocks it
    nutrition.ts           Nutrition math: unit conversion, scaling, totals and data checks
    targets.ts             Daily calorie and macro targets from cited formulas
    firstRun.ts            The first-run answers, kept on the device until sign-in
    sources.ts             Names of the USDA releases shown on the Sources screen
    theme.ts               Dark and light theme handling
public/
  theme-init.js            Applies the theme before the page first draws
scripts/
  usda/import_usda.py      Turns the USDA downloads into a data migration, with its tests
  check-design-tokens.mjs  Blocks off-token colors, fonts and sizes
  security-headers.ts      HTTP security headers, including the Content Security Policy
  bundle-secrets.ts        Finds anything that looks like a secret in the build output
  browser-deps.sh          Installs the test browsers' Ubuntu packages in CI, from GitHub's cache when it has them
supabase/
  config.toml              Local Supabase settings
  migrations/              Database changes, applied in order
  tests/database/          Database security tests (pgTAP)
e2e/                       End-to-end tests, run against the local Supabase stack
.github/workflows/         CI and CodeQL code scanning
```

</details>

## Getting started

You need:

- Node.js 22.12 or newer. `.nvmrc` sets the version, so `nvm use` picks it up.
- npm
- Docker, for the local Supabase stack
- Python 3, for the USDA importer's tests (standard library only)

### 1. Install

```bash
git clone https://github.com/tajamul-wani/shumar.git
cd shumar
nvm use
npm install
```

### 2. Add environment variables

Copy `.env.example` to `.env.local` and fill in the values. Ask a maintainer for access. Never commit `.env.local`.

| Variable                        | Used for                                                     |
| :------------------------------ | :----------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | The Supabase project address                                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The Supabase publishable key. Never put the secret key here. |
| `LINEAR_API_KEY`                | Task tracking (maintainers only)                             |
| `LINEAR_TEAM_KEY`               | Task tracking (maintainers only)                             |

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

### Scripts

| Command             | What it does                                                |
| :------------------ | :---------------------------------------------------------- |
| `npm run dev`       | Start the development server                                |
| `npm run build`     | Type check and build for production, with security headers  |
| `npm run preview`   | Serve the production build locally, with the same headers   |
| `npm run lint`      | Check design tokens, run oxlint and check formatting        |
| `npm run format`    | Format all files with Prettier                              |
| `npm run typecheck` | Run the TypeScript compiler                                 |
| `npm run test`      | Run the unit tests with coverage, then the importer's tests |
| `npm run test:db`   | Run the database security tests                             |
| `npm run test:e2e`  | Run the end-to-end tests                                    |
| `npm run check`     | Lint, type check, unit tests and build, one after the other |

## Testing

| Tests             | Command                             | What they cover                                                                                     | Needs local Supabase |
| :---------------- | :---------------------------------- | :-------------------------------------------------------------------------------------------------- | :------------------- |
| Lint and types    | `npm run lint`, `npm run typecheck` | Code style, type errors and off-token design values                                                 | No                   |
| Unit              | `npm run test`                      | Nutrition math, food search, logging, the screens and the USDA importer                             | No                   |
| Database security | `npm run test:db`                   | Each user reaches only their own logs, table privileges, food search and the USDA data              | Yes                  |
| End to end        | `npm run test:e2e`                  | Sign-in and sign-out, logging a meal, layout, accessibility, the security policy and data isolation | Yes                  |

- End-to-end tests run on an Android phone, an iPhone, a tablet and a 1440 px desktop, in both themes.
- They build the app against the local Supabase stack, never a hosted project, into `dist-e2e/`, so your own build in `dist/` is left alone. Each run signs up fresh test users, so no Google account is needed.
- The first time, install the browsers with `npx playwright install --with-deps chromium webkit`.

<details>
<summary>Checks on every pull request</summary>

Six checks must pass before a pull request can merge into `main`:

1. Lint and types
2. Unit tests
3. Database security tests
4. End-to-end tests
5. Security scan: a dependency audit, a check that every package was published by its owner, and a secret scan of the full history
6. CodeQL, GitHub's code scanning. A high or critical finding also blocks the merge, and it runs weekly on `main` as well.

Every action in the workflows is pinned to an exact commit, with its version in a comment, so a moved tag can't change what runs.

Every job and every slow step has a time limit, so a stuck step fails in minutes instead of running for hours. The end-to-end job installs the browsers' Ubuntu packages from GitHub's cache, so a slow download server can't hold up a pull request.

</details>

## Architecture

Shumār is a single-page React app. The data lives in Supabase, and row-level security keeps each person's logs private. Open a topic below for the details.

<details>
<summary><strong>Screens and navigation</strong></summary>

- Each screen has its own address, handled by wouter, so the back button, reloads and shared links all work. Unknown addresses go to Today.
- Signed-out visitors see `src/firstRun/` instead: a welcome screen at `/` and one question per screen at `/start/age`, `/start/sex`, `/start/weight`, `/start/height`, `/start/activity` and `/start/goal`. An address further on goes back to the first question still to answer, and any other address goes to the welcome screen.
- `src/shell/AppShell.tsx` draws the frame around every screen. Phones and tablets get a tab bar (Today, Trends, You) and a round add button. From 1024 px up, a side navigation takes over.
- After moving to another screen, focus goes to its heading, for keyboard and screen reader users.

</details>

<details>
<summary><strong>Sign-in</strong></summary>

- Google sign-in runs through Supabase Auth with the PKCE flow. The app sends the visitor to Google, Supabase handles the reply, and the session comes back to the app.
- `src/auth/AuthProvider.tsx` shares the session with every screen and follows Supabase as it refreshes or ends it.
- The welcome screen offers **Get started** for the first-run questions and **I already have an account** for Google sign-in. The last question hands over to Google sign-in too.
- The first-run answers are kept on the device as they are given, under `shumar-cache:first-run`, and checked again whenever they are read. Weight can be entered in kg or lb and is stored in kg.
- Signing out removes the session and everything stored under the `shumar-cache:` prefix, such as recent foods, the day's searches and the first-run answers. Only the theme choice stays.

</details>

<details>
<summary><strong>Keys and security</strong></summary>

- The app only holds the project address and the publishable key, which are public by design. Row-level security is what protects each user's data.
- `src/lib/supabase.ts` refuses to start with a secret key, and the build fails if anything that looks like a secret ends up in its output.
- `npm run build` writes `dist/_headers` from `scripts/security-headers.ts`. The Content Security Policy allows code, styles and fonts from this site only, and network calls only to this site and its Supabase project.

</details>

<details>
<summary><strong>Database tables</strong></summary>

The migrations in `supabase/migrations/` define the database. Row-level security is on for every table, and each table gives the app only the privileges it needs.

| Table             | Holds                                                                        | Who can access it                             |
| :---------------- | :--------------------------------------------------------------------------- | :-------------------------------------------- |
| `kashmiri_foods`  | Our own food catalog, with values per 100 g and a source for every food      | Anyone can read; nobody can write via the API |
| `food_units`      | The weight in grams of one piece, cup or katori of a catalog food            | Anyone can read; nobody can write via the API |
| `user_logs`       | One row per food logged: meal, day, amount and the nutrients at that moment  | Only the person who logged it                 |
| `usda_releases`   | Which USDA files are loaded, with the SHA-256 of each download               | Signed-in people can read                     |
| `usda_foods`      | About 7,100 USDA foods, values per 100 g, flagged when the calories look off | Signed-in people can read                     |
| `usda_portions`   | USDA household portions, such as "1 cup, chopped", in grams                  | Signed-in people can read                     |
| `search_synonyms` | Local food words mapped to USDA wording, such as curd to yogurt              | Signed-in people can read                     |

</details>

<details>
<summary><strong>Food data and search</strong></summary>

Food values come from named sources only: our own measured Kashmiri recipes in `kashmiri_foods`, and USDA FoodData Central for ingredients and everyday foods. The USDA data is public domain and lives in our own database, so search never calls an outside API.

- **Search:** `search_foods(query)`, a database function, looks in our own catalog first, then in USDA foods by whole words and words still being typed, then by similar spelling for typos. Local words like curd, dal or haakh find the matching USDA food. It returns at most 20 results and only signed-in people can call it.
- **In the app:** `src/lib/foodSearch.ts` checks every result before the app uses it and always offers grams as a unit. It keeps up to 100 searches for the rest of the day, in memory and on the device, so a search made earlier that day costs no request, even after a reload. Kept searches belong to the person who made them, are checked again when read, and start afresh each day.
- **Importer:** `scripts/usda/import_usda.py` downloads the USDA Foundation Foods and SR Legacy files, stops if a file's SHA-256 doesn't match the pinned one, and writes a data migration. It leaves out foods with a missing value instead of filling them in, flags foods whose calories don't match their protein, carbs and fat, and skips US-only categories such as fast food and baby food.

To import a new USDA release:

1. Update the file name and SHA-256 in `DATASETS`.
2. Run `python3 scripts/usda/import_usda.py supabase/migrations/<timestamp>_usda_foods_data.sql`.
3. Update the expected counts in `supabase/tests/database/usda_data.test.sql`.

</details>

<details>
<summary><strong>Logging a meal</strong></summary>

The add button opens the log sheet at `/log`. The sheet is one component, `src/log/LogSheet.tsx`, so another screen can show it too.

- It opens on the meal for the time of day: breakfast until 11:00, lunch until 16:00, evening tea until 19:00 and dinner after that. Its button (such as **To dinner**) picks any of the five, including snack.
- `src/log/useFoodSearch.ts` searches once typing pauses for 300 ms and cancels a search that is no longer wanted.
- A chosen food offers its household units first, then grams, with a stepper for the amount. The values update as the amount changes. Foods flagged by the calorie check, and Kashmiri dishes not yet confirmed by a second weighing, are marked as estimates.
- `src/lib/logs.ts` checks the amount (more than 0, at most 10,000 and at most 20 kg) and saves one `user_logs` row with the nutrients at that moment. The log date is the person's local calendar day, and the row's owner comes from the session, never from the app.
- The last 10 foods added stay on the device, so the sheet lists them before any search and adds one again in one tap.
- `/log/edit/<id>` (`src/screens/EditLogScreen.tsx`) changes a food already logged: its amount, its meal, and its unit between the one it was logged in and grams. The values come from the log itself, so they match what the person saw, and its day stays the same.

</details>

<details>
<summary><strong>The Today screen</strong></summary>

`src/screens/TodayScreen.tsx` shows the day at a glance. It reads only the day's logs and the number of days logged (`days_logged()`, a database function that returns one number), and works out the rest on the device with `src/lib/today.ts`.

- The ring shows the calories eaten. Protein, carbs and fat follow, always in that order.
- The review card appears when the day's sodium passes 2,000 mg, the World Health Organization's limit for adults, and names the food that gave the most.
- The meals list shows each meal with food in it, in the order of the day, with its calories and its protein, carbs and fat. Calories are always saffron and each macro has its own color, always with its name beside it.
- Opening a meal lists its foods in a smaller size, each with its amount, calories, macros and sodium. Each food has **Edit** (the edit screen) and **Remove** buttons: labelled under the food on phones, icons beside it on wider screens. The same food in the same amount, logged more than once, shows once with its count (such as ×3) and their values together, and the bin takes one away.
- Adding a food shows a short toast ("Added to lunch"), and Remove takes the food off the list at once and shows a toast with **Undo**, which puts it back exactly as it was logged. Toasts sit at the bottom right on wide screens and, on phones, in the bottom strip beside the add button, with a saffron edge for added and a gray one for removed. They close by themselves (8 seconds with Undo, 5 without) but wait while they are touched, hovered or focused, and focus goes to Undo after a removal, so nobody is rushed.
- From 1024 px up, the log sheet sits beside the day as **Add food**, so a food added there shows in the day at once, and each meal shows the time of its first food. Phones and tablets use the round add button instead.
- On phones, names step down a size, icons are smaller and rows keep room around them. No text is cut short: long food names wrap.
- Loading, empty and failed days each have their own state, and a failed day can be tried again.

</details>

<details>
<summary><strong>Nutrition math</strong></summary>

The math lives in `src/lib/nutrition.ts`, apart from the screens, so it can be tested on its own.

- Every food value is stored per 100 g. A serving is quantity × grams per unit (piece, cup, katori or grams), then scaled from the per-100 g values.
- Values keep full precision in calculations and are rounded only for display.
- Food values are checked by comparing the stated calories with the energy from protein, carbs and fat. Sodium is always in milligrams.

</details>

<details>
<summary><strong>Daily targets</strong></summary>

`src/lib/targets.ts` turns a person's answers (sex, age, height, weight, activity and goal) into daily calories, protein, carbs and fat. Each number in it has its source in a comment next to it.

| Step           | How it works                                                                                                                                | Source                                                     |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------- |
| Resting energy | 10 × kg + 6.25 × cm - 5 × age, then + 5 for men or - 161 for women                                                                          | Mifflin-St Jeor, 1990                                      |
| Daily energy   | Resting energy × 1.40 (sedentary), 1.53 (lightly active), 1.76 (moderately active) or 2.25 (very active)                                    | ICMR-NIN 2020 for sedentary, FAO/WHO/UNU 2004 for the rest |
| Goal           | Lose 0.25, 0.5 or 0.75 kg a week with 300, 500 or 750 kcal less a day. Maintain and body recomposition stay at daily energy. Gain adds 10%. | NIH 1998, AHA/ACC/TOS 2013, Iraki et al. 2019              |
| Safety floor   | Weight-loss targets never go below 1,200 kcal for women or 1,500 for men, and never above daily energy                                      | AHA/ACC/TOS 2013                                           |
| Protein        | 1.6 g per kg of body weight, or 2.2 g for body recomposition, at most 35% of calories                                                       | Morton et al. 2018, ISSN 2017, Iraki et al. 2019, IOM 2005 |
| Fat and carbs  | Fat is 25% of calories and carbs get the rest                                                                                               | IOM 2005, WHO                                              |

It accepts ages 18 to 100, heights of 100 to 250 cm and weights of 30 to 300 kg, and refuses anything else, including answers read back from storage that don't match a known option.

</details>

<details>
<summary><strong>Theme</strong></summary>

- `public/theme-init.js` sets the theme before the page draws, from the saved choice or the device setting, so it never flashes the wrong theme.
- `src/theme/ThemeProvider.tsx` keeps it in step with the choice (and with the device, for System) and matches the browser's status bar color.
- The choice is made on the You screen, or with the theme button in the desktop side navigation. Only the choice (system, light or dark) is stored on the device.

</details>

## Design system

All colors, fonts, type sizes and font weights are defined once as tokens in `src/index.css` and used through Tailwind classes such as `bg-koshur-base`, `text-body` and `font-semibold`. Tailwind's default palette, sizes, fonts and weights are turned off, so only these tokens exist. `npm run lint` fails if a component uses anything else.

Every color token has a dark and a light value, switched by the `data-theme` attribute on the page.

| Color token                                      | Role                          |
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
2. Keep each commit to one change that builds and passes its tests on its own. Write messages in the Conventional Commits style, for example `feat: add food search with household units`.
3. Before opening a pull request into `main`, run `npm run check`, `npm run test:db` and `npm run test:e2e`.
4. All six pull request checks must pass before it can merge.

## License

Copyright © 2026 Tajamul Wani. All rights reserved.
