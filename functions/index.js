import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import webpush from "web-push";
import {
  claimable,
  expired,
  retryable,
  validSubscription,
} from "./reminder-policy.js";
initializeApp();
const db = getFirestore();
const privateKey = defineSecret("WEB_PUSH_PRIVATE_KEY");
const publicKey = defineString("WEB_PUSH_PUBLIC_KEY");
const subject = defineString("WEB_PUSH_SUBJECT");

// Only explicit reminder times and push subscriptions are read; never planner or journal data.
export const deliverReminders = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "UTC",
    region: "us-central1",
    secrets: [privateKey],
    timeoutSeconds: 120,
    maxInstances: 1,
    retryCount: 2,
  },
  async () => {
    const now = Timestamp.now();
    const pending = await db
      .collectionGroup("reminders")
      .where("status", "==", "pending")
      .where("dueAt", "<=", now)
      .limit(20)
      .get();
    const abandoned = await db
      .collectionGroup("reminders")
      .where("status", "==", "sending")
      .where("leaseUntil", "<=", now)
      .limit(20)
      .get();
    const queue = [...pending.docs, ...abandoned.docs];
    async function deliver(snapshot) {
      // Ignore similarly named collections outside the user namespace.
      if (!/^users\/[^/]+\/reminders\/[^/]+$/.test(snapshot.ref.path)) return;
      const claim = await db.runTransaction(async (tx) => {
        const live = await tx.get(snapshot.ref),
          r = live.data();
        if (!live.exists || !claimable(r, now.toMillis())) return null;
        if (expired(r, now.toMillis()) || (r.attempts || 0) >= 3) {
          tx.update(snapshot.ref, { status: "expired" });
          return null;
        }
        const lease = Timestamp.fromMillis(now.toMillis() + 5 * 60000);
        tx.update(snapshot.ref, {
          status: "sending",
          leaseUntil: lease,
          attempts: (r.attempts || 0) + 1,
        });
        return { attempt: (r.attempts || 0) + 1, lease };
      });
      if (!claim) return;
      const devices = await snapshot.ref.parent.parent
        .collection("pushDevices")
        .limit(10)
        .get();
      let sent = 0,
        transient = 0;
      await Promise.all(
        devices.docs.map(async (device) => {
          const subscription = device.data().subscription;
          if (!validSubscription(subscription)) {
            await device.ref.delete();
            return;
          }
          try {
            await webpush.sendNotification(
              subscription,
              JSON.stringify({ id: snapshot.id }),
              {
                vapidDetails: {
                  subject: subject.value(),
                  publicKey: publicKey.value(),
                  privateKey: privateKey.value(),
                },
                TTL: 300,
                urgency: "high",
                timeout: 5000,
              },
            );
            sent++;
          } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 410)
              await device.ref.delete();
            else if (retryable(error.statusCode)) transient++;
            // Never log tokens, subscriptions, or personal notification contents.
          }
        }),
      );
      await db.runTransaction(async (tx) => {
        const live = await tx.get(snapshot.ref),
          r = live.data();
        // Cancellation deletes the record. Never recreate it after sending.
        if (
          !live.exists ||
          r.status !== "sending" ||
          r.attempts !== claim.attempt ||
          !r.leaseUntil.isEqual(claim.lease)
        )
          return;
        tx.update(snapshot.ref, {
          status:
            transient > 0 && claim.attempt < 3
              ? "pending"
              : sent > 0
                ? "sent"
                : "failed",
          deliveredAt: FieldValue.serverTimestamp(),
          leaseUntil: FieldValue.delete(),
        });
      });
    }
    // Bound concurrent work so one slow push service cannot exhaust the function runtime.
    await Promise.all(
      Array.from({ length: 5 }, async () => {
        while (queue.length) {
          const next = queue.shift();
          if (next) await deliver(next);
        }
      }),
    );
  },
);
