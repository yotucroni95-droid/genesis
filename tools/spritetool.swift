// Sprite tool: cut AI-generated character sheets into game-ready pixel art.
// Usage:
//   spritetool sample  <img> x,y [x,y...]
//   spritetool analyze <img> <x0> <y0> <x1> <y1> <bgR,G,B> <tol>
//   spritetool sheet   <img> <out.png> <frame> <bgR,G,B> <tol> <cols> <rows> <rect;rect;...>   (rects x,y,w,h in output order)
//   spritetool frames  <img> <out.png> <frame> <bgR,G,B> <tol> <rect;rect;...>  (one row strip)
//   spritetool portrait <img> <out.png> <size> <x> <y> <side> [<bgR,G,B> <tol> <fillR,G,B>]
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct Img { var w: Int; var h: Int; var px: [UInt8] } // RGBA, straight alpha

func load(_ path: String) -> Img {
  let url = URL(fileURLWithPath: path) as CFURL
  guard let src = CGImageSourceCreateWithURL(url, nil), let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fatalError("cannot load \(path)") }
  let w = cg.width, h = cg.height
  var px = [UInt8](repeating: 0, count: w * h * 4)
  let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
  return Img(w: w, h: h, px: px) // sources are opaque, so premultiplied == straight
}

func save(_ img: Img, _ path: String) {
  var p = img.px
  // premultiply for CoreGraphics
  for i in stride(from: 0, to: p.count, by: 4) { let a = Int(p[i+3]); for c in 0..<3 { p[i+c] = UInt8(Int(p[i+c]) * a / 255) } }
  let ctx = CGContext(data: &p, width: img.w, height: img.h, bitsPerComponent: 8, bytesPerRow: img.w * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  let cg = ctx.makeImage()!
  let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, cg, nil)
  CGImageDestinationFinalize(dest)
}

func rgb(_ s: String) -> (Int, Int, Int) { let a = s.split(separator: ",").map { Int($0)! }; return (a[0], a[1], a[2]) }
func dist(_ img: Img, _ x: Int, _ y: Int, _ bg: (Int, Int, Int)) -> Double {
  let i = (y * img.w + x) * 4
  let dr = Double(Int(img.px[i]) - bg.0), dg = Double(Int(img.px[i+1]) - bg.1), db = Double(Int(img.px[i+2]) - bg.2)
  return (dr*dr + dg*dg + db*db).squareRoot()
}

/// Mask: true = character pixel.
func mask(_ img: Img, _ bg: (Int, Int, Int), _ tol: Double) -> [Bool] {
  var m = [Bool](repeating: false, count: img.w * img.h)
  for y in 0..<img.h { for x in 0..<img.w { m[y*img.w+x] = dist(img, x, y, bg) > tol } }
  return m
}

struct R { var x, y, w, h: Int }
func parseRects(_ s: String) -> [R] { s.split(separator: ";").map { let a = $0.split(separator: ",").map { Int($0)! }; return R(x: a[0], y: a[1], w: a[2], h: a[3]) } }

/// Tight bbox of mask pixels inside r.
func tight(_ m: [Bool], _ w: Int, _ r: R) -> R? {
  var x0 = Int.max, y0 = Int.max, x1 = -1, y1 = -1
  for y in r.y..<(r.y + r.h) { for x in r.x..<(r.x + r.w) where m[y*w+x] { x0 = min(x0, x); y0 = min(y0, y); x1 = max(x1, x); y1 = max(y1, y) } }
  return x1 < 0 ? nil : R(x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1)
}

/// Area-average downscale of a masked region into dst at (dx,dy) with scale s (dst px per src px).
func blit(_ img: Img, _ m: [Bool], _ r: R, _ s: Double, into dst: inout Img, _ dx: Int, _ dy: Int) {
  let ow = Int((Double(r.w) * s).rounded()), oh = Int((Double(r.h) * s).rounded())
  for oy in 0..<oh { for ox in 0..<ow {
    let sx0 = Double(ox) / s, sx1 = Double(ox + 1) / s, sy0 = Double(oy) / s, sy1 = Double(oy + 1) / s
    var rs = 0.0, gs = 0.0, bs = 0.0, cnt = 0.0, tot = 0.0
    var yy = Int(sy0); while Double(yy) < sy1 { var xx = Int(sx0); while Double(xx) < sx1 {
      let X = r.x + xx, Y = r.y + yy
      if X < img.w && Y < img.h { tot += 1; if m[Y*img.w+X] { let i = (Y*img.w+X)*4; rs += Double(img.px[i]); gs += Double(img.px[i+1]); bs += Double(img.px[i+2]); cnt += 1 } }
      xx += 1 }; yy += 1 }
    guard tot > 0, cnt / tot >= 0.5 else { continue }
    let X = dx + ox, Y = dy + oy
    guard X >= 0, Y >= 0, X < dst.w, Y < dst.h else { continue }
    let i = (Y*dst.w+X)*4
    dst.px[i] = UInt8(rs/cnt); dst.px[i+1] = UInt8(gs/cnt); dst.px[i+2] = UInt8(bs/cnt); dst.px[i+3] = 255
  } }
}

