# Walk mask for every map: the player walks only on the painted path.
#
# For each map it finds the painted road (colour close to genesis.roadColor) in
# 4x4 px cells, adds the bridges, and then makes sure every story stop, every
# character and the spawn can be reached with the real foot box: when one is off
# the path, a passage is opened from the nearest road to it (as straight as
# possible, avoiding water). The result goes into the map JSON as
# genesis.walk = { cell, w, h, rows: [run lengths, blocked first] }.
#
# Run:  uv run --with pillow --with numpy --with scipy python tools/make_walk.py . [map ids] [--review DIR]
import sys, os, json, heapq, colorsys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

C = 4                       # cell size in pixels
FOOT_W, FOOT_H = 14, 8      # player foot box (src/world/player.js)
STOP_NEAR = 30              # src/world/stops.js NEAR
TALK_NEAR = 64              # src/world/talk.js NEAR
MARGIN = 8                  # stand comfortably inside those ranges
BRUSH = 3                   # passage half-width in cells (about 28 px wide)

# per-map tuning of the road detection, when the default needs help
# 'lab': perceptual colour distance + smooth paint, for maps whose houses share the road colour
TUNE = {
    'babel': dict(mode='lab'), 'egito': dict(mode='lab'), 'dota': dict(mode='lab'),
    'fora_eden': dict(mode='lab'), 'ceu': dict(mode='lab'),
    'betel': dict(sat=(0.75, 1.4)),
    # map id: dict(hue=..., sat=(lo, hi) as factors of the road's saturation, val=min factor, fill=cell fraction)
}


