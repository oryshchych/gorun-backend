// routes/cloudinary.ts
import express from 'express';
import cloudinary from '../cloudinary';

const router = express.Router();

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
