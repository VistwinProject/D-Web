import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

test('hidden outputs acknowledge sync revisions without animation frames; stale sync expires', async () => {
  let now = 0, next
  const listeners = {}, reports = []
  const context = vm.createContext({
    URL, URLSearchParams, AbortSignal,
    location: { search: '?x=1&side=left', href: 'http://127.0.0.1:8776/Dweb.html' },
    crypto: { randomUUID: () => 'test-output' },
    performance: { now: () => now },
    document: { hidden: true, createElement: () => ({ style: {} }), body: { append() {} } },
    window: { addEventListener: (type, fn) => { listeners[type] = fn } },
    addEventListener() {},
    setTimeout(fn) { next = fn },
    async fetch(url, options) {
      reports.push(JSON.parse(options.body))
      return { ok: true, json: async () => ({ epoch: 'current' }) }
    },
  })
  vm.runInContext(readFileSync(new URL('../x-report.js', import.meta.url), 'utf8'), context)
  await new Promise(setImmediate)
  assert.equal(reports.at(-1).ready, false)
  listeners['dweb-sync']({ detail: { epoch: 'current', revision: 7, connected: true } })
  await next()
  assert.equal(reports.at(-1).ready, true)
  assert.equal(reports.at(-1).revision, 7)
  assert.equal(reports.at(-1).visible, false)
  assert.equal(reports.at(-1).rendering, false)
  now = 4000
  await next()
  assert.equal(reports.at(-1).ready, false)
  listeners['dweb-sync']({ detail: { epoch: 'new', revision: 0, connected: true } })
  await next()
  assert.equal(reports.at(-1).epoch, 'new')
  assert.equal(reports.at(-1).ready, true)
})
