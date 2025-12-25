const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = process.env.UPLOAD_DIR || './uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const leaveApplicationId = req.body.leave_application_id || req.params.id || 'temp';
    const folderPath = path.join(uploadDir, 'leave-documents', leaveApplicationId.toString());
    
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    
    cb(null, folderPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // 允許的檔案類型：pdf、jpeg、jpg、tiff 和其他圖片格式
  const allowedTypes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/bmp', 
    'image/webp',
    'image/tiff',
    'image/tif',
    'application/pdf'
  ];
  
  // 檢查 mimetype 或副檔名
  const fileExt = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
  
  // 檢查檔案大小（5MB）
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  // 檢查檔案類型
  const isValidType = allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExt);
  
  if (!isValidType) {
    return cb(new Error(`不支援的檔案類型。只允許：${allowedExtensions.join(', ')}`), false);
  }
  
  cb(null, true);
};

// 單檔案上傳（用於創建申請時）
const uploadSingle = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

// 多檔案上傳（用於一次上傳多個檔案）
const uploadMultiple = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 100 // 最多 100 個檔案（不限制數量，但設置一個合理的上限）
  },
  fileFilter: fileFilter
});

// 預設導出 uploadMultiple，支持多文件上傳
const upload = uploadMultiple;

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple
};