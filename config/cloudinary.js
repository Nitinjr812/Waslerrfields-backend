const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload audio file to Cloudinary
const uploadAudio = async (fileBuffer, fileName) => {
  try {
    const result = await cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto', // Allows audio files
        folder: 'audio_items', // Organize files in folder
        public_id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        format: 'mp3', // Convert to mp3 for consistency
      },
      (error, result) => {
        if (error) {
          throw error;
        }
        return result;
      }
    );

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto',
          folder: 'audio_items',
          public_id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

// Delete audio file from Cloudinary
const deleteAudio = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'auto'
    });
    return result;
  } catch (error) {
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
};

module.exports = {
  cloudinary,
  uploadAudio,
  deleteAudio
};