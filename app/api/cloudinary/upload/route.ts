import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);

const signCloudinaryParams = (params: Record<string, string>, apiSecret: string) => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return createHash('sha1')
    .update(`${payload}${apiSecret}`)
    .digest('hex');
};

export async function POST(request: NextRequest) {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Cloudinary upload is not configured.' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Proof of payment file is required.' }, { status: 400 });
    }

    if (file.type && !allowedTypes.has(file.type)) {
      return NextResponse.json({ error: 'Only image or PDF proof files are allowed.' }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign: Record<string, string> = {
      folder: 'pasakay/driver-memberships',
      timestamp,
    };

    if (uploadPreset) {
      paramsToSign.upload_preset = uploadPreset;
    }

    const signature = signCloudinaryParams(paramsToSign, apiSecret);
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    uploadForm.append('api_key', apiKey);
    uploadForm.append('signature', signature);

    Object.entries(paramsToSign).forEach(([key, value]) => {
      uploadForm.append(key, value);
    });

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: uploadForm,
    });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Cloudinary upload failed.' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      secureUrl: data.secure_url,
      publicId: data.public_id,
      resourceType: data.resource_type,
      format: data.format,
      bytes: data.bytes,
      originalFilename: data.original_filename || file.name,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to upload proof of payment.' }, { status: 500 });
  }
}
