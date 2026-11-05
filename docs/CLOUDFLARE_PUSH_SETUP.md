# Phone reminders without Firebase Blaze

Keep Firebase Authentication, Firestore, and Hosting on Spark. The optional `cloudflare/` Worker sends standard Web Push using a once-per-minute Cron Trigger and D1 database. Use Cloudflare's **Free** plan and remain within its quotas. Do not deploy the alternative `functions/` scheduler for this setup.

## Deploy

Requires Node 24 and a Cloudflare account. Run in `cloudflare/`:

```powershell
npm ci
npx wrangler login
npx wrangler d1 create better-every-day-reminders
```

Copy the returned database ID into `wrangler.jsonc`. Confirm `APP_ORIGIN` is the exact live frontend origin (no trailing slash) and `FIREBASE_PROJECT_ID` is `better-every-day-594e0`.

```powershell
npx wrangler d1 migrations apply better-every-day-reminders --remote
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Keep the private key private. Never commit it, paste it into chat, or put it in a `VITE_` variable. Enter each value interactively:

```powershell
npx wrangler secret put WEB_PUSH_PRIVATE_KEY
npx wrangler secret put WEB_PUSH_PUBLIC_KEY
npx wrangler secret put WEB_PUSH_SUBJECT
```

The subject must be a contact URL or `mailto:` address you control. Store the generated key pair securely so redeployments use the same keys. Then:

```powershell
npm test
npm run check
npm run deploy
```

In the root ignored `.env`, set `VITE_WEB_PUSH_PUBLIC_KEY` to the public key and `VITE_PUSH_API_URL` to the Worker HTTPS URL. Rebuild and redeploy Firebase Hosting:

```powershell
npm run build
firebase deploy --only hosting --project better-every-day-594e0
```

No Firebase service-account credential is needed. The Worker verifies Firebase ID-token signatures, expiry, issuer and audience against Google's public keys. Each query is scoped to the verified user ID. Revoked sessions can remain valid until the ID token expires (normally up to an hour); no Admin revocation check is performed.

## Test on iPhone

Use iOS 16.4 or later. Open the live app in Safari, Share → Add to Home Screen, open the new icon, sign in, and enable this phone on the Reminders screen. Schedule a reminder at least two minutes ahead, close the app, and check receipt. Repeat with cancellation and disabled notifications. Focus, network availability and OS settings may delay or suppress alerts. This is not a guaranteed Clock alarm.

## Limits and privacy

- Only device subscription and explicit one-time reminder times go to D1. No journal text or task names are sent. Payloads contain only a random reminder ID.
- Three devices and thirty pending reminders per account; at most ten reminders processed per minute. Higher load causes delays. The Free plan has shared request/CPU/database quotas, so it is suitable for this small personal app, not unlimited use.
- Transient delivery failures retry up to three times. A lease handles interrupted sends. As with most push systems, a crash after dispatch can cause a duplicate; the notification ID groups duplicate notifications on the device.
- Cancel deletes the record; disabling a phone cancels its scheduled reminders. Already dispatched pushes cannot be recalled. Signing out alone does not cancel reminders.
- Records are removed seven days after the due time. Device subscriptions remain until disabled or the push service reports they expired. Remove devices before deleting an account; automatic Firebase account-deletion cleanup is not provided.
- API lists refresh every thirty seconds. Changing providers does not migrate existing schedules or subscriptions. Cancel/disable on the old provider before switching; never run both senders for the same schedule.
- Free quota exhaustion pauses delivery; monitor the Cloudflare dashboard. No billing upgrade is required by this implementation.

References: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Apple Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
