CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('guest', 'client', 'waiter', 'chef', 'admin')),
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL,
  weight TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL,
  recipe TEXT NOT NULL DEFAULT '',
  cooking_time TEXT NOT NULL DEFAULT '15 минут',
  ingredients TEXT NOT NULL DEFAULT 'Ингредиенты не указаны',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id INTEGER PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('free', 'partial', 'booked')) DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  table_id INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  booking_day DATE NOT NULL DEFAULT CURRENT_DATE,
  time_slot TEXT NOT NULL,
  start_minute INTEGER NOT NULL CHECK (start_minute >= 0 AND start_minute < 1440),
  end_minute INTEGER NOT NULL CHECK (end_minute > 0 AND end_minute <= 1440 AND end_minute > start_minute),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (table_id, booking_day, time_slot),
  EXCLUDE USING GIST (
    table_id WITH =,
    booking_day WITH =,
    int4range(start_minute, end_minute, '[)') WITH &&
  )
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  table_id INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  booking_id BIGINT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
  time_slot TEXT NOT NULL,
  sort_minutes INTEGER NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed')) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  total INTEGER NOT NULL CHECK (total > 0),
  remaining INTEGER NOT NULL CHECK (remaining >= 0 AND remaining <= total),
  comment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'cooking', 'ready', 'served')) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_bookings_table_day ON bookings(table_id, booking_day);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_dish_id ON order_items(dish_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
