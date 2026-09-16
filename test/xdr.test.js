'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { parseXdr, nmeaChecksum } = require('../lib/xdr')
const { createAttitudeMapper, parseNames } = require('../lib/attitude')
const createPlugin = require('..')

const withCs = (s) => {
  const body = s.slice(1)
  return `${s}*${nmeaChecksum(body).toString(16).toUpperCase().padStart(2, '0')}`
}
const rad = (deg) => (deg * Math.PI) / 180
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('parses a multi-transducer XDR sentence', () => {
  const m = parseXdr(withCs('$IIXDR,A,5.3,D,ROLL,A,-2.1,D,PITCH'))
  assert.deepEqual(m, [
    { type: 'A', value: 5.3, unit: 'D', name: 'ROLL' },
    { type: 'A', value: -2.1, unit: 'D', name: 'PITCH' }
  ])
})

test('rejects bad checksum, non-XDR, and tolerates tag blocks and no checksum', () => {
  assert.equal(parseXdr('$IIXDR,A,5.3,D,ROLL*00'), null)
  assert.equal(parseXdr(withCs('$IIMWV,1,R,2,N,A')), null)
  assert.equal(parseXdr('garbage'), null)
  assert.equal(parseXdr(`\\s:m5,c:123*00\\${withCs('$IIXDR,A,1,D,ROLL')}`)[0].value, 1)
  assert.equal(parseXdr('$IIXDR,A,1,D,ROLL')[0].name, 'ROLL')
})

test('skips empty/non-numeric values and incomplete groups', () => {
  const m = parseXdr(withCs('$IIXDR,A,,D,ROLL,A,abc,D,PITCH,A,3,D,YAW,A,4'))
  assert.deepEqual(m.map((x) => x.name), ['YAW'])
})

test('parseNames handles aliases and NA', () => {
  assert.deepEqual(parseNames('m5_heel, roll'), ['M5_HEEL', 'ROLL'])
  assert.deepEqual(parseNames('NA'), [])
  assert.deepEqual(parseNames(''), [])
  assert.deepEqual(parseNames(undefined), [])
})

const config = {
  roll: { names: 'm5_heel, roll' },
  pitch: { names: 'trim, pitch, updown' },
  yaw: { names: 'yaw, angle, hdg' }
}

test('single sentence with all three axes, aliases, case-insensitive', () => {
  const mapper = createAttitudeMapper(config)
  const a = mapper.process(withCs('$IIXDR,A,5,D,M5_Heel,A,-2,D,UpDown,A,90,D,hdg'), 0)
  near(a.roll, rad(5))
  near(a.pitch, rad(-2))
  near(a.yaw, rad(90))
})

test('separate sentences are merged into one attitude', () => {
  const mapper = createAttitudeMapper(config)
  let a = mapper.process(withCs('$IIXDR,A,5,D,ROLL'), 0)
  assert.deepEqual(a, { roll: rad(5), pitch: null, yaw: null })
  a = mapper.process(withCs('$IIXDR,A,-3,D,TRIM'), 100)
  near(a.roll, rad(5))
  near(a.pitch, rad(-3))
  assert.equal(a.yaw, null)
  a = mapper.process(withCs('$IIXDR,A,45,D,ANGLE'), 200)
  assert.ok(['roll', 'pitch', 'yaw'].every((k) => typeof a[k] === 'number'))
})

test('stale values become null after maxAge', () => {
  const mapper = createAttitudeMapper({ ...config, maxAge: 1 })
  mapper.process(withCs('$IIXDR,A,5,D,ROLL'), 0)
  const a = mapper.process(withCs('$IIXDR,A,-3,D,PITCH'), 1500)
  assert.deepEqual(a, { roll: null, pitch: rad(-3), yaw: null })
})

test('maxAge 0 never expires', () => {
  const mapper = createAttitudeMapper({ ...config, maxAge: 0 })
  mapper.process(withCs('$IIXDR,A,5,D,ROLL'), 0)
  const a = mapper.process(withCs('$IIXDR,A,-3,D,PITCH'), 1e9)
  assert.deepEqual(a, { roll: rad(5), pitch: rad(-3), yaw: null })
})

test('NA axis is ignored and unmapped sentences produce nothing', () => {
  const mapper = createAttitudeMapper({ roll: { names: 'roll' }, pitch: { names: 'NA' }, yaw: { names: '' } })
  assert.equal(mapper.process(withCs('$IIXDR,A,3,D,PITCH'), 0), null)
  assert.equal(mapper.process(withCs('$IIXDR,C,20,C,TEMP'), 0), null)
  assert.deepEqual(mapper.process(withCs('$IIXDR,A,3,D,PITCH,A,1,D,ROLL'), 0), { roll: rad(1), pitch: null, yaw: null })
})

test('invert, offset and radian units', () => {
  const mapper = createAttitudeMapper({
    roll: { names: 'roll', invert: true, offset: 1 },
    pitch: { names: 'pitch' }
  })
  const a = mapper.process(withCs(`$IIXDR,A,10,D,ROLL,A,${rad(4)},R,PITCH`), 0)
  near(a.roll, rad(-9))
  near(a.pitch, rad(4))
})

test('name mapped to two axes is reported and first wins', () => {
  const mapper = createAttitudeMapper({ roll: { names: 'x' }, pitch: { names: 'x' } })
  assert.equal(mapper.conflicts.length, 1)
  assert.deepEqual(mapper.process(withCs('$IIXDR,A,1,D,X'), 0), { roll: rad(1), pitch: null, yaw: null })
})

function fakeApp () {
  const app = new EventEmitter()
  app.signalk = new EventEmitter()
  app.messages = []
  app.handleMessage = (id, delta) => app.messages.push(delta)
  app.setPluginStatus = () => {}
  app.setPluginError = (e) => { app.pluginError = e }
  app.debug = () => {}
  app.error = () => {}
  return app
}

test('plugin publishes navigation.attitude once per sentence when emitted on both app and app.signalk', () => {
  const app = fakeApp()
  const plugin = createPlugin(app)
  plugin.start(config)
  const s = withCs('$IIXDR,A,5,D,ROLL,A,-2,D,PITCH')
  app.emit('nmea0183', s)
  app.signalk.emit('nmea0183', s)
  assert.equal(app.messages.length, 1)
  const v = app.messages[0].updates[0].values[0]
  assert.equal(v.path, 'navigation.attitude')
  near(v.value.roll, rad(5))
  near(v.value.pitch, rad(-2))
  assert.equal(v.value.yaw, null)

  plugin.stop()
  app.emit('nmea0183', s)
  assert.equal(app.messages.length, 1)
})

test('plugin falls back to app.signalk-only servers', () => {
  const app = fakeApp()
  const plugin = createPlugin(app)
  plugin.start(config)
  app.signalk.emit('nmea0183', withCs('$IIXDR,A,5,D,ROLL'))
  assert.equal(app.messages.length, 1)
  plugin.stop()
})

test('plugin reports an error when every axis is NA', () => {
  const app = fakeApp()
  const plugin = createPlugin(app)
  plugin.start({ roll: { names: 'NA' }, pitch: { names: 'NA' }, yaw: { names: 'NA' } })
  assert.match(app.pluginError, /No transducer names/)
})
