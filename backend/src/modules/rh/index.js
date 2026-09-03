import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import employesRouter from './employes.routes.js';
import congesRouter from './conges.routes.js';
import paiesRouter from './paies.routes.js';
import evaluationsRouter from './evaluations.routes.js';
import formationsRouter from './formations.routes.js';
import kpiRouter from './kpi.routes.js';
import rapportsActiviteRouter from './rapportsActivite.routes.js';
import postesRouter from './postes.routes.js';
import candidatsRouter from './candidats.routes.js';
import contratsRouter from './contrats.routes.js';
import checklistsRouter from './checklists.routes.js';
import pointageRouter from './pointage.routes.js';

const router = Router();
router.use(authenticate);

router.use('/kpi', kpiRouter);
router.use('/employes', employesRouter);
router.use('/conges', congesRouter);
router.use('/paies', paiesRouter);
router.use('/evaluations', evaluationsRouter);
router.use('/formations', formationsRouter);
router.use('/rapports-activite', rapportsActiviteRouter);
router.use('/postes', postesRouter);
router.use('/candidats', candidatsRouter);
router.use('/contrats', contratsRouter);
router.use('/checklists', checklistsRouter);
router.use('/pointage', pointageRouter);

export default router;
