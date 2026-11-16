"""Lists every file the game needs, so the service worker can download all of
it on the first visit and the game works 100% offline (sounds included).
Run after adding or removing files:  python3 tools/make_precache.py
"""
import json, os
G = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = ['./', 'index.html', 'manifest.webmanifest']
for root, folder_exts in (('css', ('.css',)), ('src', ('.js',)), ('content', ('.json',))):
    for dp, _, fs in os.walk(os.path.join(G, root)):
        for f in sorted(fs):
            if f.endswith(folder_exts):
                files.append(os.path.relpath(os.path.join(dp, f), G))
manifest = json.load(open(os.path.join(G, 'assets/manifest.json')))
files.append('assets/manifest.json')
for a in manifest['assets']:
    if a.get('pending'): continue
    p = 'assets/' + a['src']
    if os.path.exists(os.path.join(G, p)): files.append(p)
for folder in ('assets/sfx', 'assets/voice', 'assets/logo'):
    for f in sorted(os.listdir(os.path.join(G, folder))):
        if f.endswith(('.mp3', '.m4a', '.png', '.svg')): files.append(f'{folder}/{f}')
files = list(dict.fromkeys(files))
size = sum(os.path.getsize(os.path.join(G, f)) for f in files if f not in ('./',))
json.dump({'files': files}, open(os.path.join(G, 'precache.json'), 'w'), indent=0)
print(len(files), 'files,', round(size / 1e6, 1), 'MB')
