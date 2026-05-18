#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const distRoot = path.join(repoRoot, 'web-dist');
const indexPath = path.join(distRoot, 'index.html');
const serverEntryPath = path.join(distRoot, 'server', 'entry-server.js');

const [{ render }, html] = await Promise.all([
  import(pathToFileURL(serverEntryPath).href),
  fs.readFile(indexPath, 'utf8'),
]);

await fs.writeFile(indexPath, html.replace('<!--ssr-demo-->', render()));
await fs.rm(path.join(distRoot, 'server'), { force: true, recursive: true });
