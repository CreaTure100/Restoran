const ALLOWED_DISH_STATUS_TRANSITIONS = {
  pending: ['cooking'],
  cooking: ['ready'],
  ready: ['served'],
  served: [],
};

function canTransitionDishStatus(currentStatus, nextStatus) {
  const allowed = ALLOWED_DISH_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

function calculateOrderTotal(orderItems, menuById) {
  return orderItems.reduce((sum, item) => {
    const menuItem = menuById.get(item.dishId);
    return sum + (menuItem ? Number(menuItem.price) * item.total : 0);
  }, 0);
}

function isOrderCompleted(orderItems) {
  return orderItems.every((item) => Number(item.remaining) === 0 || item.status === 'served');
}

function hasAnyRole(userRole, allowedRoles) {
  return allowedRoles.includes(userRole);
}

module.exports = {
  ALLOWED_DISH_STATUS_TRANSITIONS,
  canTransitionDishStatus,
  calculateOrderTotal,
  isOrderCompleted,
  hasAnyRole,
};
