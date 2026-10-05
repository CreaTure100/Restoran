const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateOrderTotal, canServeDish, applyServeDish, resolveOrderCompletion } = require('../../lib/order-utils');

test('calculateOrderTotal uses dish_id prices', () => {
  const menuMap = new Map([
    [1, 100],
    [2, 250],
  ]);

  const total = calculateOrderTotal([
    { dish_id: 1, total: 2 },
    { dish_id: 2, total: 1 },
  ], menuMap);

  assert.equal(total, 450);
});

test('dish serving status transitions and completion', () => {
  const dish = { status: 'ready', remaining: 1 };
  assert.equal(canServeDish(dish), true);
  assert.equal(applyServeDish(dish), true);
  assert.equal(dish.remaining, 0);
  assert.equal(dish.status, 'served');

  assert.equal(resolveOrderCompletion([{ remaining: 0 }, { remaining: 0 }]), true);
  assert.equal(resolveOrderCompletion([{ remaining: 0 }, { remaining: 1 }]), false);
});
