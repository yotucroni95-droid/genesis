#!/usr/bin/env python3
"""Copies the capture questions of content/fuga.json into supabase/fuga.sql
(between the @QUESTIONS-BEGIN@/@QUESTIONS-END@ markers). Run after editing them."""
import json, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
qs = json.loads((root / 'content/fuga.json').read_text())['tempt']
lit = lambda s: "'" + str(s).replace("'", "''") + "'"
rows = ',\n'.join(
    f"  ({i}, {lit(q['q'])}, array[{', '.join(lit(o) for o in q['options'])}], {q['answer']}, {lit(q.get('verse', ''))})"
    for i, q in enumerate(qs))
block = ('-- @QUESTIONS-BEGIN@\ndelete from public.genesis_fuga_q;\n'
         f'insert into public.genesis_fuga_q (id, q, options, answer, verse) values\n{rows};\n-- @QUESTIONS-END@')
sql = root / 'supabase/fuga.sql'
text = re.sub(r'-- @QUESTIONS-BEGIN@.*?-- @QUESTIONS-END@', lambda _: block, sql.read_text(), flags=re.S)
sql.write_text(text)
print(f'{len(qs)} perguntas copiadas para {sql.relative_to(root)}')
