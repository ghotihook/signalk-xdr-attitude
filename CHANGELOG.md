# Changelog

## 1.0.0 (2026-09-15)

First release.

- Maps NMEA 0183 XDR transducer names to `navigation.attitude` roll, pitch and yaw.
- Each axis accepts several names (case-insensitive); `NA` or empty turns an axis off.
- Handles one sentence with several transducers, and separate sentences with one transducer each. Separate values are merged, and any older than a configurable maximum age are dropped.
- Per-axis invert and offset.
- Validates checksums, supports NMEA 4.10 tag blocks, and accepts degrees or radians.
