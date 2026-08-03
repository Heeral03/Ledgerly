const multer = require('multer');
const path = require('path');

// ── File upload config ───────────────────────────────────────────────
const storage = multer.memoryStorage(); // Keep file in memory, encrypt immediately
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only .xlsx, .xls, and .csv files are allowed'));
  },
});

module.exports = upload;
