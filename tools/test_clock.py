"""Boundary and data tests for the shared clock (no browser dependency)."""
import unittest
from unittest.mock import patch
import serve

class ClockTests(unittest.TestCase):
    def setUp(self):
        self.clock=patch('serve.time.monotonic',return_value=1000)
        self.now=self.clock.start();self.addCleanup(self.clock.stop)
        serve.state.update(time=0.,playing=True,values=None,mode='auto');serve.anchor=1000
    def test_six_cues_and_pause(self):
        for i,t in enumerate(serve.STARTS):
            self.assertEqual(serve.command({'cmd':'goto','stage':i+1})['time'],t)
        serve.command({'cmd':'pause'});self.now.return_value=1030
        self.assertEqual(serve.snapshot()['time'],72)
    def test_loop(self):
        self.now.return_value=1095
        self.assertEqual(serve.snapshot()['time'],5)
    def test_wait_and_trigger(self):
        serve.command({'cmd':'mode','value':'wait'});self.now.return_value=1015
        self.assertFalse(serve.snapshot()['playing'])
        self.assertLess(serve.snapshot()['time'],12)
        self.assertEqual(serve.command({'cmd':'trigger'})['time'],12)
    def test_hold(self):
        serve.command({'cmd':'goto','stage':3});serve.command({'cmd':'mode','value':'hold'})
        self.now.return_value=1020
        self.assertEqual(serve.snapshot()['time'],28)
    def test_external_data_and_reset(self):
        s=serve.command({'cmd':'data','pm25':123})
        self.assertEqual(s['values'][4],123)
        self.assertEqual(s['values'][0],480)
        self.assertIsNone(serve.command({'cmd':'reset'})['values'])
    def test_invalid_data(self):
        for p in [{'cmd':'goto','stage':7},{'cmd':'data','pm25':float('nan')},{'cmd':'data','co2':-1}]:
            with self.assertRaises(ValueError): serve.command(p)

if __name__=='__main__': unittest.main()
