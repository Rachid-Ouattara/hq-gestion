module.exports = {
  apps: [
    {
      name: 'hq-gestion-api',
      cwd: __dirname + '/../backend',
      script: 'src/server.js',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
