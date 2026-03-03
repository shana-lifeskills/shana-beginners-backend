/**
 * Email: valid format per RFC 5322 simplified (common pattern).
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password: at least 8 characters, at least one letter and one number
 * (standardization: alphanumeric mix).
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_HAS_LETTER = /[a-zA-Z]/;
const PASSWORD_HAS_NUMBER = /\d/;

function isValidEmail(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  return EMAIL_REGEX.test(value.trim());
}

function validatePassword(value) {
  if (typeof value !== 'string') {
    return { valid: false, message: 'Password must be a string' };
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }
  if (!PASSWORD_HAS_LETTER.test(value)) {
    return { valid: false, message: 'Password must contain at least one letter' };
  }
  if (!PASSWORD_HAS_NUMBER.test(value)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
}

module.exports = {
  isValidEmail,
  validatePassword,
};
