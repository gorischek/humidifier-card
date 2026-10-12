# Humidifier Card

Eine Luftbefeuchter-Karte für Home Assistant mit Kreisregler für die Zielfeuchtigkeit, aktuellem Feuchtigkeitswert, Betriebsmodi und Wasser-/Tankwarnungen. Die Anordnung orientiert sich an der **Purifier Card**, sodass beide Karten zusammenpassen.

Unterstützt werden:

- **Getrennte Entitäten**, zum Beispiel ein Levoit mit ESPHome: `switch` + `number` + `select` + Sensoren.
- **Native `humidifier`-Entitäten** mit Zielwert, aktueller Feuchtigkeit und Betriebsmodi als Attribute.
- Deutsch und Englisch, helle und dunkle HA-Themes sowie eine kompakte Ansicht.
- Ein visueller Editor für die Geräte-Entitäten und Anzeigeoptionen.
- Weitere Statistiken und Warnungen über YAML.

## Installation über HACS

1. In **HACS** das Menü mit den drei Punkten öffnen und **Benutzerdefinierte Repositories / Custom repositories** wählen.
2. `https://github.com/gorischek/humidifier-card` hinzufügen, Kategorie **Dashboard** (in älteren Oberflächen **Lovelace / Plugin**).
3. **Humidifier Card** suchen und herunterladen. Falls noch kein Release existiert, die Standardversion `main` verwenden.
4. Den Browser vollständig neu laden. Ein Neustart von Home Assistant ist für die Karte nicht erforderlich.
5. Im Dashboard eine manuelle Karte hinzufügen und die YAML unten einfügen, oder im Kartenpicker **Humidifier Card** auswählen.

Die fertige Datei **`dist/humidifier-card.js`** liegt bereits auf `main`; ein eigenes Kompilieren oder Release ist für die erste Installation nicht notwendig.

Falls HACS keine Dashboard-Ressource angelegt hat, unter **Einstellungen → Dashboards → Ressourcen** hinzufügen:

```yaml
url: /hacsfiles/humidifier-card/humidifier-card.js
type: module
```

Die vorhandene `purifier-card.js`-Ressource bleibt bestehen. Beide Karten haben eigene Elementnamen und können gleichzeitig geladen werden.

## Konfiguration für Michaels Levoit

```yaml
type: custom:humidifier-card
entity: switch.levoit_luftbefeuchter_luftbefeuchter
target_humidity_entity: number.levoit_luftbefeuchter_zielfeuchtigkeit
humidity_entity: sensor.levoit_luftbefeuchter_luftfeuchtigkeit
mode_entity: select.levoit_luftbefeuchter_betriebsmodus
temperature_entity: sensor.levoit_luftbefeuchter_temperatur
water_missing_entity: binary_sensor.levoit_luftbefeuchter_wasser_fehlt
tank_missing_entity: binary_sensor.levoit_luftbefeuchter_tank_fehlt
name: Levoit Luftbefeuchter
compact_view: false
show_name: false
show_state: true
show_mode: true
show_toolbar: true
stats:
  - entity_id: sensor.levoit_luftbefeuchter_temperatur
    subtitle: Temperatur
    unit: °C
    precision: 1
  - entity_id: number.levoit_luftbefeuchter_zielfeuchtigkeit
    subtitle: Zielfeuchtigkeit
    unit: '%'
    precision: 0
```

Auch als Datei unter [examples/levoit.yaml](examples/levoit.yaml) verfügbar.

- **Kreisregler:** stellt die Zielfeuchtigkeit ein. Minimum, Maximum und Schrittweite stammen von der Zielwert-Entität. Ein Service-Aufruf erfolgt beim Loslassen; die Tastatursteuerung wird beim Verlassen des Reglers bestätigt.
- **Mitte:** aktuelle Luftfeuchtigkeit, auf ganze Prozent gerundet.
- **Oben:** Auswahl der vom Gerät angebotenen Betriebsmodi. Die ursprünglichen Optionsnamen werden unverändert an HA gesendet.
- **Unten:** Ein/Aus, Schnellwahl der Betriebsmodi sowie die Statistikfelder.
- **Warnungen:** erscheinen bei `on` der Wasser- oder Tanksensoren. Ein Klick öffnet die jeweilige Entität.

Die Karte führt keine eigene Regelung aus. Vorhandene Automationen für Zeitfenster, Fensterkontakt, Feuchtigkeitsregelung und Tankzustand arbeiten weiter. Manuelle Änderungen können von diesen Automationen beim nächsten Durchlauf wieder angepasst werden.

Die Nebelanimation zeigt bei der Konfiguration mit einem Schalter **eingeschaltet** an; sie bestätigt keine tatsächlich gemessene Nebelerzeugung. Bei einer Wasser-/Tankwarnung wird sie angehalten. Unbekannte oder nicht verfügbare Sensorwerte erscheinen als `—`, nicht als `0`. Ein nicht verfügbarer Warnsensor wird ausdrücklich als solcher angezeigt.

## Native humidifier-Entität

```yaml
type: custom:humidifier-card
entity: humidifier.living_room
```

Verwendet die Attribute `humidity`, `current_humidity`, `min_humidity`, `max_humidity`, `mode` und `available_modes`. Falls die Integration keinen aktuellen Messwert liefert, kann `humidity_entity` einen separaten Sensor angeben. Ebenso sind separate Zielwert- und Modus-Entitäten als Overrides möglich.

## Optionen

