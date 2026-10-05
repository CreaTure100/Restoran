const { query, closePool } = require('./index');
const { runSeed } = require('./seed');

async function resetDatabase() {
  await query('TRUNCATE TABLE refresh_tokens, order_items, orders, bookings, restaurant_tables, menu_items, users RESTART IDENTITY CASCADE');
  await runSeed();
}

if (require.main === module) {
  resetDatabase()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Reset failed:', error);
      await closePool();
      process.exit(1);
    });
}

module.exports = { resetDatabase };
