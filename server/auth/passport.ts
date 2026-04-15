/**
 * Passport configuration — Google OAuth strategy with domain gate.
 *
 * Who can sign in:
 *   - Any Google Workspace account whose hosted domain (hd claim) matches
 *     ALLOWED_EMAIL_DOMAIN (e.g. "weaudit.com").
 *   - Any email in ALLOWED_EMAIL_OVERRIDES (comma-separated list) — useful
 *     for developer/admin accounts that aren't part of the Workspace.
 *   - All logins additionally require the ID token's email_verified = true.
 *
 * Session shape: we serialize only the userId into the session cookie and
 * re-hydrate from the database on each request. Small cookie, fresh data.
 */

import passport from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import { storage } from "../storage";
import type { User as DomainUser } from "../storage-types";

// Re-export so other auth modules don't need two imports.
export type User = DomainUser;

// Tell Passport that req.user is our domain User. The `as` form avoids
// the "interface can only extend identifier" error that occurs when
// extending an inline `import(...)` type.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends DomainUser {}
  }
}

function parseOverrides(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isAllowed(email: string, hd: string | undefined): {
  ok: true;
} | {
  ok: false;
  reason: string;
} {
  const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN || "").toLowerCase();
  const overrides = parseOverrides(process.env.ALLOWED_EMAIL_OVERRIDES);
  const normalizedEmail = email.toLowerCase();

  if (overrides.has(normalizedEmail)) return { ok: true };
  if (allowedDomain && hd && hd.toLowerCase() === allowedDomain) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: allowedDomain
      ? `Only @${allowedDomain} Google Workspace accounts are allowed.`
      : `This account is not permitted to sign in.`,
  };
}

export function configurePassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.BASE_URL || "http://localhost:5000";

  if (!clientID || !clientSecret) {
    console.warn(
      "[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google sign-in will not work.",
    );
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: clientID || "missing",
        clientSecret: clientSecret || "missing",
        callbackURL: `${baseUrl}/auth/google/callback`,
        // hd is a Google-specific param that nudges the account picker
        // toward the target Workspace. It is UX-only — the real gate is
        // server-side below.
        ...(process.env.ALLOWED_EMAIL_DOMAIN
          ? { hd: process.env.ALLOWED_EMAIL_DOMAIN }
          : {}),
      },
      async (_accessToken, _refreshToken, profile: Profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          // `verified` on profile.emails[0] maps to email_verified in the
          // underlying OpenID token. passport-google-oauth20 exposes it as
          // `verified: "true" | "false"` (stringy). Treat missing/"false"
          // as unverified.
          const verifiedRaw = (profile.emails?.[0] as { verified?: string | boolean } | undefined)?.verified;
          const verified = verifiedRaw === true || verifiedRaw === "true";
          // hd is only present for Workspace accounts. `_json.hd` is the
          // raw JSON claim from the ID token.
          const hd = (profile as Profile & { _json?: { hd?: string } })._json?.hd;

          if (!email) {
            return done(null, false, { message: "Google returned no email." });
          }
          if (!verified) {
            return done(null, false, { message: "Email not verified by Google." });
          }

          const gate = isAllowed(email, hd);
          if (!gate.ok) {
            return done(null, false, { message: gate.reason });
          }

          const name =
            profile.displayName ||
            profile.name?.givenName ||
            email.split("@")[0];
          const picture = profile.photos?.[0]?.value;

          const user: User = await storage.upsertUserByGoogleSub({
            googleSub: profile.id,
            email: email.toLowerCase(),
            name,
            picture,
            hd,
          });
          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, (user as User).userId);
  });

  passport.deserializeUser(async (userId: string, done) => {
    try {
      const user = await storage.getUserById(userId);
      if (!user) return done(null, false);
      return done(null, user);
    } catch (err) {
      return done(err as Error);
    }
  });
}

export { passport };
