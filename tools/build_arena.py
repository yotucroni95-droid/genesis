"""Arena gets every quiz question in the game (arena extras, the replay bank
and the chapter quizzes), without repeats. Run after changing any quiz:
    python3 tools/build_arena.py
content/arena-extra.json holds the questions that exist only in the Arena."""
import json, re, glob, os
G = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key = lambda s: re.sub(r'\W+', '', s.lower())
src = []
src += json.load(open(f'{G}/content/arena-extra.json'))['questions']
for v in json.load(open(f'{G}/content/questions.json'))['chapters'].values():
    src += v.get('quiz', [])
for f in sorted(glob.glob(f'{G}/content/chapters/*.json')):
    if f.endswith('index.json'): continue
    for s in json.load(open(f))['stops']:
        if s['challenge']['type'] == 'quiz':
            cf = s['challenge'].get('config', {})
            src += cf.get('pool') or cf.get('questions') or []
out, seen = [], set()
for x in src:
    k = key(x['q'])
    if k in seen or not (0 <= x.get('answer', -1) < len(x.get('options', []))): continue
    seen.add(k)
    q = {'q': x['q'], 'options': x['options'], 'answer': x['answer']}
    ref = x.get('ref') or x.get('verse')
    if ref: q['ref'] = ref
    out.append(q)
json.dump({'questions': out}, open(f'{G}/content/arena.json', 'w'), ensure_ascii=False, indent=1)
print(len(out), 'arena questions')
