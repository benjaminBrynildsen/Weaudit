/**
 * Auth routes.
 *
 *   GET  /auth/google            — kicks off the OAuth flow
 *   GET  /auth/google/callback   — handles the OAuth callback
 *   GET  /auth/me                — returns the current user or 401
 *   POST /auth/logout            — destroys the session + clears cookie
 *
 * Successful login redirects to /dashboard. Failure redirects to
 * /login?error=<reason> so the client can show a message.
 */

import type { Express, Request, Response } from "express";
import { passport } from "./passport";

export function registerAuthRoutes(app: Express) {
  app.get(
    "/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
    }),
  );

  app.get(
    "/auth/google/callback",
    // Use a custom callback so we can pass the strategy's `info.message`
    // as a URL param on failure — otherwise the user sees a blank
    // /login page with no context.
    (req, res, next) => {
      passport.authenticate("google", (err: Error | null, user: Express.User | false, info: { message?: string } | undefined) => {
        if (err) return next(err);
        if (!user) {
          const reason = encodeURIComponent(info?.message || "sign-in failed");
          return res.redirect(`/login?error=${reason}`);
        }
        req.logIn(user, (loginErr) => {
          if (loginErr) return next(loginErr);
          return res.redirect("/dashboard");
        });
      })(req, res, next);
    },
  );

  app.get("/auth/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: "unauthenticated" });
    }
    const u = req.user!;
    // Don't leak googleSub/hd to the client — they're internal.
    return res.json({
      userId: u.userId,
      email: u.email,
      name: u.name,
      picture: u.picture,
    });
  });

  app.post("/auth/logout", (req: Request, res: Response, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie("weaudit.sid");
        return res.json({ ok: true });
      });
    });
  });
}
