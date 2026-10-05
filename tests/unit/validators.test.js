const { describe, it, expect } = require('vitest');
const { normalizeEmail, validateEmail, validatePassword } = require('../../utils/validators');

describe('validators', () => {
  it('normalizes email', () => {
    expect(normalizeEmail('  USER@MAIL.COM  ')).toBe('user@mail.com');
  });

  it('validates email format', () => {
    expect(validateEmail('wrong')).toBe('Некорректный email');
    expect(validateEmail('test@example.com')).toBeNull();
  });

  it('validates password length', () => {
    expect(validatePassword('123')).toBe('Пароль должен состоять минимум из 6 символов');
    expect(validatePassword('123456')).toBeNull();
  });
});
