function calculateOrderTotal(orderItems, menuItemsById) {
  return orderItems.reduce((sum, item) => {
    const price = Number(menuItemsById.get(Number(item.dish_id)) || 0);
    return sum + price * Number(item.total || 0);
  }, 0);
}

function canServeDish(dish) {
  return dish.status === 'ready' && Number(dish.remaining) > 0;
}

function applyServeDish(dish) {
  if (!canServeDish(dish)) {
    return false;
  }

  const remaining = Number(dish.remaining) - 1;
  dish.remaining = remaining;
  if (remaining === 0) {
    dish.status = 'served';
  }
  return true;
}

function resolveOrderCompletion(orderItems) {
  return orderItems.every((dish) => Number(dish.remaining) === 0);
}

module.exports = {
  calculateOrderTotal,
  canServeDish,
  applyServeDish,
  resolveOrderCompletion,
};
