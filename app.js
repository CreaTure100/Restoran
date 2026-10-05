const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query, withTransaction, closePool } = require('./db');
const { normalizeEmail, validateEmail, validatePassword } = require('./lib/validation');
const { parseTimeSlot, formatTimeSlot, hasMinimumDuration, isWorkingHours } = require('./lib/time');
const { calculateOrderTotal, resolveOrderCompletion } = require('./lib/order-utils');
const { hasAllowedRole } = require('./lib/auth');

const ROLES = {
  GUEST: 'guest',
  CLIENT: 'client',
  WAITER: 'waiter',
  CHEF: 'chef',
  ADMIN: 'admin',
};

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const ACCESS_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '45m';
const REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '1d';

if (!JWT_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT_SECRET and REFRESH_SECRET environment variables are required');
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] [${req.method}] ${res.statusCode} ${req.path}`);
  });
  next();
});

function toUserResponse(row) {
  if (!row) return null;
  const { password, is_blocked, created_at, ...rest } = row;
  return {
    ...rest,
    isBlocked: is_blocked,
    createdAt: created_at,
  };
}

async function findUserById(id) {
  const result = await query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function findUserByEmail(email) {
  const result = await query('SELECT * FROM users WHERE email = $1', [normalizeEmail(email)]);
  return result.rows[0] || null;
}

async function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );

  const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
  const decoded = jwt.decode(refreshToken);
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);
  await query('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)', [refreshToken, user.id, expiresAt]);

  return { accessToken, refreshToken };
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Недействительный или просроченный токен' });
    }
    req.user = payload;
    return next();
  });
}

function authenticateTokenOptional(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (!err) {
      req.user = payload;
    }
    next();
  });
}

function authorize(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Требуется аутентификация' });
    }

    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Пользователь заблокирован' });
    }

    if (!hasAllowedRole(user.role, allowedRoles)) {
      return res.status(403).json({
        error: 'Недостаточно прав для выполнения операции',
        requiredRoles: allowedRoles,
        userRole: user.role,
      });
    }

    req.dbUser = user;
    return next();
  };
}

async function getOrdersForQuery(whereClause = '', params = []) {
  const ordersResult = await query(
    `SELECT o.*,
            oi.id AS item_id,
            oi.dish_id,
            oi.name,
            oi.total,
            oi.remaining,
            oi.comment,
            oi.status AS dish_status
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${whereClause}
       ORDER BY o.sort_minutes ASC, o.created_at DESC, oi.id ASC`,
    params
  );

  const map = new Map();
  for (const row of ordersResult.rows) {
    if (!map.has(row.id)) {
      map.set(row.id, {
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
      map.get(row.id).dishes.push({
        name: row.name,
        total: Number(row.total),
        remaining: Number(row.remaining),
        dishId: Number(row.dish_id),
        comment: row.comment || '',
        status: row.dish_status,
      });
    }
  }

  return Array.from(map.values());
}

async function getDishQueue() {
  const result = await query(
    `SELECT o.id AS order_id,
            o.table_id,
            o.time_slot,
            oi.id AS order_item_id,
            oi.dish_id,
            oi.name,
            oi.remaining,
            oi.comment,
            oi.status
       FROM orders o
       INNER JOIN order_items oi ON oi.order_id = o.id
      WHERE o.completed = FALSE
        AND oi.remaining > 0
      ORDER BY o.sort_minutes ASC, o.created_at ASC, oi.id ASC`
  );

  return result.rows.map((row) => ({
    id: `${row.order_id}-${row.order_item_id}`,
    orderId: row.order_id,
    tableId: row.table_id,
    dishName: row.name,
    dishId: Number(row.dish_id),
    quantity: Number(row.remaining),
    comment: row.comment || '',
    status: row.status,
    timeSlot: row.time_slot,
  }));
}

async function getTablesWithSlots() {
  const result = await query(
    `SELECT t.id,
            t.status,
            COALESCE(array_agg(b.time_slot ORDER BY b.start_minute) FILTER (WHERE b.id IS NOT NULL), '{}') AS slots
       FROM restaurant_tables t
       LEFT JOIN bookings b ON b.table_id = t.id AND b.booking_day = CURRENT_DATE
      GROUP BY t.id, t.status
      ORDER BY t.id ASC`
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    status: row.status,
    slots: row.slots,
  }));
}

app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
  }

  const emailError = validateEmail(normalizedEmail);
  if (emailError) {
    return res.status(400).json({ error: emailError });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = `user-${nanoid(12)}`;

  const result = await query(
    `INSERT INTO users (id, name, email, password, role, is_blocked)
     VALUES ($1, $2, $3, $4, $5, FALSE)
     RETURNING *`,
    [id, name.trim(), normalizedEmail, passwordHash, ROLES.CLIENT]
  );

  return res.status(201).json(toUserResponse(result.rows[0]));
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  if (user.is_blocked) {
    return res.status(401).json({ error: 'Пользователь заблокирован' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  const tokens = await generateTokens(user);
  return res.status(200).json({
    ...tokens,
    user: toUserResponse(user),
  });
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh токен не предоставлен' });
  }

  const tokenResult = await query('SELECT * FROM refresh_tokens WHERE token = $1', [refreshToken]);
  const storedToken = tokenResult.rows[0];
  if (!storedToken) {
    return res.status(401).json({ error: 'Недействительный refresh токен' });
  }

  jwt.verify(refreshToken, REFRESH_SECRET, async (err, decoded) => {
    if (err) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      return res.status(403).json({ error: 'Refresh токен истек' });
    }

    const user = await findUserById(decoded.id);
    if (!user || user.is_blocked) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      return res.status(401).json({ error: 'Пользователь не найден или заблокирован' });
    }

    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    const tokens = await generateTokens(user);
    return res.status(200).json(tokens);
  });
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  return res.status(200).json(toUserResponse(user));
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  }
  return res.status(200).json({ message: 'Выход выполнен успешно' });
});

app.get('/api/users', authenticateToken, authorize(ROLES.ADMIN), async (_req, res) => {
  const result = await query('SELECT * FROM users ORDER BY created_at ASC');
  return res.json(result.rows.map(toUserResponse));
});

app.get('/api/users/:id', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  return res.json(toUserResponse(user));
});

app.put('/api/users/:id', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  const { name, email, role, isBlocked } = req.body;

  if (email) {
    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ error: emailError });
    }
  }

  if (role && !Object.values(ROLES).includes(role)) {
    return res.status(400).json({ error: 'Некорректная роль' });
  }

  const updated = await query(
    `UPDATE users
        SET name = COALESCE($2, name),
            email = COALESCE($3, email),
            role = COALESCE($4, role),
            is_blocked = COALESCE($5, is_blocked)
      WHERE id = $1
      RETURNING *`,
    [
      req.params.id,
      name ? name.trim() : null,
      email ? normalizeEmail(email) : null,
      role || null,
      isBlocked === undefined ? null : Boolean(isBlocked),
    ]
  );

  return res.json(toUserResponse(updated.rows[0]));
});

app.delete('/api/users/:id', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
  }

  const updated = await query('UPDATE users SET is_blocked = TRUE WHERE id = $1 RETURNING id', [req.params.id]);
  if (!updated.rows[0]) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.params.id]);
  return res.json({ message: 'Пользователь заблокирован' });
});

app.post('/api/users/employee', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }

  const emailError = validateEmail(email);
  if (emailError) {
    return res.status(400).json({ error: emailError });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  if (!Object.values(ROLES).includes(role) || role === ROLES.GUEST) {
    return res.status(400).json({ error: 'Некорректная роль' });
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (id, name, email, password, role, is_blocked)
     VALUES ($1, $2, $3, $4, $5, FALSE)
     RETURNING *`,
    [`user-${nanoid(12)}`, name.trim(), normalizedEmail, passwordHash, role]
  );

  return res.status(201).json(toUserResponse(result.rows[0]));
});

