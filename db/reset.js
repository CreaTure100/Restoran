const pool = require('./pool');
const { migrate } = require('./migrate');
const { seedDatabase } = require('./seed');

async function resetDatabase() {
  await migrate();
  await seedDatabase({ force: true });
}

if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log('Database reset completed');
      return pool.end();
    })
    .catch((error) => {
      console.error('Database reset failed', error);
      process.exitCode = 1;
    });
}

module.exports = { resetDatabase };
