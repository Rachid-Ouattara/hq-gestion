import cron from 'node-cron';
import { withTransaction } from '../db/pool.js';
import { notifyRole } from '../lib/notifications.js';

/** Créances clients dont l'échéance est dépassée (facture non soldée) —
 * rappel quotidien tant que la facture reste en retard (pas de colonne de
 * suivi : la condition WHERE elle-même empêche les doublons une fois payée). */
async function alertCreancesEnRetard(client) {
  const { rows } = await client.query(
    `SELECT f.id, f.numero, f.echeance, c.nom AS client_nom
       FROM commercial_factures f
       JOIN commercial_clients c ON c.id = f.client_id
       LEFT JOIN (SELECT facture_id, SUM(montant) AS total_encaisse FROM commercial_encaissements GROUP BY facture_id) enc
         ON enc.facture_id = f.id
      WHERE f.statut != 'annulee' AND f.echeance < CURRENT_DATE
        AND f.montant_total - COALESCE(enc.total_encaisse, 0) > 0`
  );
  for (const f of rows) {
    await notifyRole(client, {
      roleCode: 'direction',
      titre: 'Créance client en retard',
      message: `La facture ${f.numero} (${f.client_nom}) a dépassé son échéance et n'est pas totalement encaissée.`,
      moduleCode: 'finance',
      entityType: 'facture',
      entityId: f.id,
      critique: true,
    });
  }
}

/** Créances arrivant à échéance dans 7 jours — rappel unique (déclenchement
 * exact à J-7, comme le rappel documents administratifs). */
async function alertCreancesEcheanceProche(client) {
  const { rows } = await client.query(
    `SELECT f.id, f.numero, c.nom AS client_nom
       FROM commercial_factures f
       JOIN commercial_clients c ON c.id = f.client_id
       LEFT JOIN (SELECT facture_id, SUM(montant) AS total_encaisse FROM commercial_encaissements GROUP BY facture_id) enc
         ON enc.facture_id = f.id
      WHERE f.statut != 'annulee' AND f.echeance = CURRENT_DATE + 7
        AND f.montant_total - COALESCE(enc.total_encaisse, 0) > 0`
  );
  for (const f of rows) {
    await notifyRole(client, {
      roleCode: 'secretaire',
      titre: 'Créance client à échéance proche',
      message: `La facture ${f.numero} (${f.client_nom}) arrive à échéance dans 7 jours.`,
      moduleCode: 'finance',
      entityType: 'facture',
      entityId: f.id,
    });
  }
}

/** Dettes fournisseurs dont l'échéance est dépassée (bon de commande non soldé). */
async function alertDettesEnRetard(client) {
  const { rows } = await client.query(
    `SELECT b.id, b.numero, f.nom AS fournisseur_nom
       FROM bons_de_commande b
       JOIN fournisseurs f ON f.id = b.fournisseur_id
       LEFT JOIN (SELECT bon_id, SUM(montant) AS total_paye FROM paiements GROUP BY bon_id) pai
         ON pai.bon_id = b.id
      WHERE b.statut != 'annule' AND b.echeance < CURRENT_DATE
        AND b.montant_total - COALESCE(pai.total_paye, 0) > 0`
  );
  for (const b of rows) {
    await notifyRole(client, {
      roleCode: 'direction',
      titre: 'Dette fournisseur en retard',
      message: `Le bon de commande ${b.numero} (${b.fournisseur_nom}) a dépassé son échéance de paiement.`,
      moduleCode: 'finance',
      entityType: 'bon_commande',
      entityId: b.id,
      critique: true,
    });
  }
}

/** Dettes fournisseurs arrivant à échéance dans 7 jours. */
async function alertDettesEcheanceProche(client) {
  const { rows } = await client.query(
    `SELECT b.id, b.numero, f.nom AS fournisseur_nom
       FROM bons_de_commande b
       JOIN fournisseurs f ON f.id = b.fournisseur_id
       LEFT JOIN (SELECT bon_id, SUM(montant) AS total_paye FROM paiements GROUP BY bon_id) pai
         ON pai.bon_id = b.id
      WHERE b.statut != 'annule' AND b.echeance = CURRENT_DATE + 7
        AND b.montant_total - COALESCE(pai.total_paye, 0) > 0`
  );
  for (const b of rows) {
    await notifyRole(client, {
      roleCode: 'secretaire',
      titre: 'Dette fournisseur à échéance proche',
      message: `Le bon de commande ${b.numero} (${b.fournisseur_nom}) arrive à échéance de paiement dans 7 jours.`,
      moduleCode: 'finance',
      entityType: 'bon_commande',
      entityId: b.id,
    });
  }
}

const CHECKS = [
  ['alertCreancesEnRetard', alertCreancesEnRetard],
  ['alertCreancesEcheanceProche', alertCreancesEcheanceProche],
  ['alertDettesEnRetard', alertDettesEnRetard],
  ['alertDettesEcheanceProche', alertDettesEcheanceProche],
];

async function runDailyChecks() {
  for (const [name, check] of CHECKS) {
    try {
      await withTransaction(check);
    } catch (err) {
      // Une vérification en échec ne doit pas empêcher les suivantes de tourner.
      // eslint-disable-next-line no-console
      console.error(`[jobs] échec alerte financière « ${name} »`, err.message);
    }
  }
}

export function registerFinanceAlertsJob() {
  cron.schedule('0 8 * * *', () => {
    runDailyChecks().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[jobs] échec alertes financières quotidiennes', err.message);
    });
  });
}

export { runDailyChecks };
