const path = require('path');
const multer = require('multer');
const fileStorage = require('../localFiles');

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'text/plain',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('File type not allowed. Use PDF, Office, images or text.'));
    }
    return cb(null, true);
  },
}).single('file');

function eProcessTaskAttachmentUpload(req, res, next) {
  if (!req.params.runId || !req.params.taskId) {
    return res.status(400).json({ message: 'Missing run or task id.' });
  }
  return upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed.' });
    if (!req.file) return next();
    try {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const key = `e-process/tasks/${req.params.taskId}/${unique}${path.extname(req.file.originalname || '')}`;
      await fileStorage.uploadBuffer(key, req.file.buffer, req.file.mimetype);
      req.file.storageKey = key;
      req.file.path = key;
      req.file.filename = path.basename(key);
      return next();
    } catch (uploadErr) {
      console.error('[eProcess] task upload failed:', uploadErr.message);
      return res.status(500).json({ message: 'Upload failed.' });
    }
  });
}

module.exports = { eProcessTaskAttachmentUpload };
