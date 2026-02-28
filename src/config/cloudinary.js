import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (filePath) => {
  try {
    if (!filePath) return null;
    const response = await cloudinary.uploader.upload(filePath, {
      resource_type: 'auto',
      folder: 'taskflow',
    });

    console.log('Cloudinary upload response:', response);

    return response;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    fs.unlinkSync(filePath); // Clean up the local file
    throw error;
  }
};
export { uploadToCloudinary };
export default cloudinary;
