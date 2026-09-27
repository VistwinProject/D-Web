"""Mix licensed equipment recordings under dialogue; runtime stays one audio element.

Uses only the standard library. Timing is resolved from the existing show events,
so changing a voice recording and rebuilding also moves the equipment cues.
"""
import array
import json
import sys
import wave


def read_pcm(path, rate):
    with wave.open(str(path), 'rb') as src:
        if (src.getnchannels(), src.getsampwidth(), src.getframerate()) != (1, 2, rate):
            raise ValueError(f'{path}: expected mono PCM16 at {rate}Hz')
        data = array.array('h', src.readframes(src.getnframes()))
    if sys.byteorder != 'little':
        data.byteswap()
    if not data:
        raise ValueError(f'{path}: empty recording')
    return data


def resolve_time(value, show):
    if isinstance(value, (float, int)):
        return float(value)
    if value == 'end':
        return show['duration']
    return show['events'][value]


def dialogue_gain(t, clips, floor=.28, attack=.25, release=.5):
    """Ramp down before each spoken line, then recover gently afterwards."""
    gain = 1.
    for cue in clips:
        start, end = cue['start'], cue['end']
        if start <= t <= end:
            return floor
        if start-attack < t < start:
            gain = min(gain, floor+(1-floor)*(start-t)/attack)
        elif end < t < end+release:
            gain = min(gain, floor+(1-floor)*(t-end)/release)
    return gain


def sample_loop(samples, position, loop_start, crossfade):
    """Play the real startup once, crossfading only the steady running section."""
    size = len(samples)
    period = size-loop_start-crossfade
    if position >= size:
        position = loop_start+crossfade+(position-size) % period
    if position >= size-crossfade:
        blend = (position-(size-crossfade))/crossfade
        return samples[position]*(1-blend)+samples[loop_start+position-(size-crossfade)]*blend
    return samples[position]


def build_mix(root, show, rate=32000):
    manifest_path = root/'sound-effects.json'
    if not manifest_path.exists():
        return
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    voice = read_pcm(root/'assets/audio/theatre-voice.wav', rate)
    count = round(show['duration']*rate)
    if len(voice) != count:
        raise ValueError('Voice master duration differs from show clock')
    effects = array.array('f', [0.]) * count
    resolved = []
    # A 10ms gain envelope, interpolated per sample, avoids pumping and clicks.
    step = max(1, rate//100)
    duck = [dialogue_gain(i/rate, show['clips'], manifest['duckGain'])
            for i in range(0, count+step*2, step)]
    for cue in manifest['cues']:
        start, end = (resolve_time(cue[k], show) for k in ('start', 'end'))
        if not 0 <= start < end <= show['duration']:
            raise ValueError(f"{cue['id']}: invalid cue interval")
        samples = read_pcm(root/cue['file'], rate)
        loop_start = round(cue.get('loopStart', 0)*rate)
        crossfade = round(cue.get('crossfade', .15)*rate)
        if crossfade < 1 or not 0 <= loop_start < len(samples)-2*crossfade:
            raise ValueError(f"{cue['id']}: invalid loop region")
        offset, length = round(start*rate), round(end*rate)-round(start*rate)
        fade_in, fade_out = max(1, round(cue['fadeIn']*rate)), max(1, round(cue['fadeOut']*rate))
        for j in range(length):
            at = offset+j
            envelope = min(1., j/fade_in, (length-1-j)/fade_out)
            block, fraction = divmod(at, step)
            lowered = duck[block]+(duck[block+1]-duck[block])*fraction/step
            effects[at] += sample_loop(samples, j, loop_start, crossfade)*cue['gain']*envelope*lowered
        resolved.append({'id': cue['id'], 'start': start, 'end': end, 'file': cue['file']})
    # Leave dialogue untouched; constrain only the added layer to available headroom.
    mixed = array.array('h', (round(max(-32000, min(32000, v+s))) for v, s in zip(voice, effects)))
    if sys.byteorder != 'little':
        mixed.byteswap()
    path = 'assets/audio/theatre-mix.wav'
    with wave.open(str(root/path), 'wb') as dst:
        dst.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        dst.writeframes(mixed.tobytes())
    show['audio'] = path
    show['soundEffects'] = resolved
    print(f"Mixed {len(resolved)} equipment/ambience cues with dialogue ducking")
