"""DataUpdateCoordinator for RSS Feed."""
from __future__ import annotations

import logging
import re
from datetime import timedelta
from typing import Any

import feedparser
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import (
    ATTR_ENTRY_IMAGE,
    ATTR_ENTRY_LINK,
    ATTR_ENTRY_PUBLISHED,
    ATTR_ENTRY_SUMMARY,
    ATTR_ENTRY_TITLE,
    ATTR_FEED_TITLE,
    CONF_MAX_ENTRIES,
    CONF_SCAN_INTERVAL,
    CONF_URL,
    DEFAULT_MAX_ENTRIES,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)


class RssFeedCoordinator(DataUpdateCoordinator):
    """Coordinator to fetch RSS feed data."""

    def __init__(self, hass: HomeAssistant, config_entry) -> None:
        """Initialize the coordinator."""
        self.config_entry = config_entry
        scan_interval = self._get_scan_interval(config_entry)

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=scan_interval),
        )

    @staticmethod
    def _get_scan_interval(config_entry) -> int:
        """Read scan interval from options or data (in seconds)."""
        return int(
            config_entry.options.get(
                CONF_SCAN_INTERVAL,
                config_entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL),
            )
        )

    def update_interval_from_config(self) -> None:
        """Re-apply update_interval after options change."""
        self.update_interval = timedelta(seconds=self._get_scan_interval(self.config_entry))

    def _get_url(self) -> str:
        return self.config_entry.options.get(
            CONF_URL, self.config_entry.data.get(CONF_URL, "")
        )

    def _get_max_entries(self) -> int:
        return int(
            self.config_entry.options.get(
                CONF_MAX_ENTRIES,
                self.config_entry.data.get(CONF_MAX_ENTRIES, DEFAULT_MAX_ENTRIES),
            )
        )

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch data from the RSS feed."""
        url = self._get_url()
        max_entries = self._get_max_entries()

        session = async_get_clientsession(self.hass)

        try:
            async with session.get(url, timeout=15) as response:
                if response.status != 200:
                    raise UpdateFailed(f"HTTP error {response.status} for {url}")
                content = await response.read()
        except Exception as err:
            raise UpdateFailed(f"Error fetching RSS feed: {err}") from err

        try:
            feed = feedparser.parse(content)
        except Exception as err:
            raise UpdateFailed(f"Error parsing RSS feed: {err}") from err

        feed_title = feed.feed.get("title", url)
        entries = []

        for entry in feed.entries[:max_entries]:
            # Extract image from various feed formats
            image_url = None
            if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
                image_url = entry.media_thumbnail[0].get("url")
            elif hasattr(entry, "media_content") and entry.media_content:
                for media in entry.media_content:
                    if media.get("type", "").startswith("image"):
                        image_url = media.get("url")
                        break
            elif hasattr(entry, "enclosures") and entry.enclosures:
                for enc in entry.enclosures:
                    if enc.get("type", "").startswith("image"):
                        image_url = enc.get("url") or enc.get("href")
                        break

            # Strip HTML from summary
            summary = entry.get("summary", entry.get("description", ""))
            summary = re.sub(r"<[^>]+>", "", summary).strip()
            summary = summary[:300] + "..." if len(summary) > 300 else summary

            published = ""
            if hasattr(entry, "published"):
                published = entry.published
            elif hasattr(entry, "updated"):
                published = entry.updated

            entries.append(
                {
                    ATTR_ENTRY_TITLE: entry.get("title", "Kein Titel"),
                    ATTR_ENTRY_SUMMARY: summary,
                    ATTR_ENTRY_LINK: entry.get("link", ""),
                    ATTR_ENTRY_PUBLISHED: published,
                    ATTR_ENTRY_IMAGE: image_url,
                }
            )

        return {
            ATTR_FEED_TITLE: feed_title,
            "entries": entries,
            "entry_count": len(entries),
            "url": url,
        }
