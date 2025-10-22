const r2PublicDevUrl = process.env.R2_PUBLIC_DEV_URL || "https://pub-c0be1568314a40d49fab4f1974e8e917.r2.dev";

// Utility function
function generateFileUrl(filename) {
  return `https://pub-79c57e1a78e74c94bf0b33acf829ba41.r2.dev/${encodeURIComponent(filename)}`;
}


module.exports = { generateFileUrl };
