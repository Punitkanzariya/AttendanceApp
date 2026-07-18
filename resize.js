const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');

async function resizeImages() {
  try {
    const splashPath = path.join(assetsDir, 'splash-icon.png');
    if (fs.existsSync(splashPath)) {
      const splash = await Jimp.read(splashPath);
      await splash.resize(512, Jimp.AUTO).quality(80).writeAsync(splashPath);
      console.log('splash-icon.png resized to 512px');
    }

    const iconPath = path.join(assetsDir, 'icon.png');
    if (fs.existsSync(iconPath)) {
      const icon = await Jimp.read(iconPath);
      await icon.resize(512, Jimp.AUTO).quality(80).writeAsync(iconPath);
      console.log('icon.png resized to 512px');
    }

    const androidForegroundPath = path.join(assetsDir, 'android-icon-foreground.png');
    if (fs.existsSync(androidForegroundPath)) {
      const foreground = await Jimp.read(androidForegroundPath);
      await foreground.resize(512, Jimp.AUTO).quality(80).writeAsync(androidForegroundPath);
      console.log('android-icon-foreground.png resized to 512px');
    }
  } catch (err) {
    console.error('Error resizing images:', err);
  }
}

resizeImages();
