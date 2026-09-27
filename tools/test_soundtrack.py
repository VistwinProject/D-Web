"""Check the audible layer's boundaries, dialogue priority and rebuild contract."""
import array
import json
import tempfile
import unittest
import wave
from pathlib import Path
from build_soundtrack import build_mix, dialogue_gain, sample_loop, read_pcm


class SoundtrackTests(unittest.TestCase):
    def test_dialogue_ducks_before_line_and_recovers_after(self):
        cues = [{'start': 2., 'end': 4.}]
        self.assertEqual(dialogue_gain(1., cues), 1.)
        self.assertLess(dialogue_gain(1.9, cues), 1.)
        self.assertEqual(dialogue_gain(3., cues), .28)
        self.assertLess(dialogue_gain(4.2, cues), 1.)
        self.assertEqual(dialogue_gain(4.6, cues), 1.)

    def test_motor_switch_is_not_repeated_when_running_sound_loops(self):
        source = [9000]*10+[1000]*90
        rendered = [sample_loop(source, i, 20, 10) for i in range(500)]
        self.assertEqual(rendered[:10], [9000]*10)
        self.assertEqual(rendered[100:], [1000]*400)

    def test_mix_preserves_voice_outside_event_and_keeps_duration(self):
        rate = 1000
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); audio = root/'assets/audio'; audio.mkdir(parents=True)
            for path, samples in [(audio/'theatre-voice.wav', [1000]*6000), (audio/'fan.wav', [4000]*1000)]:
                with wave.open(str(path), 'wb') as w:
                    w.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
                    w.writeframes(array.array('h', samples).tobytes())
            (root/'sound-effects.json').write_text(json.dumps({'duckGain': .28, 'cues': [{
                'id': 'fan', 'file': 'assets/audio/fan.wav', 'start': 'exhaustOn', 'end': 'heatOff',
                'gain': 1, 'fadeIn': .1, 'fadeOut': .1, 'loopStart': .2, 'crossfade': .1
            }]}), encoding='utf-8')
            show = {'duration': 6., 'events': {'exhaustOn': 1., 'heatOff': 5.}, 'clips': [{'start': 2., 'end': 3.}]}
            build_mix(root, show, rate)
            mixed = read_pcm(root/show['audio'], rate)
            self.assertEqual(len(mixed), 6000)
            self.assertEqual(list(mixed[:1000]), [1000]*1000)
            self.assertEqual(list(mixed[5000:]), [1000]*1000)
            self.assertEqual(mixed[1500], 5000)
            self.assertEqual(mixed[2500], 2120)
            self.assertEqual(show['soundEffects'][0]['start'], 1.)
            with wave.open(str(audio/'theatre-voice.wav')) as w:
                self.assertEqual(array.array('h', w.readframes(6000))[2500], 1000)


if __name__ == '__main__':
    unittest.main()
