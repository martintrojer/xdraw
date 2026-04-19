#!/usr/bin/env bun

import path from 'node:path';
import index from '../src/index.html';

function randomPort() {
  return 3000 + Math.floor(Math.random() * 30000);
}

function printHelp() {
  console.log(`xdraw

Usage:
  xdraw <file>
  xdraw open <file>
  xdraw new <file>

Notes:
  - Opens Excalidraw in system browser
  - Saves back to same .excalidraw file
  - Single executable build: bun run compile
`);
}

function normalizeTarget(input?: string) {
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

function openBrowser(url: string) {
  if (process.env.XDRAW_NO_OPEN === '1') {
    return;
  }

  const platform = process.platform;

  if (platform === 'darwin') {
    Bun.spawn(['open', url], {
      stdout: 'ignore',
      stderr: 'ignore',
      stdin: 'ignore',
      detached: true,
    });
    return;
  }

  if (platform === 'win32') {
    Bun.spawn(['cmd', '/c', 'start', '', url], {
      stdout: 'ignore',
      stderr: 'ignore',
      stdin: 'ignore',
      detached: true,
    });
    return;
  }

  Bun.spawn(['xdg-open', url], {
    stdout: 'ignore',
    stderr: 'ignore',
    stdin: 'ignore',
    detached: true,
  });
}

async function readScene(targetPath: string) {
  const raw = await Bun.file(targetPath).text();
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

  let isNewFile = false;
  const targetFile = Bun.file(targetPath);
  const exists = await targetFile.exists();

  if (exists && command === 'new') {
    throw new Error(`File already exists: ${targetPath}`);
  }

  if (!exists) {
    await Bun.$`mkdir -p ${path.dirname(targetPath)}`.quiet();
    await Bun.write(targetPath, `${JSON.stringify(createEmptyScene(), null, 2)}\n`);
    isNewFile = true;
  }

  let server: Bun.Server<undefined> | null = null;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      server = Bun.serve({
        port: randomPort(),
        development: process.env.NODE_ENV !== 'production',
        routes: {
          '/': index,
          '/api/scene': {
            GET: async () =>
              Response.json({
                path: targetPath,
                basename: path.basename(targetPath),
                isNewFile,
                scene: await readScene(targetPath),
              }),
            PUT: async (req: Request) => {
              const body = await req.json();
              await Bun.write(targetPath, `${JSON.stringify(body, null, 2)}\n`);
              isNewFile = false;

              return Response.json({
                basename: path.basename(targetPath),
                savedAt: new Date().toISOString(),
              });
            },
          },
        },
        fetch() {
          return new Response('Not found', { status: 404 });
        },
      });
      break;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code !== 'EADDRINUSE') {
        throw error;
      }
      server = null;
    }
  }

  if (!server) {
    throw new Error('Failed to start server after multiple port attempts.');
  }

  console.log(`xdraw serving ${targetPath}`);
  console.log(`xdraw opening ${server.url.href}`);
  openBrowser(server.url.href);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
