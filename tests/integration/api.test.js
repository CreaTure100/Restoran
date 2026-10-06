const request = require('supertest');
const { describe, it, beforeAll, afterAll, expect } = require('vitest');

const hasTestDb = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_TEST);

if (!hasTestDb) {
  describe.skip('integration api tests', () => {
    it('requires DATABASE_URL or DATABASE_URL_TEST', () => {});
  });
} else {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  process.env.AUTO_MIGRATE = 'false';
  process.env.AUTO_SEED = 'false';

  const { app } = require('../../server');
  const pool = require('../../db/pool');
  const { migrate } = require('../../db/migrate');
  const { seedDatabase } = require('../../db/seed');

  const auth = {};

  const authHeader = (token) => ({ Authorization: `Token ${token}` });

  const login = async (email, password) => {
    const response = await request(app).post('/api/auth/login').send({ email, password });
    return response.body.accessToken;
  };

  describe('integration api tests', () => {
    beforeAll(async () => {
      await migrate();
      await seedDatabase({ force: true });

      auth.client = await login('client@example.com', 'client123');
      auth.waiter = await login('waiter@restaurant.com', 'waiter123');
      auth.chef = await login('chef@restaurant.com', 'chef123');
      auth.admin = await login('admin@restaurant.com', 'admin123');
    });

    afterAll(async () => {
      await pool.end();
    });

    it('register/login/refresh/logout flow works', async () => {
      const registerResponse = await request(app).post('/api/auth/register').send({
        name: 'Тестовый клиент',
        email: '  NEWCLIENT@EXAMPLE.COM ',
        password: '123456',
      });
      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.email).toBe('newclient@example.com');

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'newclient@example.com',
        password: '123456',
      });
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.refreshToken).toBeTruthy();

      const refreshResponse = await request(app).post('/api/auth/refresh').send({
        refreshToken: loginResponse.body.refreshToken,
      });
      expect(refreshResponse.status).toBe(200);

      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set(authHeader(loginResponse.body.accessToken))
        .send({ refreshToken: refreshResponse.body.refreshToken });
      expect(logoutResponse.status).toBe(200);
    });

    it('keeps public menu and role checks', async () => {
      const menuPublic = await request(app).get('/api/menu');
      expect(menuPublic.status).toBe(200);
      expect(menuPublic.body.length).toBeGreaterThan(0);

      const adminOnly = await request(app).get('/api/users').set(authHeader(auth.client));
      expect(adminOnly.status).toBe(403);
    });

    it('blocks overlapping bookings and requires booking for order', async () => {
      const firstBooking = await request(app)
        .post('/api/tables/1/book')
        .set(authHeader(auth.client))
        .send({ timeSlot: '13:00-14:00' });
      expect(firstBooking.status).toBe(200);

      const overlapBooking = await request(app)
        .post('/api/tables/1/book')
        .set(authHeader(auth.client))
        .send({ timeSlot: '13:30-14:30' });
      expect(overlapBooking.status).toBe(400);

      const noBookingOrder = await request(app)
        .post('/api/orders')
        .set(authHeader(auth.client))
        .send({ tableId: 3, timeSlot: '15:00-16:00', dishes: [{ dishId: 1, quantity: 1 }] });
      expect(noBookingOrder.status).toBe(400);

      const createOrder = await request(app)
        .post('/api/orders')
        .set(authHeader(auth.client))
        .send({ tableId: 1, timeSlot: '13:00-14:00', dishes: [{ dishId: 1, quantity: 1 }] });
      expect(createOrder.status).toBe(201);
    });

    it('supports kitchen and waiter lifecycle', async () => {
      const createBooking = await request(app)
        .post('/api/tables/5/book')
        .set(authHeader(auth.client))
        .send({ timeSlot: '17:00-18:00' });
      expect(createBooking.status).toBe(200);

      const createOrder = await request(app)
        .post('/api/orders')
        .set(authHeader(auth.client))
        .send({
          tableId: 5,
          timeSlot: '17:00-18:00',
          dishes: [{ dishId: 2, quantity: 1, comment: 'Без соли' }],
        });
      expect(createOrder.status).toBe(201);

      const queue = await request(app).get('/api/kitchen/queue').set(authHeader(auth.chef));
      expect(queue.status).toBe(200);
      const queueItem = queue.body.find((item) => item.orderId === createOrder.body.id);
      expect(queueItem).toBeTruthy();

      const started = await request(app)
        .put(`/api/kitchen/dish/${queueItem.id}/start`)
        .set(authHeader(auth.chef));
      expect(started.status).toBe(200);

      const completed = await request(app)
        .put(`/api/kitchen/dish/${queueItem.id}/complete`)
        .set(authHeader(auth.chef));
      expect(completed.status).toBe(200);

      const serve = await request(app)
        .put(`/api/orders/${createOrder.body.id}/dish/0/serve`)
        .set(authHeader(auth.waiter));
      expect(serve.status).toBe(200);
      expect(serve.body.completed).toBe(true);
    });
  });
}
