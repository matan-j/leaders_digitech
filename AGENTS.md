# Project Context for Codex

You are taking over this project from Claude Code.  
Your job is to understand the existing codebase deeply before changing anything.

## Project Overview

This is a Digitech / Leaders management web app.

Stack:
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend / DB / Auth: Supabase
- Supabase Edge Functions are used for server-side logic and scheduled/email-related tasks
- Hosting: Vercel
- Database migrations live under `supabase/migrations`
- Frontend code lives mostly under `src/`

Important env vars:
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- Supabase Edge Functions should use `Deno.env.get(...)`, not `process.env`
- Edge Functions should use Supabase secrets such as `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `BREVO_API_KEY`

## Known Deployment Context

The app is deployed on Vercel.

There was a previous routing bug where refreshing deep links like `/calendar` returned 404.  
The solution was a Vercel rewrite:
- `/api/(.*)` should go to API/serverless routes
- all non-api routes should rewrite to `/index.html`
- do not break SPA routing

The project may include a `vercel.json` or equivalent config for this.

## Supabase / Email Context

The app uses Supabase.
There are Edge Functions, including notification/admin-related functions.

One known past bug:
`notify-admins-low-attendance` returned:
`error: supabaseUrl is required`

Likely cause:
Edge Function env vars were not read correctly.

Correct approach:
- In Supabase Edge Functions, use `Deno.env.get("SUPABASE_URL")`
- Use `SUPABASE_SERVICE_ROLE_KEY` for privileged backend operations
- Do not rely on frontend `VITE_` env vars inside Edge Functions
- Use Brevo for transactional emails, not Gmail API

## Engineering Rules

Before editing:
1. Read the relevant files.
2. Understand the data flow.
3. Identify the smallest safe change.
4. Explain what you are changing and why.
5. Avoid large rewrites unless explicitly asked.

Do not:
- Rename database columns without checking migrations and all usages.
- Change Supabase RLS/policies without explaining the security impact.
- Replace the architecture.
- Add new dependencies unless clearly necessary.
- Touch unrelated files.
- Break Vercel SPA routing.
- Expose secrets in frontend code.
- Put service role keys in client-side code.

## Verification

After changes, run the relevant checks:
- `npm install` only if needed
- `npm run dev` for local sanity
- `npm run build`
- lint/typecheck if available in `package.json`

When debugging:
- Search the repo for relevant table names, column names, Supabase queries, Edge Function names, and route names.
- Check both frontend usage and Supabase migrations.
- If there is a DB error, trace it back to the exact table/column/policy/function involved.

## How to Work With Me

I want practical, direct help.
For each task:
- First summarize what you found.
- Then propose the minimal fix.
- Then implement it.
- Then tell me how to test it.

Assume I am working with GitHub branches and PRs.
Prefer creating a clear branch name and small PR-style changes.