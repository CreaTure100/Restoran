const { nanoid } = require('nanoid');
const pool = require('./pool');
const { initialUsers } = require('../data/users');
const { initialMenuItems } = require('../data/menu');
const { initialTables } = require('../data/tables');
const { initialOrders } = require('../data/orders');
const { toBookingDates } = require('../utils/time');
const { normalizeEmail } = require('../utils/validators');

async function upsertUsers(client) {
  for (const user of initialUsers) {
    const email = normalizeEmail(user.email);
    await client.query(
      `INSERT INTO users (id, name, email, password, role, is_blocked, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (email)
       DO UPDATE SET
         name = EXCLUDED.name,
         password = EXCLUDED.password,
         role = EXCLUDED.role,
         is_blocked = EXCLUDED.is_blocked`,
      [user.id || nanoid(), user.name, email, user.password, user.role, Boolean(user.isBlocked)],
    );
  }
}

async function upsertMenu(client) {
  for (const item of initialMenuItems) {
    await client.query(
      `INSERT INTO menu_items
        (id, name, price, category, weight, description, image, recipe, cooking_time, ingredients)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id)
       DO UPDATE SET
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        category = EXCLUDED.category,
        weight = EXCLUDED.weight,
        description = EXCLUDED.description,
        image = EXCLUDED.image,
        recipe = EXCLUDED.recipe,
        cooking_time = EXCLUDED.cooking_time,
        ingredients = EXCLUDED.ingredients`,
      [
        item.id,
        item.name,
        item.price,
        item.category,
        item.weight,
        item.description || '',
        item.image || '/images/default.jpg',
        item.recipe || '',
        item.cookingTime || '15 минут',
        item.ingredients || '',
      ],
    );
  }
}

async function seedBookingsAndOrders(client) {
  const bookingCache = new Map();
  const insertBookingSafely = async (tableId, bookingDates) => {
    try {
      const { rows } = await client.query(
        `INSERT INTO bookings (table_id, user_id, time_slot, booking_start, booking_end, status)
         VALUES ($1, NULL, $2, $3, $4, 'active')
         RETURNING id`,
        [tableId, bookingDates.formattedSlot, bookingDates.startDate.toISOString(), bookingDates.endDate.toISOString()],
      );
      return rows[0]?.id || null;
    } catch (error) {
      if (error.code !== '23P01') throw error;
      return null;
    }
  };

  for (const table of initialTables) {
    await client.query('INSERT INTO restaurant_tables (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [table.id]);

    for (const slot of table.slots || []) {
      const bookingDates = toBookingDates(slot);
      if (!bookingDates) continue;

      const key = `${table.id}:${bookingDates.formattedSlot}`;
      if (bookingCache.has(key)) continue;

      const insertedId = await insertBookingSafely(table.id, bookingDates);

      if (insertedId) {
        bookingCache.set(key, insertedId);
      } else {
        const existing = await client.query(
          `SELECT id FROM bookings
           WHERE table_id = $1
             AND booking_start = $2
             AND booking_end = $3
             AND status = 'active'
           LIMIT 1`,
          [table.id, bookingDates.startDate.toISOString(), bookingDates.endDate.toISOString()],
        );

        if (existing.rows[0]?.id) {
          bookingCache.set(key, existing.rows[0].id);
        }
      }
    }
  }

  for (const order of initialOrders) {
    const bookingDates = toBookingDates(order.timeSlot);
    if (!bookingDates) continue;

    const bookingKey = `${order.tableId}:${bookingDates.formattedSlot}`;
    let bookingId = bookingCache.get(bookingKey);

    if (!bookingId) {
      bookingId = await insertBookingSafely(order.tableId, bookingDates);

      if (!bookingId) {
        const existing = await client.query(
          `SELECT id FROM bookings
           WHERE table_id = $1
             AND booking_start = $2
             AND booking_end = $3
             AND status = 'active'
           LIMIT 1`,
          [order.tableId, bookingDates.startDate.toISOString(), bookingDates.endDate.toISOString()],
        );
        bookingId = existing.rows[0]?.id;
      }

      bookingCache.set(bookingKey, bookingId);
    }

    await client.query(
      `INSERT INTO orders
        (id, table_id, booking_id, client_id, client_name, time_slot, sort_minutes, status, completed, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (id)
       DO UPDATE SET
        table_id = EXCLUDED.table_id,
        booking_id = EXCLUDED.booking_id,
        client_id = EXCLUDED.client_id,
        client_name = EXCLUDED.client_name,
        time_slot = EXCLUDED.time_slot,
        sort_minutes = EXCLUDED.sort_minutes,
        status = EXCLUDED.status,
        completed = EXCLUDED.completed`,
      [
        order.id,
        order.tableId,
        bookingId,
        order.clientId,
        order.clientName || 'Гость',
        bookingDates.formattedSlot,
        order.sortMinutes || bookingDates.parsed.start,
        order.completed ? 'completed' : 'active',
        Boolean(order.completed),
      ],
    );

    await client.query('DELETE FROM order_items WHERE order_id = $1', [order.id]);

    for (const dish of order.dishes) {
      await client.query(
        `INSERT INTO order_items
          (order_id, dish_id, dish_name, total, remaining, status, comment)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          order.id,
          dish.dishId,
          dish.name,
          dish.total,
          dish.remaining,
          dish.status || 'pending',
          dish.comment || '',
        ],
      );
    }
  }
}

async function seedDatabase({ force = false } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (force) {
      await client.query('TRUNCATE TABLE refresh_tokens, order_items, orders, bookings, restaurant_tables RESTART IDENTITY CASCADE');
    } else {
      const countResult = await client.query('SELECT COUNT(*)::int AS count FROM restaurant_tables');
      if (countResult.rows[0].count > 0) {
        await client.query('COMMIT');
        return { skipped: true };
      }
    }

    await upsertUsers(client);
    await upsertMenu(client);
    await seedBookingsAndOrders(client);

    await client.query('COMMIT');
    return { skipped: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedDatabase({ force: process.argv.includes('--force') })
    .then((result) => {
      if (result.skipped) {
        console.log('Seed skipped: data already exists');
      } else {
        console.log('Seed completed');
      }
      return pool.end();
    })
    .catch((error) => {
      console.error('Seed failed', error);
      process.exitCode = 1;
    });
}

module.exports = { seedDatabase };
