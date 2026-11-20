// Dev tool: visits every screen and runs the layout audit.
// (await import('/tools/layout_run.js?' + Date.now())).run()

// the audit is imported fresh each run so edits to it are picked up

const SCREENS = [
  ['title'], ['lobby'], ['explore'], ['arena'], ['online'], ['friends'], ['ranking'], ['shop'], ['pass'], ['missions'],
  ['boxes'], ['collection'], ['avatar', { backScene: 'lobby' }], ['medals'], ['album'], ['daily'], ['profile'], ['credits'],
  ['world', { mapId: 'eden', chapterId: 'cap1' }],
  ['challenge', { chapterId: 'acamp', stopId: 'acamp_s20' }],
];

export async function run(only) {
  const { audit } = await import(`./layout_audit.js?${Date.now()}`);
  const g = window.__genesis;
  const out = {};
  for (const [name, params] of SCREENS) {
    if (only && !only.includes(name)) continue;
    try {
      await g.scenes.go(name, params || {});
      await new Promise((r) => setTimeout(r, 900));
      document.querySelectorAll('.modal, .toast').forEach((m) => m.remove());
      const p = audit();
      if (p.length) out[name] = p;
    } catch (err) { out[name] = [`erro: ${err.message}`]; }
  }
  await g.scenes.go('lobby');
  return out;
}
