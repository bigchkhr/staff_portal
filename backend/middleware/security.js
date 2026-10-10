const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const User = require('../database/models/User');

// HR 成員檢查緩存（避免每次請求都查詢數據庫）
const hrMemberCache = new Map();
// 批核成員（supervisor / approver1/2/3 / checker）檢查緩存（避免每次請求都查詢數據庫）
const approvalMemberCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 緩存 5 分鐘

// 定期清理過期緩存（每 10 分鐘清理一次）
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of hrMemberCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      hrMemberCache.delete(key);
    }
  }
  for (const [key, value] of approvalMemberCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      approvalMemberCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

// 檢查用戶是否為 HR Group 成員（帶緩存）
const checkHRMembership = async (userId) => {
  const cacheKey = `hr_member_${userId}`;
  const cached = hrMemberCache.get(cacheKey);
  
  // 如果緩存存在且未過期，直接返回
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.isHRMember;
  }
  
  // 查詢數據庫
  try {
    const isHRMember = await User.isHRMember(userId);
    // 更新緩存
    hrMemberCache.set(cacheKey, {
      isHRMember,
      timestamp: Date.now()
    });
    return isHRMember;
  } catch (error) {
    console.warn('[checkHRMembership] Error:', error.message);
    return false;
  }
};

// 檢查用戶是否豁免一般 API rate limit（supervisor / approver1/2/3 / checker，帶緩存）
const checkApprovalMembership = async (userId) => {
  const cacheKey = `approval_member_${userId}`;
  const cached = approvalMemberCache.get(cacheKey);

  // 如果緩存存在且未過期，直接返回
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.isApprovalMember;
  }

  // 查詢數據庫
  try {
    const isApprovalMember = await User.isRateLimitExemptMember(userId);
    // 更新緩存
    approvalMemberCache.set(cacheKey, {
      isApprovalMember,
      timestamp: Date.now()
    });
    return isApprovalMember;
  } catch (error) {
    console.warn('[checkApprovalMembership] Error:', error.message);
    return false;
  }
};

// 一般 API 的 Rate Limiting（基於用戶 ID，HR Group 與 supervisor / approver1/2/3 / checker 不受限制）
const apiLimiter = rateLimit({
  windowMs: 10* 60 * 1000, // 10 分鐘
  max: 200, // 限制 200 個請求
  message: { message: 'Too many requests, please try again later. 請求過於頻繁，請稍後再試' },
  standardHeaders: true,
  legacyHeaders: false,
  // 基於用戶 ID 進行限制（而不是 IP）
  keyGenerator: (req) => {
    try {
      // 嘗試從 Authorization header 獲取 token
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        // 解析 token（不驗證，只獲取 userId）
        const decoded = jwt.decode(token);
        if (decoded && decoded.userId) {
          // 使用用戶 ID 作為 key
          return `user_${decoded.userId}`;
        }
      }
      // 如果沒有 token 或無法解析，回退到使用 IP（用 ipKeyGenerator 正確處理 IPv6）
      return ipKeyGenerator(req);
    } catch (error) {
      // 如果解析失敗，回退到使用 IP（用 ipKeyGenerator 正確處理 IPv6）
      return ipKeyGenerator(req);
    }
  },
  handler: (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    let userId = 'unknown';
    try {
      if (token) {
        const decoded = jwt.decode(token);
        userId = decoded?.userId || 'unknown';
      }
    } catch (e) {
      // ignore
    }
    
    console.log(`🚫 [API RATE LIMIT] 429 錯誤 - 用戶 ID: ${userId}, 路徑: ${req.path}, 方法: ${req.method}, IP: ${req.ip || req.connection.remoteAddress || 'unknown'}, 時間: ${new Date().toISOString()}`);
    
    res.status(429).json({ 
      message: 'Too many requests, please try again later. 請求過於頻繁，請稍後再試',
      error: 'TOO_MANY_REQUESTS'
    });
  },
  // 跳過 HR Group 與 supervisor / approver1/2/3 / checker 的請求
  skip: async (req) => {
    try {
      // 嘗試從 Authorization header 獲取 token
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return false; // 沒有 token，不跳過（應用 rate limit）
      }

      // 解析 token（不驗證，只獲取 userId）
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.userId) {
        return false; // token 無效，不跳過
      }

      // 檢查是否為 HR Group 成員或批核成員（使用緩存）
      const [isHRMember, isApprovalMember] = await Promise.all([
        checkHRMembership(decoded.userId),
        checkApprovalMembership(decoded.userId)
      ]);

      return isHRMember || isApprovalMember; // 如果是 HR 或批核角色，跳過 rate limit
    } catch (error) {
      // 如果檢查失敗，不跳過（應用 rate limit 以確保安全）
      console.warn('[apiLimiter] Error checking membership:', error.message);
      return false;
    }
  }
});

