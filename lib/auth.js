function hasAllowedRole(role, allowedRoles) {
  return allowedRoles.includes(role);
}

module.exports = { hasAllowedRole };
