// routes/cloudinary.ts
import express, { type Request, type Response } from 'express';
import cloudinary from '../cloudinary';

const router = express.Router();

router.get('/signature', (_req, res) => {
  const timestamp = Math.round(Date.now() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder: 'events',
      type: 'upload',
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

// Derives a Cloudinary public_id from a secure_url, then returns a short-lived
// signed URL so that authenticated-type assets (existing PDFs) can be opened.
router.get('/signed-url', (req: Request, res: Response) => {
  const raw = req.query['url'];
  if (typeof raw !== 'string' || !raw) {
    res.status(400).json({ success: false, message: 'url query param required' });
    return;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? '';

  // Extract everything after /upload/ (or /raw/upload/) as the versioned path,
  // then strip the leading version segment (v1234567890/) if present.
  const uploadMarker = '/upload/';
  const markerIdx = raw.indexOf(uploadMarker);
  if (markerIdx === -1) {
    res.status(400).json({ success: false, message: 'Not a Cloudinary upload URL' });
    return;
  }

  let publicIdWithExt = raw.slice(markerIdx + uploadMarker.length);
  // Remove version prefix (vNNNNNNNNNN/)
  publicIdWithExt = publicIdWithExt.replace(/^v\d+\//, '');
  // Remove file extension for the public_id
  const dotIdx = publicIdWithExt.lastIndexOf('.');
  const publicId = dotIdx !== -1 ? publicIdWithExt.slice(0, dotIdx) : publicIdWithExt;

  const signedUrl = cloudinary.url(publicId, {
    resource_type: 'raw',
    type: 'authenticated',
    sign_url: true,
    secure: true,
    expires_at: Math.round(Date.now() / 1000) + 3600, // 1-hour window
    cloud_name: cloudName,
  });

  res.json({ success: true, data: { signedUrl } });
});

export default router;
