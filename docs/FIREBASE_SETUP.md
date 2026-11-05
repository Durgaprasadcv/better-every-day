# Firebase, live saving, deployment, and iPhone notifications

## Optional Firebase setup

1. Create a Firebase project and register a Web App.
2. Enable Authentication → Email/Password. Configure a password policy and add your hosting domain to Authentication → Settings → Authorized domains. Do not publish a Firebase project with open Firestore rules.
3. Create Cloud Firestore in production mode.
4. Copy `.env.example` to `.env.local` and fill all four `VITE_FIREBASE_*` values. Restart Vite after changes. Without all four settings, the app stays in local mode.
5. Install the official Firebase CLI and deploy the included rules:

   ```sh
   npm install -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules
   ```

6. Open the cloud button, create an account or sign in, then choose **Back up to cloud** for a manual snapshot or **Enable live saving** for automatic saving during this session.
7. On another device, sign in, choose **Review cloud restore**, export any current local entries, then choose **Replace local entries**.

Firebase Web App configuration is delivered to the browser; security comes from Authentication and Firestore rules. Never use an Admin SDK key in this app. `.env*` (except the empty example), Firebase CLI state, logs, exports, and service account files are ignored. Review staged files before committing to this public repository.

### Backup and conflicts

The planner backup document is `/users/{uid}/app/tracker` with `{schemaVersion, days, revision, updatedAt}`. Rules require the authenticated owner for reads and writes, restrict root fields, require schema 2, enforce increasing integer revisions, and bind timestamps to server time. Other paths are denied except the owner-only reminder and push-device paths documented below. The owner can delete the cloud document through Firebase tooling.

Manual backups are explicit online Firestore transactions. A transaction reads the current revision and only uploads if it matches the revision observed by this session; Firestore retries concurrent transactions. A new session starts at revision zero, so an existing backup must be restored and reviewed before that session can upload. A conflicting revision stops the write and preserves local data. No offline cloud transactions are queued: offline updates remain in local storage. In manual mode, explicitly retry online; in live mode, the app retries after reconnecting. This avoids last-write-wins surprises and cross-account queues.

Restore reads from the server, validates the document, and shows a replacement review. It never merges or applies silently. Export the current local version before replacing it to keep both versions. Cloud backup is a single snapshot (limit 700,000 JSON characters, with 100 tasks per day and 3,660 days); retain exports for longer history. A future sync implementation should move to per-record revisions, tombstones, and explicit merge review.

See Firebase's [transaction behavior](https://firebase.google.com/docs/firestore/manage-data/transactions) and [user-based security rules](https://firebase.google.com/docs/firestore/security/rules-conditions).

## Live Firebase saving

Live saving is opt-in **per session** from the cloud/account panel. It includes private reflections, tasks, habits, and metrics in the signed-in user's snapshot. Signing in alone leaves it off. A 700 ms debounce reduces writes while typing. Changes save locally before any upload, so pending edits survive closing the browser. Re-enable live saving after reopening to resume.

A realtime listener downloads remote changes only when this device has no conflicting edits. Both uploads and manual backups use revision-checked transactions on the same document. Map keys are canonicalized for comparison so Firestore's ordering cannot create false conflicts. If both devices changed, automatic saving pauses; export both versions, then choose **Use cloud version** or **Keep device version**. The latter still uses a revision-checked transaction, so another intervening update triggers review again. Automatic field merging is deliberately deferred.

The last acknowledged snapshot and revision are kept locally under an account-specific bed-live-sync key. These are private, unencrypted app data too. Cloud entries are not erased on sign-out. Live saving stops on account change; review this browser's entries before enabling it for another account. Manual restore/upload is disabled while live saving runs. Turning live saving off does not recall an already submitted write.

## Deploy and install

```sh
npm run build
firebase deploy --only hosting
```

Deploy Firestore rules separately before enabling cloud access. The supplied `firebase.json` serves `dist/` with SPA fallback. Alternatively deploy `dist/` to HTTPS static hosting at the **domain root**, with unknown routes falling back to `index.html`. The current manifest and asset paths assume root hosting; GitHub Pages subpath hosting needs an explicit Vite `base` and manifest path adjustment first.

Open the production site online once, then install from the browser's install menu / Add to Home Screen. The generated service worker precaches the app shell, scripts, styles, and local PNG icons. After activation, the tracker works offline. Installation and notifications require HTTPS (localhost is allowed); iOS installation uses Safari's Add to Home Screen. Service workers are generated only by the production build, not normal Vite development mode. Firebase API traffic is not runtime-cached by the service worker. Firestore uses its default memory cache; browser-local app data is the source of truth.

## Release checks

Automated tests mock Firebase and are not a substitute for deployed rules verification. Before enabling real cloud use, test in the Firebase Emulator Suite or a disposable project:

