module.exports = {
  apps: [
    {
      name: 'rof-server',
      script: 'server.js',
      cwd: '/var/www/rof-app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3005
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3005
      },
      // Logging
      error_file: '/var/log/pm2/rof-error.log',
      out_file: '/var/log/pm2/rof-out.log',
      log_file: '/var/log/pm2/rof-combined.log',
      time: true,
      // Restart settings
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};