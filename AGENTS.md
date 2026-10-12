# Repository guidelines

- Use `home-assistant-js-websocket` for HA entity types and `custom-card-helpers` for HA types and lifecycle events.
- Implement the UI as Lit web components in TypeScript.
- `src/humidifier-card.ts` is the entry point; `src/model.ts` contains entity lookup and service routing.
- `src/stat-template.ts` derives from Purifier Card. Preserve its generation checks and subscription cleanup; never briefly render raw values while a formatted template result is pending.
- Changes to any configured entity must refresh the card, including statistics and warnings independent of the power entity.
- Do not infer an unavailable sensor value as zero. Use a dash and disable unavailable controls.
- Keep the private `humidifier-round-slider` registration and preserve dependency license notices in the bundle.
- Run `npm test` and `npm run test:browser` for behavior changes. Install Chromium with `npx playwright install chromium` if needed.
- Run `npm run build` and commit `dist/humidifier-card.js` with source changes. HACS must be able to install the default branch without a release.
- Preserve the original MIT copyright and attribution to Purifier Card and Thomas Lovén.
- Use Conventional Commits. Summarize behavior and validation, and distinguish simulated browser tests from a real device test.
