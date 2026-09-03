import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { asyncHandler, badRequest } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';
import { loadPermissions } from '../../middleware/rbac.js';
import * as service from './auth.service.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Trop de tentatives, réessayez plus tard.' },
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Email et mot de passe requis');
    const result = await service.login({ ...parsed.data, ip: req.ip });
    res.json(result);
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const result = await service.refresh({ refreshToken: req.body?.refreshToken });
    res.json(result);
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await service.logout({ refreshToken: req.body?.refreshToken });
    res.json({ ok: true });
  })
);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  asyncHandler(async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('E-mail requis');
    await service.forgotPassword(parsed.data);
    // Réponse identique que le compte existe ou non : n'expose jamais son existence.
    res.json({ ok: true });
  })
);

router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Lien invalide et mot de passe (min. 8 caractères) requis');
    await service.resetPassword(parsed.data);
    res.json({ ok: true });
  })
);

// Profil courant + permissions (pour piloter la navigation front)
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const permissions = await loadPermissions(req.user.role_id);
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        full_name: req.user.full_name,
        role: req.user.role_code,
        is_staff: req.user.is_staff,
      },
      permissions,
    });
  })
);

export default router;
