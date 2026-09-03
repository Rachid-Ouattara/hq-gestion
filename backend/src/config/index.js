import dotenv from 'dotenv';

dotenv.config();

const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    // eslint-disable-next-line no-console
    console.warn(`[config] Variable d'environnement manquante: ${key}`);
  }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh',
    accessTtl: Number(process.env.ACCESS_TOKEN_TTL || 900), // secondes
    refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  },
  seed: {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@hq.bf',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@2026',
    name: process.env.SEED_ADMIN_NAME || 'Administrateur HQ',
  },
  webOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || 'HQ Gestion <no-reply@headquaters.org>',
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
    privateKey: process.env.VAPID_PRIVATE_KEY || null,
    subject: process.env.VAPID_SUBJECT || 'mailto:contact@headquaters.org',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || null,
  },
};
