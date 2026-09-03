const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../../uploads');
const paymentProofsDir = path.join(uploadDir, 'payments');
const maintenancePhotosDir = path.join(uploadDir, 'maintenance');
const avatarsDir = path.join(uploadDir, 'avatars');

[uploadDir, paymentProofsDir, maintenancePhotosDir, avatarsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure disk storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'proof_image' || file.fieldname === 'proof') {
            cb(null, paymentProofsDir);
        } else if (file.fieldname === 'photo' || file.fieldname === 'photo_url') {
            cb(null, maintenancePhotosDir);
        } else {
            cb(null, uploadDir);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

// File filter (images and pdfs)
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|pdf|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    }
    cb(new Error('Only image files (JPG, PNG, WEBP, GIF) and PDFs are allowed!'));
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter
});

module.exports = upload;