app.get('/api/menu', async (_req, res) => {
  const result = await query(
    `SELECT id, name, price, category, weight, description, image, recipe, cooking_time, ingredients
       FROM menu_items
      ORDER BY id ASC`
  );

  return res.json(
    result.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      price: Number(row.price),
      category: row.category,
      weight: row.weight,
      description: row.description,
      image: row.image,
      recipe: row.recipe,
      cookingTime: row.cooking_time,
      ingredients: row.ingredients,
    }))
  );
});

app.get('/api/menu/:id', authenticateTokenOptional, async (req, res) => {
  const id = Number(req.params.id);
  const result = await query(
    `SELECT id, name, price, category, weight, description, image, recipe, cooking_time, ingredients
       FROM menu_items
      WHERE id = $1`,
    [id]
  );

  const item = result.rows[0];
  if (!item) {
    return res.status(404).json({ error: 'Блюдо не найдено' });
  }

  let canViewRecipe = false;
  if (req.user?.id) {
    const user = await findUserById(req.user.id);
    canViewRecipe = user && [ROLES.CHEF, ROLES.ADMIN].includes(user.role);
  }

  const response = {
    id: Number(item.id),
    name: item.name,
    price: Number(item.price),
    category: item.category,
    weight: item.weight,
    description: item.description,
    image: item.image,
    cookingTime: item.cooking_time,
    ingredients: item.ingredients,
  };

  if (canViewRecipe) {
    response.recipe = item.recipe;
  }

  return res.json(response);
});

