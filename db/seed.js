const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const { initialMenuItems } = require('../data/menu');
const { initialTables } = require('../data/tables');
const { initialOrders } = require('../data/orders');
const { query, withTransaction, closePool } = require('./index');
const { parseTimeSlot, formatTimeSlot } = require('../lib/time');

const usersSeed = [
  { id: 'user-admin', name: 'Администратор', email: 'admin@restaurant.com', password: 'admin123', role: 'admin' },
  { id: 'user-waiter', name: 'Иван Официант', email: 'waiter@restaurant.com', password: 'waiter123', role: 'waiter' },
  { id: 'user-chef', name: 'Петр Повар', email: 'chef@restaurant.com', password: 'chef123', role: 'chef' },
  { id: 'user-client', name: 'Алексей Клиент', email: 'client@example.com', password: 'client123', role: 'client' },
];

async function upsertUsers(client) {
  for (const user of usersSeed) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await client.query(
      `INSERT INTO users (id, name, email, password, role, is_blocked)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       ON CONFLICT (id)
       DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, password = EXCLUDED.password, role = EXCLUDED.role, is_blocked = FALSE`,
      [user.id, user.name, user.email, passwordHash, user.role]
    );
  }
}

async function upsertMenu(client) {
  for (const item of initialMenuItems) {
    await client.query(
      `INSERT INTO menu_items (id, name, price, category, weight, description, image, recipe, cooking_time, ingredients)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         price = EXCLUDED.price,
         category = EXCLUDED.category,
         weight = EXCLUDED.weight,
         description = EXCLUDED.description,
         image = EXCLUDED.image,
         recipe = EXCLUDED.recipe,
         cooking_time = EXCLUDED.cooking_time,
         ingredients = EXCLUDED.ingredients`,
      [item.id, item.name, item.price, item.category, item.weight, item.description || '', item.image, item.recipe || '', item.cookingTime || '15 минут', item.ingredients || 'Ингредиенты не указаны']
    );
  }
}

async function upsertTables(client) {
  for (const table of initialTables) {
    await client.query(
      `INSERT INTO restaurant_tables (id, status)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [table.id, table.status]
    );
  }
}

async function ensureBooking(client, tableId, slot, userId = null) {
  const normalizedSlot = formatTimeSlot(slot);
  if (!normalizedSlot) return null;
  const parsed = parseTimeSlot(normalizedSlot);

  const existing = await client.query(
    `SELECT id FROM bookings
     WHERE table_id = $1 AND booking_day = CURRENT_DATE AND time_slot = $2`,
    [tableId, normalizedSlot]
  );

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO bookings (table_id, user_id, booking_day, time_slot, start_minute, end_minute)
     VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)
     RETURNING id`,
    [tableId, userId, normalizedSlot, parsed.start, parsed.end]
  );

  return inserted.rows[0].id;
}

async function upsertOrders(client) {
  const menuMapResult = await client.query('SELECT id, name FROM menu_items');
  const menuNameById = new Map(menuMapResult.rows.map((row) => [Number(row.id), row.name]));

  for (const order of initialOrders) {
    const normalizedSlot = formatTimeSlot(order.timeSlot);
    const bookingId = await ensureBooking(client, order.tableId, normalizedSlot, order.clientId || null);

    await client.query(
      `INSERT INTO orders (id, table_id, booking_id, time_slot, sort_minutes, completed, created_at, client_id, client_name, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         table_id = EXCLUDED.table_id,
         booking_id = EXCLUDED.booking_id,
         time_slot = EXCLUDED.time_slot,
         sort_minutes = EXCLUDED.sort_minutes,
         completed = EXCLUDED.completed,
         client_id = EXCLUDED.client_id,
         client_name = EXCLUDED.client_name,
         status = EXCLUDED.status`,
      [
        order.id || `ord-${nanoid(10)}`,
        order.tableId,
        bookingId,
        normalizedSlot,
        order.sortMinutes,
        Boolean(order.completed),
        order.createdAt || new Date().toISOString(),
        order.clientId,
        order.clientName || 'Гость',
        order.status || (order.completed ? 'completed' : 'active'),
      ]
    );

    await client.query('DELETE FROM order_items WHERE order_id = $1', [order.id]);

    for (const dish of order.dishes) {
      const dishId = Number(dish.dishId);
      const actualName = menuNameById.get(dishId) || dish.name;
      await client.query(
        `INSERT INTO order_items (order_id, dish_id, name, total, remaining, comment, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          order.id,
          dishId,
          actualName,
          Number(dish.total),
          Number(dish.remaining),
          dish.comment || '',
          dish.status || 'pending',
        ]
      );
    }
  }
}

async function runSeed() {
  await withTransaction(async (client) => {
    await upsertUsers(client);
    await upsertMenu(client);
    await upsertTables(client);
    await upsertOrders(client);
  });
  console.log('Seed completed');
}

async function cleanupExpiredTokens() {
  await query('DELETE FROM refresh_tokens WHERE expires_at <= NOW()');
}

if (require.main === module) {
  runSeed()
    .then(cleanupExpiredTokens)
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Seed failed:', error);
      await closePool();
      process.exit(1);
    });
}

module.exports = { runSeed, cleanupExpiredTokens };
