import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceDir = join(__dirname, '../node_modules/@cubejs-client/playground/public/chart-renderers');
const targetDir = join(__dirname, '../public/chart-renderers');

function copyRecursiveSync(src, dest) {
  if (!existsSync(src)) {
    console.warn('⚠️  Chart renderers source not found. Skipping...');
    return;
  }

  const exists = existsSync(src);
  const stats = exists && statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }
    readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(join(src, childItemName), join(dest, childItemName));
    });
  } else {
    copyFileSync(src, dest);
  }
}

console.log('📦 Copying chart renderers...');
copyRecursiveSync(sourceDir, targetDir);
console.log('✅ Chart renderers copied successfully!');