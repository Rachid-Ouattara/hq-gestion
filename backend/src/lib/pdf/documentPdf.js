import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__dirname, '..', '..', '..', '..', 'web', 'public', 'logo.jpg');

// `toLocaleString('fr-FR')` insère un espace fine insécable (U+202F) comme
// séparateur de milliers — absent de l'encodage WinAnsi des polices standard
// de pdfkit (Helvetica), ce qui l'affiche comme un caractère incorrect ("/").
// On formate donc à la main avec un espace ASCII normal.
export function formatNumber(n, { decimals = 0 } = {}) {
  const fixed = Number(n).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart ? `${grouped},${decPart}` : grouped;
}

export function money(n) {
  return formatNumber(n, { decimals: 2 }) + ' FCFA';
}

export function newDocument() {
  return new PDFDocument({ size: 'A4', margin: 50 });
}

/**
 * Dessine le logo + le bloc coordonnées de l'entreprise en haut du
 * document, puis le titre/numéro du document à droite. Retourne le y
 * auquel continuer le reste de la mise en page.
 */
export function drawLetterhead(doc, entreprise, { titre, numero, date }) {
  const top = doc.y;
  try {
    doc.image(LOGO_PATH, 50, top, { width: 48 });
  } catch {
    // Logo introuvable (environnement de build différent) : on continue sans.
  }

  doc.font('Helvetica-Bold').fontSize(13).fillColor('#000').text(entreprise.nom_legal || 'Headquarters', 105, top, { width: 250 });
  doc.font('Helvetica').fontSize(9).fillColor('#555');
  const lignesEntreprise = [entreprise.adresse, entreprise.telephone, entreprise.email, entreprise.numero_fiscal ? `IFU : ${entreprise.numero_fiscal}` : null].filter(Boolean);
  doc.text(lignesEntreprise.join('\n'), 105, top + 18, { width: 250 });
  const afterEntreprise = doc.y;
  doc.fillColor('#000');

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#000').text(titre, 300, top, { width: 245, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor('#555');
  doc.text(numero, 300, top + 22, { width: 245, align: 'right' });
  if (date) doc.text(date, 300, top + 36, { width: 245, align: 'right' });
  doc.fillColor('#000');

  const bottom = Math.max(afterEntreprise, top + 90) + 10;
  doc.moveTo(50, bottom).lineTo(545, bottom).strokeColor('#ddd').stroke();
  doc.y = bottom + 15;
  return doc.y;
}

/** Bloc destinataire (client/fournisseur) — nom, contact, adresse, téléphone, email, IFU. */
export function drawDestinataire(doc, { label, tiers }) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#888').text(label.toUpperCase(), 50, doc.y);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(tiers.nom, 50, doc.y + 3);
  doc.font('Helvetica').fontSize(9).fillColor('#555');
  const lignes = [tiers.contact_nom, tiers.adresse, tiers.telephone, tiers.email, tiers.numero_fiscal ? `IFU : ${tiers.numero_fiscal}` : null].filter(Boolean);
  if (lignes.length) doc.text(lignes.join('\n'), 50, doc.y + 2, { width: 300 });
  doc.fillColor('#000');
  doc.moveDown(1.5);
}

/** Tableau des lignes (désignation/qté/PU/montant), commun devis/factures/bons. */
export function drawLignesTable(doc, lignes) {
  const colX = { designation: 50, qte: 320, pu: 390, montant: 475 };
  const rowH = 20;

  const header = () => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#888');
    doc.text('DÉSIGNATION', colX.designation, y);
    doc.text('QTÉ', colX.qte, y, { width: 50, align: 'right' });
    doc.text('PU', colX.pu, y, { width: 70, align: 'right' });
    doc.text('MONTANT', colX.montant, y, { width: 70, align: 'right' });
    doc.y = y + 14;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
    doc.y += 6;
    doc.fillColor('#000');
  };

  header();
  for (const l of lignes) {
    if (doc.y > 700) {
      doc.addPage();
      doc.y = 50;
      header();
    }
    const y = doc.y;
    doc.font('Helvetica').fontSize(10);
    doc.text(l.designation, colX.designation, y, { width: 260 });
    doc.text(`${l.quantite}${l.unite ? ' ' + l.unite : ''}`, colX.qte, y, { width: 65, align: 'right', lineBreak: false });
    doc.text(formatNumber(l.prix_unitaire), colX.pu, y, { width: 80, align: 'right', lineBreak: false });
    doc.text(formatNumber(l.montant), colX.montant, y, { width: 65, align: 'right', lineBreak: false });
    doc.y = y + rowH;
  }
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
  doc.moveDown(0.5);
}

export function drawTotal(doc, label, montant, { bold = true } = {}) {
  const y = doc.y;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).fillColor('#000');
  doc.text(label, 290, y, { width: 115 });
  // width généreux + lineBreak désactivé : le montant + « FCFA » ne doit
  // jamais passer à la ligne (sinon il chevauche la ligne de total suivante).
  doc.text(money(montant), 405, y, { width: 140, align: 'right', lineBreak: false });
  doc.y = y + 16;
}

export { PDFDocument };
