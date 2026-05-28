const initialOrders = [
  {
    id: 'ord-0',
    tableId: 6,
    timeSlot: '08:00–09:00',
    sortMinutes: 8*60,
    dishes: [
      { name: 'Брускетта с томатами', total: 2, remaining: 0, dishId: 1, comment: '', status: 'served' },
      { name: 'Спагетти Карбонара', total: 1, remaining: 0, dishId: 9, comment: '', status: 'served' },
      { name: 'Тирамису', total: 2, remaining: 0, dishId: 15, comment: '', status: 'served' },
    ],
    completed: true,
    createdAt: new Date().toISOString(),
    clientId: null,
    clientName: 'Гость',
    status: 'completed'
  },
  {
    id: 'ord-2a',
    tableId: 2,
    timeSlot: '10:00–11:00',
    sortMinutes: 10*60,
    dishes: [
      { name: 'Капрезе', total: 2, remaining: 2, dishId: 2, comment: '', status: 'pending' },
      { name: 'Пицца Маргарита', total: 1, remaining: 1, dishId: 5, comment: '', status: 'pending' },
      { name: 'Джелато', total: 2, remaining: 2, dishId: 17, comment: '', status: 'pending' },
    ],
    completed: false,
    createdAt: new Date().toISOString(),
    clientId: null,
    clientName: 'Гость',
    status: 'active'
  },
  {
    id: 'ord-2b',
    tableId: 2,
    timeSlot: '11:00–14:00',
    sortMinutes: 11*60,
    dishes: [
      { name: 'Карпаччо из говядины', total: 1, remaining: 1, dishId: 3, comment: '', status: 'pending' },
      { name: 'Лазанья Болоньезе', total: 1, remaining: 1, dishId: 10, comment: '', status: 'pending' },
      { name: 'Панна котта', total: 2, remaining: 2, dishId: 16, comment: '', status: 'pending' },
    ],
    completed: false,
    createdAt: new Date().toISOString(),
    clientId: null,
    clientName: 'Гость',
    status: 'active'
  },
  {
    id: 'ord-15a',
    tableId: 15,
    timeSlot: '10:00–14:00',
    sortMinutes: 10*60,
    dishes: [
      { name: 'Прошутто с дыней', total: 2, remaining: 2, dishId: 4, comment: '', status: 'pending' },
      { name: 'Пицца Пепперони', total: 2, remaining: 2, dishId: 6, comment: '', status: 'pending' },
      { name: 'Ризотто с морепродуктами', total: 1, remaining: 1, dishId: 13, comment: '', status: 'pending' },
      { name: 'Крем-брюле', total: 2, remaining: 2, dishId: 18, comment: '', status: 'pending' },
    ],
    completed: false,
    createdAt: new Date().toISOString(),
    clientId: null,
    clientName: 'Гость',
    status: 'active'
  },
  {
    id: 'ord-15b',
    tableId: 15,
    timeSlot: '15:00–18:00',
    sortMinutes: 15*60,
    dishes: [
      { name: 'Пицца Четыре сыра', total: 2, remaining: 2, dishId: 7, comment: '', status: 'pending' },
      { name: 'Феттучини Альфредо', total: 2, remaining: 2, dishId: 11, comment: '', status: 'pending' },
      { name: 'Апероль Шприц', total: 3, remaining: 3, dishId: 19, comment: '', status: 'pending' },
    ],
    completed: false,
    createdAt: new Date().toISOString(),
    clientId: null,
    clientName: 'Гость',
    status: 'active'
  },
  {
    id: 'ord-9',
    tableId: 9,
    timeSlot: '12:00–22:00',
    sortMinutes: 12*60,
    dishes: [
      { name: 'Брускетта с томатами', total: 4, remaining: 4, dishId: 1, comment: '', status: 'pending' },
      { name: 'Пицца Маргарита', total: 3, remaining: 3, dishId: 5, comment: '', status: 'pending' },
      { name: 'Пицца Пепперони', total: 2, remaining: 2, dishId: 6, comment: '', status: 'pending' },
      { name: 'Спагетти Карбонара', total: 2, remaining: 2, dishId: 9, comment: '', status: 'pending' },
      { name: 'Тирамису', total: 3, remaining: 3, dishId: 15, comment: '', status: 'pending' },
      { name: 'Панна котта', total: 2, remaining: 2, dishId: 16, comment: '', status: 'pending' },
    ],
    completed: false,
    createdAt: new Date().toISOString(),
    clientId: null,
    clientName: 'Гость',
    status: 'active'
  },
  {
    id: 'ord-7',
    tableId: 7,
    timeSlot: '18:00–20:00',
    sortMinutes: 18*60,
    dishes: [
      { name: 'Ризотто с грибами', total: 2, remaining: 2, dishId: 14, comment: '', status: 'pending' },
      { name: 'Тортиллини с грибами', total: 1, remaining: 1, dishId: 12, comment: '', status: 'pending' },
      { name: 'Джелато', total: 2, remaining: 2, dishId: 17, comment: '', status: 'pending' },
    ],
    completed: false,
    createdAt: new Date().toISOString(),
    clientId: null,
    clientName: 'Гость',
    status: 'active'
  },
  {
    id: 'ord-4',
    tableId: 4,
    timeSlot: '09:00–23:00',
    sortMinutes: 9*60,
    dishes: [
      { name: 'Капрезе', total: 2, remaining: 2, dishId: 2, comment: '', status: 'pending' },
      { name: 'Пицца с грибами', total: 2, remaining: 2, dishId: 8, comment: '', status: 'pending' },
      { name: 'Лазанья Болоньезе', total: 1, remaining: 1, dishId: 10, comment: '', status: 'pending' },
      { name: 'Крем-брюле', total: 2, remaining: 2, dishId: 18, comment: '', status: 'pending' },
    ],
    completed: false,
    createdAt: new Date().toISOString(),
    clientId: null,
    clientName: 'Гость',
    status: 'active'
  },
  {
    id: 'ord-12',
    tableId: 12,
    timeSlot: '19:00–21:00',
    sortMinutes: 19*60,
    dishes: [
      { name: 'Карпаччо из говядины', total: 1, remaining: 1, dishId: 3, comment: '', status: 'pending' },
      { name: 'Ризотто с морепродуктами', total: 2, remaining: 2, dishId: 13, comment: '', status: 'pending' },
      { name: 'Просекко', total: 2, remaining: 2, dishId: 20, comment: '', status: 'pending' },
    ],
    completed: false,
    createdAt: new Date().toISOString(),
    clientId: null,
    clientName: 'Гость',
    status: 'active'
  },
];

module.exports = { initialOrders };