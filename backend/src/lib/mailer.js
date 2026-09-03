import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

function resetEmailHtml({ fullName, resetUrl }) {
  return `
  <div style="background:#EAFBFC;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#0B1220;padding:24px 32px;">
        <span style="color:#F5931D;font-weight:700;font-size:20px;">hq</span>
        <span style="color:#ffffff;font-weight:700;font-size:20px;">Gestion</span>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="color:#0B1220;font-size:16px;margin:0 0 16px;">Bonjour ${fullName || ''},</p>
        <p style="color:#3A4356;font-size:14px;line-height:1.6;margin:0 0 24px;">
          Une demande de réinitialisation de mot de passe a été effectuée pour votre compte HQ Gestion.
          Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans 1 heure.
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:#F5931D;color:#ffffff;text-decoration:none;
           font-weight:600;font-size:14px;padding:12px 28px;border-radius:999px;">Réinitialiser mon mot de passe</a>
        <p style="color:#8994AC;font-size:12px;line-height:1.6;margin:24px 0 0;">
          Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail — votre mot de passe reste inchangé.
        </p>
      </td></tr>
    </table>
  </div>`;
}

export async function sendPasswordResetEmail({ to, fullName, resetUrl }) {
  if (!transporter) {
    // eslint-disable-next-line no-console
    console.warn(`[mailer] SMTP non configuré — lien de réinitialisation pour ${to} : ${resetUrl}`);
    return;
  }
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: 'Réinitialisation de votre mot de passe HQ Gestion',
    html: resetEmailHtml({ fullName, resetUrl }),
  });
}

function notificationEmailHtml({ fullName, titre, message, actionUrl }) {
  return `
  <div style="background:#EAFBFC;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#0B1220;padding:24px 32px;">
        <span style="color:#F5931D;font-weight:700;font-size:20px;">hq</span>
        <span style="color:#ffffff;font-weight:700;font-size:20px;">Gestion</span>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="color:#0B1220;font-size:16px;margin:0 0 16px;">Bonjour ${fullName || ''},</p>
        <p style="color:#0B1220;font-size:15px;font-weight:700;margin:0 0 8px;">${titre}</p>
        <p style="color:#3A4356;font-size:14px;line-height:1.6;margin:0 0 24px;">${message}</p>
        <a href="${actionUrl}" style="display:inline-block;background:#F5931D;color:#ffffff;text-decoration:none;
           font-weight:600;font-size:14px;padding:12px 28px;border-radius:999px;">Voir dans HQ Gestion</a>
        <p style="color:#8994AC;font-size:12px;line-height:1.6;margin:24px 0 0;">
          Vous recevez cet e-mail car cette notification a été marquée critique dans HQ Gestion.
        </p>
      </td></tr>
    </table>
  </div>`;
}

/** Envoi de secours pour les notifications marquées `critique` — même repli console
 * que `sendPasswordResetEmail` si le SMTP n'est pas configuré. */
export async function sendNotificationEmail({ to, fullName, titre, message, actionUrl }) {
  if (!transporter) {
    // eslint-disable-next-line no-console
    console.warn(`[mailer] SMTP non configuré — notification critique pour ${to} : ${titre}`);
    return;
  }
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: `HQ Gestion — ${titre}`,
    html: notificationEmailHtml({ fullName, titre, message, actionUrl }),
  });
}

function entretienEmailHtml({ fullName, posteTitle, date, heureDebut, meetLink, mode }) {
  const dateLabel = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `
  <div style="background:#EAFBFC;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#0B1220;padding:24px 32px;">
        <span style="color:#F5931D;font-weight:700;font-size:20px;">hq</span>
        <span style="color:#ffffff;font-weight:700;font-size:20px;">Gestion</span>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="color:#0B1220;font-size:16px;margin:0 0 16px;">Bonjour ${fullName || ''},</p>
        <p style="color:#3A4356;font-size:14px;line-height:1.6;margin:0 0 16px;">
          Votre entretien pour le poste <strong>${posteTitle}</strong> est confirmé :
        </p>
        <p style="color:#0B1220;font-size:15px;font-weight:700;margin:0 0 4px;">${dateLabel}${heureDebut ? ` à ${heureDebut.slice(0, 5)}` : ''}</p>
        <p style="color:#3A4356;font-size:14px;margin:0 0 24px;">${mode === 'visio' ? 'Entretien en visioconférence' : 'Entretien en présentiel'}</p>
        ${meetLink ? `<a href="${meetLink}" style="display:inline-block;background:#F5931D;color:#ffffff;text-decoration:none;
           font-weight:600;font-size:14px;padding:12px 28px;border-radius:999px;">Rejoindre sur Google Meet</a>` : ''}
        <p style="color:#8994AC;font-size:12px;line-height:1.6;margin:24px 0 0;">
          Pour toute question, répondez directement à cet e-mail.
        </p>
      </td></tr>
    </table>
  </div>`;
}

export async function sendEntretienInvitationEmail({ to, fullName, posteTitle, date, heureDebut, meetLink, mode }) {
  if (!transporter) {
    // eslint-disable-next-line no-console
    console.warn(`[mailer] SMTP non configuré — invitation entretien pour ${to} (${posteTitle}, ${date}${meetLink ? `, ${meetLink}` : ''})`);
    return;
  }
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: `Entretien — ${posteTitle} — HQ Gestion`,
    html: entretienEmailHtml({ fullName, posteTitle, date, heureDebut, meetLink, mode }),
  });
}
