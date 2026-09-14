'use strict'

// Parse an NMEA 0183 XDR sentence into its transducer measurements.
// Format: $--XDR,<type>,<value>,<unit>,<name>[,<type>,<value>,<unit>,<name>...]*hh
// Returns an array of { type, value, unit, name } or null if the line is not
// a valid XDR sentence (wrong id, bad checksum, malformed).

function nmeaChecksum (body) {
  let cs = 0
  for (let i = 0; i < body.length; i++) cs ^= body.charCodeAt(i)
  return cs
}

function parseXdr (line) {
  if (typeof line !== 'string') return null
  let s = line.trim()

  // Strip an NMEA 4.10 tag block: \s:talker,c:1234*hh\$IIXDR,...
  if (s.startsWith('\\')) {
    const end = s.indexOf('\\', 1)
    if (end === -1) return null
    s = s.slice(end + 1)
  }

  if (s[0] !== '$') return null

  let body
  const star = s.indexOf('*')
  if (star !== -1) {
    body = s.slice(1, star)
    const cs = s.slice(star + 1, star + 3)
    if (cs.length === 2) {
      const expected = parseInt(cs, 16)
      if (Number.isNaN(expected) || expected !== nmeaChecksum(body)) return null
    }
  } else {
    body = s.slice(1)
  }

  const fields = body.split(',')
  const id = fields[0]
  if (id.length < 5 || id.slice(-3).toUpperCase() !== 'XDR') return null

  const measurements = []
  for (let i = 1; i + 3 < fields.length; i += 4) {
    const type = fields[i].trim().toUpperCase()
    const raw = fields[i + 1].trim()
    const unit = fields[i + 2].trim().toUpperCase()
    const name = fields[i + 3].trim()
    if (raw === '' || name === '') continue
    const value = Number(raw)
    if (!Number.isFinite(value)) continue
    measurements.push({ type, value, unit, name })
  }
  return measurements
}

module.exports = { parseXdr, nmeaChecksum }
