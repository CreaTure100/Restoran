const path = require('path');
const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db/pool');
const config = require('./config');
const { migrate } = require('./db/migrate');
const { seedDatabase } = require('./db/seed');
const { parseTimeSlot, toBookingDates } = require('./utils/time');
const { normalizeEmail, validateEmail, validatePassword } = require('./utils/validators');
const { calculateOrderTotal, isOrderCompleted } = require('./utils/orders');

const ROLES = {
  CLIENT: 'client',
  WAITER: 'waiter',
  CHEF: 'chef',
  ADMIN: 'admin',
};

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.accessExpiresIn },
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    config.refreshSecret,
    { expiresIn: config.refreshExpiresIn },
  );

  return { accessToken, refreshToken };
}

async function storeRefreshToken(token, userId) {
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1 OR expires_at < NOW()', [userId]);
  await pool.query(
    'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, NOW() + $3::interval)',
    [token, userId, config.refreshExpiresIn],
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Токен не предоставлен' });

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(403).json({ error: 'Недействительный или просроченный токен' });
  }
}

function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret);
  } catch {
    req.user = null;
  }

  return next();
}

function authorize(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется аутентификация' });

    const userResult = await pool.query('SELECT id, role, is_blocked FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.is_blocked) return res.status(403).json({ error: 'Пользователь заблокирован' });
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: 'Недостаточно прав для выполнения операции',
        requiredRoles: allowedRoles,
        userRole: user.role,
      });
    }

    req.user.role = user.role;
    return next();
  };
}

function validateBookingTime(slot) {
  const parsed = parseTimeSlot(slot);
  if (!parsed) return 'Неверный формат времени. Используйте HH:MM-HH:MM';
  if (parsed.end <= parsed.start) return 'Время окончания должно быть позже времени начала';
  if (parsed.end - parsed.start < 30) return 'Минимальное время бронирования 30 минут';
  if (parsed.start < 9 * 60 || parsed.end > 23 * 60) return 'Ресторан работает с 9:00 до 23:00';
  return null;
}

async function getTablesWithSlots() {
  const { rows } = await pool.query(
    `SELECT t.id,
            b.time_slot,
            b.booking_start
     FROM restaurant_tables t
     LEFT JOIN bookings b ON b.table_id = t.id AND b.status = 'active'
     ORDER BY t.id, b.booking_start`,
  );

  const tableMap = new Map();

  for (const row of rows) {
    if (!tableMap.has(row.id)) tableMap.set(row.id, { id: row.id, slots: [] });
    if (row.time_slot) tableMap.get(row.id).slots.push(row.time_slot);
  }

  return [...tableMap.values()].map((table) => {
    const hasFullDay = table.slots.some((slot) => slot === '09:00-23:00');
    const status = table.slots.length === 0 ? 'free' : (hasFullDay || table.slots.length >= 3 ? 'booked' : 'partial');
    return { ...table, status };
  });
}

