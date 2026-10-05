const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, validateEmail, validatePassword } = require('../../lib/validation');

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  User@Example.COM  '), 'user@example.com');
});

test('validateEmail validates strict format', () => {
  assert.equal(validateEmail('user@example.com'), null);
  assert.equal(validateEmail('invalid@'), 'Некорректный email');
  assert.equal(validateEmail(''), 'Email обязателен');
});

test('validatePassword validates complexity and length', () => {
  assert.equal(validatePassword('abc12345'), null);
  assert.equal(validatePassword('short1'), 'Пароль должен состоять минимум из 8 символов');
  assert.equal(validatePassword('abcdefgh'), 'Пароль должен содержать буквы и цифры');
});
