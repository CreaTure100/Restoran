const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { initialUsers } = require('./data/users');
const { initialMenuItems } = require('./data/menu');
const { initialTables } = require('./data/tables');
const { initialOrders } = require('./data/orders');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/images', express.static('public/images'));

const ROLES = {
    GUEST: 'guest',
    CLIENT: 'client',
    WAITER: 'waiter',
    CHEF: 'chef',
    ADMIN: 'admin'
};

const JWT_SECRET = "TableOne_access_secret_key";
const REFRESH_SECRET = "Table_refresh_secret_key";
const ACCESS_EXPIRES_IN = "45m";
const REFRESH_EXPIRES_IN = "1d";

let refreshTokens = [];
let users = [...initialUsers];
let menuItems = [...initialMenuItems];
let tables = [...initialTables];
let orders = [...initialOrders];
let dishQueue = [];

function parseTimeSlot(slot) {
    if (!slot) return null;
    
    let cleanSlot = slot;
    if (cleanSlot.includes('с ') && cleanSlot.includes(' до')) {
        cleanSlot = cleanSlot.replace('с ', '').replace(' до', '-');
    }
    
    const [start, end] = cleanSlot.split('-');
    if (!start || !end) return null;
    
    const [startHour, startMin] = start.trim().split(':').map(Number);
    const [endHour, endMin] = end.trim().split(':').map(Number);
    
    if (isNaN(startHour) || isNaN(endHour)) return null;
    
    return {
        start: startHour * 60 + (startMin || 0),
        end: endHour * 60 + (endMin || 0),
        startStr: start.trim(),
        endStr: end.trim()
    };
}

function updateDishQueue() {
    dishQueue = [];
    const activeOrders = orders.filter(o => !o.completed);
    
    activeOrders.forEach(order => {
        order.dishes.forEach((dish, idx) => {
            if (dish.remaining > 0) {
                const status = dish.status || 'pending';
                dishQueue.push({
                    id: `${order.id}-${idx}`,
                    orderId: order.id,
                    tableId: order.tableId,
                    dishName: dish.name,
                    dishId: dish.dishId,
                    quantity: dish.remaining,
                    comment: dish.comment || '',
                    status: status,
                    timeSlot: order.timeSlot
                });
            }
        });
    });
}

updateDishQueue();

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
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: ACCESS_EXPIRES_IN }
    );
    
    const refreshToken = jwt.sign(
        { id: user.id },
        REFRESH_SECRET,
        { expiresIn: REFRESH_EXPIRES_IN }
    );
    refreshTokens = refreshTokens.filter(rt => rt.userId !== user.id); // Удаление старых токенов пользователя
    refreshTokens.push({
        token: refreshToken,
        userId: user.id,
    });
    
    return { accessToken, refreshToken };
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: "Токен не предоставлен" });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Недействительный или просроченный токен" });
        }
        req.user = user;
        next();
    });
}

function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Требуется аутентификация" });
        }
        
        const user = users.find(u => u.id === req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: "Пользователь не найден" });
        }
        
        if (user.isBlocked) {
            return res.status(403).json({ error: "Пользователь заблокирован" });
        }
        
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ 
                error: "Недостаточно прав для выполнения операции",
                requiredRoles: allowedRoles,
                userRole: user.role
            });
        }
        
        next();
    };
}

function validateEmail(email){
    const emailRegex= /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
    if (!email){
        return  "Email обязателен";
    }
    if (!emailRegex.test(email)){
        return "Некорректный email ";
    }
    return null;
}

