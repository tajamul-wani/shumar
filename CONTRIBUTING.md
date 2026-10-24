# Contributing to Shumār

Thank you for helping. This page covers how work goes from a branch to `main`. To set up the project first, see [Getting started](README.md#getting-started).

## Branches

Branch from `main`, named `<prefix>/<short-description>`, such as `feat/food-search`:

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

## Commits

Keep each commit to one change that builds and passes its tests on its own. Write the message in the Conventional Commits style, saying what was done: `feat: added food search with household units`.

## Checks

Before opening a pull request into `main`, run `npm run check`, `npm run test:db` and `npm run test:e2e`. A maintainer merges only when all six checks pass: lint and types, unit, database, end-to-end, a security scan and CodeQL.

## Pull requests

Title the pull request with the branch's prefix and what it did, in about 70 characters: `feat: added food search with household units`. Its description has exactly three sections: **What we did** (the work and how it was built), **Why** and **What this solves**, with no commit lists or test results.

Small fixes go into related work rather than their own pull request, unless they are urgent (`hotfix/` or `security/`).

## House rules

- Colors, fonts, type sizes and weights come only from the tokens in `src/index.css`. `npm run lint` fails on anything else.
- Every food value needs a named source and is stored per 100 g. See [How the numbers are worked out](README.md#how-the-numbers-are-worked-out).
- Write plainly in the app, the docs, commits and pull requests: short sentences, no em dashes and no emojis.
- Report security problems privately, as [SECURITY.md](SECURITY.md) explains, never in a public issue.
