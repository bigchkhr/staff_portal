const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// 一般 API 的 Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100, // 限制 100 個請求
  message: '請求過於頻繁，請稍後再試',
  standardHeaders: true,
  legacyHeaders: false,
});

// 登入 API 的嚴格 Rate Limiting（防暴力破解）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 5, // 只允許 5 次嘗試
  message: '登入嘗試次數過多，請 15 分鐘後再試',
  skipSuccessfulRequests: true, // 成功的請求不計入
  standardHeaders: true,
  legacyHeaders: false,
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
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 年
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
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

