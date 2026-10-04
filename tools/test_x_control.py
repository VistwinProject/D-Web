import unittest
import json
import threading
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import patch
import serve


class XControlTests(unittest.TestCase):
    def setUp(self):
        timer = patch('serve.time.monotonic', return_value=1000)
        self.now = timer.start()
        self.addCleanup(timer.stop)
        serve.outputs.clear()
        serve.x_commands.clear()
        serve.revision = 0
        serve.x_controlled = False
        serve.state.update(time=0., playing=False, values=None, mode='auto')
        serve.anchor = 1000

    def report(self, side, revision=0, **kw):
        return serve.x_report(dict(instance=side, side=side, epoch=serve.epoch,
            revision=revision, ready=True, visible=False, rendering=False, **kw))

    def test_background_control_ack_requires_both_pages(self):
        for side in ('left', 'right'): self.report(side)
        receipt, code = serve.x_control(dict(id='pause', epoch=serve.epoch, operation='pause'))
        self.assertEqual(code, 202)
        self.report('left', receipt['revision'])
        self.assertEqual(serve.x_status()['command']['state'], 'accepted')
        self.report('right', receipt['revision'])
        status = serve.x_status()
        self.assertEqual(status['command']['state'], 'applied')
        self.assertTrue(status['ready'])
        self.assertTrue(all(o['rendering'] is False for o in status['outputs']))

    def test_frozen_pages_still_disable_control(self):
        for side in ('left', 'right'): self.report(side)
        self.now.return_value += 5
        self.assertFalse(serve.x_status()['ready'])
        _, code = serve.x_control(dict(id='start', epoch=serve.epoch, operation='start'))
        self.assertEqual(code, 503)
        self.assertFalse(serve.state['playing'])

    def test_wrong_epoch_never_registers_output(self):
        serve.x_report(dict(instance='old', side='left', epoch='old', revision=100, ready=True))
        self.assertFalse(serve.x_status()['ready'])
        self.assertEqual(serve.outputs, {})

    def test_receipt_timeout_is_not_replayed(self):
        for side in ('left', 'right'): self.report(side)
        payload = dict(id='one', epoch=serve.epoch, operation='start')
        serve.x_control(payload)
        revision = serve.revision
        self.now.return_value += 5
        self.assertEqual(serve.x_status()['command']['state'], 'unknown')
        self.assertEqual(serve.x_control(payload)[0]['state'], 'unknown')
        self.assertEqual(serve.revision, revision)

    def test_local_pause_supersedes_start_with_explicit_failure(self):
        for side in ('left', 'right'): self.report(side)
        serve.x_control(dict(id='one', epoch=serve.epoch, operation='start'))
        serve.command(dict(cmd='pause'))
        status = serve.x_status()
        self.assertEqual(status['command']['state'], 'rejected')
        self.assertIn('覆蓋', status['command']['note'])
        self.assertFalse(status['playback']['playing'])

    def test_stale_page_cannot_pause_x_but_updated_local_controls_can(self):
        for side in ('left', 'right'): self.report(side)
        serve.x_control(dict(id='one', epoch=serve.epoch, operation='start'))
        server = ThreadingHTTPServer(('127.0.0.1', 0), serve.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f'http://127.0.0.1:{server.server_port}/api/state'
            def post(payload):
                return urlopen(Request(url, data=json.dumps(payload).encode(),
                    headers={'Content-Type':'application/json'}), timeout=2)
            with self.assertRaises(HTTPError) as failure:
                post(dict(cmd='pause'))
            self.assertEqual(failure.exception.code, 409)
            self.assertTrue(serve.state['playing'])
            with post(dict(cmd='pause', controlProtocol='d-local-v2')) as reply:
                self.assertEqual(reply.status, 200)
            self.assertFalse(serve.state['playing'])
        finally:
            server.shutdown(); server.server_close(); thread.join()


if __name__ == '__main__': unittest.main()
