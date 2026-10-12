import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const compiled = await build({ entryPoints: ['src/model.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const model = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const entity = (state, attributes = {}) => ({ state, attributes });
const config = model.buildConfig({ entity: 'switch.humidifier', target_humidity_entity: 'number.target', humidity_entity: 'sensor.humidity', mode_entity: 'select.mode', water_missing_entity: 'binary_sensor.water', tank_missing_entity: 'binary_sensor.tank', stats: [{ entity_id: 'sensor.temperature' }] });
const states = {
  'switch.humidifier': entity('on'),
  'number.target': entity('45', { min: 30, max: 80, step: 5 }),
  'select.mode': entity('Auto', { options: ['Auto', 'Niedrig', 'Hoch'] }),
};

test('Levoit target is sent to number rather than power switch; limits and steps respected', () => {
  assert.deepEqual(model.targetRequest(config, states, 47), { domain: 'number', service: 'set_value', data: { entity_id: 'number.target', value: 45 } });
  assert.equal(model.targetRequest(config, states, 200).data.value, 80);
  assert.equal(model.targetRequest(config, states, -10).data.value, 30);
});
test('Levoit mode uses exact option from select entity', () => {
  assert.deepEqual(model.modeRequest(config, states, 'Hoch'), { domain: 'select', service: 'select_option', data: { entity_id: 'select.mode', option: 'Hoch' } });
  assert.throws(() => model.modeRequest(config, states, 'High'));
});
test('native humidifier uses humidity and mode services', () => {
  const config = model.buildConfig({ entity: 'humidifier.native' });
  const states = { 'humidifier.native': entity('on', { humidity: 50, min_humidity: 35, max_humidity: 70, mode: 'auto', available_modes: ['auto', 'low'] }) };
  assert.deepEqual(model.targetRequest(config, states, 55), { domain: 'humidifier', service: 'set_humidity', data: { entity_id: 'humidifier.native', humidity: 55 } });
  assert.deepEqual(model.modeRequest(config, states, 'low'), { domain: 'humidifier', service: 'set_mode', data: { entity_id: 'humidifier.native', mode: 'low' } });
});
test('missing, unknown and unavailable values are never interpreted as zero', () => {
  for (const raw of [undefined, null, '', ' ', 'unknown', 'unavailable', false, NaN, Infinity]) assert.equal(model.numeric(raw), undefined);
  assert.equal(model.numeric('0'), 0);
  for (const raw of ['unknown', 'unavailable']) {
    const unavailable = { ...states, 'number.target': entity(raw) };
    assert.equal(model.targetInfo(config, unavailable).available, false);
    assert.throws(() => model.targetRequest(config, unavailable, 50));
  }
  assert.equal(model.readStat({ entity_id: 'sensor.missing', attribute: 'a.b' }, config, states), undefined);
});
test('all dependent entities trigger refresh', () => {
  const tracked = model.trackedEntities(config);
  for (const id of ['switch.humidifier', 'number.target', 'sensor.humidity', 'select.mode', 'binary_sensor.water', 'binary_sensor.tank', 'sensor.temperature']) assert.ok(tracked.includes(id));
});
test('input helpers route correctly and steps relative to the minimum work', () => {
  const config = model.buildConfig({ entity: 'switch.humidifier', target_humidity_entity: 'input_number.target', mode_entity: 'input_select.mode' });
  const states = { 'input_number.target': entity('30.5', { min: 30.5, max: 80.5, step: .5 }), 'input_select.mode': entity('Low', { options: ['Low', 'High'] }) };
  assert.equal(model.targetRequest(config, states, 31.3).data.value, 31.5);
  assert.equal(model.targetRequest(config, states, 31).domain, 'input_number');
  assert.equal(model.modeRequest(config, states, 'High').domain, 'input_select');
});
test('invalid configuration is rejected before rendering', () => {
  assert.throws(() => model.buildConfig({ entity: 'fan.wrong' }));
  assert.throws(() => model.buildConfig({ entity: 'switch.no_target' }));
  assert.throws(() => model.buildConfig({ entity: 'humidifier.native', target_humidity_entity: 'sensor.wrong' }));
  assert.throws(() => model.buildConfig({ entity: 'humidifier.native', stats: [{ entity_id: 'sensor.value', precision: -1 }] }));
});
