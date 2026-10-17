// Image uploads (menu photos, gallery, customers' inspiration photos), stored in data/uploads
// under random names so they can't be guessed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { UPLOAD_DIR } from './db.js';
import { bad } from './validate.js';

const IMAGE_TYPES = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic',
};

export const imageUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + IMAGE_TYPES[file.mimetype]),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES[file.mimetype]) cb(null, true);
    else cb(bad('Photos must be JPG, PNG, WebP, GIF or HEIC.'));
  },
});

export function removeImage(filename) {
  if (filename && /^[a-f0-9]+\.(jpg|png|webp|gif|heic)$/.test(filename)) {
    fs.rm(path.join(UPLOAD_DIR, filename), { force: true }, () => {});
  }
}

// Wraps a handler that may have received an uploaded image (field `field`), and deletes the
// upload again if the handler rejects the request.
export const withImage = (handler, field = 'image') => [
  imageUpload.single(field),
  (req, res) => {
    try {
      handler(req, res);
    } catch (err) {
      removeImage(req.file?.filename);
      throw err;
    }
  },
];
