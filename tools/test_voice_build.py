"""Exercise cue placement using quiet synthetic fixtures, never audio playback."""
import array, contextlib, io, json, tempfile, unittest, wave
from pathlib import Path
from unittest.mock import patch
import build_voice_show as build

class VoiceBuildTests(unittest.TestCase):
    def test_placements_and_master_duration(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'assets/audio').mkdir(parents=True)
            for index,clip in enumerate(build.SCRIPT['clips']):
                with wave.open(str(root/'assets/audio'/f"{clip['id']}.wav"),'wb') as f:
                    f.setparams((1,2,build.RATE,0,'NONE','not compressed'))
                    f.writeframes(array.array('h',[200,-200])*(build.RATE//2*(index%3+1)))
            with patch.object(build,'ROOT',root),contextlib.redirect_stdout(io.StringIO()):build.build()
            show=json.loads((root/'show.json').read_text(encoding='utf-8'))
            self.assertEqual(len(show['clips']),12)
            for i,clip in enumerate(show['clips']):
                self.assertGreaterEqual(clip['start'],show['starts'][clip['scene']-1])
                end=(show['starts']+[show['duration']])[clip['scene']]
                self.assertLess(clip['end'],end)
                if i:self.assertGreater(clip['start'],show['clips'][i-1]['end'])
            self.assertGreater(show['events']['heatOff'],show['starts'][5])
            self.assertLess(show['events']['heatOn'],show['starts'][3])
            with wave.open(str(root/show['audio'])) as master:
                self.assertEqual(master.getnframes()/master.getframerate(),show['duration'])
            js=(root/'show-config.js').read_text(encoding='utf-8')
            self.assertEqual(json.loads(js.split('window.D_SHOW = ',1)[1].rstrip(';\n')),show)
    def test_missing_recording_does_not_publish_config(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            with patch.object(build,'ROOT',root),self.assertRaises(FileNotFoundError):build.build()
            self.assertFalse((root/'show-config.js').exists())

if __name__=='__main__':unittest.main()
