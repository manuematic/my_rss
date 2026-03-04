"""Config flow for RSS Feed integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession
import homeassistant.helpers.config_validation as cv

from .const import (
    CONF_MAX_ENTRIES,
    CONF_NAME,
    CONF_SCAN_INTERVAL,
    CONF_URL,
    DEFAULT_MAX_ENTRIES,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    MAX_MAX_ENTRIES,
    MAX_SCAN_INTERVAL,
    MIN_MAX_ENTRIES,
    MIN_SCAN_INTERVAL,
)

_LOGGER = logging.getLogger(__name__)


async def validate_rss_url(hass: HomeAssistant, url: str) -> dict[str, Any]:
    """Validate the RSS feed URL by fetching it."""
    session = async_get_clientsession(hass)
    try:
        async with session.get(url, timeout=10) as response:
            if response.status != 200:
                raise ValueError(f"HTTP {response.status}")
            content = await response.text()
            if "<rss" not in content and "<feed" not in content and "<channel" not in content:
                raise ValueError("Not a valid RSS/Atom feed")
    except Exception as err:
        _LOGGER.error("Error validating RSS URL %s: %s", url, err)
        raise
    return {}


class RssFeedConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for RSS Feed."""

    VERSION = 2

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            url = user_input[CONF_URL].strip()
            name = user_input[CONF_NAME].strip()

            # Check for duplicate entries
            await self.async_set_unique_id(url)
            self._abort_if_unique_id_configured()

            try:
                await validate_rss_url(self.hass, url)
            except ValueError:
                errors["base"] = "cannot_connect"
            except Exception:
                errors["base"] = "unknown"
            else:
                return self.async_create_entry(
                    title=name,
                    data={
                        CONF_NAME: name,
                        CONF_URL: url,
                        CONF_MAX_ENTRIES: user_input[CONF_MAX_ENTRIES],
                        CONF_SCAN_INTERVAL: DEFAULT_SCAN_INTERVAL,
                    },
                )

        schema = vol.Schema(
            {
                vol.Required(CONF_NAME, default="Mein RSS Feed"): cv.string,
                vol.Required(CONF_URL): cv.string,
                vol.Required(CONF_MAX_ENTRIES, default=DEFAULT_MAX_ENTRIES): vol.All(
                    vol.Coerce(int),
                    vol.Range(min=MIN_MAX_ENTRIES, max=MAX_MAX_ENTRIES),
                ),
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> RssFeedOptionsFlow:
        """Get the options flow."""
        return RssFeedOptionsFlow(config_entry)


class RssFeedOptionsFlow(config_entries.OptionsFlow):
    """Handle RSS Feed options."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Manage the options."""
        errors: dict[str, str] = {}

        if user_input is not None:
            url = user_input[CONF_URL].strip()

            try:
                await validate_rss_url(self.hass, url)
            except ValueError:
                errors["base"] = "cannot_connect"
            except Exception:
                errors["base"] = "unknown"
            else:
                return self.async_create_entry(title="", data=user_input)

        current_url = self.config_entry.options.get(
            CONF_URL, self.config_entry.data.get(CONF_URL, "")
        )
        current_max = self.config_entry.options.get(
            CONF_MAX_ENTRIES, self.config_entry.data.get(CONF_MAX_ENTRIES, DEFAULT_MAX_ENTRIES)
        )
        current_interval = self.config_entry.options.get(
            CONF_SCAN_INTERVAL, self.config_entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
        )

        schema = vol.Schema(
            {
                vol.Required(CONF_URL, default=current_url): cv.string,
                vol.Required(CONF_MAX_ENTRIES, default=current_max): vol.All(
                    vol.Coerce(int),
                    vol.Range(min=MIN_MAX_ENTRIES, max=MAX_MAX_ENTRIES),
                ),
                vol.Required(CONF_SCAN_INTERVAL, default=current_interval): vol.All(
                    vol.Coerce(int),
                    vol.Range(min=MIN_SCAN_INTERVAL, max=MAX_SCAN_INTERVAL),
                ),
            }
        )

        return self.async_show_form(
            step_id="init",
            data_schema=schema,
            errors=errors,
        )