function validatePassword(password){
    if (!password){
        return "Пароль обязателен";
    }
    if (password.length < 6){
        return "Пароль должен состоять минимум из 6 символов";
    }
    return null;
}

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Имя, email и пароль обязательны" });
    }

    if (emailError){
        return res.status(400).json({error: emailError});
    }

    if (passwordError){
        return res.status(400).json({error: passwordError});
    }

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(409).json({ error: "Пользователь с таким email уже существует" });
    }

    const newUser = {
        id: nanoid(),
        name,
        email: email.toLowerCase().trim(), //Добавил нормализцацию, чтобы избежать возможных ошибок
        password: await hashPassword(password),
        role: ROLES.CLIENT,
        isBlocked: false,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    const userResponse = { ...newUser };
    delete userResponse.password;
    
    res.status(201).json(userResponse);
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: "Email и пароль обязательны" });
    }
    
    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
    }
    
    if (user.isBlocked) {
        return res.status(401).json({ error: "Пользователь заблокирован" });
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    
    if (isPasswordValid) {
        const tokens = generateTokens(user);
        const userResponse = { ...user };
        delete userResponse.password;
        
        res.status(200).json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: userResponse
        });
    } else {
        res.status(401).json({ error: "Неверный пароль" });
    }
});

app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
        return res.status(400).json({ error: "Refresh токен не предоставлен" });
    }
    
    const storedToken = refreshTokens.find(rt => rt.token === refreshToken);
    if (!storedToken) {
        return res.status(401).json({ error: "Недействительный refresh токен" });
    }
    
    jwt.verify(refreshToken, REFRESH_SECRET, (err, decoded) => {
        if (err) {
            refreshTokens = refreshTokens.filter(rt => rt.token !== refreshToken);
            return res.status(403).json({ error: "Refresh токен истек" });
        }
        
        const user = users.find(u => u.id === decoded.id);
        if (!user || user.isBlocked) {
            refreshTokens = refreshTokens.filter(rt => rt.token !== refreshToken);
            return res.status(401).json({ error: "Пользователь не найден или заблокирован" });
        }
        
        refreshTokens = refreshTokens.filter(rt => rt.token !== refreshToken);
        const tokens = generateTokens(user);
        res.status(200).json(tokens);
    });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
    }
    
    const userResponse = { ...user };
    delete userResponse.password;
    
    res.status(200).json(userResponse);
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        refreshTokens = refreshTokens.filter(rt => rt.token !== refreshToken);
    }
    res.status(200).json({ message: "Выход выполнен успешно" });
});

app.get('/api/users', authenticateToken, authorize(ROLES.ADMIN), (req, res) => {
    const usersResponse = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    });
    res.json(usersResponse);
});

app.get('/api/users/:id', authenticateToken, authorize(ROLES.ADMIN), (req, res) => {
    const user = users.find(u => u.id === req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
});

app.put('/api/users/:id', authenticateToken, authorize(ROLES.ADMIN), (req, res) => {
    const userIndex = users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const { name, email, role, isBlocked } = req.body;
    
    if (name) users[userIndex].name = name;
    if (email) users[userIndex].email = email;
    if (role && Object.values(ROLES).includes(role)) users[userIndex].role = role;
    if (isBlocked !== undefined) users[userIndex].isBlocked = isBlocked;
    
    const { password, ...userWithoutPassword } = users[userIndex];
    res.json(userWithoutPassword);
});

app.delete('/api/users/:id', authenticateToken, authorize(ROLES.ADMIN), (req, res) => {
    const userIndex = users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    if (users[userIndex].id === req.user.id) {
        return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
    }
    
    users[userIndex].isBlocked = true;
    refreshTokens = refreshTokens.filter(rt => rt.userId !== req.params.id);
    res.json({ message: 'Пользователь заблокирован' });
});

app.post('/api/users/employee', authenticateToken, authorize(ROLES.ADMIN), async (req, res) => {
    const { name, email, password, role } = req.body;
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError){
        return res.status(400).json({error: emailError});
    }

    if (passwordError){
        return res.status(400).json({error: passwordError})
    }
    
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: "Все поля обязательны" });
    }
    
    if (!Object.values(ROLES).includes(role) || role === ROLES.GUEST) {
        return res.status(400).json({ error: "Некорректная роль" });
    }
    
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(409).json({ error: "Пользователь с таким email уже существует" });
    }
    
    const newUser = {
        id: nanoid(),
        name,
        email: email.toLowerCase().trim(), //Добавил нормализцацию, чтобы избежать возможных ошибок
        password: await hashPassword(password),
        role,
        isBlocked: false,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    const userResponse = { ...newUser };
    delete userResponse.password;
    
    res.status(201).json(userResponse);
});

