/**
 * RSS Feed Card für Home Assistant
 * Platzieren in: /config/www/rss-feed-card.js
 * Lovelace resource: /local/rss-feed-card.js
 */

class RssFeedCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Bitte eine entity angeben (sensor.mein_rss_feed)");
    }
    this._config = {
      title: config.title || null,
      entity: config.entity,
      max_items: config.max_items || null,
      show_summary: config.show_summary !== false,
      show_date: config.show_date !== false,
      show_image: config.show_image !== false,
      show_source: config.show_source !== false,
      open_link: config.open_link || "new_tab",
      theme: config.theme || "auto",
    };
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() {
    return 3;
  }

  _formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d)) return dateStr;
      const now = new Date();
      const diff = Math.floor((now - d) / 1000);
      if (diff < 60) return "Gerade eben";
      if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
      if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
      if (diff < 604800) return `vor ${Math.floor(diff / 86400)} Tagen`;
      return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  }

  render() {
    if (!this._config || !this._hass) return;

    const entityId = this._config.entity;
    const state = this._hass.states[entityId];

    const isDark =
      this._config.theme === "dark" ||
      (this._config.theme === "auto" &&
        this._hass.themes?.darkMode);

    if (!state) {
      this.shadowRoot.innerHTML = `
        <ha-card>
          <div style="padding:16px;color:var(--error-color)">
            Entity "${entityId}" nicht gefunden.
          </div>
        </ha-card>`;
      return;
    }

    const attrs = state.attributes || {};
    const feedTitle = attrs.feed_title || attrs.friendly_name || "RSS Feed";
    const entries = attrs.entries || [];
    const maxItems = this._config.max_items || entries.length;
    const displayEntries = entries.slice(0, maxItems);
    const cardTitle = this._config.title || feedTitle;

    const accentColor = "#1976D2";
    const cardBg = isDark ? "#1c1c1e" : "#ffffff";
    const textPrimary = isDark ? "#e0e0e0" : "#212121";
    const textSecondary = isDark ? "#9e9e9e" : "#757575";
    const borderColor = isDark ? "#333" : "#f0f0f0";
    const tagBg = isDark ? "#2a2a2e" : "#e8f0fe";
    const tagColor = accentColor;
    const hoverBg = isDark ? "#252528" : "#f8f9ff";

    const entriesHtml = displayEntries.length === 0
      ? `<div style="padding:20px;text-align:center;color:${textSecondary}">Keine Einträge verfügbar</div>`
      : displayEntries.map((entry, index) => {
          const title = entry.title || "Kein Titel";
          const summary = entry.summary || "";
          const link = entry.link || "#";
          const published = entry.published || "";
          const image = entry.image;
          const dateStr = this._formatDate(published);

          const imageHtml = (this._config.show_image && image)
            ? `<div style="flex-shrink:0;width:80px;height:64px;border-radius:8px;overflow:hidden;margin-left:12px">
                <img src="${image}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none'" />
               </div>`
            : "";

          const summaryHtml = (this._config.show_summary && summary)
            ? `<p style="margin:4px 0 0;font-size:0.78rem;color:${textSecondary};line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${summary}</p>`
            : "";

          const dateHtml = (this._config.show_date && dateStr)
            ? `<span style="font-size:0.72rem;color:${textSecondary};margin-top:6px;display:block">${dateStr}</span>`
            : "";

          const divider = index < displayEntries.length - 1
            ? `<div style="height:1px;background:${borderColor};margin:0 0"></div>`
            : "";

          return `
            <a href="${link}" target="_blank" rel="noopener noreferrer"
               style="display:block;text-decoration:none;color:inherit;padding:12px 16px;transition:background 0.15s"
               onmouseover="this.style.background='${hoverBg}'"
               onmouseout="this.style.background='transparent'">
              <div style="display:flex;align-items:flex-start;gap:0">
                <div style="flex:1;min-width:0">
                  <div style="font-size:0.875rem;font-weight:500;color:${textPrimary};line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">
                    ${title}
                  </div>
                  ${summaryHtml}
                  ${dateHtml}
                </div>
                ${imageHtml}
              </div>
            </a>
            ${divider}
          `;
        }).join("");

    const sourceHtml = this._config.show_source
      ? `<div style="padding:8px 16px;border-top:1px solid ${borderColor};display:flex;align-items:center;gap:6px">
           <span style="font-size:0.7rem;color:${textSecondary}">Quelle:</span>
           <span style="font-size:0.7rem;background:${tagBg};color:${tagColor};padding:2px 8px;border-radius:12px;font-weight:500">${feedTitle}</span>
           <span style="margin-left:auto;font-size:0.7rem;color:${textSecondary}">${displayEntries.length} Einträge</span>
         </div>`
      : "";

    this.shadowRoot.innerHTML = `
      <ha-card style="background:${cardBg};border-radius:12px;overflow:hidden;box-shadow:var(--ha-card-box-shadow,0 2px 8px rgba(0,0,0,.1))">
        <div style="padding:14px 16px 10px;display:flex;align-items:center;gap:10px;border-bottom:1px solid ${borderColor}">
          <div style="width:32px;height:32px;border-radius:8px;background:${accentColor};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
              <path d="M6.18,15.64A2.18,2.18 0 0,1 8.36,17.82C8.36,19.01 7.38,20 6.18,20C4.98,20 4,19.01 4,17.82A2.18,2.18 0 0,1 6.18,15.64M4,4.44A15.56,15.56 0 0,1 19.56,20H16.73A12.73,12.73 0 0,0 4,7.27V4.44M4,10.1A9.9,9.9 0 0,1 13.9,20H11.07A7.07,7.07 0 0,0 4,12.93V10.1Z"/>
            </svg>
          </div>
          <div style="font-weight:600;font-size:1rem;color:${textPrimary};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cardTitle}</div>
        </div>
        <div>${entriesHtml}</div>
        ${sourceHtml}
      </ha-card>
    `;
  }

  static getConfigElement() {
    return document.createElement("rss-feed-card-editor");
  }

  static getStubConfig() {
    return {
      entity: "sensor.mein_rss_feed",
      title: "",
      show_summary: true,
      show_date: true,
      show_image: true,
      show_source: true,
      max_items: 5,
    };
  }
}

