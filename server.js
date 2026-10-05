const { app, shutdownResources } = require('./app');

const port = Number(process.env.PORT || 3001);

let server;

function startServer() {
  server = app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
  });
  return server;
}

async function gracefulShutdown(signal) {
  console.log(`Получен сигнал ${signal}, завершаю работу...`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await shutdownResources();
  process.exit(0);
}

if (require.main === module) {
  startServer();
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

module.exports = { app, startServer };
