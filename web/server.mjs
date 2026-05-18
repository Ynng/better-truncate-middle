#!/usr/bin/env node
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer as createViteServer } from 'vite';

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(webRoot, 'index.html');
const options = parseArgs(process.argv.slice(2));
const server = http.createServer(handleRequest);

const vite = await createViteServer({
  root: webRoot,
  server: {
    hmr: { clientPort: options.port, server },
    host: options.host,
    middlewareMode: { server },
  },
  appType: 'custom',
});

async function handleRequest(req, res) {
  try {
    const url = req.url ?? '/';

    if (isIndexRequest(url)) {
      const template = await fs.readFile(indexPath, 'utf8');
      const transformed = await vite.transformIndexHtml(url, template);
      const { render } = await vite.ssrLoadModule('/entry-server.tsx');
      const html = transformed.replace('<!--ssr-demo-->', render());

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
      return;
    }

    const htmlPath = htmlFilePath(url);
    if (htmlPath !== null) {
      const template = await fs.readFile(htmlPath, 'utf8');
      const html = await vite.transformIndexHtml(url, template);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
      return;
    }

    vite.middlewares(req, res, (error) => {
      if (error) {
        vite.ssrFixStacktrace(error);
        console.error(error);
        res.statusCode = 500;
        res.end(
          error instanceof Error ? error.message : 'Internal server error',
        );
        return;
      }

      res.statusCode = 404;
      res.end('Not found');
    });
  } catch (error) {
    vite.ssrFixStacktrace(error);
    console.error(error);
    res.statusCode = 500;
    res.end(error instanceof Error ? error.message : 'Internal server error');
  }
}

server.listen(options.port, options.host, () => {
  const host = options.host === '0.0.0.0' ? 'localhost' : options.host;
  console.log(`web dev server: http://${host}:${String(options.port)}/`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => {
      void vite.close().then(() => {
        process.exit(0);
      });
    });
  });
}

function isIndexRequest(url) {
  const pathname = new URL(url, 'http://web.local').pathname;
  return pathname === '/' || pathname === '/index.html';
}

function htmlFilePath(url) {
  const pathname = new URL(url, 'http://web.local').pathname;
  if (!pathname.endsWith('.html')) return null;

  const filePath = path.resolve(webRoot, `.${pathname}`);
  if (!filePath.startsWith(`${webRoot}${path.sep}`)) return null;
  return filePath;
}

function parseArgs(args) {
  const parsed = { host: '127.0.0.1', port: 6007 };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--host') {
      parsed.host = args[index + 1] ?? parsed.host;
      index += 1;
    } else if (arg.startsWith('--host=')) {
      parsed.host = arg.slice('--host='.length);
    } else if (arg === '--port') {
      parsed.port = Number(args[index + 1] ?? parsed.port);
      index += 1;
    } else if (arg.startsWith('--port=')) {
      parsed.port = Number(arg.slice('--port='.length));
    }
  }

  if (!Number.isInteger(parsed.port) || parsed.port <= 0) {
    throw new Error(`Invalid --port value: ${String(parsed.port)}`);
  }

  return parsed;
}