app.post('/api/menu', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
  const { name, price, category, weight, description, image, recipe, cookingTime, ingredients } = req.body;

  if (!name || !price || !category || !weight) {
    return res.status(400).json({ error: 'Название, цена, категория и вес блюда обязательны' });
  }

  const inserted = await query(
    `INSERT INTO menu_items (name, price, category, weight, description, image, recipe, cooking_time, ingredients)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      name,
      Number(price),
      category,
      weight,
      description || '',
      image || '/images/default.jpg',
      recipe || '',
      cookingTime || '15 минут',
      ingredients || 'Ингредиенты не указаны',
    ]
  );

  const row = inserted.rows[0];
  return res.status(201).json({
    id: Number(row.id),
    name: row.name,
    price: Number(row.price),
    category: row.category,
    weight: row.weight,
    description: row.description,
    image: row.image,
    recipe: row.recipe,
    cookingTime: row.cooking_time,
    ingredients: row.ingredients,
  });
});

app.put('/api/menu/:id', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
  const id = Number(req.params.id);

  const updated = await query(
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
      RETURNING *`,
    [
      id,
      req.body.name || null,
      req.body.price === undefined ? null : Number(req.body.price),
      req.body.category || null,
      req.body.weight || null,
      req.body.description || null,
      req.body.image || null,
      req.body.recipe || null,
      req.body.cookingTime || null,
      req.body.ingredients || null,
    ]
  );

  if (!updated.rows[0]) {
    return res.status(404).json({ error: 'Блюдо не найдено' });
  }

  const row = updated.rows[0];
  return res.json({
    id: Number(row.id),
    name: row.name,
    price: Number(row.price),
    category: row.category,
    weight: row.weight,
    description: row.description,
    image: row.image,
    recipe: row.recipe,
    cookingTime: row.cooking_time,
    ingredients: row.ingredients,
  });
});

app.delete('/api/menu/:id', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await query('DELETE FROM menu_items WHERE id = $1 RETURNING id, name', [id]);

  if (!deleted.rows[0]) {
    return res.status(404).json({ error: 'Блюдо не найдено' });
  }

  const countResult = await query('SELECT COUNT(*)::int AS count FROM menu_items');

  return res.json({
    message: 'Блюдо удалено',
    deletedItem: deleted.rows[0],
    remainingCount: countResult.rows[0].count,
  });
});

app.get('/api/tables', authenticateToken, async (_req, res) => {
  const tables = await getTablesWithSlots();
  return res.json(tables);
});

