const { nanoid } = require('nanoid');
const bcrypt = require('bcrypt');

const adminHash = bcrypt.hashSync('admin123', 10);
const waiterHash = bcrypt.hashSync('waiter123', 10);
const chefHash = bcrypt.hashSync('chef123', 10);
const clientHash = bcrypt.hashSync('client123', 10);

const initialUsers = [
    {
        id: nanoid(),
        name: 'Администратор',
        email: 'admin@restaurant.com',
        password: adminHash,
        role: 'admin',
        isBlocked: false,
        createdAt: new Date().toISOString()
    },
    {
        id: nanoid(),
        name: 'Иван Официант',
        email: 'waiter@restaurant.com',
        password: waiterHash,
        role: 'waiter',
        isBlocked: false,
        createdAt: new Date().toISOString()
    },
    {
        id: nanoid(),
        name: 'Петр Повар',
        email: 'chef@restaurant.com',
        password: chefHash,
        role: 'chef',
        isBlocked: false,
        createdAt: new Date().toISOString()
    },
    {
        id: nanoid(),
        name: 'Алексей Клиент',
        email: 'client@example.com',
        password: clientHash,
        role: 'client',
        isBlocked: false,
        createdAt: new Date().toISOString()
    }
];

module.exports = { initialUsers };