| Option | Bedeutung | Standard |
|---|---|---|
| `entity` | `switch.*` oder `humidifier.*` für Ein/Aus | Pflicht |
| `target_humidity_entity` | `number.*` oder `input_number.*` für den Zielwert | Pflicht bei `switch`; sonst `humidity`-Attribut |
| `humidity_entity` | `sensor.*` für aktuelle Luftfeuchtigkeit | `current_humidity`-Attribut |
| `mode_entity` | `select.*` oder `input_select.*` für Betriebsmodus | Native `mode` / `available_modes` |
| `temperature_entity` | Temperatursensor für die Standardstatistiken | Keine |
| `water_missing_entity` | Binärsensor; `on` bedeutet Wasser fehlt | Keine |
| `tank_missing_entity` | Binärsensor; `on` bedeutet Tank fehlt | Keine |
| `name` | Eigener Anzeigename | Name der Hauptentität |
| `show_name` | Gerätename anzeigen | `true` |
| `show_state` | Ein/Aus-Zustand anzeigen | `true` |
| `show_mode` | Modusauswahl oben anzeigen | `true` |
| `show_toolbar` | Ein/Aus und Modusschaltflächen unten anzeigen | `true` |
| `compact_view` | Kompakte Ansicht mit linearem Regler | `false` |
| `stats` | Eigene Statistikfelder; `[]` blendet sie aus | Temperatur und separater Zielwert, soweit konfiguriert |
| `warnings` | Zusätzliche Warnungen | `[]` |

Ein/Aus wird mit `switch.turn_on` / `switch.turn_off` beziehungsweise `humidifier.turn_on` / `humidifier.turn_off` gesteuert. Zielwerte nutzen `number.set_value`, `input_number.set_value` oder `humidifier.set_humidity`. Modi nutzen `select.select_option`, `input_select.select_option` oder `humidifier.set_mode`.

### Statistikfelder

Jedes Feld benötigt `entity_id` oder `attribute`. `attribute` ohne `entity_id` bezieht sich auf die Hauptentität. Optionale Angaben sind `subtitle`, `unit`, `precision` (0–10) und `value_template`. Ohne `unit` wird die Einheit der Entität verwendet. Ohne `precision` werden Zahlen auf ganze Werte gerundet.

```yaml
stats:
  - entity_id: sensor.room_temperature
    subtitle: Temperatur
    precision: 1
  - entity_id: sensor.another_value
    subtitle: Gerundeter Wert
    unit: '%'
    value_template: '{{ value | float(0) | round(0) }}'
```

Templates werden von HA gerendert und erhalten den jeweiligen Rohwert als Variable `value`. Bis zur ersten Antwort bleibt das Templatefeld leer; bei späteren Aktualisierungen bleibt das letzte formatierte Ergebnis sichtbar. Dadurch blitzen keine unformatierten Rohwerte auf.

### Zusätzliche Warnungen

```yaml
warnings:
  - entity_id: binary_sensor.fenster_az_window
    state: 'on'
    label: Fenster geöffnet
    icon: mdi:window-open-variant
```

Diese Hinweise steuern das Gerät nicht. `state` ist optional und standardmäßig `on`.

## Manuelle Installation

1. [dist/humidifier-card.js](dist/humidifier-card.js) herunterladen und als `config/www/humidifier-card.js` speichern.
2. Ressource `/local/humidifier-card.js` mit Typ **JavaScript-Modul** hinzufügen.
3. Browser neu laden und die Karte konfigurieren.

Nur eine der Installationsmethoden verwenden, damit dieselbe Karte nicht zweimal registriert wird.

## Entwicklung und Releases

Node.js 22 oder neuer:

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

`npm test` prüft TypeScript, baut die fertige Datei und testet die Entity-/Service-Zuordnung, Wertebereiche, ungültige Zustände und die beobachteten Entitäten. Die Browserprüfung verwendet simulierte HA-Zustände und prüft zusätzlich Anzeigeaktualisierungen, Bedienung, Tastaturregler, Templates, Warnungen, Fehlerbehandlung, Editor und Layout. Der Test am echten Gerät erfolgt anschließend in Home Assistant.

Nach Änderungen **`npm run build`** ausführen und die aktualisierte Datei unter `dist/` zusammen mit dem Quellcode committen. Der Check-Workflow prüft, ob Quellcode und Bundle zusammenpassen.

Für ein Release die Version in `package.json` und `package-lock.json` erhöhen, neu bauen und committen. Anschließend entweder einen passenden `v*`-Tag pushen oder unter **Actions → Publish release → Run workflow** den Release-Workflow starten. Er prüft den Code und veröffentlicht die gebaute `humidifier-card.js` als Release-Anhang. Für `1.0.0` ist der Tag `v1.0.0`.

## Herkunft und Lizenz

Diese Karte wurde aus dem Konzept und Teilen des Codes von [Purifier Card](https://github.com/denysdovhan/purifier-card) von **Denys Dovhan** abgeleitet. Ausgangspunkt war [gorischek/purifier-card](https://github.com/gorischek/purifier-card), einschließlich des Statistik-Template-Fixes. Der Kreisregler stammt von **Thomas Lovén** (`@thomasloven/round-slider`); sein Elementname wird beim Build auf `humidifier-round-slider` geändert, damit es keine Kollision mit HA oder der Purifier Card gibt.

Die ursprüngliche MIT-Lizenz und die Urheberhinweise bleiben erhalten. Lizenzhinweise für eingebundene Bibliotheken stehen auch im fertigen Bundle.
