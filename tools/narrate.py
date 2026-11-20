"""Generate humanised Brazilian-Portuguese narration for Gênesis with Kokoro.

Each line is split into sentences; every sentence is synthesised with a small
random variation in speed, and real pauses are inserted after commas,
sentence ends and ellipses. Volume is levelled so all clips sound alike.

usage: narrate.py <genesis dir> [--only key-prefix] [--sample out.wav]
"""
import json, os, random, re, subprocess, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

G = sys.argv[1]
ONLY = tuple(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else ()  # comma-separated key prefixes
SAMPLE = sys.argv[sys.argv.index('--sample') + 1] if '--sample' in sys.argv else ''
CACHE = os.path.expanduser('~/.cache/hyperframes/tts')
kokoro = Kokoro(f'{CACHE}/models/kokoro-v1.0.onnx', f'{CACHE}/voices/voices-v1.0.bin')
SR = 24000
random.seed(7)

V = {n: kokoro.get_voice_style(n) for n in ('pm_santa', 'pm_alex', 'pf_dora')}
BLEND_DARK = (V['pm_alex'] * 0.5 + V['pm_santa'] * 0.5).astype(np.float32)
BLEND_OLD = (V['pm_santa'] * 0.7 + V['pm_alex'] * 0.3).astype(np.float32)

# role -> (voice style, base speed, pause after sentence, clause pause)
ROLES = {
    'narrador': (V['pm_santa'], 0.90, 0.55, 0.22),
    'deus': (V['pm_santa'], 0.80, 0.75, 0.30),
    'homem': (V['pm_alex'], 0.95, 0.45, 0.18),
    'mulher': (V['pf_dora'], 0.95, 0.45, 0.18),
    'sombra': (BLEND_DARK, 0.88, 0.55, 0.22),
    'anciao': (BLEND_OLD, 0.86, 0.6, 0.24),
    # children and teens of the Acampamento: the adult voices raised in pitch
    'menina': (V['pf_dora'], 0.98, 0.42, 0.16),
    'menino': (V['pm_alex'], 1.0, 0.42, 0.16),
    'jovem_f': (V['pf_dora'], 0.98, 0.45, 0.18),
    'jovem_m': (V['pm_alex'], 0.97, 0.45, 0.18),
}
PITCH = {'menina': 1.2, 'menino': 1.32, 'jovem_f': 1.08, 'jovem_m': 1.14}  # >1 = higher voice
SPEAKER_ROLE = {
    'narrador': 'narrador', 'deus': 'deus',
    'adao': 'homem', 'abel': 'homem', 'caim': 'homem', 'noe': 'homem', 'miguel': 'homem', 'gabriel': 'homem', 'peregrino': 'homem',
    'querubim': 'mulher', 'eva': 'mulher', 'anjos_fieis': 'mulher',
    'abraao': 'anciao', 'isaque': 'homem', 'jaco': 'homem', 'jose': 'homem', 'sara': 'mulher', 'rebeca': 'mulher',
    'lucifer': 'sombra', 'serpente': 'sombra', 'anjos_caidos': 'sombra',
    'moises': 'homem', 'josue': 'homem', 'bezalel': 'homem', 'joquebede': 'mulher', 'miria': 'jovem_f',
    'aventureira': 'menina', 'aventureiro': 'menino', 'desbravadora': 'jovem_f', 'desbravador': 'jovem_m',
}
# people of the Acampamento map, by picture: diretor, conselheira, instrutor, enfermeira, corneteiro, lanterninha
VARIANT_ROLE = {'acampamento_povo': ['homem', 'mulher', 'anciao', 'mulher', 'jovem_m', 'menino']}

UNITS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
         'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']


