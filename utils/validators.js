function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateEmail(email) {
  const normalized = normalizeEmail(email);
  const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;

  if (!normalized) return 'Email обязателен';
  if (!emailRegex.test(normalized)) return 'Некорректный email';
  return null;
}

function validatePassword(password) {
  if (!password) return 'Пароль обязателен';
  if (String(password).length < 6) return 'Пароль должен состоять минимум из 6 символов';
  return null;
}

module.exports = {
  normalizeEmail,
  validateEmail,
  validatePassword,
};
