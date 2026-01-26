const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = process.env.UPLOAD_DIR || './uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 如果是創建申請，使用 temp 文件夾；如果是上傳到現有申請，使用申請 ID
    const applicationId = req.params.id || req.body.extra_working_hours_application_id || 'temp';
    const folderPath = path.join(uploadDir, 'extra-working-hours-documents', applicationId.toString());
    
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
  
  const fileExt = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
  
  const isValidType = allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExt);
  
  if (!isValidType) {
    return cb(new Error(`不支援的檔案類型。只允許：${allowedExtensions.join(', ')}`), false);
  }
  
  cb(null, true);
};

const uploadMultiple = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 100
  },
  fileFilter: fileFilter
});

const upload = uploadMultiple;

module.exports = {
  upload,
  uploadMultiple
};

