import fs from 'node:fs/promises';
import path from 'node:path';

const sourceDir = path.resolve('node_modules/@excalidraw/excalidraw/dist/prod/fonts');
const targetDir = path.resolve('dist/fonts');

await fs.mkdir(path.dirname(targetDir), { recursive: true });
await fs.cp(sourceDir, targetDir, { recursive: true });
