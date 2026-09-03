import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import ecolesRouter from './ecoles.routes.js';
import equipementsRouter from './equipements.routes.js';
import chapitresRouter from './chapitres.routes.js';
import campsRouter from './camps.routes.js';
import formateursRouter from './formateurs.routes.js';
import seancesRouter from './seances.routes.js';
import rapportsCoursRouter from './rapportsCours.routes.js';
import maintenanceRouter from './maintenance.routes.js';
import kpiRouter from './kpi.routes.js';

const router = Router();
router.use(authenticate);

router.use('/kpi', kpiRouter);
router.use('/ecoles', ecolesRouter);
router.use('/equipements', equipementsRouter);
router.use('/chapitres', chapitresRouter);
router.use('/camps', campsRouter);
router.use('/formateurs', formateursRouter);
router.use('/seances', seancesRouter);
router.use('/rapports-cours', rapportsCoursRouter);
router.use('/maintenance', maintenanceRouter);

export default router;