app.post('/api/tables/:id/book', authenticateToken, authorize(ROLES.CLIENT, ROLES.WAITER, ROLES.CHEF, ROLES.ADMIN), async (req, res) => {
  const tableId = Number(req.params.id);
  const { timeSlot } = req.body;

  if (!timeSlot) {
    return res.status(400).json({ error: 'Время бронирования обязательно' });
  }

  const parsed = parseTimeSlot(timeSlot);
  if (!parsed) {
    return res.status(400).json({ error: 'Неверный формат времени. Используйте HH:MM-HH:MM' });
  }

  if (!hasMinimumDuration(parsed, 30)) {
    return res.status(400).json({ error: 'Минимальное время бронирования 30 минут' });
  }

  if (!isWorkingHours(parsed)) {
    return res.status(400).json({ error: 'Ресторан работает с 9:00 до 23:00' });
  }

  const normalizedSlot = `${parsed.startStr}-${parsed.endStr}`;

  try {
    const result = await withTransaction(async (client) => {
      const tableResult = await client.query('SELECT id, status FROM restaurant_tables WHERE id = $1 FOR UPDATE', [tableId]);
      const table = tableResult.rows[0];
      if (!table) {
        return { status: 404, payload: { error: 'Стол не найден' } };
      }

      if (table.status === 'booked') {
        return { status: 400, payload: { error: 'Стол полностью занят на сегодня' } };
      }

      await client.query(
        `INSERT INTO bookings (table_id, user_id, booking_day, time_slot, start_minute, end_minute)
         VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)`,
        [tableId, req.user.id, normalizedSlot, parsed.start, parsed.end]
      );

      const countResult = await client.query(
        'SELECT COUNT(*)::int AS count FROM bookings WHERE table_id = $1 AND booking_day = CURRENT_DATE',
        [tableId]
      );
      const slotsCount = countResult.rows[0].count;
      const status = slotsCount >= 3 ? 'booked' : 'partial';
      await client.query('UPDATE restaurant_tables SET status = $2 WHERE id = $1', [tableId, status]);

      const tableWithSlots = await client.query(
        `SELECT t.id, t.status,
                COALESCE(array_agg(b.time_slot ORDER BY b.start_minute) FILTER (WHERE b.id IS NOT NULL), '{}') AS slots
           FROM restaurant_tables t
           LEFT JOIN bookings b ON b.table_id = t.id AND b.booking_day = CURRENT_DATE
          WHERE t.id = $1
          GROUP BY t.id, t.status`,
        [tableId]
      );

      return {
        status: 200,
        payload: {
          message: 'Стол успешно забронирован',
          table: {
            id: tableWithSlots.rows[0].id,
            status: tableWithSlots.rows[0].status,
            slots: tableWithSlots.rows[0].slots,
          },
          bookedSlot: normalizedSlot,
        },
      };
    });

    return res.status(result.status).json(result.payload);
  } catch (error) {
    if (error.code === '23P01' || error.code === '23505') {
      const existingSlots = await query(
        `SELECT time_slot FROM bookings WHERE table_id = $1 AND booking_day = CURRENT_DATE ORDER BY start_minute`,
        [tableId]
      );
      return res.status(400).json({
        error: 'Это время уже забронировано',
        existingSlots: existingSlots.rows.map((row) => row.time_slot),
      });
    }
    return res.status(500).json({ error: 'Ошибка бронирования' });
  }
});

