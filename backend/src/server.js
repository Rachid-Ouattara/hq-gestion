import { createApp } from './app.js';
import { config } from './config/index.js';
import { startListening } from './realtime/notificationDispatcher.js';
import { registerRhAlertsJob } from './jobs/rhAlerts.job.js';
import { registerAdministrativeAlertsJob } from './jobs/administrativeAlerts.job.js';
import { registerFinanceAlertsJob } from './jobs/financeAlerts.job.js';

const app = createApp();

app.listen(config.port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`API HQ Gestion démarrée sur http://localhost:${config.port} (${config.env})`);
});

startListening();
registerRhAlertsJob();
registerAdministrativeAlertsJob();
registerFinanceAlertsJob();