def lab(a):
    a = a.astype(float) / 255
    a = np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = a @ M.T / np.array([0.9505, 1.0, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def detect_lab(img, road, t):
    L = lab(img); r = lab(np.array([[road]], np.uint8))[0, 0]
    d = np.sqrt(((L - r) ** 2).sum(-1))
    v = L[..., 0]; vv = ndimage.uniform_filter(v, 7)
    sd = np.sqrt(np.maximum(ndimage.uniform_filter(v * v, 7) - vv * vv, 0))
    H, W = d.shape
    cell = lambda px: px.reshape(H // C, C, W // C, C).mean(axis=(1, 3))
    core = cell((d < t.get('de', 14)) & (sd < t.get('smooth', 6))) > 0.45
    core = ndimage.binary_closing(core, iterations=2)
    core = ndimage.binary_opening(core, iterations=1)
    # the pebbled edges of the road: same colour family, next to the smooth middle
    loose = cell(d < t.get('de_edge', 22)) > 0.5
    return core | (ndimage.binary_dilation(core, iterations=2) & loose)

def rgb2hsv(a):
    a = a.astype(float) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r); gg = m & (mx == g) & ~rr; bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6
    h[gg] = (b - r)[gg] / d[gg] + 2
    h[bb] = (r - g)[bb] / d[bb] + 4
    h = h / 6
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx


def detect(img, road, t):
    h, s, v = rgb2hsv(img)
    rh, rs, rv = colorsys.rgb_to_hsv(*(np.array(road) / 255))
    dh = np.abs(h - rh); dh = np.minimum(dh, 1 - dh)
    if t.get('mode') == 'lab':
        walk = detect_lab(img, road, t)
    lo, hi = t.get('sat', (0.6, 1.4))
    px = (dh < t.get('hue', 0.05)) & (s > rs * lo) & (s < min(1.0, rs * hi + 0.05)) & (v > rv * t.get('val', 0.7))
    if 'smooth' in t:  # the road is evenly painted; grass and gravel are speckled
        vv = ndimage.uniform_filter(v, 7); sd = np.sqrt(np.maximum(ndimage.uniform_filter(v * v, 7) - vv * vv, 0))
        px &= sd < t['smooth']
    H, W = px.shape
    cells = px.reshape(H // C, C, W // C, C).mean(axis=(1, 3)) > t.get('fill', 0.45)
    cells = ndimage.binary_closing(cells, iterations=2)
    cells = ndimage.binary_opening(cells, iterations=1)
    if t.get('mode') == 'lab': cells = walk
    water = ((h > 0.47) & (h < 0.7) & (s > 0.3) & (v > 0.25)).reshape(H // C, C, W // C, C).mean(axis=(1, 3)) > 0.5
    return cells, water


def foot_free(walk, solids):
    """free[y, x] for feet points on a 2 px lattice (x, y in pixels / 2)."""
    Hc, Wc = walk.shape
    H2, W2 = Hc * C // 2, Wc * C // 2
    # integral image of blocked cells for fast box tests
    blocked = (~walk).astype(np.int32)
    ii = np.zeros((Hc + 1, Wc + 1), np.int32); ii[1:, 1:] = blocked.cumsum(0).cumsum(1)
    ys, xs = np.mgrid[0:H2, 0:W2]
    X, Y = xs * 2, ys * 2
    x0 = X - FOOT_W // 2; x1 = X + FOOT_W // 2; y0 = Y - FOOT_H; y1 = Y
    ok = (x0 >= 0) & (y0 >= 0) & (x1 <= Wc * C) & (y1 <= Hc * C)
    cx0 = np.clip(x0 // C, 0, Wc); cx1 = np.clip((x1 - 1) // C + 1, 0, Wc)
    cy0 = np.clip(y0 // C, 0, Hc); cy1 = np.clip((y1 - 1) // C + 1, 0, Hc)
    n = ii[cy1, cx1] - ii[cy0, cx1] - ii[cy1, cx0] + ii[cy0, cx0]
    free = ok & (n == 0)
    for (sx, sy, sw, sh) in solids:
        free &= ~((x0 < sx + sw) & (x1 > sx) & (y0 < sy + sh) & (y1 > sy))
    return free


def reach(free, start):
    sx, sy = int(start[0] // 2), int(start[1] // 2)
    if not free[sy, sx]:
        # nearest free point (the game nudges the player out)
        ys, xs = np.nonzero(free)
        if not len(xs): return np.zeros_like(free)
        k = np.argmin((xs - sx) ** 2 + (ys - sy) ** 2)
        if (xs[k] - sx) ** 2 + (ys[k] - sy) ** 2 > 36: return np.zeros_like(free)
        sx, sy = xs[k], ys[k]
    lab, _ = ndimage.label(free)
    return lab == lab[sy, sx]


def near_ok(R, px, py, r):
    ys, xs = np.nonzero(R)
    if not len(xs): return False
    return bool(((xs * 2 - px) ** 2 + (ys * 2 - py) ** 2 < r * r).any())


def carve(walk, cost, R, px, py):
    """Opens a passage from the reachable area to the point (px, py)."""
    Hc, Wc = walk.shape
    # reachable cells (feet points -> cells)
    rc = np.zeros_like(walk)
    ys, xs = np.nonzero(R)
    rc[np.clip(ys * 2 // C - 1, 0, Hc - 1), np.clip(xs * 2 // C, 0, Wc - 1)] = True
    tx, ty = int(px // C), int(py // C)
    dist = np.full(walk.shape, np.inf); prev = {}
    dist[ty, tx] = 0; pq = [(0.0, tx, ty)]
    goal = None
    while pq:
        d, x, y = heapq.heappop(pq)
        if d > dist[y, x]: continue
        if rc[y, x]: goal = (x, y); break
        for dx, dy, w in ((1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.41), (-1, 1, 1.41), (1, -1, 1.41), (-1, -1, 1.41)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < Wc and 0 <= ny < Hc:
                nd = d + w * cost[ny, nx]
                if nd < dist[ny, nx]:
                    dist[ny, nx] = nd; prev[(nx, ny)] = (x, y); heapq.heappush(pq, (nd, nx, ny))
    if goal is None: return []
    path = [goal]
    while path[-1] != (tx, ty): path.append(prev[path[-1]])
    yy, xx = np.ogrid[-BRUSH:BRUSH + 1, -BRUSH:BRUSH + 1]
    disc = xx * xx + yy * yy <= BRUSH * BRUSH + 1
    for x, y in path:
        y0, y1 = max(0, y - BRUSH), min(Hc, y + BRUSH + 1); x0, x1 = max(0, x - BRUSH), min(Wc, x + BRUSH + 1)
        walk[y0:y1, x0:x1] |= disc[(y0 - y + BRUSH):(y1 - y + BRUSH), (x0 - x + BRUSH):(x1 - x + BRUSH)]
    return path


def rle(row):
    out, cur, n = [], False, 0
    for v in row:
        if bool(v) == cur: n += 1
        else: out.append(n); cur = not cur; n = 1
    out.append(n)
    return ','.join(map(str, out))


def npc_box(n, T, frame):
    px, py = (n['x'] + 0.5) * T, (n['y'] + 1) * T - 4
    w = h = round(frame * 0.55)
    return (px - w / 2, py - h, w, h), (px, py)


def process(G, mid, chapters, frames, review):
    path = f'{G}/content/maps/{mid}.json'
    raw = open(path).read()
    m = json.loads(raw); g = m['genesis']; T = m['tilewidth']
    img = np.array(Image.open(f'{G}/assets/maps/{mid}.jpg').convert('RGB'))
    walk, water = detect(img, g['roadColor'], TUNE.get(mid, {}))
    for (bx, by, bw, bh) in g.get('bridges', []):
        walk[by // C:(by + bh) // C + 1, bx // C:(bx + bw) // C + 1] = True
    for (x0, y0, x1, y1) in g.get('walkAdd', []):    # hand-made openings, pixels
        walk[y0 // C:y1 // C, x0 // C:x1 // C] = True
    for (x0, y0, x1, y1) in g.get('walkBlock', []):  # hand-made walls, pixels
        walk[y0 // C:y1 // C, x0 // C:x1 // C] = False
    # small islands that hold nothing are noise
    lab, n = ndimage.label(walk)
    sizes = ndimage.sum(walk, lab, range(1, n + 1))
    walk = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 40])
    cost = np.where(walk, 1.0, 5.0); cost[water] = 80.0
    sp = g['spawn']; spawn = ((sp['x'] + 0.5) * T, (sp['y'] + 1) * T - 4)
    targets = []
    for ch in chapters:
        for s in ch['stops']:
            targets.append(('stop', s['id'], (s['x'] + 0.5) * T, (s['y'] + 0.5) * T, STOP_NEAR - MARGIN))
    solids = []
    for ch in chapters:
        for nn in ch.get('npcs', []):
            box, (px, py) = npc_box(nn, T, frames.get(nn['sheet'], 32))
            solids.append(box)
            targets.append(('npc', f"{nn['sheet']}@{nn['x']},{nn['y']}", px, py - 12, TALK_NEAR - MARGIN - 12))
    # people are solid: passages go around them, never through
    for (sx, sy, sw, sh) in solids:
        x0 = int((sx - FOOT_W / 2) // C) - 1; x1 = int((sx + sw + FOOT_W / 2) // C) + 2
        y0 = int(sy // C) - 1; y1 = int((sy + sh + FOOT_H) // C) + 2
        cost[max(0, y0):y1, max(0, x0):x1] = 1e6
    carved = []
    # the spawn itself must stand on the path
    free = foot_free(walk, solids)
    if not free[int(spawn[1] // 2), int(spawn[0] // 2)]:
        # open a passage from the spawn to the nearest road (search from the road side)
        R = np.zeros_like(free); ys, xs = np.nonzero(free)
        lab, _ = ndimage.label(free); big = np.bincount(lab.ravel())[1:].argmax() + 1
        carved.append(('spawn', carve(walk, cost, lab == big, *spawn)))
    for _ in range(3):
        free = foot_free(walk, solids)
        R = reach(free, spawn)
        todo = [t for t in targets if not near_ok(R, t[2], t[3], t[4])]
        if not todo: break
        for kind, name, px, py, r in todo:
            p = carve(walk, cost, R, px, py)
            carved.append((name, p))
            free = foot_free(walk, solids); R = reach(free, spawn)
    free = foot_free(walk, solids); R = reach(free, spawn)
    # keep only ground the player can actually get to (drops rooftops and loose bits)
    rc = np.zeros_like(walk); ys, xs = np.nonzero(R)
    rc[np.clip(ys * 2 // C - 1, 0, walk.shape[0] - 1), np.clip(xs * 2 // C, 0, walk.shape[1] - 1)] = True
    lab_, _ = ndimage.label(walk)
    walk = np.isin(lab_, np.unique(lab_[rc & walk])) & walk
    free = foot_free(walk, solids); R = reach(free, spawn)
    if not free[int(spawn[1] // 2), int(spawn[0] // 2)]: print(f'   WARNING {mid}: spawn not on the path')
    bad = [t[1] for t in targets if not near_ok(R, t[2], t[3], t[4])]
    for t in targets:
        if t[1] in bad:
            ys, xs = np.nonzero(R)
            dmin = np.sqrt(((xs * 2 - t[2]) ** 2 + (ys * 2 - t[3]) ** 2).min()) if len(xs) else -1
            print(f'   {t[1]} at ({t[2]:.0f},{t[3]:.0f}) nearest reachable {dmin:.0f}px (needs < {t[4]})')
    g['walk'] = {'cell': C, 'w': walk.shape[1], 'h': walk.shape[0], 'rows': [rle(r) for r in walk]}
    compact = '\n' not in raw.strip()
    open(path, 'w').write(json.dumps(m, ensure_ascii=False, separators=(',', ':')) if compact else json.dumps(m, ensure_ascii=False, indent=1))
    if review:
        vis = img.copy()
        big = np.kron(walk, np.ones((C, C), bool))
        vis[~big] = (vis[~big] * 0.35).astype(np.uint8)
        im = Image.fromarray(vis); d = ImageDraw.Draw(im)
        for name, p in carved:
            for x, y in p: d.rectangle([x * C, y * C, x * C + 1, y * C + 1], fill=(255, 0, 255))
        for box in solids: d.rectangle([box[0], box[1], box[0] + box[2], box[1] + box[3]], outline=(0, 255, 255), width=2)
        for kind, name, px, py, r in targets:
            col = (255, 230, 0) if kind == 'stop' else (0, 255, 255)
            if name in bad: col = (255, 0, 0)
            d.ellipse([px - r, py - r, px + r, py + r], outline=col, width=2)
        d.rectangle([spawn[0] - 5, spawn[1] - 5, spawn[0] + 5, spawn[1] + 5], fill=(0, 255, 0))
        im.save(os.path.join(review, f'walk_{mid}.png'))
    print(f'{mid:12s} walkable {walk.mean() * 100:4.1f}%  passages opened: {len(carved)}  {"UNREACHABLE: " + ", ".join(bad) if bad else "all reachable"}')
    return bad


def main():
    args = sys.argv[1:]
    review = None
    if '--review' in args:
        i = args.index('--review'); review = args[i + 1]; del args[i:i + 2]
    G = args[0]; only = args[1:]
    chapters = [json.load(open(f'{G}/content/chapters/{f}')) for f in sorted(os.listdir(f'{G}/content/chapters')) if f != 'index.json']
    man = json.load(open(f'{G}/assets/manifest.json'))
    frames = {a['id'].replace('sheet.', ''): a.get('frame', 32) for a in man['assets'] if a['id'].startswith('sheet.')}
    maps = sorted({c['map'] for c in chapters})
    bad = []
    for mid in maps:
        if only and mid not in only: continue
        bad += process(G, mid, [c for c in chapters if c['map'] == mid], frames, review)
    sys.exit(1 if bad else 0)


main()
