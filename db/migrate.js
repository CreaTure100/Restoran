const fs = require('fs');
const path = require('path');
const { closePool, query } = require('./index');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await query(sql);
    console.log(`Applied migration: ${file}`);
  }
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Migration failed:', error);
      await closePool();
      process.exit(1);
    });
}

module.exports = { runMigrations };
