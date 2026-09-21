# XDR to Attitude

A Signal K plugin that maps NMEA 0183 XDR sentences into `navigation.attitude` (roll, pitch and yaw).

## Why it exists

Heel, trim and heading sensors often send their readings as XDR sentences, but every device chooses its own transducer name. One heel sensor says `M5_HEEL`, another says `ROLL`. Trim might be `TRIM`, `PITCH` or `UPDOWN`. This plugin is a simple way to map all of those names onto Signal K's standard attitude data, so your instruments and apps can use them.

## Install

Install **XDR to Attitude** from the Signal K **Appstore**, then restart the server.

## How to use

1. Open **Server → Plugin Config → gh - XDR to attitude**.
2. For each axis, list the XDR transducer names that should feed it, separated by commas. Names aren't case-sensitive.

   | Axis         | Example               |
   |--------------|-----------------------|
   | Roll / Heel  | `m5_heel, roll`       |
   | Pitch / Trim | `trim, pitch, updown` |
   | Yaw          | `yaw, angle, hdg`     |

   Enter `NA` for any axis you don't have.
3. Enable the plugin and submit. The values appear under `navigation.attitude` in the Data Browser.

The plugin handles one XDR sentence carrying several values, and separate sentences with one value each. Separate values are combined into a single attitude.

### Other settings

- **Invert sign:** for a sensor mounted backwards.
- **Offset:** a calibration correction, in degrees.
- **Maximum age:** how long a value from a separate sentence is kept, in seconds (default 5). `0` keeps it forever.
- **Sentence events:** leave as `nmea0183` unless your connection sends sentences under a custom event name.

**Tip:** if `navigation.attitude` shows two sources, Signal K may be decoding some standard names itself. Choose one in Signal K's source priority settings, or only list your custom names here.
