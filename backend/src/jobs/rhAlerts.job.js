import cron from 'node-cron';
import { withTransaction } from '../db/pool.js';
import { notifyRole, notifyUser } from '../lib/notifications.js';

/** Échéance de contrat à J-7 exactement — pas de répétition, pas de colonne de suivi
 * nécessaire puisque la fenêtre d'égalité ne se déclenche qu'un seul jour. */
async function alertContratsEcheance(client) {
  const { rows } = await client.query(
    `SELECT c.numero, c.employe_id, e.nom, e.prenom
       FROM rh_contrats c JOIN rh_employes e ON e.id = c.employe_id
      WHERE c.statut = 'actif' AND c.date_fin = CURRENT_DATE + INTERVAL '7 days'`
  );
  for (const c of rows) {
    await notifyRole(client, {
      roleCode: 'direction',
      titre: 'Contrat arrivant à échéance',
      message: `Le contrat ${c.numero} de ${c.prenom} ${c.nom} arrive à échéance dans 7 jours.`,
      moduleCode: 'rh',
      entityType: 'contrat',
      // Pas de page de détail dédiée aux contrats : l'historique se consulte sur la fiche employé.
      entityId: c.employe_id,
      critique: true,
    });
  }
}

/** Rappel d'entretien à J-1. */
async function alertEntretiensDemain(client) {
  const { rows } = await client.query(
    `SELECT en.id, en.candidat_id, en.evaluateur_id, c.nom, c.prenom, p.titre AS poste_titre,
            emp.user_id AS evaluateur_user_id
       FROM rh_entretiens en
       JOIN rh_candidats c ON c.id = en.candidat_id
       JOIN rh_postes p ON p.id = c.poste_id
       LEFT JOIN rh_employes emp ON emp.id = en.evaluateur_id
      WHERE en.statut = 'planifie' AND en.date_entretien = CURRENT_DATE + INTERVAL '1 day'`
  );
  for (const en of rows) {
    const titre = 'Entretien prévu demain';
    const message = `Entretien avec ${en.prenom} ${en.nom} (${en.poste_titre}) prévu demain.`;
    if (en.evaluateur_user_id) {
      await notifyUser(client, { userId: en.evaluateur_user_id, titre, message, moduleCode: 'rh', entityType: 'entretien', entityId: en.candidat_id });
    } else {
      await notifyRole(client, { roleCode: 'direction', titre, message, moduleCode: 'rh', entityType: 'entretien', entityId: en.candidat_id });
    }
  }
}

/** Congé soumis depuis 2 jours sans décision — évite qu'une demande ne s'enlise. */
async function alertCongesEnAttente(client) {
  const { rows } = await client.query(
    `SELECT co.id, co.numero, e.nom, e.prenom
       FROM rh_conges co JOIN rh_employes e ON e.id = co.employe_id
      WHERE co.statut = 'soumise' AND co.updated_at::date = CURRENT_DATE - INTERVAL '2 days'`
  );
  for (const co of rows) {
    await notifyRole(client, {
      roleCode: 'direction',
      titre: 'Demande de congé en attente',
      message: `La demande de congé ${co.numero} de ${co.prenom} ${co.nom} est en attente depuis 2 jours.`,
      moduleCode: 'rh',
      entityType: 'conge',
      entityId: co.id,
      critique: true,
    });
  }
}

/** Checklist d'intégration non terminée 2 jours après l'arrivée. */
async function alertChecklistsIncompletes(client) {
  const { rows } = await client.query(
    `SELECT DISTINCT e.id, e.nom, e.prenom
       FROM rh_checklist_items ci
       JOIN rh_employes e ON e.id = ci.employe_id
      WHERE ci.type = 'arrivee' AND ci.checked = false AND e.date_embauche = CURRENT_DATE - INTERVAL '2 days'`
  );
  for (const e of rows) {
    await notifyRole(client, {
      roleCode: 'secretaire',
      titre: "Checklist d'intégration incomplète",
      message: `La checklist d'intégration de ${e.prenom} ${e.nom} n'est pas terminée 2 jours après son arrivée.`,
      moduleCode: 'rh',
      entityType: 'employe',
      entityId: e.id,
    });
  }
}

async function runDailyChecks() {
  await withTransaction(alertContratsEcheance);
  await withTransaction(alertEntretiensDemain);
  await withTransaction(alertCongesEnAttente);
  await withTransaction(alertChecklistsIncompletes);
}

export function registerRhAlertsJob() {
  cron.schedule('30 7 * * *', () => {
    runDailyChecks().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[jobs] échec alertes RH quotidiennes', err.message);
    });
  });
}

export { runDailyChecks };
