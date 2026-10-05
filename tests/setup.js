process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret';
process.env.REFRESH_SECRET = process.env.REFRESH_SECRET || 'test-refresh-secret';
process.env.ACCESS_EXPIRES_IN = process.env.ACCESS_EXPIRES_IN || '45m';
process.env.REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || '1d';
process.env.AUTO_MIGRATE = 'false';
process.env.AUTO_SEED = 'false';
