const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

const {
  uploadsRoot: uploadsDir,
  signedUploadUrl,
} = require("../upload-access");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const directory = path.join(uploadsDir, req.company.id);
    fs.mkdirSync(directory, { recursive: true });
    cb(null, directory);
  },
  filename: function (req, file, cb) {
    const safeExt = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    }[file.mimetype];
    const uniqueName = `payment-${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}${safeExt}`;
    cb(null, uniqueName);
  },
});

function fileFilter(req, file, cb) {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Yalnız şəkil faylları yüklənə bilər"));
  }

  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "EXPEDITOR"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Şəkil seçilməyib" });
      }

      const url = signedUploadUrl(
        `/uploads/${req.company.id}/${req.file.filename}`,
        req,
      );

      return res.status(201).json({
        message: "Şəkil uğurla yükləndi",
        file: {
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url,
        },
      });
    } catch (error) {
      console.error("UPLOAD_IMAGE_ERROR:", error);
      return res
        .status(500)
        .json({ message: error.message || "Şəkil yüklənə bilmədi" });
    }
  },
);

module.exports = router;