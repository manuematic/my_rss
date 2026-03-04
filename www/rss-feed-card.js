/**
 * RSS Feed Card für Home Assistant — v0.5.0
 * /config/www/rss-feed-card.js  →  resource: /local/rss-feed-card.js (JavaScript-Modul)
 */

class RssFeedCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._localMaxItems = null;
    this._filterText    = "";
    this._refreshTimer  = null;
    this._built         = false;   // true once the card skeleton is in the DOM
  }

  // ── Config ───────────────────────────────────────────────────────────────
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
      refresh_minutes: config.refresh_minutes  || 0,
      theme:           config.theme            || "auto",
    };
    this._localMaxItems = null;
    this._filterText    = "";
    this._built         = false;   // force full rebuild on config change
    this._startRefreshTimer();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() { return 4; }

  // ── Auto-refresh ─────────────────────────────────────────────────────────
  _startRefreshTimer() {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    const minutes = this._config?.refresh_minutes || 0;
    if (minutes > 0) {
      this._refreshTimer = setInterval(() => {
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

  // ── Helpers ──────────────────────────────────────────────────────────────
  _esc(str) {
    return String(str ?? "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  _formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const d    = new Date(dateStr);
      if (isNaN(d)) return dateStr;
      const diff = Math.floor((Date.now() - d) / 1000);
      if (diff < 60)     return "Gerade eben";
      if (diff < 3600)   return `vor ${Math.floor(diff/60)} Min.`;
      if (diff < 86400)  return `vor ${Math.floor(diff/3600)} Std.`;
      if (diff < 604800) return `vor ${Math.floor(diff/86400)} Tagen`;
      return d.toLocaleDateString("de-DE",{day:"2-digit",month:"short",year:"numeric"});
    } catch { return dateStr; }
  }

  _matchesFilter(entry) {
    if (!this._filterText) return true;
    const q = this._filterText.toLowerCase();
    return (entry.title||"").toLowerCase().includes(q) ||
           (entry.summary||"").toLowerCase().includes(q);
  }

  // ── Theme tokens (computed once per render) ───────────────────────────────
  _tokens() {
    const isDark = this._config.theme === "dark" ||
                   (this._config.theme === "auto" && this._hass?.themes?.darkMode);
    return {
      isDark,
      accent:      "#1976D2",
      cardBg:      isDark ? "#1c1c1e" : "#ffffff",
      textPrimary: isDark ? "#e0e0e0" : "#212121",
      textSec:     isDark ? "#9e9e9e" : "#757575",
      border:      isDark ? "#333"    : "#f0f0f0",
      tagBg:       isDark ? "#2a2a2e" : "#e8f0fe",
      hoverBg:     isDark ? "#252528" : "#f8f9ff",
      toolbarBg:   isDark ? "#242426" : "#f5f8ff",
      inputBg:     isDark ? "#1c1c1e" : "#ffffff",
      inputBorder: isDark ? "#444"    : "#d0d7e8",
    };
  }

  // ── Main render ───────────────────────────────────────────────────────────
  // Strategy:
  //   • First call (or config change): build full DOM skeleton, attach listeners.
  //   • Subsequent calls (hass update / filter / slider): only patch dynamic parts.
  _render() {
    if (!this._config || !this._hass) return;

    const state = this._hass.states[this._config.entity];
    if (!state) {
      this.shadowRoot.innerHTML = `
        <ha-card><div style="padding:16px;color:var(--error-color)">
          Entity "${this._config.entity}" nicht gefunden.
        </div></ha-card>`;
      this._built = false;
      return;
    }

    const t = this._tokens();

    if (!this._built) {
      this._buildSkeleton(t, state);
      this._built = true;
    }

    this._updateDynamic(t, state);
  }

  // ── Build full DOM once ───────────────────────────────────────────────────
  _buildSkeleton(t, state) {
    const attrs     = state.attributes || {};
    const allEntries = attrs.entries || [];
    const configMax = this._config.max_items || allEntries.length || 1;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        #filter-input {
          flex: 1;
          border: 1px solid ${t.inputBorder};
          border-radius: 6px;
          padding: 5px 10px;
          font-size: 0.85rem;
          background: ${t.inputBg};
          color: ${t.textPrimary};
          outline: none;
          transition: border-color .15s;
          font-family: inherit;
        }
        #filter-input:focus { border-color: ${t.accent}; }
        #filter-clear {
          background: none; border: none; cursor: pointer;
          padding: 2px 4px; color: ${t.textSec}; font-size: 1rem; line-height: 1;
        }
        #max-slider { flex: 1; accent-color: ${t.accent}; cursor: pointer; }
        .entry-link {
          display: block; text-decoration: none; color: inherit;
          padding: 12px 16px; transition: background .15s;
        }
        .entry-link:hover { background: ${t.hoverBg}; }
      </style>
      <ha-card id="card" style="background:${t.cardBg};border-radius:12px;overflow:hidden;
        box-shadow:var(--ha-card-box-shadow,0 2px 8px rgba(0,0,0,.1))">

        <!-- Header -->
        <div id="header" style="padding:14px 16px 10px;display:flex;align-items:center;gap:10px;
          border-bottom:1px solid ${t.border}">
          <div style="width:32px;height:32px;border-radius:8px;background:${t.accent};
            display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
              <path d="M6.18,15.64A2.18,2.18 0 0,1 8.36,17.82C8.36,19.01 7.38,20 6.18,20
                C4.98,20 4,19.01 4,17.82A2.18,2.18 0 0,1 6.18,15.64M4,4.44A15.56,15.56
                0 0,1 19.56,20H16.73A12.73,12.73 0 0,0 4,7.27V4.44M4,10.1A9.9,9.9 0 0,1
                13.9,20H11.07A7.07,7.07 0 0,0 4,12.93V10.1Z"/>
            </svg>
          </div>
          <div id="card-title" style="font-weight:600;font-size:1rem;color:${t.textPrimary};
            flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>
        </div>

        <!-- Slider (conditionally shown via display) -->
        <div id="slider-row" style="display:${this._config.show_slider?"flex":"none"};
          padding:8px 16px 6px;background:${t.toolbarBg};border-bottom:1px solid ${t.border};
          align-items:center;gap:10px">
          <span style="font-size:0.75rem;color:${t.textSec};white-space:nowrap">Einträge:</span>
          <input id="max-slider" type="range" min="1" max="${allEntries.length||1}" value="${this._localMaxItems ?? configMax}" />
          <span id="slider-val" style="font-size:0.8rem;font-weight:600;color:${t.accent};
            min-width:26px;text-align:right">${this._localMaxItems ?? configMax}</span>
        </div>

        <!-- Filter bar (conditionally shown) -->
        <div id="filter-row" style="display:${this._config.show_filter?"flex":"none"};
          padding:8px 16px 8px;background:${t.toolbarBg};border-bottom:1px solid ${t.border};
          align-items:center;gap:8px">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="${t.textSec}" style="flex-shrink:0">
            <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5
              L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5
              0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14
              14,12 14,9.5C14,7 12,5 9.5,5Z"/>
          </svg>
          <input id="filter-input" type="text" placeholder="Stichwort filtern…" value="" />
          <button id="filter-clear" style="display:none">✕</button>
        </div>

        <!-- Entries -->
        <div id="entries-list"></div>

        <!-- Footer -->
        <div id="footer" style="display:${this._config.show_source?"flex":"none"};
          padding:8px 16px;border-top:1px solid ${t.border};align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:0.7rem;color:${t.textSec}">Quelle:</span>
          <span id="footer-source" style="font-size:0.7rem;background:${t.tagBg};color:${t.accent};
            padding:2px 8px;border-radius:12px;font-weight:500"></span>
          <span id="footer-refresh" style="font-size:0.7rem;color:${t.textSec}">
            ${this._config.refresh_minutes > 0 ? `↻ alle ${this._config.refresh_minutes} Min.` : ""}
          </span>
          <span id="footer-count" style="margin-left:auto;font-size:0.7rem;color:${t.textSec}"></span>
        </div>

      </ha-card>`;

    // ── Attach event listeners once ────────────────────────────────────────

    // Slider – only update the dynamic parts, NOT the whole card
    const slider   = this.shadowRoot.getElementById("max-slider");
    const sliderVal = this.shadowRoot.getElementById("slider-val");
    slider?.addEventListener("input", (e) => {
      this._localMaxItems = parseInt(e.target.value);
      sliderVal.textContent = this._localMaxItems;
      this._updateDynamic(this._tokens(), this._hass.states[this._config.entity]);
    });

    // Filter input – key: update only entries + clear button, never rebuild DOM
    const filterInput = this.shadowRoot.getElementById("filter-input");
    const clearBtn    = this.shadowRoot.getElementById("filter-clear");

    filterInput?.addEventListener("input", (e) => {
      // Read directly from the live input to avoid focus loss
      this._filterText = e.target.value;
      clearBtn.style.display = this._filterText ? "block" : "none";
      this._updateDynamic(this._tokens(), this._hass.states[this._config.entity]);
      // Cursor stays in input – no DOM rebuild
    });

    clearBtn?.addEventListener("click", () => {
      this._filterText = "";
      filterInput.value = "";
      clearBtn.style.display = "none";
      this._updateDynamic(this._tokens(), this._hass.states[this._config.entity]);
    });
  }

  // ── Update only the dynamic parts ────────────────────────────────────────
  _updateDynamic(t, state) {
    const attrs      = state?.attributes || {};
    const feedTitle  = attrs.feed_title  || attrs.friendly_name || "RSS Feed";
    const allEntries = attrs.entries     || [];
    const cardTitle  = this._config.title || feedTitle;

    const configMax    = this._config.max_items || allEntries.length;
    const effectiveMax = this._localMaxItems !== null ? this._localMaxItems : configMax;

    // Filtered list
    const filtered  = allEntries.filter(e => this._matchesFilter(e));
    const displayed = filtered.slice(0, effectiveMax);

    // Header title
    const titleEl = this.shadowRoot.getElementById("card-title");
    if (titleEl) titleEl.textContent = cardTitle;

    // Slider max + value (don't reset value if user is dragging)
    const slider    = this.shadowRoot.getElementById("max-slider");
    const sliderVal = this.shadowRoot.getElementById("slider-val");
    if (slider) {
      slider.max = allEntries.length || 1;
      if (this._localMaxItems === null) {
        slider.value        = effectiveMax;
        if (sliderVal) sliderVal.textContent = effectiveMax;
      }
    }

    // Entries list
    const list = this.shadowRoot.getElementById("entries-list");
    if (list) list.innerHTML = this._buildEntriesHtml(displayed, allEntries.length, filtered.length, t);

    // Footer
    const src   = this.shadowRoot.getElementById("footer-source");
    const count = this.shadowRoot.getElementById("footer-count");
    if (src)   src.textContent   = feedTitle;
    if (count) count.textContent =
      `${displayed.length}${this._filterText?" gefiltert":""} / ${allEntries.length} Einträge`;
  }

  _buildEntriesHtml(displayed, totalCount, filteredCount, t) {
    if (totalCount === 0)
      return `<div style="padding:24px;text-align:center;color:${t.textSec}">Keine Einträge verfügbar</div>`;

    if (displayed.length === 0)
      return `<div style="padding:24px;text-align:center;color:${t.textSec}">
        Kein Eintrag entspricht dem Filter „${this._esc(this._filterText)}"</div>`;

    return displayed.map((entry, index) => {
      const title   = this._esc(entry.title   || "Kein Titel");
      const summary = this._esc(entry.summary || "");
      const link    = this._esc(entry.link    || "#");
      const dateStr = this._formatDate(entry.published || "");
      const image   = entry.image;

      const imgHtml = (this._config.show_image && image) ? `
        <div style="flex-shrink:0;width:80px;height:64px;border-radius:8px;overflow:hidden;margin-left:12px">
          <img src="${this._esc(image)}" style="width:100%;height:100%;object-fit:cover"
               onerror="this.parentElement.style.display='none'" />
        </div>` : "";

      const sumHtml = (this._config.show_summary && summary) ? `
        <p style="margin:4px 0 0;font-size:0.78rem;color:${t.textSec};line-height:1.45;
           display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
          ${summary}</p>` : "";

      const dateHtml = (this._config.show_date && dateStr) ? `
        <span style="font-size:0.72rem;color:${t.textSec};margin-top:6px;display:block">
          ${dateStr}</span>` : "";

      const divider = index < displayed.length - 1
        ? `<div style="height:1px;background:${t.border}"></div>` : "";

      return `
        <a class="entry-link" href="${link}" target="_blank" rel="noopener noreferrer">
          <div style="display:flex;align-items:flex-start">
            <div style="flex:1;min-width:0">
              <div style="font-size:0.875rem;font-weight:500;color:${t.textPrimary};line-height:1.4;
                   overflow:hidden;text-overflow:ellipsis;display:-webkit-box;
                   -webkit-line-clamp:2;-webkit-box-orient:vertical">${title}</div>
              ${sumHtml}${dateHtml}
            </div>
            ${imgHtml}
          </div>
        </a>${divider}`;
    }).join("");
  }

  // ── Visual Editor ─────────────────────────────────────────────────────────
  static getConfigElement() { return document.createElement("rss-feed-card-editor"); }

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

// ── Visual Editor Component ────────────────────────────────────────────────
class RssFeedCardEditor extends HTMLElement {
  setConfig(config) { this._config = config; this._render(); }
  set hass(hass)    { this._hass = hass; if (!this._editorBuilt) this._render(); }

  _fire(key, value) {
    this.dispatchEvent(new CustomEvent("config-changed",
      { detail: { config: { ...this._config, [key]: value } } }));
  }

  _render() {
    this._editorBuilt = true;
    if (!this._config) return;
    const c = this._config;

    this.innerHTML = `
      <style>
        .ed  { padding:16px;display:flex;flex-direction:column;gap:10px }
        .lbl { font-size:.82rem;color:var(--secondary-text-color);display:block;margin-bottom:3px }
        .inp { width:100%;box-sizing:border-box;padding:7px 10px;
               border:1px solid var(--divider-color,#ccc);border-radius:6px;
               font-size:.9rem;background:var(--card-background-color);
               color:var(--primary-text-color) }
        .row { display:flex;align-items:center;justify-content:space-between;padding:2px 0 }
        .row span { font-size:.875rem;color:var(--primary-text-color) }
        .sec { border-top:1px solid var(--divider-color,#eee);padding-top:10px;margin-top:4px }
        h4   { margin:0 0 8px;font-size:.78rem;color:var(--secondary-text-color);
               text-transform:uppercase;letter-spacing:.06em }
      </style>
      <div class="ed">
        <div><span class="lbl">Entity (sensor.my_rss_feed_*)</span>
          <input class="inp" type="text" id="entity" value="${c.entity||""}" placeholder="sensor.my_rss_feed_tagesschau"/>
        </div>
        <div><span class="lbl">Kartentitel (leer = Feed-Titel)</span>
          <input class="inp" type="text" id="title" value="${c.title||""}" placeholder="Mein RSS Feed"/>
        </div>
        <div><span class="lbl">Standard max. Einträge (leer = alle)</span>
          <input class="inp" type="number" id="max_items" value="${c.max_items||""}" min="1" max="50"/>
        </div>
        <div><span class="lbl">Card auto-refresh (Minuten, 0 = aus)</span>
          <input class="inp" type="number" id="refresh_minutes" value="${c.refresh_minutes||0}" min="0" max="1440"/>
        </div>
        <div class="sec"><h4>Bedienelemente</h4>
          <div class="row"><span>Schieberegler Einträge</span>
            <input type="checkbox" id="show_slider"  ${c.show_slider !==false?"checked":""}/>
          </div>
          <div class="row"><span>Stichwort-Filterfeld</span>
            <input type="checkbox" id="show_filter"  ${c.show_filter !==false?"checked":""}/>
          </div>
        </div>
        <div class="sec"><h4>Inhaltsanzeige</h4>
          <div class="row"><span>Zusammenfassung</span>
            <input type="checkbox" id="show_summary" ${c.show_summary!==false?"checked":""}/>
          </div>
          <div class="row"><span>Datum</span>
            <input type="checkbox" id="show_date"    ${c.show_date   !==false?"checked":""}/>
          </div>
          <div class="row"><span>Vorschaubilder</span>
            <input type="checkbox" id="show_image"   ${c.show_image  !==false?"checked":""}/>
          </div>
          <div class="row"><span>Quellen-Badge</span>
            <input type="checkbox" id="show_source"  ${c.show_source !==false?"checked":""}/>
          </div>
        </div>
      </div>`;

    [["entity",v=>v],["title",v=>v],
     ["max_items",v=>parseInt(v)||null],["refresh_minutes",v=>parseInt(v)||0]]
      .forEach(([id,fn]) =>
        this.querySelector(`#${id}`).addEventListener("change",e=>this._fire(id,fn(e.target.value))));

    ["show_slider","show_filter","show_summary","show_date","show_image","show_source"]
      .forEach(id =>
        this.querySelector(`#${id}`).addEventListener("change",e=>this._fire(id,e.target.checked)));
  }
}

customElements.define("rss-feed-card",        RssFeedCard);
customElements.define("rss-feed-card-editor", RssFeedCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        "rss-feed-card",
  name:        "RSS Feed Card",
  description: "RSS-Feed Einträge mit Filter, Slider und Auto-Refresh",
  preview:     true,
});

console.info(
  "%c RSS-FEED-CARD %c v0.5.0 ",
  "color:#fff;background:#1976D2;font-weight:bold;padding:2px 6px;border-radius:3px 0 0 3px",
  "color:#1976D2;background:#e8f0fe;font-weight:bold;padding:2px 6px;border-radius:0 3px 3px 0"
);
