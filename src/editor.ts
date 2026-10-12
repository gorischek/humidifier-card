import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { fireEvent, type HomeAssistant } from 'custom-card-helpers';
import type { CardConfig } from './model';

const fields = [
  ['entity', ['switch', 'humidifier'], 'Gerät (Ein/Aus)', 'Device (power)'],
  ['target_humidity_entity', ['number', 'input_number'], 'Zielfeuchtigkeit', 'Target humidity'],
  ['humidity_entity', ['sensor'], 'Aktuelle Luftfeuchtigkeit', 'Current humidity'],
  ['mode_entity', ['select', 'input_select'], 'Betriebsmodus', 'Operating mode'],
  ['temperature_entity', ['sensor'], 'Temperatur', 'Temperature'],
  ['water_missing_entity', ['binary_sensor'], 'Wasser fehlt', 'Water missing'],
  ['tank_missing_entity', ['binary_sensor'], 'Tank fehlt', 'Tank missing'],
] as const;

@customElement('humidifier-card-editor')
export class HumidifierCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private config: Partial<CardConfig> = {};
  static styles = css`
    :host { display: block; }
    label { display: block; margin: 12px 0; color: var(--primary-text-color); }
    select, input[type=text] { display: block; width: 100%; padding: 10px; box-sizing: border-box; margin-top: 6px; font: inherit; color: var(--primary-text-color); background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 6px; }
    input[type=checkbox] { accent-color: var(--primary-color); margin-right: 8px; }
    p { color: var(--secondary-text-color); font-size: 13px; }
  `;
  setConfig(config: Partial<CardConfig>) { this.config = { ...config }; }
  private change(key: keyof CardConfig, value: string | boolean) {
    const config = { ...this.config } as Record<string, unknown>;
    if (value === '') delete config[key]; else config[key] = value;
    this.config = config as Partial<CardConfig>;
    fireEvent(this, 'config-changed', { config: this.config });
  }
  protected shouldUpdate(changed: PropertyValues) {
    if (changed.has('config')) return true;
    const old = changed.get('hass') as HomeAssistant | undefined;
    return !old || old.language !== this.hass?.language || Object.keys(old.states).join() !== Object.keys(this.hass?.states ?? {}).join();
  }
  protected render() {
    if (!this.hass) return html``;
    const de = this.hass.language?.startsWith('de');
    return html`
      <p>${de ? 'Bei einem Schalter bitte auch die Zielfeuchtigkeit auswählen. Bei humidifier-Entitäten sind die zusätzlichen Entitäten optional. Statistiken und weitere Warnungen können in YAML angepasst werden.' : 'For a switch, also select the target humidity. For humidifier entities the additional entities are optional. Custom stats and warnings can be configured in YAML.'}</p>
      ${fields.map(([key, domains, german, english]) => {
        const ids = Object.keys(this.hass.states).filter(id => (domains as readonly string[]).includes(id.split('.')[0])).sort();
        const current = this.config[key] ?? '';
        return html`<label>${de ? german : english}<select aria-label=${de ? german : english} .value=${current}
          @change=${(event: Event) => this.change(key, (event.target as HTMLSelectElement).value)}>
          <option value="">—</option>
          ${current && !ids.includes(current) ? html`<option value=${current} selected>${current}</option>` : ''}
          ${ids.map(id => html`<option value=${id} .selected=${id === current}>${this.hass.states[id].attributes.friendly_name ?? id} (${id})</option>`)}
        </select></label>`;
      })}
      <label>${de ? 'Name (optional)' : 'Name (optional)'}<input type="text" .value=${this.config.name ?? ''}
        @change=${(event: Event) => this.change('name', (event.target as HTMLInputElement).value)}></label>
      ${([
        ['show_name', 'Name anzeigen', 'Show name'], ['show_state', 'Zustand anzeigen', 'Show state'],
        ['show_mode', 'Betriebsmodus anzeigen', 'Show mode'], ['show_toolbar', 'Bedienleiste anzeigen', 'Show toolbar'],
        ['compact_view', 'Kompakte Ansicht', 'Compact view'],
      ] as const).map(([key, german, english]) => html`<label><input type="checkbox" .checked=${this.config[key] ?? key !== 'compact_view'}
        @change=${(event: Event) => this.change(key, (event.target as HTMLInputElement).checked)}>${de ? german : english}</label>`)}
    `;
  }
}
