import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth, configured } from "../../shared/services/firebase.js";
export default function AccountPanel({
  user,
  operationBusy,
  disabled,
  online,
  live,
  cloud,
  setMessage,
}) {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const busy = operationBusy || authBusy;
  async function login(create) {
    setAuthBusy(true);
    try {
      if (create)
        await createUserWithEmailAndPassword(
          auth,
          credentials.email,
          credentials.password,
        );
      else
        await signInWithEmailAndPassword(
          auth,
          credentials.email,
          credentials.password,
        );
      setCredentials((c) => ({ ...c, password: "" }));
      setMessage(
        "Signed in. Local entries stay on this device until you upload.",
      );
    } catch {
      setMessage(
        "Sign-in failed. Check your email, password, connection, and Firebase configuration.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <section className="account card">
      <h2>
        <ShieldCheck size={21} /> Your private space
      </h2>
      <p>
        Entries are stored in this browser profile, unencrypted. Cloud backup
        and live saving are optional. Sign-out does not erase local entries; use
        a private browser profile on shared devices.
      </p>
      {!configured ? (
        <p className="notice">
          Local mode is ready. Configure Firebase using the README to enable
          account backup.
        </p>
      ) : user ? (
        <>
          <p>Signed in as {user.email}</p>
          <div className="actions">
            <button
              disabled={disabled || !online || live.enabled}
              onClick={() => cloud("up")}
            >
              Back up to cloud
            </button>
            <button
              disabled={disabled || !online || live.enabled}
              onClick={() => cloud("down")}
            >
              Review cloud restore
            </button>
            <button
              disabled={busy}
              onClick={() =>
                signOut(auth).catch(() =>
                  setMessage("Could not sign out. Please retry."),
                )
              }
            >
              Sign out
            </button>
          </div>
          <p className="small">
            Manual backup is available while live saving is off.
          </p>
          <div className="live-controls">
            <h3>Live Firebase saving</h3>
            <p className="small">
              Enable each session to automatically save all device entries,
              including reflections, to this account. Offline edits remain local
              and retry when connected. Other devices update live; conflicts
              require your review.
            </p>
            <div className="actions">
              <button
                disabled={disabled}
                onClick={() => (live.enabled ? live.disable() : live.enable())}
              >
                {live.enabled ? "Turn off live saving" : "Enable live saving"}
              </button>
              {live.enabled && (
                <button disabled={disabled || !online} onClick={live.retry}>
                  Retry cloud saving
                </button>
              )}
            </div>
            <p className="notice" role="status">
              {live.status}
            </p>
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            login(false);
          }}
        >
          <div className="inputs">
            <label>
              Email
              <input
                required
                type="email"
                autoComplete="email"
                value={credentials.email}
                onChange={(e) =>
                  setCredentials({
                    ...credentials,
                    email: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                minLength="6"
                autoComplete="current-password"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({
                    ...credentials,
                    password: e.target.value,
                  })
                }
              />
            </label>
          </div>
          <div className="actions">
            <button disabled={busy}>Sign in</button>
            <button
              disabled={
                busy || !credentials.email || credentials.password.length < 6
              }
              type="button"
              onClick={() => login(true)}
            >
              Create account
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
