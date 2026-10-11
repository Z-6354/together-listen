/** PM2 进程描述：崩溃自动拉起、后台常驻 */
module.exports = {
  apps: [
    {
      name: "together-listen",
      script: "server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      /* 2G 小机双人用：200M 易误触发重启导致断连，512M 更稳 */
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--max-old-space-size=448",
        PORT: 3847,
        PUBLIC_SITE_ORIGIN: "https://wannian.fun",
        SOCKET_CORS_RELAXED: "1",
        /** 管理调试页 /admin.html 令牌，务必改为随机长字符串 */
        ADMIN_TOKEN: "",
      },
    },
  ],
};
