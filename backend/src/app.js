import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import rolesRoutes from './modules/roles/roles.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import attachmentsRoutes from './modules/attachments/attachments.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import reportingRoutes from './modules/reporting/reporting.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import businessRoutes, { validationsRouter } from './modules/business/business.routes.js';
import achatsRoutes from './modules/achats/index.js';
import stocksRoutes from './modules/stocks/index.js';
import administrativeRoutes from './modules/administrative/index.js';
import rhRoutes from './modules/rh/index.js';
import rhGoogleAuthRoutes from './modules/rh/googleAuth.routes.js';
import rhPublicRoutes from './modules/rh/public.routes.js';
import financeRoutes from './modules/finance/index.js';
import commercialRoutes from './modules/commercial/index.js';
import formationRoutes from './modules/formation/index.js';
import prospectionRoutes from './modules/prospection/index.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());
  app.set('trust proxy', 1);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'hq-gestion' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/roles', rolesRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/attachments', attachmentsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/reporting', reportingRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/modules', businessRoutes);
  app.use('/api/validations', validationsRouter);
  app.use('/api/achats', achatsRoutes);
  app.use('/api/stocks', stocksRoutes);
  app.use('/api/administrative', administrativeRoutes);
  app.use('/api/public/recrutement', rhPublicRoutes);
  // Doit être monté avant /api/rh : son /callback (redirection Google) ne peut
  // pas passer par le `router.use(authenticate)` global de rh/index.js.
  app.use('/api/rh/google', rhGoogleAuthRoutes);
  app.use('/api/rh', rhRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/commercial', commercialRoutes);
  app.use('/api/formation', formationRoutes);
  app.use('/api/prospection', prospectionRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
