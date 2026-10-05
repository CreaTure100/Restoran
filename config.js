require('dotenv').config();

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || '******localhost:5432/restoran',
  jwtSecret: process.env.JWT_SECRET || 'change-me-access-secret',
  refreshSecret: process.env.REFRESH_SECRET || 'change-me-refresh-secret',
  accessExpiresIn: process.env.ACCESS_EXPIRES_IN || '45m',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '1d',
  autoMigrate: (process.env.AUTO_MIGRATE || 'true') === 'true',
  autoSeed: (process.env.AUTO_SEED || 'true') === 'true',
};

module.exports = config;
