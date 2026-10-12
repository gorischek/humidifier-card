import { LitElement, html, nothing, svg, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { fireEvent, type HomeAssistant } from 'custom-card-helpers';
import '@thomasloven/round-slider';
import './stat-template';
import './editor';
import { styles } from './styles';
import {
  buildConfig, isAvailable, modeInfo, modeRequest, numeric, readStat,
  targetInfo, targetRequest, trackedEntities,
  type CardConfig, type ServiceRequest, type Stat, type Warning,
} from './model';

declare const CARD_VERSION: string;
console.info(`HUMIDIFIER-CARD ${CARD_VERSION}`);

const translations = {
  de: { name: 'Luftbefeuchter', humidity: 'Luftfeuchtigkeit', target: 'Ziel', temperature: 'Temperatur', on: 'Eingeschaltet', off: 'Ausgeschaltet', unavailable: 'Nicht verfügbar', unknown: 'Unbekannt', mode: 'Betriebsmodus', power: 'Ein/Aus', more: 'Weitere Informationen', water: 'Wasser fehlt', tank: 'Tank fehlt', failed: 'Aktion fehlgeschlagen', auto: 'Auto', low: 'Niedrig', high: 'Hoch' },
  en: { name: 'Humidifier', humidity: 'Humidity', target: 'Target', temperature: 'Temperature', on: 'On', off: 'Off', unavailable: 'Unavailable', unknown: 'Unknown', mode: 'Operating mode', power: 'Power', more: 'More information', water: 'Water missing', tank: 'Tank missing', failed: 'Action failed', auto: 'Auto', low: 'Low', high: 'High' },
};
type TranslationKey = keyof typeof translations.en;

@customElement('humidifier-card')
export class HumidifierCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private config?: CardConfig;
  @state() private pending?: string;
  @state() private draftTarget?: number;
  @state() private error = '';
  private pendingTimer?: ReturnType<typeof setTimeout>;

  static styles = styles;

  static getConfigElement() { return document.createElement('humidifier-card-editor'); }

  static getStubConfig(hass: HomeAssistant, entities: string[] = []) {
    const ids = entities.length ? entities : Object.keys(hass.states);
    const native = ids.find(id => id.startsWith('humidifier.'));
    if (native) return { type: 'custom:humidifier-card', entity: native };
    const switchId = ids.find(id => id.startsWith('switch.') && /luftbefeuchter|humidifier/i.test(id));
    const numberId = ids.find(id => /^(number|input_number)\./.test(id) && /zielfeuchtigkeit|target.*humidity/i.test(id));
    return { type: 'custom:humidifier-card', entity: switchId ?? '', target_humidity_entity: numberId ?? '' };
  }

  setConfig(config: Partial<CardConfig>) {
    this.config = buildConfig(config);
    this.clearPending();
    this.error = '';
  }

  getCardSize() { return this.config?.compact_view ? 3 : 5; }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.clearPending();
  }

  protected shouldUpdate(changed: PropertyValues) {
    if ([...changed.keys()].some(key => key !== 'hass')) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    if (!old || !this.hass || !this.config) return true;
    if (old.language !== this.hass.language || old.connection !== this.hass.connection) return true;
    return trackedEntities(this.config).some(id => old.states[id] !== this.hass.states[id]);
  }

  protected updated(changed: PropertyValues) {
    const old = changed.get('hass') as HomeAssistant | undefined;
    if (old && this.pending && old.states[this.pending] !== this.hass.states[this.pending]) {
      this.clearPending();
    }
  }

  private t(key: TranslationKey) {
    return translations[this.hass?.language?.startsWith('de') ? 'de' : 'en'][key];
  }

  private modeLabel(value: string) {
    const aliases: Record<string, TranslationKey> = { auto: 'auto', low: 'low', high: 'high', niedrig: 'low', hoch: 'high' };
    const key = aliases[value.toLowerCase()];
    return key ? this.t(key) : value;
  }

  private format(value: unknown, precision = 0) {
    const number = numeric(value);
    if (number === undefined) return '—';
    return new Intl.NumberFormat(this.hass?.language || 'en', { maximumFractionDigits: precision }).format(number);
  }

  private clearPending() {
    clearTimeout(this.pendingTimer);
    this.pendingTimer = undefined;
    this.pending = undefined;
    this.draftTarget = undefined;
  }

  private more(entityId = this.config?.entity) {
    if (entityId) fireEvent(this, 'hass-more-info', { entityId });
  }

  private async send(request: ServiceRequest) {
    if (this.pending || !this.hass) return;
    this.error = '';
    this.pending = request.data.entity_id;
    this.pendingTimer = setTimeout(() => this.clearPending(), 8000);
    try {
      await this.hass.callService(request.domain, request.service, request.data);
    } catch (error: unknown) {
      this.clearPending();
      this.error = `${this.t('failed')}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private setTarget(value: unknown) {
    if (!this.config || this.pending || !isAvailable(this.hass.states[this.config.entity])) return;
    try {
      const request = targetRequest(this.config, this.hass.states, value);
      const actual = targetInfo(this.config, this.hass.states).value;
      const normalized = numeric(request.data.value ?? request.data.humidity);
      if (normalized === actual) { this.draftTarget = undefined; return; }
      this.draftTarget = normalized;
      void this.send(request);
    } catch (error) {
      this.draftTarget = undefined;
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  private setMode(value: string) {
    if (!this.config || this.pending || !isAvailable(this.hass.states[this.config.entity])) return;
    try { void this.send(modeRequest(this.config, this.hass.states, value)); }
    catch (error) { this.error = error instanceof Error ? error.message : String(error); }
  }

  private toggle() {
    if (!this.config || this.pending) return;
    const entity = this.hass.states[this.config.entity];
    if (!isAvailable(entity)) return;
    void this.send({
      domain: this.config.entity.split('.')[0],
      service: entity.state === 'on' ? 'turn_off' : 'turn_on',
      data: { entity_id: this.config.entity },
    });
  }

  private renderMode() {
    if (!this.config?.show_mode) return nothing;
    const mode = modeInfo(this.config, this.hass.states);
    if (!this.config.mode_entity && !mode.options.length) return nothing;
    const enabled = mode.available && isAvailable(this.hass.states[this.config.entity]) && !this.pending;
    return html`<label class="mode-control">
      <ha-icon icon="mdi:air-humidifier"></ha-icon>
      <select aria-label=${this.t('mode')} .value=${mode.value} ?disabled=${!enabled}
        @change=${(event: Event) => this.setMode((event.target as HTMLSelectElement).value)}>
        ${!mode.options.includes(mode.value) ? html`<option value=${mode.value}>${mode.value === 'unavailable' || mode.value === 'unknown' || !mode.value ? this.t('unavailable') : mode.value}</option>` : nothing}
        ${repeat(mode.options, value => value, value => html`<option value=${value} .selected=${value === mode.value}>${this.modeLabel(value)}</option>`)}
      </select>
    </label>`;
  }

  private renderDevice(running: boolean) {
    return svg`<svg class="device ${running ? 'running' : ''}" viewBox="0 0 120 180" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
        <path class="mist" d="M43 35c-12-9 10-12 0-23"/>
        <path class="mist" d="M60 34c12-10-10-15 0-29"/>
        <path class="mist" d="M77 35c12-9-10-12 0-23"/>
      </g>
      <path d="M25 45Q25 39 31 39H89Q95 39 95 45L102 151Q103 162 91 162H29Q17 162 18 151Z" fill="var(--card-background-color, #fff)" stroke="var(--hc-divider)" stroke-width="2"/>
      <path d="M31 40h58l-6 8H37Z" fill="var(--hc-divider)"/>
      <path d="M34 52h52v28H34Z" fill="currentColor" opacity=".07"/>
      <path d="M25 139h70" stroke="var(--hc-divider)"/>
      <circle cx="60" cy="149" r="3" fill="currentColor" opacity=${running ? '1' : '.3'}/>
    </svg>`;
  }

  private renderControls() {
    const config = this.config!;
    const target = targetInfo(config, this.hass.states);
    const entity = this.hass.states[config.entity];
    const humidityEntity = config.humidity_entity ? this.hass.states[config.humidity_entity] : entity;
    const current = isAvailable(humidityEntity) ? (config.humidity_entity ? humidityEntity.state : entity.attributes.current_humidity) : undefined;
    const value = this.draftTarget ?? target.value;
    const disabled = !target.available || !isAvailable(entity) || Boolean(this.pending);
    const humidity = html`<div class="humidity">${this.format(current)}<sup> %</sup></div><div class="humidity-label">${this.t('humidity')}</div>`;
    if (config.compact_view) return html`<div class="compact">
      <div class="compact-values"><div>${humidity}</div><div class="compact-target">${this.t('target')}<br><strong>${this.format(value, 1)} %</strong></div></div>
      <input type="range" aria-label=${this.t('target')} min=${target.min} max=${target.max} step=${target.step}
        .value=${String(value ?? target.min)} ?disabled=${disabled}
        @input=${(event: Event) => { this.draftTarget = numeric((event.target as HTMLInputElement).value); }}
        @change=${(event: Event) => this.setTarget((event.target as HTMLInputElement).value)}>
    </div>`;
    return html`<div class="slider">
      <humidifier-round-slider .min=${target.min} .max=${target.max} .step=${target.step}
        .value=${value ?? target.min} .valueLabel=${this.t('target')} .disabled=${disabled} aria-label=${this.t('target')}
        @value-changing=${(event: CustomEvent<{ value: number }>) => { this.draftTarget = event.detail.value; }}
        @value-changed=${(event: CustomEvent<{ value: number }>) => this.setTarget(event.detail.value)}>
      </humidifier-round-slider>
      ${this.renderDevice(entity.state === 'on' && !this.activeWarnings().some(w => w.entity_id === config.water_missing_entity || w.entity_id === config.tank_missing_entity))}
      <div class="slider-center">${humidity}</div>
      <div class="target"><small>${this.t('target')}</small> ${this.format(value, 1)} %</div>
    </div>`;
  }

  private activeWarnings(): Warning[] {
    const config = this.config!;
    const warnings: Warning[] = [...(config.warnings ?? [])];
    if (config.water_missing_entity) warnings.unshift({ entity_id: config.water_missing_entity, label: this.t('water'), icon: 'mdi:water-alert' });
    if (config.tank_missing_entity) warnings.unshift({ entity_id: config.tank_missing_entity, label: this.t('tank'), icon: 'mdi:cup-off-outline' });
    return warnings.filter(warning => {
      const entity = this.hass.states[warning.entity_id];
      return !isAvailable(entity) || entity.state === (warning.state ?? 'on');
    });
  }

  private renderWarnings() {
    const warnings = this.activeWarnings();
    return warnings.length ? html`<div class="warnings" aria-live="polite">${warnings.map(warning => html`
      <button class="warning" @click=${() => this.more(warning.entity_id)}>
        <ha-icon icon=${warning.icon ?? 'mdi:alert-outline'}></ha-icon>
        ${warning.label}${!isAvailable(this.hass.states[warning.entity_id]) ? ` (${this.t('unavailable')})` : ''}
      </button>` )}</div>` : nothing;
  }

  private renderStats() {
    const config = this.config!;
    const defaults: Stat[] = [];
    if (config.temperature_entity) defaults.push({ entity_id: config.temperature_entity, precision: 1, subtitle: this.t('temperature') });
    if (config.target_humidity_entity) defaults.push({ entity_id: config.target_humidity_entity, precision: 1, subtitle: this.t('target') });
    const stats = config.stats ?? defaults;
    if (!stats.length) return nothing;
    return html`<div class="stats">${repeat(stats, (_, index) => index, stat => {
      const id = stat.entity_id ?? config.entity;
      const entity = this.hass.states[id];
      const raw = readStat(stat, config, this.hass.states);
      const valid = raw !== undefined && raw !== null && raw !== '' && raw !== 'unknown' && raw !== 'unavailable';
      const value = !valid ? '—' : stat.value_template
        ? html`<humidifier-stat-template .hass=${this.hass} .template=${stat.value_template} .value=${raw}></humidifier-stat-template>`
        : numeric(raw) !== undefined ? this.format(raw, stat.precision ?? 0) : String(raw);
      return html`<button class="stats-block" @click=${() => this.more(id)}>
        <span class="stats-value">${value}</span> ${stat.unit ?? entity?.attributes.unit_of_measurement ?? ''}
        <div class="stats-subtitle">${stat.subtitle ?? entity?.attributes.friendly_name ?? id}</div>
      </button>`;
    })}</div>`;
  }

  private renderToolbar() {
    if (!this.config?.show_toolbar) return nothing;
    const entity = this.hass.states[this.config.entity];
    const mode = modeInfo(this.config, this.hass.states);
    const disabled = !isAvailable(entity) || Boolean(this.pending);
    return html`<div class="toolbar">
      <button class="icon-button ${entity.state === 'on' ? 'active' : ''}" aria-label=${this.t('power')}
        aria-pressed=${entity.state === 'on'} title=${this.t('power')} ?disabled=${disabled} @click=${() => this.toggle()}>
        <ha-icon icon="mdi:power"></ha-icon>
      </button><div class="gap"></div>
      ${repeat(mode.options, value => value, value => html`<button class="mode-button ${mode.value === value ? 'active' : ''}"
        aria-pressed=${mode.value === value} ?disabled=${disabled || !mode.available} @click=${() => this.setMode(value)}>${this.modeLabel(value)}</button>`)}
    </div>`;
  }

  protected render() {
    if (!this.config || !this.hass) return nothing;
    const entity = this.hass.states[this.config.entity];
    if (!entity) return html`<ha-card><div class="unavailable">${this.t('unavailable')}: ${this.config.entity}</div></ha-card>`;
    const stateKey = ['on', 'off', 'unavailable', 'unknown'].includes(entity.state) ? entity.state as TranslationKey : 'unknown';
    return html`<ha-card>
      <div class="header">${this.renderMode()}<span class="gap"></span>
        <button class="icon-button" aria-label=${this.t('more')} title=${this.t('more')} @click=${() => this.more()}><ha-icon icon="mdi:dots-vertical"></ha-icon></button>
      </div>
      <div class="controls">${this.renderControls()}</div>
      ${this.config.show_name || this.config.show_state ? html`<div class="metadata">
        ${this.config.show_name ? html`<div class="friendly-name">${this.config.name ?? entity.attributes.friendly_name ?? this.t('name')}</div>` : nothing}
        ${this.config.show_state ? html`<div class="state" aria-live="polite">${this.pending ? html`<span class="pending" aria-hidden="true"></span>` : nothing}${this.t(stateKey)}</div>` : nothing}
      </div>` : nothing}
      ${this.renderWarnings()}${this.renderStats()}${this.renderToolbar()}
      ${this.error ? html`<div class="error" role="alert">${this.error}</div>` : nothing}
    </ha-card>`;
  }
}

const cardWindow = window as Window & { customCards?: unknown[] };
cardWindow.customCards = cardWindow.customCards ?? [];
cardWindow.customCards.push({ type: 'humidifier-card', name: 'Humidifier Card', description: 'Humidifier control with target humidity, operating modes and tank warnings.', preview: true });
