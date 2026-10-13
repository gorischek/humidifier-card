import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = process.cwd();
const server = createServer(async (req,res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const path = resolve(root, `.${pathname === '/' ? '/tests/fixture.html' : pathname}`);
  if (!path.startsWith(root + '/')) { res.writeHead(403); res.end(); return; }
  try {
    res.setHeader('Content-Type', {'.js':'text/javascript','.html':'text/html','.json':'application/json'}[extname(path)] ?? 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser = await chromium.launch({ headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? ['--no-sandbox','--single-process','--no-zygote','--disable-gpu'] : ['--no-sandbox'] });
  const page = await browser.newPage({viewport:{width:820,height:650},deviceScaleFactor:1});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = `http://127.0.0.1:${server.address().port}`;
  await page.goto(url);
  await page.waitForFunction(() => window.ready);
  const full = page.locator('#full');
  await expect(full.locator('.slider-center')).toHaveCount(0);
  await expect(full.locator('.stats-value').nth(1)).toHaveText('43');
  await expect(full.locator('.stats-subtitle').nth(1)).toHaveText('Luftfeuchtigkeit');
  await expect(page.locator('#compact .stats-value').nth(1)).toHaveText('43');
  await expect(full.locator('.target')).toContainText('45 %');
  await expect(full.locator('.stats-value').first()).toHaveText('22,4');
  await expect(full.locator('.mode-control select')).toHaveValue('Auto');
  await expect(full.locator('.mode-control select')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(full.locator('.mode-control select')).toHaveCSS('appearance','none');
  await expect(full.locator('.status-indicator.ok')).toHaveCount(2);
  await expect(full.locator('.status-indicators')).toContainText('Tank vorhanden');
  await expect(full.locator('.status-indicators')).toContainText('Wasser vorhanden');
  await expect(page.locator('#compact .status-indicator.ok')).toHaveCount(2);
  await expect(full.locator('humidifier-round-slider [role=slider]')).toHaveAttribute('aria-valuemin','30');

  // Independent sensor updates, warnings and unavailable states refresh immediately.
  await page.evaluate(() => window.update(window.ids.humidity,'48.7'));
  await expect(full.locator('.stats-value').nth(1)).toHaveText('49');
  await expect(page.locator('#compact .stats-value').nth(1)).toHaveText('49');
  await page.evaluate(() => window.update(window.ids.temp,'23.1'));
  await expect(full.locator('.stats-value').first()).toHaveText('23,1');
  await page.evaluate(() => window.update(window.ids.water,'on'));
  await expect(full.locator('.warning')).toContainText('Wasser fehlt');
  await expect(full.locator('.device')).not.toHaveClass(/running/);
  await page.evaluate(() => window.update(window.ids.water,'off'));
  await page.evaluate(() => window.update(window.ids.tank,'on'));
  await expect(full.locator('.warning')).toContainText('Tank fehlt');
  await page.evaluate(() => window.update(window.ids.tank,'off'));
  await expect(full.locator('.warning')).toHaveCount(0);
  await expect(full.locator('.status-indicator.ok')).toHaveCount(2);
  await page.evaluate(() => window.update(window.ids.tank,'unknown'));
  await expect(full.locator('.status-indicators')).toContainText('Tank: Unbekannt');
  await expect(full.locator('.status-indicator.ok')).toHaveCount(1);
  await page.evaluate(() => window.update(window.ids.tank,'off'));
  await page.evaluate(() => window.update(window.ids.water,'unavailable'));
  await expect(full.locator('.status-indicators')).toContainText('Wasser: Nicht verfügbar');
  await expect(full.locator('.status-indicator.ok')).toHaveCount(1);
  await page.evaluate(() => window.update(window.ids.water,'off'));
  await page.evaluate(() => window.update(window.ids.humidity,'unavailable'));
  await expect(full.locator('.stats-value').nth(1)).toHaveText('—');
  await page.evaluate(() => window.update(window.ids.humidity,'43.2'));

  // Operating mode and power calls use the actual Levoit entities.
  await full.locator('.mode-control select').selectOption('Hoch');
  await expect(full.locator('.mode-control select')).toHaveValue('Hoch');
  expect(await page.evaluate(() => window.calls.at(-1))).toEqual({domain:'select',service:'select_option',data:{entity_id:'select.levoit_luftbefeuchter_betriebsmodus',option:'Hoch'}});
  await full.locator('.toolbar .icon-button').click();
  await expect(full.locator('.state')).toHaveText('Ausgeschaltet');
  expect(await page.evaluate(() => window.calls.at(-1).service)).toBe('turn_off');
  await full.locator('.toolbar .icon-button').click();
  await expect(full.locator('.state')).toHaveText('Eingeschaltet');

  // Actual keyboard interaction with the bundled slider; sends one service on blur.
  const handle = full.locator('humidifier-round-slider path.handle');
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await expect(full.locator('.target')).toContainText('50 %');
  await expect(full.locator('.pending')).toHaveCount(0);
  expect(await page.evaluate(() => window.calls.at(-1))).toEqual({domain:'number',service:'set_value',data:{entity_id:'number.levoit_luftbefeuchter_zielfeuchtigkeit',value:50}});

  await page.evaluate(() => window.update(window.ids.target,'55'));
  await expect(full.locator('.target')).toContainText('55 %');
  await expect(page.locator('#compact input[type=range]')).toHaveValue('55');
  await page.locator('#compact input[type=range]').fill('60');
  await page.locator('#compact input[type=range]').dispatchEvent('change');
  await expect(full.locator('.target')).toContainText('60 %');

  // A failed service does not leave the UI locked.
  await page.evaluate(() => { window.serviceError=true; });
  await full.locator('.toolbar .icon-button').click();
  await expect(full.locator('.error')).toContainText('Simulierter Fehler');
  await expect(full.locator('.toolbar .icon-button')).toBeEnabled();
  await page.evaluate(() => { window.serviceError=false; });
  await full.locator('.mode-control select').selectOption('Auto');
  await expect(full.locator('.error')).toHaveCount(0);
  await expect(full.locator('.mode-control select')).toHaveValue('Auto');

  // Missing primary entity renders a readable state without crashing.
  await page.evaluate(() => window.card.setConfig({entity:'humidifier.missing'}));
  await expect(full.locator('.unavailable')).toContainText('humidifier.missing');
  await page.evaluate(() => window.card.setConfig(window.config));
  await page.evaluate(() => window.update(window.ids.target,'unavailable'));
  await expect(full.locator('humidifier-round-slider [role=slider]')).toHaveAttribute('aria-disabled','true');
  await expect(full.locator('.target')).toContainText('—');
  await page.evaluate(() => window.update(window.ids.target,'45'));

  // Default stats use measured humidity beside temperature; explicit stats remain configurable.
  await page.evaluate(() => window.card.setConfig({...window.config,stats:undefined}));
  await expect(full.locator('.stats-subtitle')).toHaveText(['Temperatur','Luftfeuchtigkeit']);
  await expect(full.locator('.stats-value').nth(1)).toHaveText('43');
  await page.evaluate(() => window.card.setConfig({...window.config,stats:[]}));
  await expect(full.locator('.stats')).toHaveCount(0);
  await page.evaluate(() => window.card.setConfig(window.config));

  // Template subscription keeps formatted output during refresh; stale callbacks cannot overwrite it.
  await page.evaluate(() => {
    window.update('sensor.filter','99.98986');
    window.card.setConfig({...window.config,stats:[{entity_id:'sensor.filter',value_template:'{{ value | float(0) | round(0) }}',unit:'%',subtitle:'Test'}]});
  });
  await expect(full.locator('humidifier-stat-template')).toHaveText('100');
  await page.evaluate(() => window.update('sensor.filter','98.8'));
  await expect(full.locator('humidifier-stat-template')).toHaveText('99');
  expect(await page.evaluate(() => window.card.shadowRoot.textContent.includes('99.98986'))).toBe(false);
  await page.evaluate(() => window.templateSubscriptions[0].callback({result:'STALE'}));
  await expect(full.locator('humidifier-stat-template')).toHaveText('99');
  await page.evaluate(() => {
    window.card.setConfig(window.config);
    window.update(window.ids.humidity,'43.2'); window.update(window.ids.temp,'22.35');
  });

  // More-info events are routed to the clicked statistic.
  await page.evaluate(() => window.card.addEventListener('hass-more-info',event => { window.moreInfo=event.detail.entityId; }));
  await full.locator('.stats-block').first().click();
  expect(await page.evaluate(() => window.moreInfo)).toBe('sensor.levoit_luftbefeuchter_temperatur');
  await full.locator('.status-indicator').first().click();
  expect(await page.evaluate(() => window.moreInfo)).toBe('binary_sensor.levoit_luftbefeuchter_tank_fehlt');
  await full.locator('.status-indicator').last().click();
  expect(await page.evaluate(() => window.moreInfo)).toBe('binary_sensor.levoit_luftbefeuchter_wasser_fehlt');

  // Visual editor preserves advanced YAML fields while changing one setting.
  await page.evaluate(() => {
    const editor = document.createElement('humidifier-card-editor'); editor.id='editor';
    editor.setConfig({...window.config,warnings:[{entity_id:window.ids.water,label:'Custom'}]});
    editor.hass=window.createHass();
    editor.addEventListener('config-changed', event => { window.editorConfig=event.detail.config; });
    document.body.append(editor);
  });
  await page.locator('#editor input[type=text]').fill('Testname');
  await page.locator('#editor input[type=text]').dispatchEvent('change');
  expect(await page.evaluate(() => window.editorConfig.warnings[0].label)).toBe('Custom');
  expect(await page.evaluate(() => window.editorConfig.name)).toBe('Testname');
  await page.evaluate(() => document.querySelector('#editor').remove());

  // Native humidifier controls and attributes follow the same UI path.
  await page.evaluate(() => {
    window.update('humidifier.native','on',{humidity:50,current_humidity:46,min_humidity:35,max_humidity:70,mode:'auto',available_modes:['auto','low']});
    window.card.setConfig({entity:'humidifier.native'});
  });
  await expect(full.locator('.stats-value')).toHaveText('46');
  await expect(full.locator('.stats-subtitle')).toHaveText('Luftfeuchtigkeit');
  await expect(full.locator('.status-indicators')).toHaveCount(0);
  await expect(full.locator('.target')).toContainText('50 %');
  await full.locator('.mode-control select').selectOption('low');
  await expect(full.locator('.mode-control select')).toHaveValue('low');
  await expect(full.locator('humidifier-round-slider [role=slider]')).toHaveAttribute('aria-disabled','false');
  expect(await page.evaluate(() => window.calls.at(-1))).toEqual({domain:'humidifier',service:'set_mode',data:{entity_id:'humidifier.native',mode:'low'}});
  await full.locator('humidifier-round-slider path.handle').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await expect(full.locator('.target')).toContainText('51 %');
  await expect(full.locator('.pending')).toHaveCount(0);
  expect(await page.evaluate(() => window.calls.at(-1))).toEqual({domain:'humidifier',service:'set_humidity',data:{entity_id:'humidifier.native',humidity:51}});
  await page.evaluate(() => window.card.setConfig(window.config));

  await page.emulateMedia({reducedMotion:'reduce'});
  await mkdir('docs',{recursive:true});
  await page.screenshot({path:'docs/preview-light.png',fullPage:true});
  await page.evaluate(() => document.body.classList.add('dark'));
  await expect(full.locator('.mode-control select')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await page.screenshot({path:'docs/preview-dark.png',fullPage:true});
  await page.setViewportSize({width:390,height:850});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  console.log('Browser checks passed: transparent mode selector, persistent tank/water states, live sensor updates, warnings, unavailable values, mode, power, keyboard slider, compact slider, errors, templates, editor, themes and mobile layout.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
