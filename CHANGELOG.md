# Changelog

## 1.0.2 (2026-09-22)

- Renamed to **gh - XDR to attitude** in the plugin list and Appstore.
- Added an app icon.

## 1.0.1 (2026-09-16)

- `navigation.attitude` now always includes roll, pitch and yaw. An axis that is turned off, not yet received, or older than the maximum age is sent as `null` instead of being left out.

## 1.0.0 (2026-09-15)

First release.

- Maps NMEA 0183 XDR transducer names to `navigation.attitude` roll, pitch and yaw.
- Each axis accepts several names (case-insensitive); `NA` or empty turns an axis off.
- Handles one sentence with several transducers, and separate sentences with one transducer each. Separate values are merged, and any older than a configurable maximum age are dropped.
- Per-axis invert and offset.
- Validates checksums, supports NMEA 4.10 tag blocks, and accepts degrees or radians.
