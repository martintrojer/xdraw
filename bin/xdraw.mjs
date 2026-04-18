#!/usr/bin/env node

import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

function printHelp() {
  console.log(`xdraw

Usage:
  xdraw <file>
  xdraw open <file>
  xdraw new <file>

Notes:
  - Opens Excalidraw in system browser
  - Saves back to same .excalidraw file
  - Run "npm run build" before first use from repo
`);
}

function normalizeTarget(input) {
  if (!input) {
    throw new Error('Missing file path');
  }

  return input.endsWith('.excalidraw') ? input : `${input}.excalidraw`;
}

function createEmptyScene() {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements: [],
    appState: {
      viewBackgroundColor: '#ffffff',
    },
    files: {},
  };
}

async function ensureDistExists() {
  try {
    await fs.access(path.join(distDir, 'index.html'));
  } catch {
    throw new Error('Missing dist build. Run "npm run build" first.');
  }
}

function getMimeType(filePath) {
  const ext = path.extname(filePath);
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.woff2':
      return 'font/woff2';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function openBrowser(url) {
  if (process.env.XDRAW_NO_OPEN === '1') {
    return;
  }

  const platform = process.platform;

  if (platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
    return;
  }

  if (platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
    return;
  }

  spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
}

async function readScene(targetPath) {
  const raw = await fs.readFile(targetPath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const [commandOrPath, maybePath] = args;
  const command = ['open', 'new'].includes(commandOrPath) ? commandOrPath : 'open';
  const rawTarget = command === 'open' ? commandOrPath : maybePath;
  const targetPath = path.resolve(process.cwd(), normalizeTarget(rawTarget));

  await ensureDistExists();

  let isNewFile = false;
  try {
    await fs.access(targetPath);
    if (command === 'new') {
      throw new Error(`File already exists: ${targetPath}`);
    }
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined;
    if (code !== 'ENOENT') {
      throw error;
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, JSON.stringify(createEmptyScene(), null, 2));
    isNewFile = true;
  }

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
    const pathname = requestUrl.pathname;

    try {
      if (pathname === '/api/scene' && req.method === 'GET') {
        const scene = await readScene(targetPath);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            path: targetPath,
            basename: path.basename(targetPath),
            isNewFile,
            scene,
          })
        );
        return;
      }

      if (pathname === '/api/scene' && req.method === 'PUT') {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }

        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const scene = {
          type: 'excalidraw',
          version: 2,
          source: 'https://excalidraw.com',
          elements: Array.isArray(body.elements) ? body.elements : [],
          appState: body.appState && typeof body.appState === 'object' ? body.appState : {},
          files: body.files && typeof body.files === 'object' ? body.files : {},
        };

        await fs.writeFile(targetPath, `${JSON.stringify(scene, null, 2)}\n`);
        isNewFile = false;

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            basename: path.basename(targetPath),
            savedAt: new Date().toISOString(),
          })
        );
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method not allowed');
        return;
      }

      const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
      const filePath = path.join(distDir, relativePath);
      const normalizedPath = path.normalize(filePath);

      if (!normalizedPath.startsWith(distDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      const content = await fs.readFile(normalizedPath);
      res.writeHead(200, { 'Content-Type': getMimeType(normalizedPath) });
      res.end(content);
    } catch (error) {
      const code = error && typeof error === 'object' ? error.code : undefined;

      if (code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      console.error(error);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    }
  });

  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind server');
    }

    const url = `http://127.0.0.1:${address.port}`;
    console.log(`xdraw serving ${targetPath}`);
    console.log(`xdraw opening ${url}`);
    openBrowser(url);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
