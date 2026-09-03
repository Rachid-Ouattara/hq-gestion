import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import campagnesRouter from './campagnes.routes.js';
import groupesRouter from './groupes.routes.js';
import ecolesCiblesRouter from './ecolesCibles.routes.js';
import rapportsRouter from './rapports.routes.js';
import kpiRouter from './kpi.routes.js';

const router = Router();
router.use(authenticate);

router.use('/kpi', kpiRouter);
router.use('/campagnes', campagnesRouter);
router.use('/groupes', groupesRouter);
router.use('/ecoles-cibles', ecolesCiblesRouter);
router.use('/rapports', rapportsRouter);

export default router;
