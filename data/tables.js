const initialTables = [
    { id: 1, status: 'free', slots: [] },
    { id: 2, status: 'partial', slots: ['10:00-11:00', '11:00-14:00'] },
    { id: 3, status: 'free', slots: [] },
    { id: 4, status: 'booked', slots: ['09:00-23:00'] },
    { id: 5, status: 'free', slots: [] },
    { id: 6, status: 'free', slots: [] },
    { id: 7, status: 'partial', slots: ['18:00-20:00'] },
    { id: 8, status: 'free', slots: [] },
    { id: 9, status: 'booked', slots: ['12:00-22:00'] },
    { id: 10, status: 'free', slots: [] },
    { id: 11, status: 'free', slots: [] },
    { id: 12, status: 'partial', slots: ['19:00-21:00'] },
    { id: 13, status: 'free', slots: [] },
    { id: 14, status: 'free', slots: [] },
    { id: 15, status: 'booked', slots: ['10:00-14:00', '15:00-18:00'] },
    { id: 16, status: 'free', slots: [] },
    { id: 17, status: 'free', slots: [] },
];

module.exports = { initialTables };