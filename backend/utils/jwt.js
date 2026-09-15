const jwt = require('jsonwebtoken');

const VALID_TOKEN_EXPIRES_UNITS = ['m', 'h', 'd', 'mo', 'never'];

/**
 * 將用戶的 token 時效設定轉成 jwt.sign 可用的 expiresIn。
 * @returns {string|null} string = 時效；null = 永不過期
 */
const resolveTokenExpiresIn = (user = {}) => {
  const unit = user.token_expires_unit;
  if (!unit) {
    return process.env.JWT_EXPIRES_IN || '1h';
  }
  if (unit === 'never') {
    return null;
  }

  const value = parseInt(user.token_expires_value, 10);
  if (!Number.isFinite(value) || value < 1) {
    return process.env.JWT_EXPIRES_IN || '1h';
  }

  // jsonwebtoken 不支援「月」，以 30 天近似
  if (unit === 'mo') {
    return `${value * 30}d`;
  }

  return `${value}${unit}`;
};

/**
 * 正規化並驗證 admin 傳入的 token 時效欄位。
 * unit 為空 / default → 兩邊皆 null（用系統預設）
 */
const normalizeTokenExpires = (value, unit) => {
  if (!unit || unit === 'default') {
    return { token_expires_value: null, token_expires_unit: null };
  }

  if (!VALID_TOKEN_EXPIRES_UNITS.includes(unit)) {
    const error = new Error('無效的 token 時效單位');
    error.statusCode = 400;
    throw error;
  }

  if (unit === 'never') {
    return { token_expires_value: null, token_expires_unit: 'never' };
  }

  const num = parseInt(value, 10);
  if (!Number.isFinite(num) || num < 1) {
    const error = new Error('請輸入有效的 token 時效數值（至少為 1）');
    error.statusCode = 400;
    throw error;
  }

  return { token_expires_value: num, token_expires_unit: unit };
};

/**
 * @param {number|string} userId
 * @param {string|null|undefined} expiresIn - string 時效；null = 永不；undefined = 用環境變數預設
 */
const generateToken = (userId, expiresIn) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not set. Please check your .env file.');
  }

  const signOptions = {};
  if (expiresIn === null) {
    // 永不過期：不設 expiresIn
  } else {
    signOptions.expiresIn = expiresIn || process.env.JWT_EXPIRES_IN || '1h';
  }

  return jwt.sign({ userId }, secret, signOptions);
};

const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not set. Please check your .env file.');
  }

  return jwt.verify(token, secret);
};

module.exports = {
  generateToken,
  verifyToken,
  resolveTokenExpiresIn,
  normalizeTokenExpires,
  VALID_TOKEN_EXPIRES_UNITS
};
