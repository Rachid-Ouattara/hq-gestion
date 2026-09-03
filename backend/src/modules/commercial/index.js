import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import clientsRouter from './clients.routes.js';
import devisRouter from './devis.routes.js';
import commandesRouter from './commandes.routes.js';
import facturesRouter from './factures.routes.js';
import encaissementsRouter from './encaissements.routes.js';
import kpiRouter from './kpi.routes.js';

const router = Router();
router.use(authenticate);

router.use('/kpi', kpiRouter);
router.use('/clients', clientsRouter);
router.use('/devis', devisRouter);
router.use('/commandes', commandesRouter);
router.use('/factures', facturesRouter);
router.use('/encaissements', encaissementsRouter);

export default router;
