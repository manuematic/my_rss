/**
 * RSS Feed Card für Home Assistant — v0.4.0
 * /config/www/rss-feed-card.js  →  resource: /local/rss-feed-card.js (JavaScript-Modul)
 */

class RssFeedCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._localMaxItems  = null;
    this._filterText     = "";
    this._refreshTimer   = null;
  }

  // ── Config ──────────────────────────────────────────────────────
  setConfig(config) {
    if (!config.entity) throw new Error("Bitte eine entity angeben (sensor.my_rss_feed_...)");
    this._config = {
      title:           config.title           || null,
      entity:          config.entity,
      max_items:       config.max_items        || null,
      show_summary:    config.show_summary     !== false,
      show_date:       config.show_date        !== false,
      show_image:      config.show_image       !== false,
      show_source:     config.show_source      !== false,
      show_slider:     config.show_slider      !== false,
      show_filter:     config.show_filter      !== false,
      refresh_minutes: config.refresh_minutes  || 0,   // 0 = off
      theme:           config.theme            || "auto",
    };
    this._localMaxItems = null;
    this._filterText    = "";
    this._startRefreshTimer();
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() { return 4; }

  // ── Auto-refresh timer ──────────────────────────────────────────
  _startRefreshTimer() {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    const minutes = this._config?.refresh_minutes || 0;
    if (minutes > 0) {
      this._refreshTimer = setInterval(() => {
        // Ask HA to re-fetch entity state (triggers coordinator poll via service)
        if (this._hass && this._config?.entity) {
          this._hass.callService("homeassistant", "update_entity", {
            entity_id: this._config.entity,
          }).catch(() => {});
        }
      }, minutes * 60 * 1000);
    }
  }

  disconnectedCallback() {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
  }

  // ── Helpers ─────────────────────────────────────────────────────
  _formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const d    = new Date(dateStr);
      if (isNaN(d)) return dateStr;
      const diff = Math.floor((new Date() - d) / 1000);
      if (diff < 60)     return "Gerade eben";
      if (diff < 3600)   return `vor ${Math.floor(diff / 60)} Min.`;
      if (diff < 86400)  return `vor ${Math.floor(diff / 3600)} Std.`;
      if (diff < 604800) return `vor ${Math.floor(diff / 86400)} Tagen`;
      return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return dateStr; }
  }

  _matchesFilter(entry, filter) {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      (entry.title   || "").toLowerCase().includes(q) ||
      (entry.summary || "").toLowerCase().includes(q)
    );
  }

  // ── Render ──────────────────────────────────────────────────────
  render() {
    if (!this._config || !this._hass) return;

    const state = this._hass.states[this._config.entity];
    const isDark = this._config.theme === "dark" ||
                   (this._config.theme === "auto" && this._hass.themes?.darkMode);

    if (!state) {
      this.shadowRoot.innerHTML = `
        <ha-card><div style="padding:16px;color:var(--error-color)">
          Entity "${this._config.entity}" nicht gefunden.
        </div></ha-card>`;
      return;
    }

    const attrs     = state.attributes || {};
    const feedTitle = attrs.feed_title || attrs.friendly_name || "RSS Feed";
    const allEntries = attrs.entries || [];

    // Apply keyword filter
    const filtered  = this._filterText
      ? allEntries.filter(e => this._matchesFilter(e, this._filterText))
      : allEntries;

    const configMax    = this._config.max_items || allEntries.length;
    const effectiveMax = this._localMaxItems !== null ? this._localMaxItems : configMax;
    const displayed    = filtered.slice(0, effectiveMax);

    const cardTitle = this._config.title || feedTitle;

    // ── Theme tokens ──────────────────────────────────────────────
    const accent      = "#1976D2";
    const cardBg      = isDark ? "#1c1c1e" : "#ffffff";
    const textPrimary = isDark ? "#e0e0e0" : "#212121";
    const textSec     = isDark ? "#9e9e9e" : "#757575";
    const border      = isDark ? "#333"    : "#f0f0f0";
    const tagBg       = isDark ? "#2a2a2e" : "#e8f0fe";
    const hoverBg     = isDark ? "#252528" : "#f8f9ff";
    const toolbarBg   = isDark ? "#242426" : "#f5f8ff";
    const inputBg     = isDark ? "#1c1c1e" : "#ffffff";
    const inputBorder = isDark ? "#444"    : "#d0d7e8";

    // ── Slider ────────────────────────────────────────────────────
    const sliderHtml = this._config.show_slider ? `
      <div style="padding:8px 16px 6px;background:${toolbarBg};border-bottom:1px solid ${border};
                  display:flex;align-items:center;gap:10px">
        <span style="font-size:0.75rem;color:${textSec};white-space:nowrap">Einträge:</span>
        <input id="max-slider" type="range"
               min="1" max="${allEntries.length || 1}" value="${effectiveMax}"
               style="flex:1;accent-color:${accent};cursor:pointer" />
        <span id="slider-val"
              style="font-size:0.8rem;font-weight:600;color:${accent};min-width:26px;text-align:right">
          ${effectiveMax}
        </span>
      </div>` : "";

    // ── Filter bar ────────────────────────────────────────────────
    const filterHtml = this._config.show_filter ? `
      <div style="padding:8px 16px 8px;background:${toolbarBg};border-bottom:1px solid ${border};
                  display:flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="${textSec}" style="flex-shrink:0">
          <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
        </svg>
        <input id="filter-input" type="text"
               placeholder="Stichwort filtern…"
               value="${this._filterText}"
               style="flex:1;border:1px solid ${inputBorder};border-radius:6px;padding:5px 10px;
                      font-size:0.85rem;background:${inputBg};color:${textPrimary};outline:none;
                      transition:border-color .15s"
               onfocus="this.style.borderColor='${accent}'"
               onblur="this.style.borderColor='${inputBorder}'" />
        ${this._filterText ? `
        <button id="filter-clear"
                style="background:none;border:none;cursor:pointer;padding:2px 4px;
                       color:${textSec};font-size:1rem;line-height:1">✕</button>` : ""}
      </div>` : "";

    // ── Entry list ────────────────────────────────────────────────
    let entriesHtml;
    if (allEntries.length === 0) {
      entriesHtml = `<div style="padding:24px;text-align:center;color:${textSec}">Keine Einträge verfügbar</div>`;
    } else if (displayed.length === 0) {
      entriesHtml = `<div style="padding:24px;text-align:center;color:${textSec}">
        Kein Eintrag entspricht dem Filter „${this._escHtml(this._filterText)}"
      </div>`;
    } else {
      entriesHtml = displayed.map((entry, index) => {
        const title   = this._escHtml(entry.title   || "Kein Titel");
        const summary = this._escHtml(entry.summary || "");
        const link    = entry.link    || "#";
        const dateStr = this._formatDate(entry.published || "");
        const image   = entry.image;

        const imageHtml = (this._config.show_image && image) ? `
          <div style="flex-shrink:0;width:80px;height:64px;border-radius:8px;overflow:hidden;margin-left:12px">
            <img src="${image}" style="width:100%;height:100%;object-fit:cover"
                 onerror="this.parentElement.style.display='none'" />
          </div>` : "";

        const summaryHtml = (this._config.show_summary && summary) ? `
          <p style="margin:4px 0 0;font-size:0.78rem;color:${textSec};line-height:1.45;
             display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
            ${summary}
          </p>` : "";

        const dateHtml = (this._config.show_date && dateStr) ? `
          <span style="font-size:0.72rem;color:${textSec};margin-top:6px;display:block">${dateStr}</span>` : "";

        const divider = index < displayed.length - 1
          ? `<div style="height:1px;background:${border}"></div>` : "";

        return `
          <a href="${link}" target="_blank" rel="noopener noreferrer"
             style="display:block;text-decoration:none;color:inherit;padding:12px 16px;transition:background .15s"
             onmouseover="this.style.background='${hoverBg}'"
             onmouseout="this.style.background='transparent'">
            <div style="display:flex;align-items:flex-start">
              <div style="flex:1;min-width:0">
                <div style="font-size:0.875rem;font-weight:500;color:${textPrimary};line-height:1.4;
                     overflow:hidden;text-overflow:ellipsis;display:-webkit-box;
                     -webkit-line-clamp:2;-webkit-box-orient:vertical">
                  ${title}
                </div>
                ${summaryHtml}
                ${dateHtml}
              </div>
              ${imageHtml}
            </div>
          </a>
          ${divider}`;
      }).join("");
    }

    // ── Footer ────────────────────────────────────────────────────
    const refreshLabel = this._config.refresh_minutes > 0
      ? `<span style="font-size:0.7rem;color:${textSec}">↻ alle ${this._config.refresh_minutes} Min.</span>` : "";

    const footerHtml = this._config.show_source ? `
      <div style="padding:8px 16px;border-top:1px solid ${border};
                  display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-size:0.7rem;color:${textSec}">Quelle:</span>
        <span style="font-size:0.7rem;background:${tagBg};color:${accent};
              padding:2px 8px;border-radius:12px;font-weight:500">${this._escHtml(feedTitle)}</span>
        ${refreshLabel}
        <span style="margin-left:auto;font-size:0.7rem;color:${textSec}">
          ${displayed.length}${this._filterText ? " gefiltert" : ""} / ${allEntries.length} Einträge
        </span>
      </div>` : "";

    // ── Full card ─────────────────────────────────────────────────
    this.shadowRoot.innerHTML = `
      <ha-card style="background:${cardBg};border-radius:12px;overflow:hidden;
                      box-shadow:var(--ha-card-box-shadow,0 2px 8px rgba(0,0,0,.1))">
        <div style="padding:14px 16px 10px;display:flex;align-items:center;gap:10px;
                    border-bottom:1px solid ${border}">
          <div style="width:32px;height:32px;border-radius:8px;background:${accent};
                      display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
              <path d="M6.18,15.64A2.18,2.18 0 0,1 8.36,17.82C8.36,19.01 7.38,20 6.18,20
                       C4.98,20 4,19.01 4,17.82A2.18,2.18 0 0,1 6.18,15.64M4,4.44A15.56,15.56
                       0 0,1 19.56,20H16.73A12.73,12.73 0 0,0 4,7.27V4.44M4,10.1A9.9,9.9 0 0,1
                       13.9,20H11.07A7.07,7.07 0 0,0 4,12.93V10.1Z"/>
            </svg>
          </div>
          <div style="font-weight:600;font-size:1rem;color:${textPrimary};
                      flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${this._escHtml(cardTitle)}
          </div>
        </div>
        ${sliderHtml}
        ${filterHtml}
        <div id="entries-list">${entriesHtml}</div>
        ${footerHtml}
      </ha-card>`;

    // ── Event listeners ───────────────────────────────────────────
    const slider = this.shadowRoot.getElementById("max-slider");
    if (slider) {
      slider.addEventListener("input", (e) => {
        this._localMaxItems = parseInt(e.target.value);
        this.render();
      });
    }

    const filterInput = this.shadowRoot.getElementById("filter-input");
    if (filterInput) {
      filterInput.addEventListener("input", (e) => {
        this._filterText = e.target.value;
        this.render();
      });
    }

    const clearBtn = this.shadowRoot.getElementById("filter-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this._filterText = "";
        this.render();
      });
    }
  }

  _escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Visual Editor ─────────────────────────────────────────────
  static getConfigElement() {
    return document.createElement("rss-feed-card-editor");
  }

  static getStubConfig() {
    return {
      entity:          "sensor.my_rss_feed_mein_feed",
      title:           "",
      max_items:       5,
      show_slider:     true,
      show_filter:     true,
      show_summary:    true,
      show_date:       true,
      show_image:      true,
      show_source:     true,
      refresh_minutes: 30,
    };
  }
}

// ── Visual Editor ──────────────────────────────────────────────────────────
class RssFeedCardEditor extends HTMLElement {
  setConfig(config) { this._config = config; this.render(); }
  set hass(hass)    { this._hass = hass; if (!this._rendered) this.render(); }

  _fire(key, value) {
    this.dispatchEvent(new CustomEvent("config-changed",
      { detail: { config: { ...this._config, [key]: value } } }));
  }

  render() {
    this._rendered = true;
    if (!this._config) return;
    const c = this._config;

    this.innerHTML = `
      <style>
        .ed  { padding:16px;display:flex;flex-direction:column;gap:10px }
        lab  { font-size:.82rem;color:var(--secondary-text-color);display:block;margin-bottom:3px }
        input[type=text], input[type=number] {
          width:100%;box-sizing:border-box;padding:7px 10px;
          border:1px solid var(--divider-color,#ccc);border-radius:6px;
          font-size:.9rem;background:var(--card-background-color);color:var(--primary-text-color)
        }
        .row { display:flex;align-items:center;justify-content:space-between;padding:2px 0 }
        .row span { font-size:.875rem;color:var(--primary-text-color) }
        .sec { border-top:1px solid var(--divider-color,#eee);padding-top:10px;margin-top:4px }
        h4   { margin:0 0 8px;font-size:.78rem;color:var(--secondary-text-color);
               text-transform:uppercase;letter-spacing:.06em }
      </style>
      <div class="ed">
        <div>
          <lab>Entity (sensor.my_rss_feed_*)</lab>
          <input type="text" id="entity" value="${c.entity||""}" placeholder="sensor.my_rss_feed_tagesschau"/>
        </div>
        <div>
          <lab>Kartentitel (leer = Feed-Titel)</lab>
          <input type="text" id="title" value="${c.title||""}" placeholder="Mein RSS Feed"/>
        </div>
        <div>
          <lab>Standard max. Einträge (leer = alle)</lab>
          <input type="number" id="max_items" value="${c.max_items||""}" min="1" max="50"/>
        </div>
        <div>
          <lab>Card auto-refresh (Minuten, 0 = aus)</lab>
          <input type="number" id="refresh_minutes" value="${c.refresh_minutes||0}" min="0" max="1440"/>
        </div>
        <div class="sec">
          <h4>Sichtbare Bedienelemente</h4>
          <div class="row"><span>Schieberegler Einträge</span>
            <input type="checkbox" id="show_slider"  ${c.show_slider  !==false?"checked":""}/>
          </div>
          <div class="row"><span>Stichwort-Filterfeld</span>
            <input type="checkbox" id="show_filter"  ${c.show_filter  !==false?"checked":""}/>
          </div>
        </div>
        <div class="sec">
          <h4>Inhaltsanzeige</h4>
          <div class="row"><span>Zusammenfassung</span>
            <input type="checkbox" id="show_summary" ${c.show_summary !==false?"checked":""}/>
          </div>
          <div class="row"><span>Datum</span>
            <input type="checkbox" id="show_date"    ${c.show_date    !==false?"checked":""}/>
          </div>
          <div class="row"><span>Vorschaubilder</span>
            <input type="checkbox" id="show_image"   ${c.show_image   !==false?"checked":""}/>
          </div>
          <div class="row"><span>Quellen-Badge</span>
            <input type="checkbox" id="show_source"  ${c.show_source  !==false?"checked":""}/>
          </div>
        </div>
      </div>`;

    [
      ["entity",          v => v],
      ["title",           v => v],
      ["max_items",       v => parseInt(v)||null],
      ["refresh_minutes", v => parseInt(v)||0],
    ].forEach(([id, fn]) =>
      this.querySelector(`#${id}`).addEventListener("change", e => this._fire(id, fn(e.target.value))));

    ["show_slider","show_filter","show_summary","show_date","show_image","show_source"].forEach(id =>
      this.querySelector(`#${id}`).addEventListener("change", e => this._fire(id, e.target.checked)));
  }
}

customElements.define("rss-feed-card",        RssFeedCard);
customElements.define("rss-feed-card-editor", RssFeedCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        "rss-feed-card",
  name:        "RSS Feed Card",
  description: "Zeigt RSS-Feed Einträge mit Filter, Slider und Auto-Refresh",
  preview:     true,
});

console.info(
  "%c RSS-FEED-CARD %c v0.4.0 ",
  "color:#fff;background:#1976D2;font-weight:bold;padding:2px 6px;border-radius:3px 0 0 3px",
  "color:#1976D2;background:#e8f0fe;font-weight:bold;padding:2px 6px;border-radius:0 3px 3px 0"
);
