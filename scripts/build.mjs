import { build } from 'esbuild';
import { readFile, mkdir } from 'node:fs/promises';
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const licenseFiles = ['LICENSE', 'node_modules/@thomasloven/round-slider/LICENSE.txt', 'node_modules/lit/LICENSE', 'node_modules/lit-element/LICENSE', 'node_modules/lit-html/LICENSE', 'node_modules/@lit/reactive-element/LICENSE', 'node_modules/custom-card-helpers/LICENSE', 'node_modules/tslib/CopyrightNotice.txt'];
const licenses = await Promise.all(licenseFiles.map(async path => `/*! ${path}\n${(await readFile(path, 'utf8')).replaceAll('\r\n', '\n').replaceAll('*/', '* /')}\n*/`));
await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/humidifier-card.ts'], outfile: 'dist/humidifier-card.js',
  bundle: true, format: 'esm', target: 'es2022', minify: true,
  legalComments: 'inline', banner: { js: licenses.join('\n') },
  define: { CARD_VERSION: JSON.stringify(pkg.version) },
  plugins: [{
    name: 'private-round-slider',
    setup(build) {
      build.onLoad({ filter: /@thomasloven[\\/]round-slider[\\/]round-slider\.js$/ }, async args => {
        const source = await readFile(args.path, 'utf8');
        const registration = 'customElements.define("round-slider", RoundSlider);';
        if (!source.includes(registration)) throw new Error('Round slider registration changed; review before bundling.');
        return { contents: source.replace(registration, 'customElements.define("humidifier-round-slider", RoundSlider);'), loader: 'js' };
      });
    },
  }],
});
console.log(`Built dist/humidifier-card.js (${pkg.version})`);
