const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '******127.0.0.1:5432/restoran_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.REFRESH_SECRET = process.env.REFRESH_SECRET || 'test_refresh_secret';
process.env.ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '45m';
process.env.REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '1d';

const { runMigrations } = require('../../db/migrate');
const { resetDatabase } = require('../../db/reset');
const { app, shutdownResources } = require('../../app');

let adminToken;
let waiterToken;
let chefToken;
let clientToken;
let clientRefreshToken;

async function login(email, password) {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  assert.equal(response.statusCode, 200);
  return response.body;
}

test.before(async () => {
  await runMigrations();
});

test.beforeEach(async () => {
  await resetDatabase();
  const admin = await login('admin@restaurant.com', 'admin123');
  const waiter = await login('waiter@restaurant.com', 'waiter123');
  const chef = await login('chef@restaurant.com', 'chef123');
  const client = await login('client@example.com', 'client123');

  adminToken = admin.accessToken;
  waiterToken = waiter.accessToken;
  chefToken = chef.accessToken;
  clientToken = client.accessToken;
  clientRefreshToken = client.refreshToken;
});

test.after(async () => {
  await shutdownResources();
});

test('register/login/refresh/logout flow', async () => {
  const register = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Новый Клиент', email: '  NewClient@Example.com ', password: 'newpass123' });

  assert.equal(register.statusCode, 201);
  assert.equal(register.body.email, 'newclient@example.com');

  const loginResp = await request(app)
    .post('/api/auth/login')
    .send({ email: 'newclient@example.com', password: 'newpass123' });
  assert.equal(loginResp.statusCode, 200);

  const refreshResp = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: loginResp.body.refreshToken });
  assert.equal(refreshResp.statusCode, 200);

  const logoutResp = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', 'Bearer ' + loginResp.body.accessToken)
    .send({ refreshToken: refreshResp.body.refreshToken });
  assert.equal(logoutResp.statusCode, 200);
});

test('menu access and role rights', async () => {
  const publicDish = await request(app).get('/api/menu/1');
  assert.equal(publicDish.statusCode, 200);
  assert.equal(Object.hasOwn(publicDish.body, 'recipe'), false);

  const chefDish = await request(app).get('/api/menu/1').set('Authorization', 'Bearer ' + chefToken);
  assert.equal(chefDish.statusCode, 200);
  assert.equal(typeof chefDish.body.recipe, 'string');

  const forbidden = await request(app)
    .post('/api/menu')
    .set('Authorization', 'Bearer ' + clientToken)
    .send({ name: 'Тест', price: 100, category: 'Закуски', weight: '100г' });

  assert.equal(forbidden.statusCode, 403);
});

test('tables bookings and overlap prevention', async () => {
  const tables = await request(app).get('/api/tables').set('Authorization', 'Bearer ' + clientToken);
  assert.equal(tables.statusCode, 200);
  assert.equal(Array.isArray(tables.body), true);

  const firstBooking = await request(app)
    .post('/api/tables/1/book')
    .set('Authorization', 'Bearer ' + clientToken)
    .send({ timeSlot: '20:00-21:00' });
  assert.equal(firstBooking.statusCode, 200);

  const overlap = await request(app)
    .post('/api/tables/1/book')
    .set('Authorization', 'Bearer ' + clientToken)
    .send({ timeSlot: '20:30-21:30' });
  assert.equal(overlap.statusCode, 400);
});

test('orders require booking and kitchen/serve/completion flow', async () => {
  const withoutBooking = await request(app)
    .post('/api/orders')
    .set('Authorization', 'Bearer ' + clientToken)
    .send({
      tableId: 3,
      timeSlot: '19:00-20:00',
      dishes: [{ dishId: 1, quantity: 1, comment: '' }],
      clientName: 'Клиент',
    });
  assert.equal(withoutBooking.statusCode, 400);

  const booking = await request(app)
    .post('/api/tables/3/book')
    .set('Authorization', 'Bearer ' + clientToken)
    .send({ timeSlot: '19:00-20:00' });
  assert.equal(booking.statusCode, 200);

  const orderResp = await request(app)
    .post('/api/orders')
    .set('Authorization', 'Bearer ' + clientToken)
    .send({
      tableId: 3,
      timeSlot: '19:00-20:00',
      dishes: [{ dishId: 1, quantity: 1, comment: 'без чеснока' }],
      clientName: 'Клиент',
    });

  assert.equal(orderResp.statusCode, 201);
  const createdOrder = orderResp.body;

  const queue = await request(app).get('/api/kitchen/queue').set('Authorization', 'Bearer ' + chefToken);
  assert.equal(queue.statusCode, 200);
  const queueDish = queue.body.find((dish) => dish.orderId === createdOrder.id);
  assert.ok(queueDish);

  const startResp = await request(app)
    .put(`/api/kitchen/dish/${queueDish.id}/start`)
    .set('Authorization', 'Bearer ' + chefToken);
  assert.equal(startResp.statusCode, 200);

  const completeResp = await request(app)
    .put(`/api/kitchen/dish/${queueDish.id}/complete`)
    .set('Authorization', 'Bearer ' + chefToken);
  assert.equal(completeResp.statusCode, 200);

  const served = await request(app)
    .put(`/api/orders/${createdOrder.id}/dish/0/serve`)
    .set('Authorization', 'Bearer ' + waiterToken);
  assert.equal(served.statusCode, 200);
  assert.equal(served.body.completed, true);

  const usersAsAdmin = await request(app).get('/api/users').set('Authorization', 'Bearer ' + adminToken);
  assert.equal(usersAsAdmin.statusCode, 200);

  const usersAsClient = await request(app).get('/api/users').set('Authorization', 'Bearer ' + clientToken);
  assert.equal(usersAsClient.statusCode, 403);

  const refresh = await request(app).post('/api/auth/refresh').send({ refreshToken: clientRefreshToken });
  assert.equal(refresh.statusCode, 200);
});
