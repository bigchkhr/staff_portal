const path = require('path');
const multer = require('multer');
const fileStorage = require('../localFiles');

const MAX_FILE_SIZE = 12 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('Use a JPEG, PNG, GIF, WebP image, or a PDF.'));
    }
    return cb(null, true);
  },
}).single('file');

function eProcessProcedureImageUpload(req, res, next) {
  if (!req.params.id || !req.params.stepId) {
    return res.status(400).json({ message: 'Missing procedure or step id.' });
  }
  return upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed.' });
    if (!req.file) return next();
    try {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const key = [
        'e-process',
        'procedures',
        String(req.params.id),
        'steps',
        String(req.params.stepId),
        `${unique}${path.extname(req.file.originalname || '')}`,
      ].join('/');
      await fileStorage.uploadBuffer(key, req.file.buffer, req.file.mimetype);
      req.file.storageKey = key;
      req.file.path = key;
      req.file.filename = path.basename(key);
      return next();
    } catch (uploadErr) {
      console.error('[eProcess] procedure upload failed:', uploadErr.message);
      return res.status(500).json({ message: 'Upload failed.' });
    }
  });
}

module.exports = { eProcessProcedureImageUpload };
