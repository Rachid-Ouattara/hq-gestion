import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import comptesRouter from './comptes.routes.js';
import recettesRouter from './recettes.routes.js';
import depensesRouter from './depenses.routes.js';
import budgetsRouter from './budgets.routes.js';
import rapportsRouter from './rapports.routes.js';
import kpiRouter from './kpi.routes.js';

const router = Router();
router.use(authenticate);

router.use('/kpi', kpiRouter);
router.use('/comptes', comptesRouter);
router.use('/recettes', recettesRouter);
router.use('/depenses', depensesRouter);
router.use('/budgets', budgetsRouter);
router.use('/rapports', rapportsRouter);

export default router;
