const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = process.env.UPLOAD_DIR || './uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folderPath = path.join(uploadDir, 'announcements');
    
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
  // 允許的檔案類型：pdf、圖片格式等
  const allowedTypes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/bmp', 
    'image/webp',
    'image/tiff',
    'image/tif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  
  // 檢查 mimetype 或副檔名
  const fileExt = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
  
  // 檢查檔案類型
  const isValidType = allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExt);
  
  if (!isValidType) {
    return cb(new Error(`不支援的檔案類型。只允許：${allowedExtensions.join(', ')}`), false);
  }
  
  cb(null, true);
};

// 多檔案上傳（用於一次上傳多個檔案）
const uploadMultiple = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50 // 最多 50 個檔案
  },
  fileFilter: fileFilter
});

module.exports = {
  uploadMultiple
};

