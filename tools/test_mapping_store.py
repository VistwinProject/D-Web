import unittest,tempfile,json
from pathlib import Path
from mapping_store import ProfileStore,Conflict

def config(width=1):
    r=dict(content='ih',enabled=True,mirror=False,resolution=1280,aspect=9/14,zoom=1,panX=.5,panY=.5,brightness=1,lineWidth=width,layer=0,points=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]])
    return dict(version=1,regions=[dict(r) for _ in range(4)])
class Profiles(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.store=ProfileStore(self.tmp.name)
    def test_survives_new_process_instance(self):
        self.store.write(config(2.4),None)
        self.assertEqual(ProfileStore(self.tmp.name).read()['config'],config(2.4))
    def test_conflict_preserves_latest(self):
        first=self.store.write(config(),None);self.store.write(config(2),first['revision'])
        with self.assertRaises(Conflict):self.store.write(config(3),first['revision'])
        self.assertEqual(self.store.read()['config'],config(2))
    def test_corrupt_current_recovers_prior(self):
        first=self.store.write(config(),None);self.store.write(config(2),first['revision'])
        (Path(self.tmp.name)/'mapping.json').write_text('{broken')
        restored=self.store.read();self.assertTrue(restored['recovered']);self.assertEqual(restored['config'],config())
        self.store.write(config(1.5),restored['revision']);self.assertFalse(self.store.read()['recovered'])
    def test_reject_invalid_without_replacing(self):
        first=self.store.write(config(),None)
        for bad in [config(4),config(float('nan'))]:
            with self.assertRaises(ValueError):self.store.write(bad,first['revision'])
        self.assertEqual(self.store.read()['config'],config())
    def test_crossed_quad_rejected(self):
        c=config();c['regions'][0]['points']=[[0,0],[1,1],[1,0],[0,1]]
        with self.assertRaises(ValueError):self.store.write(c,None)
if __name__=='__main__':unittest.main()
