# signalk-xdr-attitude

A simple way to map multiple NMEA 0183 XDR transducers into Signal K's `navigation.attitude` (roll, pitch and yaw).

Devices name the same measurement differently. One heel sensor sends `M5_HEEL` and another sends `ROLL`. Trim might arrive as `TRIM`, `PITCH` or `UPDOWN`. With this plugin you list every name that should feed each axis. It then publishes them all as one attitude value (in radians) that Signal K instruments and apps already understand.

For example:

| Axis  | Example names             |
|-------|---------------------------|
| roll  | `m5_heel, roll`           |
| pitch | `trim, pitch, updown`     |
| yaw   | `yaw, angle, hdg`         |

Enter `NA` (or leave the field empty) to turn an axis off.

## Installation

In the Signal K admin UI, go to **Appstore → Available**, search for **XDR to Attitude**, and install it. Restart the server, then open **Server → Plugin Config → XDR to Attitude** to enter your names and enable the plugin.

To install from the command line instead, run this in your Signal K config folder (usually `~/.signalk`) and restart the server:

```sh
npm install signalk-xdr-attitude
```

## Supported input

Both of these work, and you can mix them:

- **One sentence with several transducers:**
  `$IIXDR,A,5.3,D,M5_HEEL,A,-2.1,D,TRIM,A,181.0,D,HDG*hh`
- **Several sentences with one transducer each:**
  `$IIXDR,A,5.3,D,ROLL*hh`, then `$IIXDR,A,-2.1,D,PITCH*hh`, and so on.

When values arrive in separate sentences, the plugin merges them. Every sentence that matches publishes a single `navigation.attitude` object with the latest value for each axis. Any value older than **Maximum age** is dropped from that object. Set Maximum age to `0` to keep values forever.

Parsing details:

- Transducer names are case-insensitive.
- A unit of `R` means radians. Any other unit, including `D`, is treated as degrees.
- Sentences with a bad checksum are ignored. Sentences with no checksum are accepted.
- NMEA 4.10 tag blocks (`\s:...*hh\$IIXDR...`) are supported.

## Configuration

For each axis (Roll / Heel, Pitch / Trim, Yaw):

- **XDR transducer names**: a comma-separated list of names, or `NA` to turn the axis off.
- **Invert sign**: flips the sign, for sensors mounted backwards.
- **Offset (degrees)**: a calibration offset, added after inversion.

General settings:

- **Maximum age (seconds)**: how long a value from a separate sentence stays in the combined attitude. The default is 5.
- **Sentence events**: the server events that carry raw NMEA 0183 sentences. The default is `nmea0183`. If a connection is set to emit a custom sentence event, add that event name here.

If the same name is listed under two axes, the plugin uses the first axis and logs an error.

## Notes

- The plugin reads raw sentences from any NMEA 0183 connection (serial, TCP, UDP) that has not suppressed the `nmea0183` event.
- The built-in NMEA 0183 parser may already turn some standard names (for example `ROLL` or `PITCH`) into attitude data. If that happens, Signal K shows two sources for `navigation.attitude`. Use source priorities to choose one, or map only your custom names here.

## Development

```sh
npm test
```
