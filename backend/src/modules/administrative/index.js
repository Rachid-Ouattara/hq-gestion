import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import archivesRouter from './archives.routes.js';
import courrierRouter from './courrier.routes.js';
import documentsRouter from './documents.routes.js';
import agendaRouter from './agenda.routes.js';
import notesRouter from './notes.routes.js';
import kpiRouter from './kpi.routes.js';

const router = Router();
router.use(authenticate);

router.use('/kpi', kpiRouter);
router.use('/archives', archivesRouter);
router.use('/courrier', courrierRouter);
router.use('/documents', documentsRouter);
router.use('/agenda', agendaRouter);
router.use('/notes', notesRouter);

export default router;
