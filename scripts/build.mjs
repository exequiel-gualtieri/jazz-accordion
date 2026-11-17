// Builds the distributable files into ./dist
//   dist/jazz-accordion.js          classic <script> (IIFE, readable)
//   dist/jazz-accordion.min.js      classic <script> (IIFE, minified)  ← CDN default
//   dist/jazz-accordion.esm.js      ES module (readable)
//   dist/jazz-accordion.esm.min.js  ES module (minified)
//   dist/themes/*.css               minified themes + all.css bundle
import { build } from 'esbuild';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const banner = `/*! jazz-accordion v${pkg.version} | ${pkg.license} License | (c) ${new Date().getFullYear()} ${pkg.author} */`;

await rm('dist', { recursive: true, force: true });
await mkdir('dist/themes', { recursive: true });

const common = {
  entryPoints: ['src/index.js'],
  bundle: true,
  target: ['es2022', 'chrome100', 'firefox100', 'safari15.4'],
  banner: { js: banner },
  logLevel: 'warning',
};

await Promise.all([
  build({ ...common, format: 'esm', outfile: 'dist/jazz-accordion.esm.js' }),
  build({ ...common, format: 'esm', minify: true, sourcemap: true, outfile: 'dist/jazz-accordion.esm.min.js' }),
  build({ ...common, format: 'iife', globalName: 'JazzAccordion', outfile: 'dist/jazz-accordion.js' }),
  build({ ...common, format: 'iife', globalName: 'JazzAccordion', minify: true, sourcemap: true, outfile: 'dist/jazz-accordion.min.js' }),
]);

const themes = (await readdir('src/themes')).filter((f) => f.endsWith('.css')).sort();
const minified = await Promise.all(
  themes.map(async (file) => {
    const result = await build({
      entryPoints: [`src/themes/${file}`],
      minify: true,
      write: false,
      logLevel: 'warning',
    });
    const css = result.outputFiles[0].text;
    await writeFile(`dist/themes/${file}`, `/*! jazz-accordion theme: ${file} */\n${css}`);
    return css;
  }),
);
await writeFile('dist/themes/all.css', `/*! jazz-accordion — all themes */\n${minified.join('')}`);

// Size report
const files = ['jazz-accordion.min.js', 'jazz-accordion.esm.min.js', 'themes/all.css'];
for (const f of files) {
  const buf = await readFile(`dist/${f}`);
  console.log(`${f.padEnd(28)} ${(buf.length / 1024).toFixed(1).padStart(6)} kB  │ gzip ${(gzipSync(buf).length / 1024).toFixed(1).padStart(5)} kB`);
}
console.log(`themes: ${themes.map((t) => t.replace('.css', '')).join(', ')}`);
