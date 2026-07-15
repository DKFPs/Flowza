/**
 * Flowza Centralized Normalization Utilities
 * Ensures data integrity across the platform.
 */

/**
 * Normalizes phone numbers to E.164-like format (digits only).
 */
export const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, "");
};

/**
 * Normalizes email addresses (lowercase, trimmed).
 */
export const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

/**
 * Normalizes names (trimmed, capitalize first letters).
 */
export const normalizeName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Normalizes common strings (trimmed).
 */
export const normalizeString = (str: string): string => {
  return str.trim();
};

/**
 * Validates Brazilian phone format (simple check for DDD + 8 or 9 digits).
 */
export const isValidPhone = (phone: string): boolean => {
  const digits = normalizePhone(phone);
  return digits.length >= 10 && digits.length <= 11;
};

/**
 * Simple email validation.
 */
export const isValidEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(normalizeEmail(email));
};
