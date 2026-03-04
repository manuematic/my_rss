# RSS Feed Integration für Home Assistant — v0.2.0

Eine vollständige Home Assistant Integration zum Lesen und Anzeigen von RSS-Feeds.

---

## 📁 Dateistruktur

```
custom_components/rss_feed/
├── __init__.py
├── manifest.json
├── config_flow.py
├── coordinator.py
├── sensor.py
├── const.py
├── strings.json
└── translations/
    └── de.json

www/
└── rss-feed-card.js
```

---

## 🚀 Installation

### Schritt 1 – Integration kopieren

1. Den Ordner `custom_components/rss_feed/` in dein Home Assistant Konfigurationsverzeichnis kopieren:
   ```
   /config/custom_components/rss_feed/
   ```

### Schritt 2 – Lovelace Card kopieren

1. Die Datei `www/rss-feed-card.js` nach `/config/www/` kopieren.

### Schritt 3 – Lovelace Resource hinzufügen

In Home Assistant unter **Einstellungen → Dashboards → Ressourcen** hinzufügen:

| URL | Typ |
|-----|-----|
| `/local/rss-feed-card.js` | JavaScript-Modul |

Oder in `configuration.yaml`:
```yaml
lovelace:
  resources:
    - url: /local/rss-feed-card.js
      type: module
```

### Schritt 4 – Home Assistant neu starten

```
Einstellungen → System → Neu starten
```

---

## ⚙️ Integration einrichten

1. **Einstellungen → Geräte & Dienste → Integration hinzufügen**
2. Nach **"RSS Feed"** suchen
3. Formular ausfüllen:
   - **Name**: Anzeigename des Feeds (z.B. `Tagesschau`)
   - **URL**: RSS-Feed URL (z.B. `https://www.tagesschau.de/xml/rss2/`)
   - **Max. Einträge**: Anzahl der Meldungen (1–50)

### Feed bearbeiten / löschen

- **Einstellungen → Geräte & Dienste**
- Beim jeweiligen Feed auf **„Konfigurieren"** klicken (URL, Einträge, Intervall ändern)
- Zum Löschen: Drei-Punkte-Menü → **„Löschen"**

### Mehrere Feeds

Wiederhole Schritt 4 für jeden weiteren Feed. Jeder Feed wird als eigener Sensor angelegt.

---

## 🃏 Lovelace Card konfigurieren

### Minimale Konfiguration

```yaml
type: custom:rss-feed-card
entity: sensor.tagesschau
```

### Vollständige Konfiguration

```yaml
type: custom:rss-feed-card
entity: sensor.tagesschau
title: "📰 Aktuelle Nachrichten"   # Optional: Eigener Titel
max_items: 5                        # Max. angezeigte Einträge (überschreibt Integration)
show_summary: true                  # Zusammenfassung anzeigen
show_date: true                     # Datum/Uhrzeit anzeigen
show_image: true                    # Vorschaubilder anzeigen
show_source: true                   # Quellen-Badge unten anzeigen
theme: auto                         # "auto" | "light" | "dark"
```

### Mehrere Feeds in einer Ansicht

```yaml
type: vertical-stack
cards:
  - type: custom:rss-feed-card
    entity: sensor.tagesschau
    title: "🔴 Tagesschau"
    max_items: 3

  - type: custom:rss-feed-card
    entity: sensor.spiegel_online
    title: "🟡 Spiegel Online"
    max_items: 3
```

---

## 📡 Bekannte funktionierende RSS-Feed URLs

| Quelle | URL |
|--------|-----|
| Tagesschau | `https://www.tagesschau.de/xml/rss2/` |
| Spiegel Online | `https://www.spiegel.de/schlagzeilen/index.rss` |
| Zeit Online | `https://newsfeed.zeit.de/all` |
| Heise | `https://www.heise.de/rss/heise-atom.xml` |
| Golem | `https://rss.golem.de/rss.php?feed=RSS2.0` |
| Wetter (DWD) | `https://www.dwd.de/DWD/warnungen/warnapp_gemeinden/json/warnungen_gemeinde_rss.xml` |

---

## 🔧 Sensor Attribute

Der erzeugte Sensor (`sensor.<name>`) hat folgende Attribute:

| Attribut | Beschreibung |
|----------|-------------|
| `state` | Anzahl der Einträge |
| `feed_title` | Titel des RSS-Feeds |
| `entries` | Liste der Einträge (title, summary, link, published, image) |
| `url` | URL des Feeds |
| `entry_count` | Anzahl geladener Einträge |

---

## ❓ Troubleshooting

**Feed wird nicht geladen:**
- URL im Browser prüfen → muss eine XML-Seite mit `<rss>` oder `<feed>` öffnen
- Logs prüfen: Einstellungen → System → Protokoll → nach "rss_feed" suchen

**Card zeigt "Entity nicht gefunden":**
- Entity-ID prüfen: Einstellungen → Geräte & Dienste → RSS Feed → Sensor anklicken
- Typischer Format: `sensor.name_des_feeds` (Leerzeichen werden zu Unterstrichen)

**Card wird nicht angezeigt:**
- Browser-Cache leeren (Strg+F5)
- Lovelace Resource korrekt eingetragen?
- Home Assistant neu gestartet nach Installation?
