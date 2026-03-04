"""Sensor platform for RSS Feed integration."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    ATTR_ENTRIES,
    ATTR_FEED_TITLE,
    ATTR_LAST_UPDATED,
    CONF_NAME,
    DOMAIN,
)
from .coordinator import RssFeedCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up RSS Feed sensor from config entry."""
    coordinator: RssFeedCoordinator = hass.data[DOMAIN][entry.entry_id]
    name = entry.data.get(CONF_NAME, "RSS Feed")

    async_add_entities([RssFeedSensor(coordinator, entry, name)], True)


class RssFeedSensor(CoordinatorEntity, SensorEntity):
    """Representation of an RSS Feed sensor."""

    def __init__(
        self,
        coordinator: RssFeedCoordinator,
        entry: ConfigEntry,
        name: str,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._entry = entry
        # Sensor-Name: "my-rss-feed.<slug>" → entity_id: sensor.my_rss_feed_<slug>
        slug = name.lower().replace(" ", "_").replace("-", "_")
        self._attr_name = f"my-rss-feed.{name}"
        self._attr_unique_id = f"my_rss_feed_{entry.entry_id}"
        self._attr_entity_id = f"sensor.my_rss_feed_{slug}"
        self._attr_icon = "mdi:rss"

    @property
    def native_value(self) -> str | None:
        """Return the state of the sensor (number of entries)."""
        if self.coordinator.data:
            return str(self.coordinator.data.get("entry_count", 0))
        return None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return extra state attributes."""
        if not self.coordinator.data:
            return {}

        data = self.coordinator.data
        return {
            ATTR_FEED_TITLE: data.get(ATTR_FEED_TITLE, ""),
            "entries": data.get("entries", []),
            "url": data.get("url", ""),
            "entry_count": data.get("entry_count", 0),
        }

    @property
    def available(self) -> bool:
        """Return True if entity is available."""
        return self.coordinator.last_update_success

    @property
    def unit_of_measurement(self) -> str:
        """Return unit of measurement."""
        return "Einträge"