app.post('/api/orders', authenticateToken, authorize(ROLES.CLIENT, ROLES.CHEF, ROLES.WAITER, ROLES.ADMIN), async (req, res) => {
  const { tableId, timeSlot, dishes, clientName } = req.body;

  if (!tableId || !timeSlot || !Array.isArray(dishes) || dishes.length === 0) {
    return res.status(400).json({ error: 'Необходимо указать стол, время и блюда' });
  }

  const parsed = parseTimeSlot(timeSlot);
  if (!parsed) {
    return res.status(400).json({ error: 'Неверный формат времени' });
  }

  const normalizedSlot = formatTimeSlot(timeSlot);

  try {
    const newOrder = await withTransaction(async (client) => {
      const tableResult = await client.query('SELECT id FROM restaurant_tables WHERE id = $1', [tableId]);
      if (!tableResult.rows[0]) {
        return { status: 404, payload: { error: 'Стол не найден' } };
      }

      const bookingResult = await client.query(
        `SELECT id
           FROM bookings
          WHERE table_id = $1
            AND booking_day = CURRENT_DATE
            AND time_slot = $2
          LIMIT 1`,
        [tableId, normalizedSlot]
      );

      if (!bookingResult.rows[0]) {
        return { status: 400, payload: { error: 'Стол не забронирован на это время. Сначала забронируйте стол!' } };
      }

      const existingOrder = await client.query('SELECT id FROM orders WHERE booking_id = $1', [bookingResult.rows[0].id]);
      if (existingOrder.rows[0]) {
        return { status: 400, payload: { error: 'На это бронирование уже создан заказ' } };
      }

      for (const dish of dishes) {
        if (!dish?.dishId || !Number.isFinite(Number(dish?.quantity)) || Number(dish.quantity) <= 0) {
          return { status: 400, payload: { error: 'Некорректные данные блюд в заказе' } };
        }
      }

      const orderId = `ord-${nanoid(10)}`;
      const insertOrder = await client.query(
        `INSERT INTO orders (id, table_id, booking_id, time_slot, sort_minutes, completed, client_id, client_name, status)
         VALUES ($1,$2,$3,$4,$5,FALSE,$6,$7,'active')
         RETURNING *`,
        [orderId, Number(tableId), bookingResult.rows[0].id, normalizedSlot, parsed.start, req.user.id, clientName || req.dbUser.name]
      );

      for (const dish of dishes) {
        const menuItem = await client.query('SELECT id, name FROM menu_items WHERE id = $1', [Number(dish.dishId)]);
        if (!menuItem.rows[0]) {
          return { status: 404, payload: { error: `Блюдо с id ${dish.dishId} не найдено` } };
        }

        await client.query(
          `INSERT INTO order_items (order_id, dish_id, name, total, remaining, comment, status)
           VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
          [
            orderId,
            Number(dish.dishId),
            menuItem.rows[0].name,
            Number(dish.quantity),
            Number(dish.quantity),
            dish.comment || '',
          ]
        );
      }

      const created = await getOrdersForQuery('WHERE o.id = $1', [orderId]);
      return { status: 201, payload: created[0] || insertOrder.rows[0] };
    });

    return res.status(newOrder.status).json(newOrder.payload);
  } catch (error) {
    return res.status(500).json({ error: 'Ошибка при создании заказа' });
  }
});

app.get('/api/orders', authenticateToken, authorize(ROLES.CLIENT, ROLES.ADMIN, ROLES.WAITER, ROLES.CHEF), async (_req, res) => {
  const orders = await getOrdersForQuery();
  return res.json(orders);
});

app.get('/api/orders/my', authenticateToken, authorize(ROLES.CLIENT), async (req, res) => {
  const orders = await getOrdersForQuery('WHERE o.client_id = $1', [req.user.id]);
  return res.json(orders);
});

app.put('/api/orders/:orderId/dish/:dishIndex/serve', authenticateToken, authorize(ROLES.WAITER, ROLES.ADMIN), async (req, res) => {
  const { orderId, dishIndex } = req.params;
  const dishPosition = Number(dishIndex);

  const order = await getOrdersForQuery('WHERE o.id = $1', [orderId]);
  if (!order[0]) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }

  const dish = order[0].dishes[dishPosition];
  if (!dish) {
    return res.status(404).json({ error: 'Блюдо не найдено' });
  }

  if (dish.status !== 'ready') {
    return res.status(400).json({ error: 'Блюдо еще не готово к подаче' });
  }

  await withTransaction(async (client) => {
    const itemResult = await client.query(
      `SELECT id, remaining
         FROM order_items
        WHERE order_id = $1
        ORDER BY id ASC
        LIMIT 1 OFFSET $2`,
      [orderId, dishPosition]
    );

    const item = itemResult.rows[0];
    const newRemaining = Math.max(Number(item.remaining) - 1, 0);
    const newStatus = newRemaining === 0 ? 'served' : 'ready';

    await client.query('UPDATE order_items SET remaining = $2, status = $3 WHERE id = $1', [item.id, newRemaining, newStatus]);

    const allItems = await client.query('SELECT remaining FROM order_items WHERE order_id = $1', [orderId]);
    const completed = resolveOrderCompletion(allItems.rows);

    if (completed) {
      await client.query('UPDATE orders SET completed = TRUE, status = $2 WHERE id = $1', [orderId, 'completed']);
    }
  });

  const updatedOrder = await getOrdersForQuery('WHERE o.id = $1', [orderId]);
  return res.json(updatedOrder[0]);
});

app.get('/api/kitchen/queue', authenticateToken, authorize(ROLES.CHEF, ROLES.ADMIN), async (_req, res) => {
  const queue = await getDishQueue();
  return res.json(queue);
});

app.put('/api/kitchen/dish/:queueId/start', authenticateToken, authorize(ROLES.CHEF, ROLES.ADMIN), async (req, res) => {
  const queueId = req.params.queueId;
  const lastDashIndex = queueId.lastIndexOf('-');
  const orderId = queueId.substring(0, lastDashIndex);
  const orderItemId = Number(queueId.substring(lastDashIndex + 1));

  const itemResult = await query('SELECT status, remaining FROM order_items WHERE id = $1 AND order_id = $2', [orderItemId, orderId]);
  const item = itemResult.rows[0];

  if (!item) {
    return res.status(404).json({ error: 'Блюдо не найдено' });
  }

  if (item.status !== 'pending') {
    return res.status(400).json({ error: `Блюдо уже ${item.status === 'cooking' ? 'готовится' : 'готово'}` });
  }

  await query('UPDATE order_items SET status = $2 WHERE id = $1', [orderItemId, 'cooking']);

  return res.json({
    message: 'Блюдо начали готовить',
    dish: {
      id: queueId,
      status: 'cooking',
      remaining: Number(item.remaining),
    },
  });
});

app.put('/api/kitchen/dish/:queueId/complete', authenticateToken, authorize(ROLES.CHEF, ROLES.ADMIN), async (req, res) => {
  const queueId = req.params.queueId;
  const lastDashIndex = queueId.lastIndexOf('-');
  const orderId = queueId.substring(0, lastDashIndex);
  const orderItemId = Number(queueId.substring(lastDashIndex + 1));

  const itemResult = await query('SELECT status, remaining FROM order_items WHERE id = $1 AND order_id = $2', [orderItemId, orderId]);
  const item = itemResult.rows[0];

  if (!item) {
    return res.status(404).json({ error: 'Блюдо не найдено' });
  }

  if (item.status !== 'cooking') {
    return res.status(400).json({ error: 'Блюдо не начали готовить' });
  }

  await query('UPDATE order_items SET status = $2 WHERE id = $1', [orderItemId, 'ready']);

  return res.json({
    message: 'Блюдо готово к подаче',
    dish: {
      id: queueId,
      status: 'ready',
      remaining: Number(item.remaining),
    },
    remaining: Number(item.remaining),
    status: 'ready',
  });
});

app.get('/api/kitchen/recipe/:dishId', authenticateToken, authorize(ROLES.CHEF, ROLES.ADMIN), async (req, res) => {
  const dishId = Number(req.params.dishId);
  const dishResult = await query(
    `SELECT id, name, recipe, description, cooking_time, ingredients
       FROM menu_items
      WHERE id = $1`,
    [dishId]
  );

  const dish = dishResult.rows[0];
  if (!dish) {
    return res.status(404).json({ error: 'Блюдо не найдено' });
  }

  const commentsResult = await query(
    `SELECT o.id AS order_id, o.table_id, o.time_slot, oi.comment
       FROM orders o
       INNER JOIN order_items oi ON oi.order_id = o.id
      WHERE o.completed = FALSE
        AND oi.dish_id = $1
        AND oi.comment <> ''
      ORDER BY o.sort_minutes ASC`,
    [dishId]
  );

  return res.json({
    id: dish.id,
    name: dish.name,
    recipe: dish.recipe || 'Рецепт не добавлен',
    description: dish.description,
    cookingTime: dish.cooking_time || '15-20 минут',
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
  const ordersResult = await query('SELECT completed FROM orders');
  const activeOrders = ordersResult.rows.filter((row) => !row.completed).length;
  const completedOrders = ordersResult.rows.filter((row) => row.completed).length;

  const completedItems = await query(
    `SELECT oi.dish_id, oi.total
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.completed = TRUE`
  );
  const menuPrices = await query('SELECT id, price FROM menu_items');
  const menuMap = new Map(menuPrices.rows.map((row) => [Number(row.id), Number(row.price)]));
  const totalRevenue = calculateOrderTotal(completedItems.rows, menuMap);

  const tablesResult = await query('SELECT status FROM restaurant_tables');
  const usersCount = await query('SELECT COUNT(*)::int AS count FROM users');
  const menuCount = await query('SELECT COUNT(*)::int AS count FROM menu_items');

  return res.json({
    totalOrders: ordersResult.rows.length,
    activeOrders,
    completedOrders,
    totalRevenue,
    tablesCount: tablesResult.rows.length,
    bookedTables: tablesResult.rows.filter((t) => t.status === 'booked').length,
    partialTables: tablesResult.rows.filter((t) => t.status === 'partial').length,
    freeTables: tablesResult.rows.filter((t) => t.status === 'free').length,
    menuItemsCount: menuCount.rows[0].count,
    usersCount: usersCount.rows[0].count,
  });
});

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use('/TableOne', express.static(distPath));
  app.get(['/TableOne', '/TableOne/*'], (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.get('/', (_req, res) => {
  res.redirect('/TableOne/');
});

async function shutdownResources() {
  await closePool();
}

module.exports = {
  app,
  shutdownResources,
  ROLES,
};