// ── Visual Editor ──────────────────────────────────────────
class RssFeedCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) this.render();
  }

  _valueChanged(key, value) {
    const newConfig = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: newConfig } }));
  }

  render() {
    this._rendered = true;
    if (!this._config) return;
    const c = this._config;

    this.innerHTML = `
      <style>
        .editor { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        label { font-size: 0.85rem; color: var(--secondary-text-color); display: block; margin-bottom: 4px; }
        input[type=text], input[type=number] {
          width: 100%; box-sizing: border-box; padding: 8px 10px;
          border: 1px solid var(--divider-color, #ccc); border-radius: 6px;
          font-size: 0.9rem; background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; }
        .toggle-row span { font-size: 0.875rem; color: var(--primary-text-color); }
      </style>
      <div class="editor">
        <div>
          <label>Entity (sensor.*)</label>
          <input type="text" id="entity" value="${c.entity || ""}" placeholder="sensor.mein_rss_feed" />
        </div>
        <div>
          <label>Titel (optional, überschreibt Feed-Titel)</label>
          <input type="text" id="title" value="${c.title || ""}" placeholder="Mein RSS Feed" />
        </div>
        <div>
          <label>Max. Anzahl Einträge</label>
          <input type="number" id="max_items" value="${c.max_items || ""}" min="1" max="50" placeholder="Alle anzeigen" />
        </div>
        <div class="toggle-row">
          <span>Zusammenfassung anzeigen</span>
          <input type="checkbox" id="show_summary" ${c.show_summary !== false ? "checked" : ""} />
        </div>
        <div class="toggle-row">
          <span>Datum anzeigen</span>
          <input type="checkbox" id="show_date" ${c.show_date !== false ? "checked" : ""} />
        </div>
        <div class="toggle-row">
          <span>Bilder anzeigen</span>
          <input type="checkbox" id="show_image" ${c.show_image !== false ? "checked" : ""} />
        </div>
        <div class="toggle-row">
          <span>Quelle anzeigen</span>
          <input type="checkbox" id="show_source" ${c.show_source !== false ? "checked" : ""} />
        </div>
      </div>
    `;

    this.querySelector("#entity").addEventListener("change", (e) => this._valueChanged("entity", e.target.value));
    this.querySelector("#title").addEventListener("change", (e) => this._valueChanged("title", e.target.value));
    this.querySelector("#max_items").addEventListener("change", (e) => this._valueChanged("max_items", parseInt(e.target.value) || null));
    this.querySelector("#show_summary").addEventListener("change", (e) => this._valueChanged("show_summary", e.target.checked));
    this.querySelector("#show_date").addEventListener("change", (e) => this._valueChanged("show_date", e.target.checked));
    this.querySelector("#show_image").addEventListener("change", (e) => this._valueChanged("show_image", e.target.checked));
    this.querySelector("#show_source").addEventListener("change", (e) => this._valueChanged("show_source", e.target.checked));
  }
}

customElements.define("rss-feed-card", RssFeedCard);
customElements.define("rss-feed-card-editor", RssFeedCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "rss-feed-card",
  name: "RSS Feed Card",
  description: "Zeigt Einträge eines RSS-Feed Sensors an",
  preview: true,
  documentationURL: "",
});

console.info(
  "%c RSS-FEED-CARD %c v1.0.0 ",
  "color:#fff;background:#1976D2;font-weight:bold;padding:2px 6px;border-radius:3px 0 0 3px",
  "color:#1976D2;background:#e8f0fe;font-weight:bold;padding:2px 6px;border-radius:0 3px 3px 0"
);
