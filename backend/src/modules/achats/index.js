import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import fournisseursRouter from './fournisseurs.routes.js';
import demandesRouter from './demandes.routes.js';
import bonsRouter from './bonsDeCommande.routes.js';
import receptionsRouter from './receptions.routes.js';
import paiementsRouter from './paiements.routes.js';
import kpiRouter from './kpi.routes.js';

const router = Router();
router.use(authenticate);

router.use('/kpi', kpiRouter);
router.use('/fournisseurs', fournisseursRouter);
router.use('/demandes', demandesRouter);
router.use('/bons-de-commande', bonsRouter);
router.use('/receptions', receptionsRouter);
router.use('/paiements', paiementsRouter);

export default router;
