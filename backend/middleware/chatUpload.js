const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = process.env.UPLOAD_DIR || './uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 從路由參數獲取聊天室 ID（路由格式：/:id/messages）
    const chatRoomId = req.params.id || req.body.chat_room_id || 'temp';
    const folderPath = path.join(uploadDir, 'chat-files', chatRoomId.toString());
    
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
  // 允許的檔案類型：PDF、圖片、Word、Excel、PowerPoint
  const allowedTypes = [
    // PDF
    'application/pdf',
    // 圖片
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/bmp', 
    'image/webp',
    'image/tiff',
    'image/tif',
    // Word
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    // Excel
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    // PowerPoint
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
  ];
  
  // 檢查 mimetype 或副檔名
  const fileExt = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [
    '.pdf',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif',
    '.doc', '.docx',
    '.xls', '.xlsx',
    '.ppt', '.pptx'
  ];
  
  // 檢查檔案類型
  const isValidType = allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExt);
  
  if (!isValidType) {
    return cb(new Error(`不支援的檔案類型。只允許：PDF、圖片（JPG、PNG、GIF等）、Word（DOC、DOCX）、Excel（XLS、XLSX）、PowerPoint（PPT、PPTX）`), false);
  }
  
  cb(null, true);
};

// 單檔案上傳（用於聊天室）
const uploadSingle = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: fileFilter
});

// 多檔案上傳（用於一次上傳多個檔案）
const uploadMultiple = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10 // 最多 10 個檔案
  },
  fileFilter: fileFilter
});

module.exports = {
  uploadSingle,
  uploadMultiple
};

