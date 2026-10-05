const { describe, it, expect } = require('vitest');
const { canTransitionDishStatus, calculateOrderTotal, isOrderCompleted, hasAnyRole } = require('../../utils/orders');

describe('orders utils', () => {
  it('validates dish status transitions', () => {
    expect(canTransitionDishStatus('pending', 'cooking')).toBe(true);
    expect(canTransitionDishStatus('pending', 'ready')).toBe(false);
  });

  it('calculates order total by dish id', () => {
    const menuById = new Map([
      [1, { price: 100 }],
      [2, { price: 50 }],
    ]);

    expect(calculateOrderTotal([{ dishId: 1, total: 2 }, { dishId: 2, total: 1 }], menuById)).toBe(250);
  });

  it('detects completed order after all dishes served', () => {
    expect(isOrderCompleted([{ remaining: 0, status: 'served' }, { remaining: 0, status: 'served' }])).toBe(true);
    expect(isOrderCompleted([{ remaining: 1, status: 'ready' }])).toBe(false);
  });

  it('checks roles access', () => {
    expect(hasAnyRole('admin', ['admin', 'chef'])).toBe(true);
    expect(hasAnyRole('client', ['admin', 'chef'])).toBe(false);
  });
});
