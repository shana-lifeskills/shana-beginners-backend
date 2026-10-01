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

/**
 * Phone: lenient — digits and an optional leading '+', 9-15 chars. Same
 * pattern paymentService.js already validates mobile money numbers with;
 * shared here so new call sites (e.g. student registration) don't
 * duplicate it.
 */
const PHONE_REGEX = /^[0-9+]{9,15}$/;

function isValidPhone(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  return PHONE_REGEX.test(value.trim());
}

/**
 * Ghana phone: exactly 10 digits starting with 0 (e.g. 0244090168), or the
 * same number with the 233 country code in place of the leading 0 (12
 * digits total, e.g. 233244090168) — no '+', no spaces. Stricter than
 * isValidPhone above; used specifically for student registration's
 * parent/guardian contact fields.
 */
const GHANA_PHONE_REGEX = /^(0\d{9}|233\d{9})$/;

function isValidGhanaPhone(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  return GHANA_PHONE_REGEX.test(value.trim());
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
  isValidPhone,
  isValidGhanaPhone,
  validatePassword,
};
