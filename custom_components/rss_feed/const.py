"""Constants for the RSS Feed integration."""

DOMAIN = "rss_feed"

CONF_NAME = "name"
CONF_URL = "url"
CONF_MAX_ENTRIES = "max_entries"
CONF_SCAN_INTERVAL = "scan_interval"

DEFAULT_MAX_ENTRIES = 5
DEFAULT_SCAN_INTERVAL = 1800  # 30 minutes

MIN_SCAN_INTERVAL = 60
MAX_SCAN_INTERVAL = 86400

MIN_MAX_ENTRIES = 1
MAX_MAX_ENTRIES = 50

ATTR_ENTRIES = "entries"
ATTR_FEED_TITLE = "feed_title"
ATTR_LAST_UPDATED = "last_updated"
ATTR_ENTRY_TITLE = "title"
ATTR_ENTRY_SUMMARY = "summary"
ATTR_ENTRY_LINK = "link"
ATTR_ENTRY_PUBLISHED = "published"
ATTR_ENTRY_IMAGE = "image"
