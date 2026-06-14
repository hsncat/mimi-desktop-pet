import { removeBackground } from '@imgly/background-removal-node';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = process.argv[2] || 'C:\\Users\\hansh\\Desktop\\咪咪.png';
const outputDir = path.join(root, 'assets');
const outputPath = path.join(outputDir, 'mimi-cutout.png');

await mkdir(outputDir, { recursive: true });

const imageBuffer = await readFile(sourcePath);

const cutoutBlob = await removeBackground(new Blob([imageBuffer], { type: 'image/png' }), {
  output: {
    format: 'image/png',
    quality: 1
  }
});

const cutoutBuffer = Buffer.from(await cutoutBlob.arrayBuffer());
await writeFile(outputPath, cutoutBuffer);
console.log(`Created ${outputPath}`);