app.get('/api/menu', (req, res) => {
    res.json(menuItems);
});

app.get('/api/menu/:id', (req, res) => {
    const id = parseInt(req.params.id)
    const item = menuItems.find(i => i.id == id);
    if (!item) {
        return res.status(404).json({ error: 'Блюдо не найдено' });
    }
    
    const response = { ...item };
    const user = users.find(u => u.id === req.user.id);
    if (user.role !== ROLES.CHEF && user.role !== ROLES.ADMIN) {
        delete response.recipe;
    }
    
    res.json(response);
});

app.post('/api/menu', authenticateToken, authorize(ROLES.ADMIN), (req, res) => {
    const { name, price, category, weight, description, image, recipe, cookingTime, ingredients } = req.body;
    
    if (!name || !price || !category || !weight) {
        return res.status(400).json({ error: "Название, цена, категория и вес блюда обязательны" });
    }
    
    const newItem = {
        id: Date.now(),
        name,
        price: Number(price),
        category,
        weight: weight || '',
        description: description || '',
        image: image || '/images/default.jpg',
        recipe: recipe || '',
        cookingTime: cookingTime || '15 минут',
        ingredients: ingredients || 'Ингредиенты не указаны'
    };
    
    menuItems.push(newItem);
    res.status(201).json(newItem);
});

app.put('/api/menu/:id', authenticateToken, authorize(ROLES.ADMIN), (req, res) => {
    const id = parseInt(req.params.id)
    const itemIndex = menuItems.findIndex(i => i.id == id);
    if (itemIndex === -1) {
        return res.status(404).json({ error: 'Блюдо не найдено' });
    }
    menuItems[itemIndex] = {
        ...menuItems[itemIndex],
        ...req.body,
        id: menuItems[itemIndex].id,
        price: req.body.price !== undefined ? Number(req.body.price) : menuItems[itemIndex].price
    };

    res.json(menuItems[itemIndex]);
});

app.delete('/api/menu/:id', authenticateToken, authorize(ROLES.ADMIN), (req, res) => {
    const id = parseInt(req.params.id)
    const itemToDelete = menuItems.find(item => item.id === id);
    
    if (!itemToDelete) {
        return res.status(404).json({ error: 'Блюдо не найдено' });
    }
    
    menuItems = menuItems.filter(item => item.id !== id);
    
    res.json({ 
        message: 'Блюдо удалено', 
        deletedItem: itemToDelete,
        remainingCount: menuItems.length
    });
});

app.get('/api/tables', authenticateToken, (req, res) => {
    res.json(tables);
});

app.post('/api/tables/:id/book', authenticateToken, authorize(ROLES.CLIENT, ROLES.WAITER, ROLES.CHEF ,ROLES.ADMIN), (req, res) => {
    const tableId = parseInt(req.params.id);
    const { timeSlot } = req.body;
    
    if (!timeSlot) {
        return res.status(400).json({ error: "Время бронирования обязательно" });
    }
    
    const table = tables.find(t => t.id === tableId);
    if (!table) {
        return res.status(404).json({ error: "Стол не найден" });
    }
    
    if (table.status === 'booked') {
        return res.status(400).json({ error: "Стол полностью занят на сегодня" });
    }
    
    const newSlot = parseTimeSlot(timeSlot);
    if (!newSlot) {
        return res.status(400).json({ error: "Неверный формат времени. Используйте HH:MM-HH:MM" });
    }
    
    if (newSlot.end - newSlot.start < 30) {
        return res.status(400).json({ error: "Минимальное время бронирования 30 минут" });
    }

    if (newSlot.start < 9 * 60 || newSlot.end > 23 * 60) {
        return res.status(400).json({ error: "Ресторан работает с 9:00 до 23:00" });
    }
    
    const overlap = table.slots.some(existingSlot => {
        const existing = parseTimeSlot(existingSlot);
        if (!existing) return false;
        return newSlot.start < existing.end && newSlot.end > existing.start;
    });
    
    if (overlap) {
        return res.status(400).json({ 
            error: "Это время уже забронировано",
            existingSlots: table.slots
        });
    }
    
    const formattedSlot = `${newSlot.startStr}-${newSlot.endStr}`;
    table.slots.push(formattedSlot);
    
    if (table.slots.length >= 3) {
        table.status = 'booked';
    } else if (table.slots.length > 0) {
        table.status = 'partial';
    }
    
    res.json({ 
        message: "Стол успешно забронирован", 
        table,
        bookedSlot: formattedSlot
    });
});

