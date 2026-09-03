import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { join } from 'node:path';
import { asyncHandler, badRequest, notFound } from '../../lib/http.js';
import { query, withTransaction } from '../../db/pool.js';
import { notifyRole } from '../../lib/notifications.js';
import { candidaturePubliqueSchema } from './rh.schemas.js';
import { uploadPublic, unlink, UPLOAD_DIR } from '../attachments/storage.js';

const router = Router();

const candidatureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Trop de candidatures envoyées depuis cette adresse, réessayez plus tard.' },
});

/** Un poste n'est visible publiquement que s'il est explicitement publié ET
 * encore ouvert — même réponse (404) qu'il n'existe pas, soit dépublié, soit
 * clôturé : ne jamais laisser deviner l'état interne d'une offre. */
async function loadPublicPoste(posteId) {
  const { rows } = await query(
    `SELECT id, numero, titre, departement, type_contrat, description, nombre_postes
       FROM rh_postes WHERE id = $1 AND avis_publie = true AND statut = 'ouvert'`,
    [posteId]
  );
  return rows[0] || null;
}

router.get(
  '/:posteId',
  asyncHandler(async (req, res) => {
    const poste = await loadPublicPoste(req.params.posteId);
    if (!poste) throw notFound('Offre introuvable');
    res.json(poste);
  })
);

router.get(
  '/:posteId/documents',
  asyncHandler(async (req, res) => {
    const poste = await loadPublicPoste(req.params.posteId);
    if (!poste) throw notFound('Offre introuvable');
    const { rows } = await query(
      `SELECT id, nom_original, type_mime, taille_octets, created_at
         FROM pieces_jointes WHERE module_code = 'rh' AND entity_type = 'poste' AND entity_id = $1
        ORDER BY created_at DESC`,
      [poste.id]
    );
    res.json(rows);
  })
);

router.get(
  '/:posteId/documents/:pieceId/download',
  asyncHandler(async (req, res) => {
    const poste = await loadPublicPoste(req.params.posteId);
    if (!poste) throw notFound('Offre introuvable');
    const { rows } = await query(
      `SELECT * FROM pieces_jointes WHERE id = $1 AND module_code = 'rh' AND entity_type = 'poste' AND entity_id = $2`,
      [req.params.pieceId, poste.id]
    );
    if (!rows[0]) throw notFound('Document introuvable');
    res.download(join(UPLOAD_DIR, rows[0].chemin_stockage), rows[0].nom_original, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'not_found', message: 'Fichier introuvable sur le serveur' });
    });
  })
);

router.post(
  '/:posteId/candidater',
  candidatureLimiter,
  uploadPublic.array('documents', 5),
  asyncHandler(async (req, res) => {
    const cleanupFiles = () => Promise.all((req.files || []).map((f) => unlink(f.path).catch(() => {})));

    // Champ honeypot : invisible pour un humain, rempli par la plupart des robots —
    // rejet silencieux (succès factice) pour ne pas leur signaler le filtrage.
    if (req.body?.site_web) {
      await cleanupFiles();
      return res.status(201).json({ ok: true });
    }

    const poste = await loadPublicPoste(req.params.posteId);
    if (!poste) {
      await cleanupFiles();
      throw notFound('Offre introuvable');
    }

    const parsed = candidaturePubliqueSchema.safeParse(req.body);
    if (!parsed.success) {
      await cleanupFiles();
      throw badRequest('Nom, prénom et e-mail valides requis');
    }
    const c = parsed.data;

    let candidat;
    try {
      candidat = await withTransaction(async (client) => {
        const { rows } = await client.query(
          `INSERT INTO rh_candidats (poste_id, nom, prenom, email, telephone, source)
           VALUES ($1,$2,$3,$4,$5,'Lien public')
           RETURNING *`,
          [poste.id, c.nom, c.prenom, c.email, c.telephone || null]
        );
        const candidatRow = rows[0];

        for (const file of req.files || []) {
          await client.query(
            `INSERT INTO pieces_jointes (module_code, entity_type, entity_id, nom_original, chemin_stockage, type_mime, taille_octets, uploaded_by)
             VALUES ('rh','candidat',$1,$2,$3,$4,$5,NULL)`,
            [candidatRow.id, file.originalname, file.filename, file.mimetype, file.size]
          );
        }

        await notifyRole(client, {
          roleCode: 'direction',
          titre: 'Nouvelle candidature (lien public)',
          message: `${c.prenom} ${c.nom} a postulé pour « ${poste.titre} » via le lien public.`,
          moduleCode: 'rh',
          entityType: 'candidat',
          entityId: candidatRow.id,
        });

        return candidatRow;
      });
    } catch (err) {
      await cleanupFiles();
      throw err;
    }

    res.status(201).json({ ok: true, numero: candidat.numero });
  })
);

export default router;
