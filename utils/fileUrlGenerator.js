const r2PublicDevUrl = process.env.R2_PUBLIC_DEV_URL || "https://pub-c0be1568314a40d49fab4f1974e8e917.r2.dev";

function generateFileUrl(filename) {
  return `${r2PublicDevUrl}/waslerr-files/${encodeURIComponent(filename)}`;
}

module.exports = { generateFileUrl };