app.post('/api/orders', authenticateToken, authorize(ROLES.CLIENT, ROLES.CHEF, ROLES.WAITER, ROLES.ADMIN), (req, res) => {
    const { tableId, timeSlot, dishes, clientName } = req.body;
    
    if (!tableId || !timeSlot || !dishes || dishes.length === 0) {
        return res.status(400).json({ error: "Необходимо указать стол, время и блюда" });
    }
    
    const table = tables.find(t => t.id === tableId);
    if (!table) {
        return res.status(404).json({ error: "Стол не найден" });
    }

    const orderSlot = parseTimeSlot(timeSlot);
    if (!orderSlot) {
        return res.status(400).json({ error: "Неверный формат времени" });
    }
    
    const isBooked = table.slots.some(existingSlot => {
        const existing = parseTimeSlot(existingSlot);
        if (!existing) return false;
        return orderSlot.start < existing.end && orderSlot.end > existing.start;
    });
    
    if (!isBooked) {
        return res.status(400).json({ error: "Стол не забронирован на это время. Сначала забронируйте стол!" });
    }
    
    const user = users.find(u => u.id === req.user.id);
    
    const newOrder = {
        id: `ord-${Date.now()}`,
        tableId,
        timeSlot,
        sortMinutes: orderSlot.start,
        dishes: dishes.map(d => ({
            name: d.name,
            total: d.quantity,
            remaining: d.quantity,
            dishId: d.dishId,
            comment: d.comment || '',
            status: 'pending'
        })),
        completed: false,
        createdAt: new Date().toISOString(),
        clientId: user.id,
        clientName: clientName || user.name,
        status: 'active'
    };
    
    orders.push(newOrder);
    updateDishQueue();
    
    res.status(201).json(newOrder);
});

app.get('/api/orders', authenticateToken, authorize(ROLES.CLIENT,ROLES.ADMIN, ROLES.WAITER, ROLES.CHEF), (req, res) => {
    res.json(orders);
});

app.get('/api/orders/my', authenticateToken, authorize(ROLES.CLIENT), (req, res) => {
    const userOrders = orders.filter(o => o.clientId === req.user.id);
    res.json(userOrders);
});

app.put('/api/orders/:orderId/dish/:dishIndex/serve', authenticateToken, authorize(ROLES.WAITER, ROLES.ADMIN), (req, res) => {
    const { orderId, dishIndex } = req.params;
    
    const order = orders.find(o => o.id === orderId);
    if (!order) {
        return res.status(404).json({ error: "Заказ не найден" });
    }
    
    const dish = order.dishes[parseInt(dishIndex)];
    if (!dish) {
        return res.status(404).json({ error: "Блюдо не найдено" });
    }

    if (dish.status !== 'ready') {
        return res.status(400).json({ error: "Блюдо еще не готово к подаче" });
    }
    
    if (dish.remaining > 0) {
        dish.remaining--;
    }

    if (dish.remaining === 0) {
        dish.status = 'served';
    }
    
    const allServed = order.dishes.every(d => d.remaining === 0);
    if (allServed) {
        order.completed = true;
        order.status = 'completed';
    }
    
    updateDishQueue();
    res.json(order);
});

app.get('/api/kitchen/queue', authenticateToken, authorize(ROLES.CHEF, ROLES.ADMIN), (req, res) => {
    updateDishQueue();
    res.json(dishQueue);
});

