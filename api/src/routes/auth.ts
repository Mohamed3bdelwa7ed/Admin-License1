import { Router, type Request, type Response } from "express";
import { authService } from "../services/auth";
import { requireAuth, validateBody } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { changePasswordSchema, loginSchema, logoutSchema, refreshSchema } from "../schemas";

/**
 * POST /api/v1/auth/login     — rate limited, issues token pair
 * POST /api/v1/auth/refresh    — rotation (old token consumed)
 * POST /api/v1/auth/logout     — revokes the refresh token
 * GET  /api/v1/auth/me         — current admin
 * POST /api/v1/auth/change-password
 */

export interface AuthRouteDeps {
  jwtSecret: string;
  rateLimits: { loginPerMinute: number; clientPerMinute: number };
}

export function authRoutes(deps: AuthRouteDeps): Router {
  const router = Router();

  router.post(
    "/login",
    rateLimit({ name: "login", limitPerMinute: deps.rateLimits.loginPerMinute }),
    validateBody(loginSchema),
    async (req: Request, res: Response) => {
      const { email, password } = req.body as { email: string; password: string };
      const { user, tokens } = await authService.login(email, password, { jwtSecret: deps.jwtSecret });
      res.json({
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    },
  );

  router.post("/refresh", validateBody(refreshSchema), async (req: Request, res: Response) => {
    const { refreshToken } = req.body as { refreshToken: string };
    const { user, tokens } = await authService.refresh(refreshToken, { jwtSecret: deps.jwtSecret });
    res.json({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  });

  router.post("/logout", validateBody(logoutSchema), async (req: Request, res: Response) => {
    const { refreshToken } = req.body as { refreshToken: string };
    await authService.logout(refreshToken);
    res.status(204).end();
  });

  router.get("/me", requireAuth({ jwtSecret: deps.jwtSecret }), async (req: Request, res: Response) => {
    res.json(await authService.me(req.user!.id));
  });

  router.post(
    "/change-password",
    requireAuth({ jwtSecret: deps.jwtSecret }),
    validateBody(changePasswordSchema),
    async (req: Request, res: Response) => {
      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };
      await authService.changePassword(req.user!.id, currentPassword, newPassword);
      res.status(204).end();
    },
  );

  return router;
}