async function fetchOrders() {
  const result = await pool.query(
    `SELECT o.id,
            o.table_id,
            o.time_slot,
            o.sort_minutes,
            o.completed,
            o.client_id,
            o.client_name,
            o.status,
            o.created_at,
            oi.id AS item_id,
            oi.dish_id,
            oi.dish_name,
            oi.total,
            oi.remaining,
            oi.comment,
            oi.status AS item_status
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ORDER BY o.sort_minutes, o.created_at, oi.id`,
  );

  const orderMap = new Map();

  for (const row of result.rows) {
    if (!orderMap.has(row.id)) {
      orderMap.set(row.id, {
        id: row.id,
        tableId: row.table_id,
        timeSlot: row.time_slot,
        sortMinutes: row.sort_minutes,
        completed: row.completed,
        createdAt: row.created_at,
        clientId: row.client_id,
        clientName: row.client_name,
        status: row.status,
        dishes: [],
      });
    }

    if (row.item_id) {
      orderMap.get(row.id).dishes.push({
        itemId: row.item_id,
        name: row.dish_name,
        total: row.total,
        remaining: row.remaining,
        dishId: row.dish_id,
        comment: row.comment,
        status: row.item_status,
      });
    }
  }

  return [...orderMap.values()];
}

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use('/images', express.static(path.join(__dirname, 'public/images')));

  app.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  });

  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
    }

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError) return res.status(400).json({ error: emailError });
    if (passwordError) return res.status(400).json({ error: passwordError });

    const normalizedEmail = normalizeEmail(email);

    try {
      const created = await pool.query(
        `INSERT INTO users (id, name, email, password, role, is_blocked)
         VALUES ($1, $2, $3, $4, $5, FALSE)
         RETURNING id, name, email, role, is_blocked AS "isBlocked", created_at AS "createdAt"`,
        [nanoid(), name, normalizedEmail, await hashPassword(password), ROLES.CLIENT],
      );

      return res.status(201).json(created.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      }
      throw error;
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

    const normalizedEmail = normalizeEmail(email);
    const userResult = await pool.query(
      `SELECT id, name, email, password, role, is_blocked, created_at
       FROM users
       WHERE email = $1`,
      [normalizedEmail],
    );

    const user = userResult.rows[0];

    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.is_blocked) return res.status(401).json({ error: 'Пользователь заблокирован' });

    const validPassword = await verifyPassword(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Неверный пароль' });

    const tokens = generateTokens(user);
    await storeRefreshToken(tokens.refreshToken, user.id);

    return res.status(200).json({
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isBlocked: user.is_blocked,
        createdAt: user.created_at,
      },
    });
  });

  app.post('/api/auth/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh токен не предоставлен' });

    const tokenResult = await pool.query(
      'SELECT token, user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [refreshToken],
    );

    if (!tokenResult.rows[0]) {
      return res.status(401).json({ error: 'Недействительный refresh токен' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.refreshSecret);
    } catch {
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      return res.status(403).json({ error: 'Refresh токен истек' });
    }

    const userResult = await pool.query(
      `SELECT id, name, email, role, is_blocked
       FROM users
       WHERE id = $1`,
      [decoded.id],
    );

    const user = userResult.rows[0];
    if (!user || user.is_blocked) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      return res.status(401).json({ error: 'Пользователь не найден или заблокирован' });
    }

    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

    const tokens = generateTokens(user);
    await storeRefreshToken(tokens.refreshToken, user.id);

    return res.status(200).json(tokens);
  });

  app.get('/api/auth/me', authenticateToken, async (req, res) => {
    const userResult = await pool.query(
      `SELECT id, name, email, role, is_blocked AS "isBlocked", created_at AS "createdAt"
       FROM users
       WHERE id = $1`,
      [req.user.id],
    );

    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    return res.status(200).json(user);
  });

  app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    return res.status(200).json({ message: 'Выход выполнен успешно' });
  });

  app.get('/api/users', authenticateToken, authorize(ROLES.ADMIN), async (_req, res) => {
    const result = await pool.query(
      `SELECT id, name, email, role, is_blocked AS "isBlocked", created_at AS "createdAt"
       FROM users
       ORDER BY created_at`,
    );
    res.json(result.rows);
  });

  app.get('/api/users/:id', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
    const result = await pool.query(
      `SELECT id, name, email, role, is_blocked AS "isBlocked", created_at AS "createdAt"
       FROM users
       WHERE id = $1`,
      [req.params.id],
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });
    return res.json(result.rows[0]);
  });

  app.put('/api/users/:id', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
    const { name, email, role, isBlocked } = req.body;

    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (!userResult.rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });

    const normalized = email ? normalizeEmail(email) : null;
    if (normalized) {
      const emailError = validateEmail(normalized);
      if (emailError) return res.status(400).json({ error: emailError });
    }

    if (role && !Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: 'Некорректная роль' });
    }

    try {
      const result = await pool.query(
        `UPDATE users
         SET name = COALESCE($2, name),
             email = COALESCE($3, email),
             role = COALESCE($4, role),
             is_blocked = COALESCE($5, is_blocked)
         WHERE id = $1
         RETURNING id, name, email, role, is_blocked AS "isBlocked", created_at AS "createdAt"`,
        [req.params.id, name || null, normalized, role || null, isBlocked === undefined ? null : Boolean(isBlocked)],
      );

      return res.json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      }
      throw error;
    }
  });

  app.delete('/api/users/:id', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
    }

    const result = await pool.query(
      `UPDATE users
       SET is_blocked = TRUE
       WHERE id = $1
       RETURNING id`,
      [req.params.id],
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });

    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.params.id]);
    return res.json({ message: 'Пользователь заблокирован' });
  });

  app.post('/api/users/employee', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: 'Некорректная роль' });
    }

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError) return res.status(400).json({ error: emailError });
    if (passwordError) return res.status(400).json({ error: passwordError });

    try {
      const created = await pool.query(
        `INSERT INTO users (id, name, email, password, role, is_blocked)
         VALUES ($1, $2, $3, $4, $5, FALSE)
         RETURNING id, name, email, role, is_blocked AS "isBlocked", created_at AS "createdAt"`,
        [nanoid(), name, normalizeEmail(email), await hashPassword(password), role],
      );

      return res.status(201).json(created.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      }
      throw error;
    }
  });

  app.get('/api/menu', async (_req, res) => {
    const result = await pool.query(
      `SELECT id, name, price::float AS price, category, weight, description, image,
              recipe, cooking_time AS "cookingTime", ingredients
       FROM menu_items
       ORDER BY id`,
    );
    res.json(result.rows);
  });

  app.get('/api/menu/:id', optionalAuth, async (req, res) => {
    const result = await pool.query(
      `SELECT id, name, price::float AS price, category, weight, description, image,
              recipe, cooking_time AS "cookingTime", ingredients
       FROM menu_items
       WHERE id = $1`,
      [Number(req.params.id)],
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Блюдо не найдено' });

    const response = { ...result.rows[0] };
    if (!req.user || ![ROLES.CHEF, ROLES.ADMIN].includes(req.user.role)) {
      delete response.recipe;
    }

    res.json(response);
  });

  app.post('/api/menu', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
    const { name, price, category, weight, description, image, recipe, cookingTime, ingredients } = req.body;

    if (!name || !price || !category || !weight) {
      return res.status(400).json({ error: 'Название, цена, категория и вес блюда обязательны' });
    }

    const nextId = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM menu_items');

    const created = await pool.query(
      `INSERT INTO menu_items
        (id, name, price, category, weight, description, image, recipe, cooking_time, ingredients)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, name, price::float AS price, category, weight, description, image,
                 recipe, cooking_time AS "cookingTime", ingredients`,
      [
        nextId.rows[0].id,
        name,
        Number(price),
        category,
        weight,
        description || '',
        image || '/images/default.jpg',
        recipe || '',
        cookingTime || '15 минут',
        ingredients || 'Ингредиенты не указаны',
      ],
    );

    res.status(201).json(created.rows[0]);
  });

  app.put('/api/menu/:id', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await pool.query('SELECT id, price FROM menu_items WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Блюдо не найдено' });

    const body = req.body || {};
    const updated = await pool.query(
      `UPDATE menu_items
       SET name = COALESCE($2, name),
           price = COALESCE($3, price),
           category = COALESCE($4, category),
           weight = COALESCE($5, weight),
           description = COALESCE($6, description),
           image = COALESCE($7, image),
           recipe = COALESCE($8, recipe),
           cooking_time = COALESCE($9, cooking_time),
           ingredients = COALESCE($10, ingredients)
       WHERE id = $1
       RETURNING id, name, price::float AS price, category, weight, description, image,
                 recipe, cooking_time AS "cookingTime", ingredients`,
      [
        id,
        body.name || null,
        body.price === undefined ? null : Number(body.price),
        body.category || null,
        body.weight || null,
        body.description || null,
        body.image || null,
        body.recipe || null,
        body.cookingTime || null,
        body.ingredients || null,
      ],
    );

    res.json(updated.rows[0]);
  });

  app.delete('/api/menu/:id', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
    const id = Number(req.params.id);

    const deleted = await pool.query(
      `DELETE FROM menu_items
       WHERE id = $1
       RETURNING id, name, price::float AS price, category, weight, description, image,
                 recipe, cooking_time AS "cookingTime", ingredients`,
      [id],
    );

    if (!deleted.rows[0]) return res.status(404).json({ error: 'Блюдо не найдено' });

    const count = await pool.query('SELECT COUNT(*)::int AS count FROM menu_items');

    return res.json({
      message: 'Блюдо удалено',
      deletedItem: deleted.rows[0],
      remainingCount: count.rows[0].count,
    });
  });

  app.get('/api/tables', authenticateToken, async (_req, res) => {
    const tables = await getTablesWithSlots();
    return res.json(tables);
  });

  app.post('/api/tables/:id/book', authenticateToken, authorize(ROLES.CLIENT, ROLES.WAITER, ROLES.CHEF, ROLES.ADMIN), async (req, res) => {
    const tableId = Number(req.params.id);
    const { timeSlot } = req.body;

    if (!timeSlot) return res.status(400).json({ error: 'Время бронирования обязательно' });

    const table = await pool.query('SELECT id FROM restaurant_tables WHERE id = $1', [tableId]);
    if (!table.rows[0]) return res.status(404).json({ error: 'Стол не найден' });

    const validationError = validateBookingTime(timeSlot);
    if (validationError) return res.status(400).json({ error: validationError });

    const bookingDates = toBookingDates(timeSlot);

    try {
      const result = await pool.query(
        `INSERT INTO bookings (table_id, user_id, time_slot, booking_start, booking_end, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING id`,
        [
          tableId,
          req.user.id,
          bookingDates.formattedSlot,
          bookingDates.startDate.toISOString(),
          bookingDates.endDate.toISOString(),
        ],
      );

      const tables = await getTablesWithSlots();
      const updatedTable = tables.find((item) => item.id === tableId);

      return res.json({
        message: 'Стол успешно забронирован',
        table: updatedTable,
        bookedSlot: bookingDates.formattedSlot,
        bookingId: result.rows[0].id,
      });
    } catch (error) {
      if (error.code === '23P01') {
        const existing = await pool.query(
          'SELECT time_slot FROM bookings WHERE table_id = $1 AND status = $2 ORDER BY booking_start',
          [tableId, 'active'],
        );
        return res.status(400).json({
          error: 'Это время уже забронировано',
          existingSlots: existing.rows.map((row) => row.time_slot),
        });
      }
      throw error;
    }
  });

  app.post('/api/orders', authenticateToken, authorize(ROLES.CLIENT, ROLES.CHEF, ROLES.WAITER, ROLES.ADMIN), async (req, res) => {
    const { tableId, timeSlot, dishes, clientName } = req.body;

    if (!tableId || !timeSlot || !Array.isArray(dishes) || dishes.length === 0) {
      return res.status(400).json({ error: 'Необходимо указать стол, время и блюда' });
    }

    const validationError = validateBookingTime(timeSlot);
    if (validationError) return res.status(400).json({ error: validationError });

    const bookingDates = toBookingDates(timeSlot);

    const tableResult = await pool.query('SELECT id FROM restaurant_tables WHERE id = $1', [Number(tableId)]);
    if (!tableResult.rows[0]) return res.status(404).json({ error: 'Стол не найден' });

    const bookingResult = await pool.query(
      `SELECT id
       FROM bookings
       WHERE table_id = $1
         AND status = 'active'
         AND booking_start <= $2
         AND booking_end >= $3
       ORDER BY booking_start ASC
       LIMIT 1`,
      [Number(tableId), bookingDates.startDate.toISOString(), bookingDates.endDate.toISOString()],
    );

    const booking = bookingResult.rows[0];
    if (!booking) {
      return res.status(400).json({ error: 'Стол не забронирован на это время. Сначала забронируйте стол!' });
    }

    const dishIds = dishes.map((dish) => Number(dish.dishId));
    const menuRows = await pool.query(
      `SELECT id, name
       FROM menu_items
       WHERE id = ANY($1::int[])`,
      [dishIds],
    );
    const menuMap = new Map(menuRows.rows.map((row) => [row.id, row]));

    for (const dish of dishes) {
      if (!menuMap.has(Number(dish.dishId))) {
        return res.status(400).json({ error: `Блюдо с id ${dish.dishId} не найдено` });
      }
      if (!dish.quantity || Number(dish.quantity) <= 0) {
        return res.status(400).json({ error: 'Количество блюда должно быть больше 0' });
      }
    }

    const orderId = `ord-${Date.now()}-${nanoid(6)}`;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO orders
          (id, table_id, booking_id, client_id, client_name, time_slot, sort_minutes, status, completed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',FALSE)`,
        [
          orderId,
          Number(tableId),
          booking.id,
          req.user.id,
          clientName || req.user.name,
          bookingDates.formattedSlot,
          bookingDates.parsed.start,
        ],
      );

      for (const dish of dishes) {
        const menuDish = menuMap.get(Number(dish.dishId));
        await client.query(
          `INSERT INTO order_items
            (order_id, dish_id, dish_name, total, remaining, status, comment)
           VALUES ($1,$2,$3,$4,$4,'pending',$5)`,
          [orderId, Number(dish.dishId), dish.name || menuDish.name, Number(dish.quantity), dish.comment || ''],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const orders = await fetchOrders();
    const createdOrder = orders.find((order) => order.id === orderId);
    return res.status(201).json(createdOrder);
  });

  app.get('/api/orders', authenticateToken, authorize(ROLES.CLIENT, ROLES.ADMIN, ROLES.WAITER, ROLES.CHEF), async (_req, res) => {
    const orders = await fetchOrders();
    return res.json(orders);
  });

  app.get('/api/orders/my', authenticateToken, authorize(ROLES.CLIENT), async (req, res) => {
    const orders = await fetchOrders();
    return res.json(orders.filter((order) => order.clientId === req.user.id));
  });

  app.put('/api/orders/:orderId/dish/:dishIndex/serve', authenticateToken, authorize(ROLES.WAITER, ROLES.ADMIN), async (req, res) => {
    const { orderId } = req.params;
    const dishIndex = Number(req.params.dishIndex);

    const orders = await fetchOrders();
    const order = orders.find((item) => item.id === orderId);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const dish = order.dishes[dishIndex];
    if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' });
    if (dish.status !== 'ready') return res.status(400).json({ error: 'Блюдо еще не готово к подаче' });

    const nextRemaining = Math.max(0, dish.remaining - 1);
    const nextStatus = nextRemaining === 0 ? 'served' : dish.status;

    await pool.query('UPDATE order_items SET remaining = $2, status = $3 WHERE id = $1', [dish.itemId, nextRemaining, nextStatus]);

    const refreshed = await fetchOrders();
    const updatedOrder = refreshed.find((item) => item.id === orderId);

    if (updatedOrder && isOrderCompleted(updatedOrder.dishes)) {
      await pool.query("UPDATE orders SET completed = TRUE, status = 'completed' WHERE id = $1", [orderId]);
    }

    const latest = await fetchOrders();
    const finalOrder = latest.find((item) => item.id === orderId);
    return res.json(finalOrder);
  });

  app.get('/api/kitchen/queue', authenticateToken, authorize(ROLES.CHEF, ROLES.ADMIN), async (_req, res) => {
    const result = await pool.query(
      `SELECT o.id AS order_id,
              o.table_id,
              o.time_slot,
              oi.id AS item_id,
              oi.dish_name,
              oi.dish_id,
              oi.remaining,
              oi.comment,
              oi.status
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.completed = FALSE
         AND oi.remaining > 0
       ORDER BY o.created_at, oi.id`,
    );

    const queue = result.rows.map((row) => ({
      id: `${row.order_id}-${row.item_id}`,
      orderId: row.order_id,
      tableId: row.table_id,
      dishName: row.dish_name,
      dishId: row.dish_id,
      quantity: row.remaining,
      comment: row.comment,
      status: row.status,
      timeSlot: row.time_slot,
    }));

    return res.json(queue);
  });

  app.put('/api/kitchen/dish/:queueId/start', authenticateToken, authorize(ROLES.CHEF, ROLES.ADMIN), async (req, res) => {
    const { queueId } = req.params;
    const splitIndex = queueId.lastIndexOf('-');
    const orderId = queueId.slice(0, splitIndex);
    const itemId = Number(queueId.slice(splitIndex + 1));

    const itemResult = await pool.query(
      `SELECT oi.id, oi.status
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = $1 AND o.id = $2`,
      [itemId, orderId],
    );

    const item = itemResult.rows[0];
    if (!item) return res.status(404).json({ error: 'Блюдо не найдено' });
    if (item.status !== 'pending') {
      return res.status(400).json({ error: `Блюдо уже ${item.status === 'cooking' ? 'готовится' : 'готово'}` });
    }

    await pool.query("UPDATE order_items SET status = 'cooking' WHERE id = $1", [itemId]);

    const updated = await pool.query('SELECT id, dish_name AS name, remaining, status FROM order_items WHERE id = $1', [itemId]);
    return res.json({ message: 'Блюдо начали готовить', dish: updated.rows[0] });
  });

  app.put('/api/kitchen/dish/:queueId/complete', authenticateToken, authorize(ROLES.CHEF, ROLES.ADMIN), async (req, res) => {
    const { queueId } = req.params;
    const splitIndex = queueId.lastIndexOf('-');
    const orderId = queueId.slice(0, splitIndex);
    const itemId = Number(queueId.slice(splitIndex + 1));

    const itemResult = await pool.query(
      `SELECT oi.id, oi.status
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = $1 AND o.id = $2`,
      [itemId, orderId],
    );

    const item = itemResult.rows[0];
    if (!item) return res.status(404).json({ error: 'Блюдо не найдено' });
    if (item.status !== 'cooking') return res.status(400).json({ error: 'Блюдо не начали готовить' });

    await pool.query("UPDATE order_items SET status = 'ready' WHERE id = $1", [itemId]);

    const updated = await pool.query(
      `SELECT id, dish_name AS name, remaining, status
       FROM order_items
       WHERE id = $1`,
      [itemId],
    );

    return res.json({
      message: 'Блюдо готово к подаче',
      dish: updated.rows[0],
      remaining: updated.rows[0].remaining,
      status: updated.rows[0].status,
    });
  });

  app.get('/api/kitchen/recipe/:dishId', authenticateToken, authorize(ROLES.CHEF, ROLES.ADMIN), async (req, res) => {
    const dishId = Number(req.params.dishId);

    const dishResult = await pool.query(
      `SELECT id, name, recipe, description, cooking_time AS "cookingTime", ingredients
       FROM menu_items
       WHERE id = $1`,
      [dishId],
    );

    const dish = dishResult.rows[0];
    if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' });

    const commentsResult = await pool.query(
      `SELECT o.id AS order_id, o.table_id, o.time_slot, oi.comment
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.completed = FALSE
         AND oi.dish_id = $1
         AND oi.comment <> ''`,
      [dishId],
    );

    return res.json({
      id: dish.id,
      name: dish.name,
      recipe: dish.recipe || 'Рецепт не добавлен',
      description: dish.description,
      cookingTime: dish.cookingTime || '15-20 минут',
      ingredients: dish.ingredients || 'Ингредиенты не указаны',
      comments: commentsResult.rows.map((row) => ({
        orderId: row.order_id,
        tableId: row.table_id,
        comment: row.comment,
        timeSlot: row.time_slot,
      })),
    });
  });

  app.get('/api/admin/stats', authenticateToken, authorize(ROLES.ADMIN), async (_req, res) => {
    const [ordersResult, menuResult, tables] = await Promise.all([
      fetchOrders(),
      pool.query('SELECT id, price::float AS price FROM menu_items'),
      getTablesWithSlots(),
    ]);

    const menuById = new Map(menuResult.rows.map((row) => [row.id, row]));

    const completedOrders = ordersResult.filter((order) => order.completed);
    const activeOrders = ordersResult.filter((order) => !order.completed);

    const totalRevenue = completedOrders.reduce((sum, order) => sum + calculateOrderTotal(order.dishes, menuById), 0);

    const usersCountResult = await pool.query('SELECT COUNT(*)::int AS count FROM users');

    return res.json({
      totalOrders: ordersResult.length,
      activeOrders: activeOrders.length,
      completedOrders: completedOrders.length,
      totalRevenue,
      tablesCount: tables.length,
      bookedTables: tables.filter((t) => t.status === 'booked').length,
      partialTables: tables.filter((t) => t.status === 'partial').length,
      freeTables: tables.filter((t) => t.status === 'free').length,
      menuItemsCount: menuById.size,
      usersCount: usersCountResult.rows[0].count,
    });
  });

  app.use((req, res, next) => {
    res.on('finish', () => {
      console.log(`[${new Date().toISOString()}] [${req.method}] ${res.statusCode} ${req.path}`);
    });
    next();
  });

  const distPath = path.join(__dirname, 'dist');
  app.use('/TableOne', express.static(distPath));
  app.get('/TableOne/*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  });

  return app;
}

const app = createApp();
let server;

async function startServer() {
  if (config.autoMigrate) await migrate();
  if (config.autoSeed) await seedDatabase();

  return new Promise((resolve) => {
    server = app.listen(config.port, () => {
      console.log(`Сервер запущен на http://localhost:${config.port}`);
      resolve(server);
    });
  });
}

async function shutdown() {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await pool.end();
}

if (require.main === module) {
  startServer();

  const stopSignals = ['SIGINT', 'SIGTERM'];
  stopSignals.forEach((signal) => {
    process.on(signal, async () => {
      await shutdown();
      process.exit(0);
    });
  });
}

module.exports = {
  app,
  createApp,
  startServer,
  shutdown,
  ROLES,
  validateBookingTime,
};
