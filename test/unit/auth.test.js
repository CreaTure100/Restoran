const test = require('node:test');
const assert = require('node:assert/strict');
const { hasAllowedRole } = require('../../lib/auth');

test('role checks', () => {
  assert.equal(hasAllowedRole('admin', ['admin', 'chef']), true);
  assert.equal(hasAllowedRole('client', ['admin', 'chef']), false);
});
