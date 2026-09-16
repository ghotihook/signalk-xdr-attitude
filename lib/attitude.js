'use strict'

const { parseXdr } = require('./xdr')

const AXES = ['roll', 'pitch', 'yaw']
const DISABLED = new Set(['', 'NA', 'N/A', 'NONE'])

// "m5_heel, roll" -> ['M5_HEEL', 'ROLL']. "NA" or empty -> [] (axis disabled).
function parseNames (input) {
  const list = Array.isArray(input) ? input : String(input || '').split(/[,;]/)
  return list
    .map((n) => String(n).trim().toUpperCase())
    .filter((n) => !DISABLED.has(n))
}

// Build a mapper that turns XDR lines into a merged navigation.attitude value.
// Values from separate sentences are merged; each is dropped once older than
// maxAge seconds (0 = never expire).
function createAttitudeMapper (options = {}) {
  const nameToAxis = new Map()
  const conflicts = []
  const axisConfig = {}

  for (const axis of AXES) {
    const cfg = options[axis] || {}
    axisConfig[axis] = {
      invert: !!cfg.invert,
      offset: Number(cfg.offset) || 0
    }
    for (const name of parseNames(cfg.names)) {
      if (nameToAxis.has(name) && nameToAxis.get(name) !== axis) {
        conflicts.push(`${name} is mapped to both ${nameToAxis.get(name)} and ${axis}; using ${nameToAxis.get(name)}`)
        continue
      }
      nameToAxis.set(name, axis)
    }
  }

  const maxAgeMs = Math.max(0, Number(options.maxAge ?? 5)) * 1000
  const state = {} // axis -> { value (radians), time (ms) }

  function toRadians (m, axis) {
    const cfg = axisConfig[axis]
    let deg = m.unit === 'R' ? (m.value * 180) / Math.PI : m.value
    if (cfg.invert) deg = -deg
    deg += cfg.offset
    return (deg * Math.PI) / 180
  }

  // Returns the attitude object to publish, or null if the line carried
  // nothing we map. Every axis is present; missing or stale axes are null.
  function process (line, now = Date.now()) {
    if (typeof line !== 'string' || !line.includes('XDR')) return null
    const measurements = parseXdr(line)
    if (!measurements) return null

    let matched = false
    for (const m of measurements) {
      const axis = nameToAxis.get(m.name.toUpperCase())
      if (!axis) continue
      state[axis] = { value: toRadians(m, axis), time: now }
      matched = true
    }
    if (!matched) return null

    const attitude = {}
    for (const axis of AXES) {
      const s = state[axis]
      if (s && maxAgeMs > 0 && now - s.time > maxAgeMs) delete state[axis]
      attitude[axis] = state[axis] ? state[axis].value : null
    }
    return attitude
  }

  return {
    process,
    conflicts,
    mappedNames: () => Object.fromEntries(
      AXES.map((axis) => [axis, [...nameToAxis].filter(([, a]) => a === axis).map(([n]) => n)])
    )
  }
}

module.exports = { createAttitudeMapper, parseNames, AXES }