def spell(n):
    if n < 20: return UNITS[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else ' e ' + UNITS[n % 10])
    if n == 100: return 'cem'
    return HUNDREDS[n // 100] + ('' if n % 100 == 0 else ' e ' + spell(n % 100))


def speakable(text):
    t = text.replace('"', '').replace('“', '').replace('”', '')
    # Bible references: "Gênesis 3:15" -> "Gênesis, capítulo três, versículo quinze"
    t = re.sub(r'(\d+):(\d+)(?:-(\d+))?', lambda m: f'capítulo {spell(int(m.group(1)))}, versículo {spell(int(m.group(2)))}'
               + (f' a {spell(int(m.group(3)))}' if m.group(3) else ''), t)
    t = re.sub(r'\b(\d+)\b', lambda m: spell(int(m.group(1))), t)
    t = t.replace('...', '…')
    return t


def sentences(text):
    parts = re.findall(r'[^.!?…]+[.!?…]*', text)
    return [p.strip() for p in parts if p.strip()]


def silence(sec):
    return np.zeros(int(SR * sec), dtype=np.float32)


def synth(text, role):
    style, speed, s_pause, c_pause = ROLES[role]
    pitch = PITCH.get(role, 1.0)
    speed = speed / pitch  # spoken slower, then sped up with the pitch: same pace, higher voice
    out = [silence(0.12)]
    for s in sentences(speakable(text)):
        sp = speed * random.uniform(0.96, 1.04)  # people never keep exactly the same pace
        audio, _ = kokoro.create(s, voice=style, speed=sp, lang='pt-br', sentence_pause=s_pause, clause_pause=c_pause)
        fade = int(SR * 0.008)
        audio[:fade] *= np.linspace(0, 1, fade)
        audio[-fade:] *= np.linspace(1, 0, fade)
        out.append(audio)
        end = s[-1]
        gap = 0.85 if end == '…' else 0.6 if end in '!?' else s_pause
        out.append(silence(gap * random.uniform(0.9, 1.15)))
    wav = np.concatenate(out)
    if pitch != 1.0:
        n = int(len(wav) / pitch)
        wav = np.interp(np.linspace(0, len(wav) - 1, n), np.arange(len(wav)), wav).astype(np.float32)
    rms = np.sqrt(np.mean(wav ** 2)) or 1
    wav = wav * (0.085 / rms)  # same loudness for every clip
    peak = np.max(np.abs(wav))
    if peak > 0.95: wav = wav * (0.95 / peak)
    return wav


def write(key, text, role, files):
    if ONLY and not key.startswith(ONLY): return
    wav_path = f'/tmp/genesis_voice_{key}.wav'
    out_rel = f'assets/voice/{key}.m4a'
    sf.write(wav_path, synth(text, role), SR)
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', wav_path, f'{G}/{out_rel}'], check=True)
    os.remove(wav_path)
    files[key] = out_rel


def main():
    os.makedirs(f'{G}/assets/voice', exist_ok=True)
    if SAMPLE:
        ch1 = json.load(open(f'{G}/content/chapters/cap1.json'))
        ch2 = json.load(open(f'{G}/content/chapters/cap2.json'))
        lines = ch1['stops'][0]['story'][:3] + ch2['stops'][0]['story'][1:4]
        clips = [synth(l['text'], SPEAKER_ROLE.get(l['speaker'], 'homem')) for l in lines]
        sf.write(SAMPLE, np.concatenate(clips), SR)
        print('sample ok')
        return
    vpath = f'{G}/content/voices.json'
    files = json.load(open(vpath)).get('files', {}) if os.path.exists(vpath) else {}
    index = json.load(open(f'{G}/content/chapters/index.json'))['chapters']
    for entry in index:
        ch = json.load(open(f"{G}/content/{entry['file']}"))
        for stop in ch['stops']:
            for i, line in enumerate(stop['story']):
                write(f"{stop['id']}-{i}", line['text'], SPEAKER_ROLE.get(line['speaker'], 'homem'), files)
        for n in ch.get('npcs', []):
            role = VARIANT_ROLE[n['sheet']][n.get('variant', 0)] if n['sheet'] in VARIANT_ROLE else SPEAKER_ROLE.get(n['sheet'], 'homem')
            for i, t in enumerate(n.get('talk', [])):
                write(f"talk-{ch['id']}-{n['sheet']}-{n['x']}-{n['y']}-{i}", t, role, files)
            if n.get('resist'):
                write(f"resist-{ch['id']}-{n['sheet']}-{n['x']}-{n['y']}", n['resist']['text'], 'narrador', files)
        print(ch['id'], 'ok', flush=True)
    for v in json.load(open(f'{G}/content/verses.json'))['cards']:
        write(f"verse-{v['id']}", f"{v['text']} … {v['ref']}.", 'narrador', files)
    print('verses ok')
    json.dump({'files': files}, open(vpath, 'w'), ensure_ascii=False, indent=1)
    print('total', len(files))


main()
