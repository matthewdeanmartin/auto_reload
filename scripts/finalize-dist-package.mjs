import { readFile, writeFile } from 'node:fs/promises';

const manifestUrl = new URL('../dist/package.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

// These fields make the source tree installable via `npm install ../auto_reload`,
// but their paths are wrong after `dist/` itself becomes the package root.
delete manifest.files;
delete manifest.main;

await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
