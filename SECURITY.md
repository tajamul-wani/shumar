# Security

Shumār holds people's private food logs, so we take every report seriously.

## Report a problem

Please don't open a public issue. Report it privately on GitHub instead: open the [Security tab](https://github.com/tajamul-wani/shumar/security) and choose **Report a vulnerability**, or go straight to the [private report form](https://github.com/tajamul-wani/shumar/security/advisories/new).

Tell us what you found, how to reproduce it, and what someone could do with it. We'll confirm we have your report, keep you updated while we fix it, and credit you when the fix is out if you'd like.

## What's covered

- The web app in this repository.
- The database's access rules (row-level security) and the migrations in `supabase/`.
- The build and the security headers it writes.

Problems in Supabase, Google sign-in or Cloudflare themselves belong with those companies.

## How Shumār protects data

- Every table has row-level security, so each person can reach only their own logs and answers.
- The app holds only the Supabase address and its publishable key. The build fails if a secret key would reach the browser.
- Every page is served with a strict content security policy and the usual security headers.
