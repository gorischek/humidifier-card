import { css } from 'lit';

// Header, circular control, metadata, stats and toolbar follow Purifier Card's layout.
export const styles = css`
  :host {
    --hc-background: var(--ha-card-background, var(--card-background-color, transparent));
    --hc-primary: var(--primary-text-color, #212121);
    --hc-secondary: var(--secondary-text-color, #727272);
    --hc-accent: var(--primary-color, #039be5);
    --hc-divider: var(--entities-divider-color, var(--divider-color, #ddd));
    display: block;
  }
  ha-card { display: block; background: var(--hc-background); color: var(--hc-primary); overflow: hidden; }
  button, select, input { font: inherit; }
  button { color: inherit; cursor: pointer; }
  button:disabled, select:disabled, input:disabled { cursor: default; opacity: .45; }
  button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--hc-accent); outline-offset: 3px; }
  .header { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 2px 10px; gap: 8px; }
  .mode-control { position: relative; display: inline-flex; align-items: center; color: var(--hc-secondary); min-width: 0; gap: 4px; }
  .mode-control ha-icon { --mdc-icon-size: 18px; }
  select { appearance: none; -webkit-appearance: none; color: var(--hc-secondary); background: transparent; border: 0; padding: 8px 24px 8px 3px; max-width: 190px; }
  .mode-arrow { position: absolute; right: 3px; pointer-events: none; }
  option { background: var(--card-background-color, #fff); color: var(--hc-primary); }
  .icon-button { border: 0; border-radius: 50%; background: transparent; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .icon-button:hover { background: var(--secondary-background-color, #eeeeee); }
  .controls { display: flex; justify-content: center; }
  .slider { position: relative; width: min(100%, 250px); aspect-ratio: 1; }
  humidifier-round-slider { display: block; width: 100%; --round-slider-path-color: var(--round-slider-path-color, var(--hc-divider)); --round-slider-bar-color: var(--round-slider-bar-color, var(--hc-accent)); }
  .device { position: absolute; top: 25%; left: 18%; width: 64%; height: 64%; pointer-events: none; color: var(--hc-accent); }
  .device-image { display: block; width: 100%; height: 100%; object-fit: contain; }
  .device-mist { position: absolute; top: -12%; left: 22%; width: 56%; height: 30%; overflow: visible; }
  .mist { opacity: 0; }
  .device.running .mist { animation: mist 2.4s ease-in-out infinite; }
  .device.running .mist:nth-child(2) { animation-delay: -.8s; }
  .device.running .mist:nth-child(3) { animation-delay: -1.6s; }
  @keyframes mist { 0% { opacity: 0; transform: translateY(9px); } 40% { opacity: .55; } 100% { opacity: 0; transform: translateY(-10px); } }
  @media (prefers-reduced-motion: reduce) { .device.running .mist { animation: none; opacity: .45; } }
  .target { position: absolute; bottom: 5px; left: 0; right: 0; text-align: center; font-size: 15px; pointer-events: none; }
  .target small { color: var(--hc-secondary); }
  .metadata { text-align: center; padding: 8px 12px 12px; }
  .friendly-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
  .state { color: var(--hc-secondary); display: flex; justify-content: center; align-items: center; gap: 8px; }
  .pending { width: 12px; height: 12px; border: 2px solid var(--hc-divider); border-top-color: var(--hc-accent); border-radius: 50%; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .stats { border-top: 1px solid var(--hc-divider); display: flex; flex-wrap: wrap; }
  .stats-block { flex: 1 1 80px; border: 0; border-right: 1px solid var(--hc-divider); background: transparent; padding: 12px 8px; text-align: center; min-width: 0; overflow-wrap: anywhere; }
  .stats-block:last-child { border-right: 0; }
  .stats-value { font-size: 20px; }
  .stats-subtitle { font-size: 12px; color: var(--hc-secondary); margin-top: 3px; }
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 5px; border-top: 1px solid var(--hc-divider); }
  .toolbar .icon-button { color: var(--hc-secondary); }
  .toolbar .active { color: var(--hc-accent); background: color-mix(in srgb, var(--hc-accent) 10%, transparent); }
  .gap { flex: 1; }
  .mode-button { border: 0; background: transparent; color: var(--hc-secondary); border-radius: 18px; padding: 9px 10px; font-size: 13px; }
  .warnings { border-top: 1px solid var(--hc-divider); padding: 8px 10px; display: flex; gap: 8px; flex-wrap: wrap; }
  .status-indicators { border-top: 1px solid var(--hc-divider); padding: 8px 10px; display: flex; gap: 8px; flex-wrap: wrap; }
  .status-indicator { flex: 1 1 120px; border: 0; background: transparent; color: var(--hc-primary); border-radius: 6px; display: inline-flex; justify-content: center; gap: 6px; align-items: center; padding: 6px 8px; font-size: 13px; white-space: nowrap; }
  .status-indicator ha-icon { --mdc-icon-size: 18px; }
  .status-indicator.ok ha-icon { color: var(--success-color, #43a047); }
  .status-indicator.unknown ha-icon { color: var(--hc-secondary); }
  .warning { border: 0; background: color-mix(in srgb, var(--warning-color, #ffa726) 12%, transparent); color: var(--hc-primary); border-radius: 6px; display: inline-flex; gap: 6px; align-items: center; padding: 6px 8px; font-size: 13px; }
  .warning ha-icon { color: var(--warning-color, #ffa726); --mdc-icon-size: 18px; }
  .error, .unavailable { padding: 12px; text-align: center; overflow-wrap: anywhere; }
  .error { color: var(--error-color, #db4437); font-size: 13px; border-top: 1px solid var(--hc-divider); }
  .compact { width: 100%; padding: 8px 16px; box-sizing: border-box; }
  .compact-values { display: flex; justify-content: center; align-items: center; }
  .compact input { width: 100%; accent-color: var(--hc-accent); margin: 16px 0 0; }
  .compact-target { text-align: center; }
`;
