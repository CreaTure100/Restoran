const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Database migrations completed');
      return pool.end();
    })
    .catch((error) => {
      console.error('Migration failed', error);
      process.exitCode = 1;
    });
}

module.exports = { migrate };
