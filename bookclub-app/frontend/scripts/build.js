const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Determine build target (default to 'india' / 'TownWink' if not set)
const target = process.env.DEPLOY_TARGET || 'india';
console.log(`🚀 Preparing build for target brand: ${target.toUpperCase()}`);

const frontendDir = path.resolve(__dirname, '..');
const publicDir = path.join(frontendDir, 'public');

// 1. Copy environment files if they exist (used by frictionless deploy script)
const envSrc = path.join(frontendDir, `.env.${target}`);
const envDest = path.join(frontendDir, '.env.production');
if (fs.existsSync(envSrc)) {
  console.log(`📋 Copying environment config from ${path.basename(envSrc)} to .env.production`);
  fs.copyFileSync(envSrc, envDest);
} else {
  console.log(`ℹ️ No specific env file found at ${envSrc}, using existing .env.production / defaults.`);
}

// 2. Setup brand-specific logo assets
const brandAssetsDir = path.join(publicDir, 'brand-assets', target);
if (fs.existsSync(brandAssetsDir)) {
  console.log(`🎨 Preparing brand assets from ${brandAssetsDir} ...`);
  
  // Copy logo.png
  const pngSrc = path.join(brandAssetsDir, 'logo.png');
  const pngDest = path.join(publicDir, 'logo.png');
  if (fs.existsSync(pngSrc)) {
    fs.copyFileSync(pngSrc, pngDest);
  }

  // Copy logo.svg if it exists (NearBorrow has an SVG, TownWink has a PNG)
  const svgSrc = path.join(brandAssetsDir, 'logo.svg');
  const svgDest = path.join(publicDir, 'logo.svg');
  if (fs.existsSync(svgSrc)) {
    fs.copyFileSync(svgSrc, svgDest);
  } else {
    // If no SVG exists for this brand, delete any old one in public/ to force using logo.png
    try { fs.unlinkSync(svgDest); } catch (e) { /* ignore */ }
  }
} else {
  console.warn(`⚠️ Brand assets directory not found: ${brandAssetsDir}`);
}

// 3. Generate brand-specific icons (favicon.ico, logo192.png, logo512.png)
console.log('⚡ Generating favicons and manifest assets...');
const generateResult = spawnSync('node', [path.join(frontendDir, 'scripts', 'generate-icons.js')], {
  stdio: 'inherit',
  cwd: frontendDir
});

if (generateResult.status !== 0) {
  console.error('❌ Failed to generate brand assets');
  process.exit(generateResult.status || 1);
}

// 4. Run original react build
console.log('🏗️ Running react-scripts build...');
const buildResult = spawnSync('npx', ['react-scripts', 'build'], {
  stdio: 'inherit',
  cwd: frontendDir,
  shell: true
});

if (buildResult.status !== 0) {
  console.error('❌ React build failed');
  process.exit(buildResult.status || 1);
}

console.log(`✅ React build completed successfully for target: ${target.toUpperCase()}`);
