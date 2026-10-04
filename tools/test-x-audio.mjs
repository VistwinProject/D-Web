import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function harness(search) {
  const events = {}, commands = [], button = { setAttribute() {} }
  let calls = 0
  const audio = { readyState: 4, currentTime: 0, paused: true, addEventListener() {}, pause() {},
    play() { calls++; return Promise.reject(Object.assign(new Error(), { name: 'NotAllowedError' })) } }
  const win = { D_SHOW: { audio: 'test.mp3', starts: [0], duration: 10 },
    addEventListener(name, fn) { events[name] = fn }, dispatchEvent(e) { commands.push(e.detail) } }
  win.parent = win
  vm.runInNewContext(readFileSync(new URL('../theater-voice.js', import.meta.url), 'utf8'), {
    URLSearchParams, location: { search }, window: win,
    document: { createElement: tag => tag === 'audio' ? audio : button, body: { append() {} }, querySelector() { return null } },
    performance: { now: () => 0 }, crypto: { randomUUID: () => 'voice' }, setInterval() {},
    CustomEvent: class { constructor(type, opts) { this.detail = opts.detail } },
  })
  return { button, commands, calls: () => calls, play: () => events['dweb-frame']({ detail: { time: 0, playing: true, mode: 'auto' } }) }
}

test('silent tests never invoke audio play', async () => {
  const h = harness('?x=1&audio=muted'); h.play(); await new Promise(setImmediate)
  assert.equal(h.calls(), 0); assert.equal(h.button.disabled, true); assert.equal(h.commands.length, 0)
})
test('autoplay denial in X mode prompts locally without pausing the shared clock', async () => {
  const h = harness('?x=1'); h.play(); await new Promise(setImmediate)
  assert.equal(h.calls(), 1); assert.equal(h.commands.length, 0)
  assert.match(h.button.textContent, /未啟用/)
})
test('standalone autoplay behavior remains unchanged', async () => {
  const h = harness(''); h.play(); await new Promise(setImmediate)
  assert.equal(h.commands[0].cmd, 'pause')
})
