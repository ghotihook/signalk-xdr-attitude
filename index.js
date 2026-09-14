'use strict'

const { createAttitudeMapper, AXES } = require('./lib/attitude')

const axisSchema = (title, defaultNames) => ({
  type: 'object',
  title,
  properties: {
    names: {
      type: 'string',
      title: 'XDR transducer names',
      description: 'Comma-separated, case-insensitive (e.g. "m5_heel, roll"). Enter NA or leave empty to disable.',
      default: defaultNames
    },
    invert: {
      type: 'boolean',
      title: 'Invert sign',
      default: false
    },
    offset: {
      type: 'number',
      title: 'Offset (degrees, added after inversion)',
      default: 0
    }
  }
})

module.exports = function (app) {
  const plugin = {
    id: 'signalk-xdr-attitude',
    name: 'XDR to Attitude',
    description: 'Maps NMEA 0183 XDR transducer names to navigation.attitude roll/pitch/yaw'
  }

  let unsubscribes = []
  let lastStatus = 0

  plugin.schema = {
    type: 'object',
    properties: {
      roll: axisSchema('Roll / Heel', 'ROLL, HEEL'),
      pitch: axisSchema('Pitch / Trim', 'PITCH, PTCH, TRIM'),
      yaw: axisSchema('Yaw', 'YAW'),
      maxAge: {
        type: 'number',
        title: 'Maximum age (seconds)',
        description: 'When roll/pitch/yaw arrive in separate sentences, a value older than this is dropped from the combined attitude. 0 = never expire.',
        default: 5
      },
      events: {
        type: 'string',
        title: 'Sentence events',
        description: 'Comma-separated server event names carrying raw NMEA 0183 sentences.',
        default: 'nmea0183'
      }
    }
  }

  plugin.start = function (options) {
    const mapper = createAttitudeMapper(options)
    mapper.conflicts.forEach((c) => app.error(c))

    const mapped = mapper.mappedNames()
    const active = AXES.filter((a) => mapped[a].length > 0)
    app.debug('mapping %j', mapped)
    if (active.length === 0) {
      app.setPluginError('No transducer names configured for roll, pitch or yaw')
      return
    }

    const handle = (sentence) => {
      const attitude = mapper.process(sentence)
      if (!attitude) return
      app.handleMessage(plugin.id, {
        updates: [{ values: [{ path: 'navigation.attitude', value: attitude }] }]
      })
      const now = Date.now()
      if (now - lastStatus > 1000) {
        lastStatus = now
        app.setPluginStatus(
          AXES.filter((a) => a in attitude)
            .map((a) => `${a} ${((attitude[a] * 180) / Math.PI).toFixed(1)}°`)
            .join(', ')
        )
      }
    }

    // Newer servers emit each sentence on both app and app.signalk; older ones
    // only on app.signalk. Prefer app and ignore app.signalk once app is seen.
    let appEmits = false
    const onApp = (s) => { appEmits = true; handle(s) }
    const onSignalk = (s) => { if (!appEmits) handle(s) }

    const events = String(options.events || 'nmea0183')
      .split(',').map((e) => e.trim()).filter(Boolean)
    for (const event of events) {
      app.on(event, onApp)
      unsubscribes.push(() => app.removeListener(event, onApp))
      if (app.signalk && typeof app.signalk.on === 'function') {
        app.signalk.on(event, onSignalk)
        unsubscribes.push(() => app.signalk.removeListener(event, onSignalk))
      }
    }

    app.setPluginStatus(`Waiting for XDR (${active.join(', ')})`)
  }

  plugin.stop = function () {
    unsubscribes.forEach((f) => f())
    unsubscribes = []
  }

  return plugin
}
