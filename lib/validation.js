function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validateEmail(email) {
  const normalized = normalizeEmail(email);
  const emailRegex = /^[^\s@]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

  if (!normalized) {
    return 'Email обязателен';
  }

  if (!emailRegex.test(normalized)) {
    return 'Некорректный email';
  }

  return null;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return 'Пароль обязателен';
  }

  if (password.length < 8) {
    return 'Пароль должен состоять минимум из 8 символов';
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Пароль должен содержать буквы и цифры';
  }

  return null;
}

module.exports = {
  normalizeEmail,
  validateEmail,
  validatePassword,
};
