import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

console.log("Starting favicon generation pipeline...");

// 1. Download source image if not already downloaded
const sourceUrl = "https://zzkzssqwpcacmegmxerb.supabase.co/storage/v1/object/public/product-images/products/lgo%20ps.png";
const tmpSource = "/tmp/logo_source.png";
if (!fs.existsSync(tmpSource)) {
  console.log("Downloading source image from URL...");
  execSync(`curl -s -o "${tmpSource}" "${sourceUrl}"`);
}

// 2. Extract raw RGBA bytes of source
execSync(`convert "${tmpSource}" rgba:/tmp/source.raw`);
const rawBuf = fs.readFileSync("/tmp/source.raw");
const srcW = 1200, srcH = 1200;

// 3. Crop logo region [minX: 37, minY: 100, maxX: 1163, maxY: 1056]
const cropX = 37, cropY = 100;
const cropW = 1127, cropH = 957;
const cleanCroppedBuf = Buffer.alloc(cropW * cropH * 4);

for (let y = 0; y < cropH; y++) {
  for (let x = 0; x < cropW; x++) {
    const srcIdx = ((y + cropY) * srcW + (x + cropX)) * 4;
    const dstIdx = (y * cropW + x) * 4;
    const a = rawBuf[srcIdx + 3];
    
    // Purify and sharpen alpha channel
    if (a > 15) {
      // Solid black ink
      cleanCroppedBuf[dstIdx] = 0;
      cleanCroppedBuf[dstIdx + 1] = 0;
      cleanCroppedBuf[dstIdx + 2] = 0;
      
      // Sharpen anti-aliasing curve slightly
      let cleanA;
      if (a >= 225) {
        cleanA = 255;
      } else {
        // Linear rescale for crisp edge transitions without blur
        cleanA = Math.round(((a - 15) / (225 - 15)) * 255);
      }
      cleanCroppedBuf[dstIdx + 3] = cleanA;
    } else {
      // Clean transparent
      cleanCroppedBuf[dstIdx] = 0;
      cleanCroppedBuf[dstIdx + 1] = 0;
      cleanCroppedBuf[dstIdx + 2] = 0;
      cleanCroppedBuf[dstIdx + 3] = 0;
    }
  }
}

fs.writeFileSync("/tmp/cropped_logo_sharpened.raw", cleanCroppedBuf);
execSync(`convert -size ${cropW}x${cropH} -depth 8 rgba:/tmp/cropped_logo_sharpened.raw /tmp/cropped_logo_sharpened.png`);
console.log("Cropped and sharpened logo generated.");

// 4. Create master 1024x1024 rounded rectangle canvas with solid white background
// Corner radius: 215px (21% of 1024)
// Subtle 2px contour with rgba(0,0,0,0.07) for optimal contrast on white tabs
const masterSize = 1024;
const cornerRadius = 215;
// Fit logo inside: target width = 740, height = 740 * (957 / 1127) = 628
const targetLogoW = 740;
const targetLogoH = Math.round(targetLogoW * (cropH / cropW)); // 628
const offsetX = Math.round((masterSize - targetLogoW) / 2); // 142
const offsetY = Math.round((masterSize - targetLogoH) / 2); // 198

console.log(`Master layout: logo ${targetLogoW}x${targetLogoH} placed at offset (${offsetX}, ${offsetY})`);

// Compose master image
execSync(`
convert -size ${masterSize}x${masterSize} xc:none \
  -fill "#ffffff" \
  -stroke "rgba(0,0,0,0.08)" -strokewidth 2 \
  -draw "roundrectangle 1,1,1022,1022,${cornerRadius},${cornerRadius}" \
  \\( /tmp/cropped_logo_sharpened.png -resize ${targetLogoW}x${targetLogoH} -filter Lanczos \\) \
  -geometry +${offsetX}+${offsetY} -composite \
  -type TrueColorAlpha -colorspace sRGB -depth 8 \
  /tmp/master_favicon.png
`);

console.log("Master favicon created at /tmp/master_favicon.png");

// 5. Generate outputs in public/
const publicDir = path.resolve("public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 512x512
execSync(`convert /tmp/master_favicon.png -filter Lanczos -resize 512x512 "${path.join(publicDir, 'android-chrome-512x512.png')}"`);

// 192x192
execSync(`convert /tmp/master_favicon.png -filter Lanczos -resize 192x192 "${path.join(publicDir, 'android-chrome-192x192.png')}"`);

// 180x180 (Apple touch icon)
execSync(`convert /tmp/master_favicon.png -filter Lanczos -resize 180x180 "${path.join(publicDir, 'apple-touch-icon.png')}"`);

// 48x48
execSync(`convert /tmp/master_favicon.png -filter Lanczos -resize 48x48 -unsharp 0x0.75+0.75+0.008 "${path.join(publicDir, 'favicon-48x48.png')}"`);

// 32x32
execSync(`convert /tmp/master_favicon.png -filter Lanczos -resize 32x32 -unsharp 0x0.75+0.75+0.008 "${path.join(publicDir, 'favicon-32x32.png')}"`);

// 16x16
execSync(`convert /tmp/master_favicon.png -filter Lanczos -resize 16x16 -unsharp 0x0.75+0.75+0.008 "${path.join(publicDir, 'favicon-16x16.png')}"`);

// Generic favicon.png
fs.copyFileSync(path.join(publicDir, 'favicon-32x32.png'), path.join(publicDir, 'favicon.png'));

// Multi-resolution ICO (16, 32, 48)
execSync(`convert "${path.join(publicDir, 'favicon-16x16.png')}" "${path.join(publicDir, 'favicon-32x32.png')}" "${path.join(publicDir, 'favicon-48x48.png')}" "${path.join(publicDir, 'favicon.ico')}"`);

// 6. Generate SVG favicon: embed high-resolution 512x512 image into scalable SVG
const base64Png512 = fs.readFileSync(path.join(publicDir, 'android-chrome-512x512.png')).toString('base64');
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="data:image/png;base64,${base64Png512}" width="512" height="512" />
</svg>
`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent, 'utf8');

console.log("All favicon files successfully generated in public/!");