app.put('/api/kitchen/dish/:queueId/start', authenticateToken, authorize(ROLES.CHEF, ROLES.ADMIN), (req, res) => {
    const { queueId } = req.params;
    const lastDashIndex = queueId.lastIndexOf('-');
    const orderId = queueId.substring(0, lastDashIndex);
    const dishIndex = parseInt(queueId.substring(lastDashIndex + 1));       
    const order = orders.find(o => o.id === orderId);

    if (!order) {
        return res.status(404).json({ error: "Заказ не найден" });
    }
    
    const dish = order.dishes[dishIndex];
    if (!dish) {
        return res.status(404).json({ error: "Блюдо не найдено" });
    }
    
    if (dish.status !== 'pending') {
        return res.status(400).json({ error: `Блюдо уже ${dish.status === 'cooking' ? 'готовится' : 'готово'}` });
    }
    
    dish.status = 'cooking';
    updateDishQueue();
    
    res.json({ message: "Блюдо начали готовить", dish });
});

app.put('/api/kitchen/dish/:queueId/complete', authenticateToken, authorize(ROLES.CHEF, ROLES.ADMIN), (req, res) => {
    const { queueId } = req.params;
    const lastDashIndex = queueId.lastIndexOf('-');
    const orderId = queueId.substring(0, lastDashIndex);
    const dishIndex = parseInt(queueId.substring(lastDashIndex + 1));
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
        return res.status(404).json({ error: "Заказ не найден" });
    }
    
    const dish = order.dishes[dishIndex];
    if (!dish) {
        return res.status(404).json({ error: "Блюдо не найдено" });
    }
    
    if (dish.status !== 'cooking') {
        return res.status(400).json({ error: "Блюдо не начали готовить" });
    }
    
    dish.status = 'ready';
    updateDishQueue();
    
    res.json({ 
        message: "Блюдо готово к подаче", 
        dish,
        remaining: dish.remaining,
        status: dish.status
    });
});

app.get('/api/kitchen/recipe/:dishId', authenticateToken, authorize(ROLES.CHEF, ROLES.ADMIN), (req, res) => {
    const dish = menuItems.find(d => d.id == req.params.dishId);
    if (!dish) {
        return res.status(404).json({ error: "Блюдо не найдено" });
    }
    const comments = [];
    const activeOrders = orders.filter(o => !o.completed);
    activeOrders.forEach(order => {
        order.dishes.forEach(dishItem => {
            if (dishItem.dishId == req.params.dishId && dishItem.comment) {
                comments.push({
                    orderId: order.id,
                    tableId: order.tableId,
                    comment: dishItem.comment,
                    timeSlot: order.timeSlot
                });
            }
        });
    });
    
    res.json({
        id: dish.id,
        name: dish.name,
        recipe: dish.recipe || "Рецепт не добавлен",
        description: dish.description,
        cookingTime: dish.cookingTime || "15-20 минут",
        ingredients: dish.ingredients || "Ингредиенты не указаны",
        comments: comments
    });
});

app.get('/api/admin/stats', authenticateToken, authorize(ROLES.ADMIN), (req, res) => {
    const activeOrders = orders.filter(o => !o.completed);
    const completedOrders = orders.filter(o => o.completed);
    
    const totalRevenue = completedOrders.reduce((sum, order) => {
        const orderTotal = order.dishes.reduce((dishSum, dish) => {
            const menuItem = menuItems.find(m => m.name === dish.name);
            return dishSum + (menuItem ? menuItem.price * dish.total : 0);
        }, 0);
        return sum + orderTotal;
    }, 0);
    
    res.json({
        totalOrders: orders.length,
        activeOrders: activeOrders.length,
        completedOrders: completedOrders.length,
        totalRevenue,
        tablesCount: tables.length,
        bookedTables: tables.filter(t => t.status === 'booked').length,
        partialTables: tables.filter(t => t.status === 'partial').length,
        freeTables: tables.filter(t => t.status === 'free').length,
        menuItemsCount: menuItems.length,
        usersCount: users.length
    });
});

app.use((req, res, next) => {
    res.on('finish', () => {
        console.log(`[${new Date().toISOString()}] [${req.method}] ${res.statusCode} ${req.path}`);
    });
    next();
});

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});