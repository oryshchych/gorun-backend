// routes/cloudinary.ts
import express from 'express';
import cloudinary from '../cloudinary';

const router = express.Router();

// Returns a signed payload for a direct browser → Cloudinary upload.
// The signed params (timestamp, folder) must match exactly what the client
// sends in the upload form-data, or Cloudinary rejects the signature.
router.get('/signature', (_req, res) => {
  const timestamp = Math.round(Date.now() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder: 'events',
    },
    process.env.CLOUDINARY_API_SECRET!
  );

  res.json({
    timestamp,
    signature,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
  });
});

export default router;