/// Lays frames out in a grid, same scale for all, feet on the bottom, centred.
func buildSheet(_ img: Img, _ m: [Bool], _ rects: [R], frame: Int, cols: Int, rows: Int) -> Img {
  let boxes = rects.map { tight(m, img.w, $0) ?? $0 }
  let maxW = boxes.map { $0.w }.max()!, maxH = boxes.map { $0.h }.max()!
  let s = Double(frame - 1) / Double(max(maxW, maxH))
  var out = Img(w: frame * cols, h: frame * rows, px: [UInt8](repeating: 0, count: frame * cols * frame * rows * 4))
  for (i, b) in boxes.enumerated() {
    let cx = (i % cols) * frame, cy = (i / cols) * frame
    let ow = Int((Double(b.w) * s).rounded()), oh = Int((Double(b.h) * s).rounded())
    blit(img, m, b, s, into: &out, cx + (frame - ow) / 2, cy + frame - oh)
  }
  print("scale \(s) maxW \(maxW) maxH \(maxH)")
  return out
}

let a = CommandLine.arguments
switch a[1] {
case "sample":
  let img = load(a[2])
  for p in a[3...] { let c = p.split(separator: ",").map { Int($0)! }; let i = (c[1]*img.w+c[0])*4; print(p, img.px[i], img.px[i+1], img.px[i+2]) }
case "analyze":
  let img = load(a[2]); let x0 = Int(a[3])!, y0 = Int(a[4])!, x1 = Int(a[5])!, y1 = Int(a[6])!
  let m = mask(img, rgb(a[7]), Double(a[8])!)
  // column / row occupancy -> runs
  func runs(_ occ: [Int], _ off: Int, _ minGap: Int) -> [(Int, Int)] {
    var res: [(Int, Int)] = []; var start = -1; var gap = 0
    for (i, v) in occ.enumerated() { if v > 2 { if start < 0 { start = i }; gap = 0 } else if start >= 0 { gap += 1; if gap >= minGap { res.append((start + off, i - gap + off)); start = -1; gap = 0 } } }
    if start >= 0 { res.append((start + off, occ.count - 1 - gap + off)) }
    return res
  }
  var rowOcc = [Int](repeating: 0, count: y1 - y0)
  for y in y0..<y1 { for x in x0..<x1 where m[y*img.w+x] { rowOcc[y-y0] += 1 } }
  let rws = runs(rowOcc, y0, 8)
  for (ry0, ry1) in rws {
    var colOcc = [Int](repeating: 0, count: x1 - x0)
    for y in ry0...ry1 { for x in x0..<x1 where m[y*img.w+x] { colOcc[x-x0] += 1 } }
    let cs = runs(colOcc, x0, 8)
    print("row \(ry0)-\(ry1): " + cs.map { "\($0.0),\(ry0),\($0.1-$0.0+1),\(ry1-ry0+1)" }.joined(separator: ";"))
  }
case "sheet":
  let img = load(a[2]); let m = mask(img, rgb(a[5]), Double(a[6])!)
  save(buildSheet(img, m, parseRects(a[9]), frame: Int(a[4])!, cols: Int(a[7])!, rows: Int(a[8])!), a[3])
case "frames":
  let img = load(a[2]); let m = mask(img, rgb(a[5]), Double(a[6])!); let rs = parseRects(a[7])
  save(buildSheet(img, m, rs, frame: Int(a[4])!, cols: rs.count, rows: 1), a[3])
case "portrait":
  let img = load(a[2]); let size = Int(a[4])!; let r = R(x: Int(a[5])!, y: Int(a[6])!, w: Int(a[7])!, h: Int(a[7])!)
  var src = img
  if a.count > 10 {
    // replace background colour with a fill colour (soft edge)
    let bg = rgb(a[8]); let tol = Double(a[9])!; let f = rgb(a[10])
    for y in 0..<img.h { for x in 0..<img.w {
      let d = dist(img, x, y, bg); if d < tol * 1.6 {
        let t = max(0, min(1, (d - tol) / (tol * 0.6))); let i = (y*img.w+x)*4
        src.px[i] = UInt8(Double(f.0) * (1-t) + Double(img.px[i]) * t)
        src.px[i+1] = UInt8(Double(f.1) * (1-t) + Double(img.px[i+1]) * t)
        src.px[i+2] = UInt8(Double(f.2) * (1-t) + Double(img.px[i+2]) * t)
      } } }
  }
  var out = Img(w: size, h: size, px: [UInt8](repeating: 0, count: size*size*4))
  blit(src, [Bool](repeating: true, count: img.w*img.h), r, Double(size)/Double(r.w), into: &out, 0, 0)
  save(out, a[3])
case "bbox":
  // tight box of non-background pixels inside a region (ignores thin noise)
  let img = load(a[2]); let r = R(x: Int(a[3])!, y: Int(a[4])!, w: Int(a[5])!, h: Int(a[6])!)
  let bg = rgb(a[7]); let tol = Double(a[8])!
  var rows = [Int](repeating: 0, count: r.h), cols = [Int](repeating: 0, count: r.w)
  for y in r.y..<(r.y+r.h) { for x in r.x..<(r.x+r.w) where dist(img, x, y, bg) > tol { rows[y-r.y] += 1; cols[x-r.x] += 1 } }
  let ys = rows.indices.filter { rows[$0] > 3 }, xs = cols.indices.filter { cols[$0] > 3 }
  print("\(r.x + xs.first!),\(r.y + ys.first!),\(xs.last! - xs.first! + 1),\(ys.last! - ys.first! + 1)")
case "cut":
  // crop a rect, optionally turn the background transparent (soft edge keeps glows), resize
  let img = load(a[2]); let r = R(x: Int(a[4])!, y: Int(a[5])!, w: Int(a[6])!, h: Int(a[7])!)
  let ow = Int(a[8])!, oh = Int(a[9])!
  let keyed = a.count > 12; let bg = keyed ? rgb(a[10]) : (0,0,0); let tol = keyed ? Double(a[11])! : 0; let soft = keyed ? Double(a[12])! : 1
  var out = Img(w: ow, h: oh, px: [UInt8](repeating: 0, count: ow*oh*4))
  let sx = Double(r.w) / Double(ow), sy = Double(r.h) / Double(oh)
  // optional CLIP="x,y,w,h": source pixels outside it count as transparent
  let clip: R? = ProcessInfo.processInfo.environment["CLIP"].map { let c = $0.split(separator: ",").map { Int($0)! }; return R(x: c[0], y: c[1], w: c[2], h: c[3]) }
  for oy in 0..<oh { for ox in 0..<ow {
    var rs = 0.0, gs = 0.0, bs = 0.0, as_ = 0.0, n = 0.0
    var yy = Int(Double(oy) * sy); while Double(yy) < Double(oy + 1) * sy { var xx = Int(Double(ox) * sx); while Double(xx) < Double(ox + 1) * sx {
      let X = r.x + xx, Y = r.y + yy
      let inClip = clip.map { X >= $0.x && Y >= $0.y && X < $0.x + $0.w && Y < $0.y + $0.h } ?? true
      if inClip, X >= 0, Y >= 0, X < img.w, Y < img.h {
        let i = (Y*img.w+X)*4
        let al = keyed ? max(0, min(1, (dist(img, X, Y, bg) - tol) / soft)) : 1
        rs += Double(img.px[i]) * al; gs += Double(img.px[i+1]) * al; bs += Double(img.px[i+2]) * al; as_ += al
      }
      n += 1; xx += 1 }; yy += 1 }
    guard as_ > 0 else { continue }
    let o = (oy*ow+ox)*4
    out.px[o] = UInt8(rs/as_); out.px[o+1] = UInt8(gs/as_); out.px[o+2] = UInt8(bs/as_); out.px[o+3] = UInt8(min(255, as_/n*255))
  } }
  save(out, a[3])
default: print("unknown command")
}
