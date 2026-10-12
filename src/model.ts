import type { HassEntity } from 'home-assistant-js-websocket';
import type { HomeAssistant } from 'custom-card-helpers';

export interface Stat {
  entity_id?: string;
  attribute?: string;
  unit?: string;
  subtitle?: string;
  precision?: number;
  value_template?: string;
}

export interface Warning {
  entity_id: string;
  state?: string;
  label: string;
  icon?: string;
}

export interface CardConfig {
  type?: string;
  entity: string;
  name?: string;
  humidity_entity?: string;
  target_humidity_entity?: string;
  mode_entity?: string;
  temperature_entity?: string;
  water_missing_entity?: string;
  tank_missing_entity?: string;
  show_name: boolean;
  show_state: boolean;
  show_mode: boolean;
  show_toolbar: boolean;
  compact_view: boolean;
  stats?: Stat[];
  warnings?: Warning[];
}

export type States = HomeAssistant['states'];
export interface ServiceRequest {
  domain: string;
  service: string;
  data: Record<string, unknown> & { entity_id: string };
}

export const isAvailable = (entity?: HassEntity) =>
  Boolean(entity && !['unknown', 'unavailable'].includes(entity.state));

export function numeric(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return;
  if (typeof value !== 'number' && typeof value !== 'string') return;
  if (typeof value === 'string' && value.trim() === '') return;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function buildConfig(config: Partial<CardConfig>): CardConfig {
  if (!config || !/^(switch|humidifier)\.[\w]+$/.test(config.entity ?? '')) {
    throw new Error('entity must be a switch.* or humidifier.* entity.');
  }
  const domains: Record<string, RegExp> = {
    target_humidity_entity: /^(number|input_number)\.[\w]+$/,
    mode_entity: /^(select|input_select)\.[\w]+$/,
    humidity_entity: /^sensor\.[\w]+$/,
    temperature_entity: /^sensor\.[\w]+$/,
    water_missing_entity: /^binary_sensor\.[\w]+$/,
    tank_missing_entity: /^binary_sensor\.[\w]+$/,
  };
  for (const [key, pattern] of Object.entries(domains)) {
    const value = config[key as keyof CardConfig];
    if (value && (typeof value !== 'string' || !pattern.test(value))) {
      throw new Error(`Invalid entity for ${key}.`);
    }
  }
  if (config.entity!.startsWith('switch.') && !config.target_humidity_entity) {
    throw new Error('A switch requires target_humidity_entity (number.* or input_number.*).');
  }
  if (config.stats !== undefined && !Array.isArray(config.stats)) throw new Error('stats must be a list.');
  if (config.warnings !== undefined && !Array.isArray(config.warnings)) throw new Error('warnings must be a list.');
  for (const stat of config.stats ?? []) {
    if (!stat || (!stat.entity_id && !stat.attribute)) throw new Error('Each stat requires entity_id or attribute.');
    if (stat.precision !== undefined && (!Number.isInteger(stat.precision) || stat.precision < 0 || stat.precision > 10)) {
      throw new Error('Stat precision must be an integer between 0 and 10.');
    }
  }
  for (const warning of config.warnings ?? []) {
    if (!warning?.entity_id || !warning.label) throw new Error('Each warning requires entity_id and label.');
  }
  return {
    ...config,
    entity: config.entity!,
    show_name: config.show_name ?? true,
    show_state: config.show_state ?? true,
    show_mode: config.show_mode ?? true,
    show_toolbar: config.show_toolbar ?? true,
    compact_view: config.compact_view ?? false,
  };
}

export function trackedEntities(config: CardConfig): string[] {
  return [...new Set([
    config.entity, config.humidity_entity, config.target_humidity_entity,
    config.mode_entity, config.temperature_entity, config.water_missing_entity,
    config.tank_missing_entity, ...(config.stats ?? []).map(stat => stat.entity_id),
    ...(config.warnings ?? []).map(warning => warning.entity_id),
  ].filter((id): id is string => Boolean(id)))];
}

export function targetInfo(config: CardConfig, states: States) {
  const id = config.target_humidity_entity ?? config.entity;
  const entity = states[id];
  const separate = Boolean(config.target_humidity_entity);
  const min = numeric(entity?.attributes[separate ? 'min' : 'min_humidity']) ?? 0;
  const max = numeric(entity?.attributes[separate ? 'max' : 'max_humidity']) ?? 100;
  const step = separate ? numeric(entity?.attributes.step) ?? 1 : 1;
  const value = isAvailable(entity) ? numeric(separate ? entity.state : entity?.attributes.humidity) : undefined;
  return { id, value, min, max, step, available: isAvailable(entity) && value !== undefined && max > min && step > 0 };
}

export function normalizeTarget(value: unknown, target: ReturnType<typeof targetInfo>): number {
  const number = numeric(value);
  if (number === undefined || !target.available) throw new Error('Target humidity is unavailable.');
  const clamped = Math.max(target.min, Math.min(target.max, number));
  const stepped = target.min + Math.round((clamped - target.min) / target.step) * target.step;
  return Number(Math.max(target.min, Math.min(target.max, stepped)).toFixed(6));
}

export function targetRequest(config: CardConfig, states: States, value: unknown): ServiceRequest {
  const target = targetInfo(config, states);
  const normalized = normalizeTarget(value, target);
  const domain = target.id.split('.')[0];
  return {
    domain, service: domain === 'humidifier' ? 'set_humidity' : 'set_value',
    data: { entity_id: target.id, [domain === 'humidifier' ? 'humidity' : 'value']: normalized },
  };
}

export function modeInfo(config: CardConfig, states: States) {
  const id = config.mode_entity ?? config.entity;
  const entity = states[id];
  const raw = entity?.attributes[config.mode_entity ? 'options' : 'available_modes'];
  const options = Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : [];
  const value = config.mode_entity ? entity?.state : entity?.attributes.mode;
  return { id, options, value: typeof value === 'string' ? value : '', available: isAvailable(entity) && options.length > 0 };
}

export function modeRequest(config: CardConfig, states: States, value: string): ServiceRequest {
  const mode = modeInfo(config, states);
  if (!mode.available || !mode.options.includes(value)) throw new Error('Mode is unavailable.');
  const domain = mode.id.split('.')[0];
  return {
    domain, service: domain === 'humidifier' ? 'set_mode' : 'select_option',
    data: { entity_id: mode.id, [domain === 'humidifier' ? 'mode' : 'option']: value },
  };
}

export function readStat(stat: Stat, config: CardConfig, states: States): unknown {
  const entity = states[stat.entity_id ?? config.entity];
  if (!isAvailable(entity)) return undefined;
  if (!stat.attribute) return entity.state;
  return stat.attribute.split('.').reduce<unknown>((value, key) =>
    value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
    entity.attributes,
  );
}