- Unauthenticated reads/writes fail; user A cannot read, create, update, or delete user B's document.
- An owner can create revision 1, update to revision 2, and restore it.
- Extra root fields, incorrect schema, non-map days, stale revisions, and forged timestamps fail.
- Two devices uploading from the same revision cannot both replace the snapshot.
- Offline edits persist after reload; manual backup requires an explicit upload, while enabled live saving retries after reconnecting.
- Install the production PWA, load it online, disconnect, reload, edit, close/reopen, and verify entries.
- Check notification allowed/denied states in target browsers; local task alarms need an open app, while separately scheduled phone reminders use Web Push.

No real Firebase project is supplied, so live Authentication, deployed rules, and real-device install behavior need that release verification. Four low-severity transitive build-tool audit findings remain in the current lockfile; high and moderate findings were resolved with explicit dependency overrides. Recheck `npm audit` when updating dependencies.

## iPhone alarms and phone notifications

Open the **Reminders** tab for installation help and both reminder modes:

1. **Open-app task reminders:** opt in each session. Due tasks for the current local day show a reminder with Dismiss and Snooze 5 minutes. Optional gentle sound uses a user-enabled Web Audio session. Only tasks due within the last 15 minutes alert; overdue history does not flood the screen. Snoozes are in memory and stop if the session closes. Browser suspension can delay foreground timers.
2. **Closed-app phone notifications:** independent, one-time reminders using standard Web Push. Supported on iPhone Home Screen web apps with iOS 16.4+. Notification permission must be granted from a user tap. These are best-effort notifications, **not native Clock alarms**: sound, delivery, Focus, Silent Mode, and notification settings remain controlled by iOS. No guaranteed exact-time or continuous ringing is possible in this PWA.

On iPhone: open the HTTPS deployment in Safari → Share → Add to Home Screen (keep Open as Web App enabled when shown), open its icon, sign in, open Reminders, then Enable this phone. On iPhone use the deployed URL; `localhost` on your phone refers to your phone, not your development PC.

### Deploy the optional push scheduler

This service needs a Firebase **Blaze billing plan**, Cloud Scheduler, Cloud Functions, and Secret Manager. Review provider pricing and set budget alerts before deploying. This repository includes the implementation but does not deploy or provision paid resources automatically.

1. Install backend dependencies with `npm ci --prefix functions` (the deployed runtime is Node.js 22).
2. Generate VAPID keys privately using the official library from `functions/`:

   ```sh
   node --input-type=module -e "import webpush from 'web-push'; console.log(webpush.generateVAPIDKeys())"
   ```

   Keep the private key out of Git, logs, and every `VITE_*` variable. Store it in Firebase Secret Manager:

   ```sh
   firebase functions:secrets:set WEB_PUSH_PRIVATE_KEY
   ```

3. Set the matching **public** key in `.env.local` as `VITE_WEB_PUSH_PUBLIC_KEY`. Backend deploy prompts for `WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_SUBJECT` (a valid `mailto:` contact or public HTTPS URL, not localhost). Firebase may store non-secret parameters in ignored `functions/.env.<project>` files. Rebuild the frontend after changing its public key.
4. Deploy the owner-only rules, collection-group indexes, scheduler, and hosting:

   ```sh
   npm run build
   firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
   ```

   Wait for both reminder indexes to finish building before testing. If desired, enable Firestore TTL on the `expiresAt` field for the `reminders` collection group to remove records seven days after the reminder time; TTL deletion is asynchronous and billed by Firebase.

5. Install the HTTPS site on the iPhone Home Screen, enable the device, schedule a reminder a few minutes ahead, close the app, and verify delivery. Test blocked notifications, Focus enabled, cancellation, expired subscriptions, account switching, and a temporarily disconnected phone. Apple can delay or suppress delivery; the scheduler checks approximately once per minute and uses a five-minute push TTL.

### Push privacy and delivery design

Subscriptions are stored under `/users/{uid}/pushDevices/{deviceId}`. Reminder records are under `/users/{uid}/reminders/{id}` and contain only timestamps and delivery status. Their private display does not include planner task names, family names, or journal entries. The notification payload contains only a random reminder ID; the service worker displays generic text and opens the tracker when tapped.

Rules allow users to create/read/delete their own reminders and reject client status updates. The scheduler uses the Admin SDK's managed identity. It restricts subscription endpoints to Apple, Google, and Mozilla HTTPS push hosts, claims due reminders with transaction leases, bounds concurrency, retries transient delivery errors up to three attempts, removes expired endpoints, and skips reminders older than 24 hours. Push delivery is at least once; a crash after dispatch can cause a repeated notification, with stable notification tags reducing duplicates. A cancellation after dispatch cannot recall an alert already sent.

The current service handles at most 40 due/abandoned reminders per minute and ten devices per user; it is intentionally sized for personal use. Scheduled phone reminders are independent from daily planner tasks: changing/completing a planner task does not cancel a phone reminder. Cancel it in Reminders. Disable this phone before switching accounts; signing out alone does not erase subscriptions or cancel scheduled reminders. Cloud backups do not include push subscriptions or scheduled notification records.

Read the official [Apple Web Push requirements](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [Firebase scheduled functions guide](https://firebase.google.com/docs/functions/schedule-functions), and [web-push library documentation](https://github.com/web-push-libs/web-push).
