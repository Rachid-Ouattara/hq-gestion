import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import categoriesRouter from './categories.routes.js';
import articlesRouter from './articles.routes.js';
import mouvementsRouter from './mouvements.routes.js';
import inventairesRouter from './inventaires.routes.js';
import kpiRouter from './kpi.routes.js';

const router = Router();
router.use(authenticate);

router.use('/kpi', kpiRouter);
router.use('/categories', categoriesRouter);
router.use('/articles', articlesRouter);
router.use('/mouvements', mouvementsRouter);
router.use('/inventaires', inventairesRouter);

export default router;
