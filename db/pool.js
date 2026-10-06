const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  connectionString: config.databaseUrl,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL client error', error);
});

module.exports = pool;
