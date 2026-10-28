import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import comptesRouter from './comptes.routes.js';
import recettesRouter from './recettes.routes.js';
import depensesRouter from './depenses.routes.js';
import budgetsRouter from './budgets.routes.js';
import rapportsRouter from './rapports.routes.js';
import kpiRouter from './kpi.routes.js';
import previsionsRouter from './previsions.routes.js';
import tresorerieRouter from './tresorerie.routes.js';
import creancesRouter from './creances.routes.js';
import dettesRouter from './dettes.routes.js';
import engagementsRouter from './engagements.routes.js';
import chargesRecurrentesRouter from './chargesRecurrentes.routes.js';

const router = Router();
router.use(authenticate);

router.use('/kpi', kpiRouter);
router.use('/comptes', comptesRouter);
router.use('/recettes', recettesRouter);
router.use('/depenses', depensesRouter);
router.use('/budgets', budgetsRouter);
router.use('/rapports', rapportsRouter);
router.use('/previsions', previsionsRouter);
router.use('/tresorerie', tresorerieRouter);
router.use('/creances', creancesRouter);
router.use('/dettes', dettesRouter);
router.use('/engagements', engagementsRouter);
router.use('/charges-recurrentes', chargesRecurrentesRouter);

export default router;
