import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Writes dist/sw.js from src/sw/sw.template.js with the list of all built files,
 * so the app is fully cached on first visit and keeps working offline.
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    writeBundle(options, bundle) {
      const dir = options.dir!;
      const files = [...Object.keys(bundle), ...readdirSync('public')].filter((f) => !f.endsWith('.map'));
      const precache = ['./', ...files.map((f) => `./${f.replace(/\\/g, '/')}`)];
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync('src/sw/sw.template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(precache, null, 2));
      writeFileSync(join(dir, 'sw.js'), source);
    },
  };
}

export default defineConfig({
  // Relative paths: works on GitHub Pages under /<repo>/ and from any other folder.
  base: './',
  build: {
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
  plugins: [serviceWorker()],
});