// 登入 API 的嚴格 Rate Limiting（防暴力破解，基於用戶）
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 15 分鐘
  max: 6, // 只允許 6 次嘗試
  message: { message: 'Too many login attempts. Please try again in 10 minutes. 登入嘗試次數過多，請 10 分鐘後再試' },
  skipSuccessfulRequests: true, // 成功的請求不計入
  standardHeaders: true,
  legacyHeaders: false,
  // 基於用戶（employee_number）進行限制（而不是 IP）
  keyGenerator: (req) => {
    // 嘗試從請求體獲取 employee_number
    const employeeNumber = req.body?.employee_number;
    if (employeeNumber) {
      // 使用員工編號作為 key
      return `login_${employeeNumber}`;
    }
    // 如果沒有 employee_number，回退到使用 IP（用 ipKeyGenerator 正確處理 IPv6）
    return ipKeyGenerator(req);
  },
  handler: (req, res) => {
    const employeeNumber = req.body?.employee_number || 'unknown';
    console.log(`🚫 [LOGIN RATE LIMIT] 429 錯誤 - 員工編號: ${employeeNumber}, IP: ${req.ip || req.connection.remoteAddress || 'unknown'}, 時間: ${new Date().toISOString()}`);
    
    res.status(429).json({ 
      message: 'Too many login attempts. Please try again in 15 minutes. 登入嘗試次數過多，請 15 分鐘後再試',
      error: 'TOO_MANY_LOGIN_ATTEMPTS'
    });
  }
});

// IP 白名單中間件（用於敏感端點）
const ipWhitelist = (req, res, next) => {
  const allowedIPs = process.env.ALLOWED_IPS 
    ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim())
    : [];
  
  if (allowedIPs.length === 0) {
    console.warn('⚠️  警告: ALLOWED_IPS 未設置，IP 白名單未啟用');
    return next();
  }
  
  const clientIP = req.ip || req.connection.remoteAddress;
  const forwardedIP = req.headers['x-forwarded-for'];
  const realIP = forwardedIP ? forwardedIP.split(',')[0].trim() : clientIP;
  
  if (!allowedIPs.includes(realIP)) {
    console.warn(`⚠️  拒絕來自 ${realIP} 的請求（不在白名單中）`);
    return res.status(403).json({ message: '訪問被拒絕' });
  }
  
  next();
};

// 請求大小限制
const requestSizeLimit = {
  json: { limit: '10mb' },
  urlencoded: { limit: '10mb', extended: true }
};

// Helmet 安全頭配置
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      frameSrc: ["'self'", "blob:"], // 允許 blob URL 用於 iframe（顯示 PDF）
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 年
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'sameorigin' }, // 改為 sameorigin 以允許同源 iframe（用於顯示 PDF）
  noSniff: true,
  xssFilter: true,
});

// 安全日誌記錄
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };
    
    // 記錄異常狀態
    if (res.statusCode >= 400) {
      console.warn('⚠️  異常請求:', JSON.stringify(logData));
    }
    
    // 記錄敏感操作
    if (req.path.includes('/admin')) {
      console.log('🔐 敏感操作:', JSON.stringify(logData));
    }
  });
  
  next();
};

module.exports = {
  apiLimiter,
  loginLimiter,
  ipWhitelist,
  requestSizeLimit,
  helmetConfig,
  securityLogger
};

