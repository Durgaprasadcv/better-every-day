# Better Every Day

A mobile-first, local-first React + Vite PWA for daily planning, discipline, health, family responsibilities, and reflection. No Firebase account or configuration is required for local use.

## Run locally

Use Node.js 24 LTS (minimum 22.12).

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Open the URL printed by Vite. Production files are emitted to `dist/`. Tests cover challenge boundaries, weekly statistics, backup validation, local storage failures, transaction conflict handling, and tracker interactions. GitHub Actions runs tests and the production build for pushes and pull requests.

## MVP

- Daily habits: discipline, walking, exercise, sleep, screen time, household work, family time, childcare.
- Timed tasks with Personal, Home, Family, and Childcare categories; complete, edit, delete with Undo, or repeat yesterday’s plan.
- Walking minutes, sleep hours, and screen time hours.
- Private daily wins and reflection, saved locally as you type.
- Seven-day statistics, habit heatmap, XP, levels, consistency streaks, and achievement badges.
- Thirty-day challenge, **6 November–5 December 2026**:
  - Days 1–7: Fix the basics
  - Days 8–14: Become more responsible
  - Days 15–21: Rebuild connection
  - Days 22–30: Make it a lifestyle
- Explicit JSON export/import and optional Firebase backup/restore.
- Open-app task reminders with optional sound and five-minute snooze, plus an optional secure Web Push scheduler for iPhone Home Screen notifications. See the iPhone setup below.

## Privacy and local storage

Personal entries live in this browser profile under `better-every-day-v2`. They are **not encrypted**; anyone with access to this profile can read them. Clearing site data removes entries. Use regular JSON exports and a separate browser profile on shared devices. Exported JSON contains private journal entries; keep it outside the public repository.

Nothing is uploaded until you choose manual backup or enable live saving. Signing into Firebase alone does not upload entries, associate existing local entries with an account, or erase them on sign-out. Review local data before backing up to a different account. No analytics, third-party fonts, sample personal names, or real personal entries are included.

Local saves validate before writing and keep the previous saved version if storage is unavailable or full. A damaged saved record is preserved for export, with editing paused. Another tab's storage change pauses edits to avoid silently replacing it: export that tab's entries, then reload. Prefer one active editing tab; localStorage is not a multi-writer database.

This version uses schema 2 and does not automatically migrate starter schema 1 records (`better-every-day-v1`). The original key is left intact. Export from the old version before upgrading if you used the starter; preserve that export until a migration is available. Schema 2 JSON import validates dates, metrics, habit IDs, task fields, and size before displaying a replacement review.

## Simple gamification

Every saved habit earns 10 XP; completed tasks earn 5 XP each (up to five tasks/day); recording a win earns 5 XP; reflection earns 10 XP. XP is derived from saved completion, so toggling repeatedly does not farm points. Each 250 XP advances a level. A consistency streak counts days with at least one habit, task, win, or reflection; today can remain unfinished without breaking yesterday's streak. Total XP excludes future dates until they arrive. Badges reward first steps, three- and seven-day streaks, a full habit day, and thirty active days. Missing a day does not subtract XP. Editing or removing earlier entries recalculates the totals.

These small rewards and progress views draw on common patterns in [Todoist Karma](https://www.todoist.com/karma) and [TickTick habit statistics](https://ticktick.com/features), with original visual design and no public leaderboard.

## Project structure

```text
src/
  app/                 App shell and coordination
  features/
    planner/           Daily checklist, timed tasks, task editing
    challenge/         Thirty-day challenge calendar
    journal/           Daily reflections
    progress/          Dashboard, XP, streaks, achievements
    reminders/         Local alarms, iPhone setup, Web Push client
    sync/              Account UI, backups, conflict-safe live saving
  shared/
    model/             Data validation and date/statistics helpers
    services/          Firebase initialization and browser storage
  styles/              Shared responsive design
  main.jsx             React entry point
  sw.js                Offline cache and push notification service worker
functions/             Private scheduled push delivery service
public/                Install icons and static assets
tests/
  unit/                Domain, storage, reminder, and backup tests
  integration/         App interactions and live sync behavior
docs/                  Setup and architecture references
.github/workflows/     Automated validation
```

See [architecture and data flow](docs/ARCHITECTURE.md) and [Firebase / iPhone setup](docs/FIREBASE_SETUP.md). Use `npm run format` to format application source and tests.

## Validation and remaining setup

Run `npm test` and `npm run build`. The suite covers the daily tracker, date boundaries, storage failures, XP, alarms and snooze, revision conflicts, and edits during cloud uploads. Backend policy tests run as part of the same command. GitHub Actions also installs the backend and checks its module syntax.

A real Firebase project is not included. Live Authentication, deployed security rules, two-device sync, and notification delivery on an actual iPhone require the setup and release checks in the linked guide. The Firestore emulator needs Java and was unavailable in this environment. The frontend lockfile has four low-severity transitive build-tool audit findings; the push backend currently reports no audit vulnerabilities. The production build has one size warning for the Firebase Firestore SDK chunk.
