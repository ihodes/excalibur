// EXACT implementation from diff.diff - NO MODIFICATIONS
(function() {
  'use strict';
  
  console.log('[DiffDiff] Script loaded successfully');

  // Raphael path parsing - EXACT
function parsePathString(pathString) {
  if (!pathString) return null;
  const paramCounts = {a: 7, c: 6, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, z: 0};
  const data = [];
  String(pathString).replace(/([astvzqmhlcr])([^astvzqmhlcr]*)/gi, function(_, command, args) {
    const type = command.toLowerCase();
    args = args.match(/-?[.\d]+/g) || [];
    if (type == "m" && args.length > 2) {
      data.push([command].concat(args.splice(0, 2)));
      type = "l";
      command = command == "m" ? "l" : "L";
    }
    while (args.length >= paramCounts[type]) {
      data.push([command].concat(args.splice(0, paramCounts[type])));
      if (!paramCounts[type]) break;
    }
  });
  return data;
}

// Path to absolute - EXACT
function pathToAbsolute(pathArray) {
  if (!pathArray || !pathArray.length) return [["M", 0, 0]];
  const res = [];
  let x = 0, y = 0, mx = 0, my = 0, start = 0;
  
  if (pathArray[0][0] == "M") {
    x = +pathArray[0][1];
    y = +pathArray[0][2];
    mx = x;
    my = y;
    start++;
    res[0] = ["M", x, y];
  }
  
  for (let r, pa, i = start, ii = pathArray.length; i < ii; i++) {
    res.push(r = []);
    pa = pathArray[i];
    if (pa[0] != pa[0].toUpperCase()) {
      r[0] = pa[0].toUpperCase();
      switch (r[0]) {
        case "A":
          r[1] = pa[1];
          r[2] = pa[2];
          r[3] = pa[3];
          r[4] = pa[4];
          r[5] = pa[5];
          r[6] = +(pa[6] + x);
          r[7] = +(pa[7] + y);
          break;
        case "V":
          r[1] = +pa[1] + y;
          break;
        case "H":
          r[1] = +pa[1] + x;
          break;
        case "M":
          mx = +pa[1] + x;
          my = +pa[2] + y;
        default:
          for (let j = 1, jj = pa.length; j < jj; j++) {
            r[j] = +pa[j] + ((j % 2) ? x : y);
          }
      }
    } else {
      for (let j = 0, jj = pa.length; j < jj; j++) {
        r[j] = pa[j];
      }
    }
    switch (r[0]) {
      case "Z":
        x = mx;
        y = my;
        break;
      case "H":
        x = r[1];
        break;
      case "V":
        y = r[1];
        break;
      case "M":
        mx = r[r.length - 2];
        my = r[r.length - 1];
      default:
        x = r[r.length - 2];
        y = r[r.length - 1];
    }
  }
  return res;
}

// Path to curve - EXACT
function path2curve(path) {
  const p = pathToAbsolute(path);
  const attrs = {x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null};
  
  const processPath = function(path, d) {
    if (!path) return ["C", d.x, d.y, d.x, d.y, d.x, d.y];
    path[0] != "T" && path[0] != "Q" && (d.qx = d.qy = null);
    switch (path[0]) {
      case "M":
        d.X = path[1];
        d.Y = path[2];
        break;
      case "A":
        path = ["C"].concat(a2c.apply(0, [d.x, d.y].concat(path.slice(1))));
        break;
      case "S":
        path = ["C", d.x + (d.x - d.bx), d.y + (d.y - d.by)].concat(path.slice(1));
        break;
      case "T":
        d.qx = d.x + (d.x - d.qx);
        d.qy = d.y + (d.y - d.qy);
        path = ["C"].concat(q2c(d.x, d.y, d.qx, d.qy, path[1], path[2]));
        break;
      case "Q":
        d.qx = path[1];
        d.qy = path[2];
        path = ["C"].concat(q2c(d.x, d.y, path[1], path[2], path[3], path[4]));
        break;
      case "L":
        path = ["C"].concat(l2c(d.x, d.y, path[1], path[2]));
        break;
      case "H":
        path = ["C"].concat(l2c(d.x, d.y, path[1], d.y));
        break;
      case "V":
        path = ["C"].concat(l2c(d.x, d.y, d.x, path[1]));
        break;
      case "Z":
        path = ["C"].concat(l2c(d.x, d.y, d.X, d.Y));
        break;
    }
    return path;
  };
  
  for (var i = 0, ii = p.length; i < ii; i++) {
    p[i] && (p[i] = processPath(p[i], attrs));
    attrs.x = p[i] && p[i][p[i].length - 2] || attrs.x;
    attrs.y = p[i] && p[i][p[i].length - 1] || attrs.y;
    attrs.bx = p[i] && p[i][p[i].length - 4] || attrs.x;
    attrs.by = p[i] && p[i][p[i].length - 3] || attrs.y;
  }
  
  return p;
}

function l2c(x1, y1, x2, y2) {
  return [x1, y1, x2, y2, x2, y2];
}

function q2c(x1, y1, ax, ay, x2, y2) {
  const _13 = 1 / 3;
  const _23 = 2 / 3;
  return [
    _13 * x1 + _23 * ax,
    _13 * y1 + _23 * ay,
    _13 * x2 + _23 * ax,
    _13 * y2 + _23 * ay,
    x2,
    y2
  ];
}

function a2c(x1, y1, rx, ry, angle, large_arc_flag, sweep_flag, x2, y2, recursive) {
  // For xy rotation
  const _120 = Math.PI * 120 / 180;
  const rad = Math.PI / 180 * (+angle || 0);
  let res = [];
  const rotateX = function(x, y, rad) {
    return x * Math.cos(rad) - y * Math.sin(rad);
  };
  const rotateY = function(x, y, rad) {
    return x * Math.sin(rad) + y * Math.cos(rad);
  };
  
  if (!recursive) {
    const x1r = rotateX(x1, y1, -rad);
    const y1r = rotateY(x1, y1, -rad);
    const x2r = rotateX(x2, y2, -rad);
    const y2r = rotateY(x2, y2, -rad);
    const x = (x1r - x2r) / 2;
    const y = (y1r - y2r) / 2;
    let h = (x * x) / (rx * rx) + (y * y) / (ry * ry);
    if (h > 1) {
      h = Math.sqrt(h);
      rx = h * rx;
      ry = h * ry;
    }
    const rx2 = rx * rx;
    const ry2 = ry * ry;
    const k = (large_arc_flag == sweep_flag ? -1 : 1) * Math.sqrt(Math.abs((rx2 * ry2 - rx2 * y * y - ry2 * x * x) / (rx2 * y * y + ry2 * x * x)));
    const cx = k * rx * y / ry + (x1r + x2r) / 2;
    const cy = k * -ry * x / rx + (y1r + y2r) / 2;
    const f1 = Math.asin(((y1r - cy) / ry).toFixed(9));
    const f2 = Math.asin(((y2r - cy) / ry).toFixed(9));
    
    let f1a = f1;
    let f2a = f2;
    if (x1r < cx) f1a = Math.PI - f1;
    if (x2r < cx) f2a = Math.PI - f2;
    if (f1a < 0) f1a = Math.PI * 2 + f1a;
    if (f2a < 0) f2a = Math.PI * 2 + f2a;
    if (sweep_flag && f1a > f2a) f1a = f1a - Math.PI * 2;
    if (!sweep_flag && f2a > f1a) f2a = f2a - Math.PI * 2;
    
    let df = f2a - f1a;
    if (Math.abs(df) > _120) {
      const f2old = f2a;
      const x2old = x2;
      const y2old = y2;
      f2a = f1a + _120 * (sweep_flag && f2a > f1a ? 1 : -1);
      const x2new = cx + rx * Math.cos(f2a);
      const y2new = cy + ry * Math.sin(f2a);
      res = a2c(x2new, y2new, rx, ry, angle, 0, sweep_flag, x2old, y2old, [f2a, f2old, cx, cy]);
    }
    df = f2a - f1a;
    const c1 = Math.cos(f1a);
    const s1 = Math.sin(f1a);
    const c2 = Math.cos(f2a);
    const s2 = Math.sin(f2a);
    const t = Math.tan(df / 4);
    const hx = 4 / 3 * rx * t;
    const hy = 4 / 3 * ry * t;
    const m1 = [x1, y1];
    const m2 = [x1 + hx * s1, y1 - hy * c1];
    const m3 = [x2 + hx * s2, y2 - hy * c2];
    const m4 = [x2, y2];
    m2[0] = 2 * m1[0] - m2[0];
    m2[1] = 2 * m1[1] - m2[1];
    if (recursive) {
      return [m2, m3, m4].concat(res);
    } else {
      res = [m2, m3, m4].concat(res);
      const newres = [];
      for (let i = 0, ii = res.length; i < ii; i++) {
        newres[i] = i % 2 ? rotateY(res[i - 1], res[i], rad) : rotateX(res[i], res[i + 1], rad);
      }
      return newres;
    }
  }
}

// Generate path segments - EXACT from diff.diff
function generatePathSegments(path) {
  const segments = [];

  path.forEach((pathCommand, i) => {
    let seg = {
      items: [],
    };

    // If command is not a moveto, create segment from previous point
    if (pathCommand[0] !== "M") {
      const prevCommand = path[i - 1];
      const prevCommandLength = prevCommand.length;

      seg = {
        items: [
          prevCommand[prevCommandLength - 2],
          prevCommand[prevCommandLength - 1],
          ...pathCommand.slice(1),
        ],
      };
    }

    // Add empty segments for "moveto"
    if (i > 0) {
      segments.push(seg);
    }
  });

  return segments;
}

// Mark subpath endings - EXACT from diff.diff
function markSubpathEndings(...pathSegments) {
  let subPaths = 0;

  pathSegments.forEach((pathSegment) => {
    let subPathIndex = 0;
    pathSegment.forEach((segment, segmentIndex) => {
      const prevSegment = pathSegment[segmentIndex - 1];

      if (segmentIndex > 0 && segment.items.length === 0) {
        prevSegment.subPathEnd = true;
        prevSegment.subPathId = subPaths + "_" + subPathIndex;
        segment.subPathStart = true;
        subPathIndex++;
      }
    });

    const lastSegment = pathSegment[pathSegment.length - 1];
    if (lastSegment && lastSegment.items.length) {
      lastSegment.subPathEnd = true;
      lastSegment.subPathId = subPaths + "_" + subPathIndex;
    }

    if (pathSegment[0]) {
      pathSegment[0].subPathStart = true;
    }

    subPaths++;
  });
}

// Bezier bounding box - EXACT from Raphael
function bezierBBox(x1, y1, x2, y2, x3, y3, x4, y4) {
  const tvalues = [];
  const bounds = [[x1, x4], [y1, y4]];
  
  for (let i = 0; i < 2; ++i) {
    const b = 6 * bounds[i][0] - 12 * (i ? y2 : x2) + 6 * (i ? y3 : x3);
    const a = -3 * bounds[i][0] + 9 * (i ? y2 : x2) - 9 * (i ? y3 : x3) + 3 * bounds[i][1];
    const c = 3 * (i ? y2 : x2) - 3 * bounds[i][0];
    
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) > 1e-12) {
        const t = -c / b;
        if (0 < t && t < 1) tvalues.push(t);
      }
    } else {
      const disc = b * b - 4 * c * a;
      if (disc >= 0) {
        const t1 = (-b + Math.sqrt(disc)) / (2 * a);
        if (0 < t1 && t1 < 1) tvalues.push(t1);
        const t2 = (-b - Math.sqrt(disc)) / (2 * a);
        if (0 < t2 && t2 < 1) tvalues.push(t2);
      }
    }
  }
  
  let x = x1, y = y1;
  let minX = x1, minY = y1, maxX = x1, maxY = y1;
  
  for (let i = 0; i < tvalues.length; i++) {
    const t = tvalues[i];
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    
    x = mt3 * x1 + 3 * mt2 * t * x2 + 3 * mt * t2 * x3 + t3 * x4;
    y = mt3 * y1 + 3 * mt2 * t * y2 + 3 * mt * t2 * y3 + t3 * y4;
    
    minX = Math.min(x, minX);
    minY = Math.min(y, minY);
    maxX = Math.max(x, maxX);
    maxY = Math.max(y, maxY);
  }
  
  minX = Math.min(x4, minX);
  minY = Math.min(y4, minY);
  maxX = Math.max(x4, maxX);
  maxY = Math.max(y4, maxY);
  
  return {
    x: minX,
    y: minY,
    x2: maxX,
    y2: maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

// Check if bboxes intersect
function isBBoxIntersect(bbox1, bbox2) {
  return bbox1.x <= bbox2.x2 &&
         bbox1.x2 >= bbox2.x &&
         bbox1.y <= bbox2.y2 &&
         bbox1.y2 >= bbox2.y;
}

// Find bezier intersections - EXACT algorithm from Raphael's interHelper
function findBezierIntersections(p, p2, justCount) {
  const x1 = p[1], y1 = p[2], x2 = p[3], y2 = p[4], x3 = p[5], y3 = p[6], x4 = p[7], y4 = p[8];
  const x1_2 = p2[1], y1_2 = p2[2], x2_2 = p2[3], y2_2 = p2[4], x3_2 = p2[5], y3_2 = p2[6], x4_2 = p2[7], y4_2 = p2[8];
  const bbox1 = bezierBBox(x1, y1, x2, y2, x3, y3, x4, y4);
  const bbox2 = bezierBBox(x1_2, y1_2, x2_2, y2_2, x3_2, y3_2, x4_2, y4_2);
  
  if (!isBBoxIntersect(bbox1, bbox2)) {
    return justCount ? 0 : [];
  }
  
  const l1 = bezlen(x1, y1, x2, y2, x3, y3, x4, y4);
  const l2 = bezlen(x1_2, y1_2, x2_2, y2_2, x3_2, y3_2, x4_2, y4_2);
  const n1 = ~~(l1 / 5), n2 = ~~(l2 / 5);
  const dots1 = [], dots2 = [];
  const xy = {};
  let res = justCount ? 0 : [];
  
  for (let i = 0; i < n1 + 1; i++) {
    const p = findDotsAtSegment(x1, y1, x2, y2, x3, y3, x4, y4, i / n1);
    dots1.push({x: p.x, y: p.y, t: i / n1});
  }
  
  for (let i = 0; i < n2 + 1; i++) {
    const p = findDotsAtSegment(x1_2, y1_2, x2_2, y2_2, x3_2, y3_2, x4_2, y4_2, i / n2);
    dots2.push({x: p.x, y: p.y, t: i / n2});
  }
  
  for (let i = 0; i < n1; i++) {
    for (let j = 0; j < n2; j++) {
      const di = dots1[i];
      const di1 = dots1[i + 1];
      const dj = dots2[j];
      const dj1 = dots2[j + 1];
      const ci = Math.abs(di1.x - di.x) < .001 ? "y" : "x";
      const cj = Math.abs(dj1.x - dj.x) < .001 ? "y" : "x";
      const is = intersect(di.x, di.y, di1.x, di1.y, dj.x, dj.y, dj1.x, dj1.y);
      
      if (is) {
        if (xy[is.x.toFixed(4)] == is.y.toFixed(4)) {
          continue;
        }
        xy[is.x.toFixed(4)] = is.y.toFixed(4);
        
        let t1 = di.t + Math.abs((is[ci] - di[ci]) / (di1[ci] - di[ci])) * (di1.t - di.t);
        let t2 = dj.t + Math.abs((is[cj] - dj[cj]) / (dj1[cj] - dj[cj])) * (dj1.t - dj.t);
        
        if (t1 > 1) t1 = 1;
        if (t2 > 1) t2 = 1;
        if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
          if (justCount) {
            res++;
          } else {
            res.push({
              x: is.x,
              y: is.y,
              t1: t1,
              t2: t2
            });
          }
        }
      }
    }
  }
  
  return res;
}

// Get point on bezier at parameter t - EXACT from Raphael's findDotsAtSegment
function findDotsAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t) {
  const t1 = 1 - t;
  const t13 = Math.pow(t1, 3);
  const t12 = Math.pow(t1, 2);
  const t2 = t * t;
  const t3 = t2 * t;
  const x = t13 * p1x + t12 * 3 * t * c1x + t1 * 3 * t * t * c2x + t3 * p2x;
  const y = t13 * p1y + t12 * 3 * t * c1y + t1 * 3 * t * t * c2y + t3 * p2y;
  const mx = p1x + 2 * t * (c1x - p1x) + t2 * (c2x - 2 * c1x + p1x);
  const my = p1y + 2 * t * (c1y - p1y) + t2 * (c2y - 2 * c1y + p1y);
  const nx = c1x + 2 * t * (c2x - c1x) + t2 * (p2x - 2 * c2x + c1x);
  const ny = c1y + 2 * t * (c2y - c1y) + t2 * (p2y - 2 * c2y + c1y);
  const ax = t1 * p1x + t * c1x;
  const ay = t1 * p1y + t * c1y;
  const cx = t1 * c2x + t * p2x;
  const cy = t1 * c2y + t * p2y;
  const alpha = (90 - Math.atan2(mx - nx, my - ny) * 180 / Math.PI);
  
  return {x: x, y: y, m: {x: mx, y: my}, n: {x: nx, y: ny}, start: {x: ax, y: ay}, end: {x: cx, y: cy}, alpha: alpha};
}

// Line-line intersection - EXACT from Raphael's intersect function
function intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  if (Math.max(x1, x2) < Math.min(x3, x4) ||
      Math.min(x1, x2) > Math.max(x3, x4) ||
      Math.max(y1, y2) < Math.min(y3, y4) ||
      Math.min(y1, y2) > Math.max(y3, y4)) {
    return;
  }
  
  const nx = (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4);
  const ny = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4);
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  
  if (!denominator) {
    return;
  }
  
  const px = nx / denominator;
  const py = ny / denominator;
  const px2 = +px.toFixed(2);
  const py2 = +py.toFixed(2);
  
  if (px2 < +Math.min(x1, x2).toFixed(2) ||
      px2 > +Math.max(x1, x2).toFixed(2) ||
      px2 < +Math.min(x3, x4).toFixed(2) ||
      px2 > +Math.max(x3, x4).toFixed(2) ||
      py2 < +Math.min(y1, y2).toFixed(2) ||
      py2 > +Math.max(y1, y2).toFixed(2) ||
      py2 < +Math.min(y3, y4).toFixed(2) ||
      py2 > +Math.max(y3, y4).toFixed(2)) {
    return;
  }
  
  return {x: px, y: py};
}

// Bezier length calculation - EXACT from Raphael
function bezlen(x1, y1, x2, y2, x3, y3, x4, y4, z) {
  if (z == null) {
    z = 1;
  }
  z = z > 1 ? 1 : z < 0 ? 0 : z;
  const z2 = z / 2;
  const n = 12;
  const Tvalues = [-0.1252, 0.1252, -0.3678, 0.3678, -0.5873, 0.5873, -0.7699, 0.7699, -0.9041, 0.9041, -0.9816, 0.9816];
  const Cvalues = [0.2491, 0.2491, 0.2335, 0.2335, 0.2032, 0.2032, 0.1601, 0.1601, 0.1069, 0.1069, 0.0472, 0.0472];
  let sum = 0;
  
  for (let i = 0; i < n; i++) {
    const ct = z2 * Tvalues[i] + z2;
    const xbase = base3(ct, x1, x2, x3, x4);
    const ybase = base3(ct, y1, y2, y3, y4);
    const comb = xbase * xbase + ybase * ybase;
    sum += Cvalues[i] * Math.sqrt(comb);
  }
  
  return z2 * sum;
}

function base3(t, p1, p2, p3, p4) {
  const t1 = -3 * p1 + 9 * p2 - 9 * p3 + 3 * p4;
  const t2 = t * t1 + 6 * p1 - 12 * p2 + 6 * p3;
  return t * t2 - 3 * p1 + 3 * p2;
}

// Path intersection - EXACT structure from diff.diff
function pathIntersection(path1, path2) {
  const p1 = path2curve(parsePathString(path1));
  const p2 = path2curve(parsePathString(path2));
  return interPathHelper(p1, p2);
}

function interPathHelper(path1, path2, justCount) {
  const intersections = [];
  
  for (let i = 0, ii = path1.length; i < ii; i++) {
    const seg1 = path1[i];
    if (seg1[0] !== "C") continue;
    
    for (let j = 0, jj = path2.length; j < jj; j++) {
      const seg2 = path2[j];
      if (seg2[0] !== "C") continue;
      
      const intr = findBezierIntersections(seg1, seg2, justCount);
      if (justCount) {
        intersections.push(intr);
      } else {
        for (let k = 0, kk = intr.length; k < kk; k++) {
          intr[k].segment1 = i;
          intr[k].segment2 = j;
          intr[k].bez1 = intr[k].t1;
          intr[k].bez2 = intr[k].t2;
        }
        intersections.push(...intr);
      }
    }
  }
  
  return intersections;
}

// Insert intersection points - EXACT from diff.diff
function insertIntersectionPoints(pathSegments, pathId, intersections) {
  intersections.forEach((intersection) => {
    const segment = intersection[`segment${pathId}`];
    const t = intersection[`bez${pathId}`];
    const splitSegmentArray = splitSegment(
      pathSegments[segment],
      t,
      intersection
    );
    
    pathSegments.splice(segment, 1, ...splitSegmentArray);
    
    // Update indices for remaining intersections
    intersections.forEach((int2) => {
      if (int2[`segment${pathId}`] > segment) {
        int2[`segment${pathId}`] += splitSegmentArray.length - 1;
      }
    });
  });
}

// Split segment - EXACT from diff.diff
function splitSegment(segment, t, intersection) {
  if (segment.items.length === 0) return [segment];
  
  const [x0, y0, x1, y1, x2, y2, x3, y3] = segment.items;
  
  // de Casteljau's algorithm
  const x01 = x0 + t * (x1 - x0);
  const y01 = y0 + t * (y1 - y0);
  const x11 = x1 + t * (x2 - x1);
  const y11 = y1 + t * (y2 - y1);
  const x21 = x2 + t * (x3 - x2);
  const y21 = y2 + t * (y3 - y2);
  
  const x02 = x01 + t * (x11 - x01);
  const y02 = y01 + t * (y11 - y01);
  const x12 = x11 + t * (x21 - x11);
  const y12 = y11 + t * (y21 - y11);
  
  const x03 = x02 + t * (x12 - x02);
  const y03 = y02 + t * (y12 - y02);
  
  const seg1 = {
    items: [x0, y0, x01, y01, x02, y02, x03, y03],
    intersection: true,
  };
  
  const seg2 = {
    items: [x03, y03, x12, y12, x21, y21, x3, y3],
    intersection: true,
  };
  
  // Preserve subpath markers
  if (segment.subPathStart) seg1.subPathStart = true;
  if (segment.subPathEnd) seg2.subPathEnd = true;
  if (segment.subPathId) {
    seg1.subPathId = segment.subPathId;
    seg2.subPathId = segment.subPathId;
  }
  
  return [seg1, seg2];
}

// Check if segment is inside path - EXACT from diff.diff
function isSegInsidePath(segment, pathString) {
  if (segment.items.length === 0) return false;
  
  // Check midpoint of segment
  const t = 0.5;
  const [x0, y0, x1, y1, x2, y2, x3, y3] = segment.items;
  
  // Calculate point on bezier at t=0.5
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  
  const x = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
  const y = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;
  
  return isPointInsidePath(pathString, x, y);
}

// Check if point is inside path - EXACT structure from diff.diff
function isPointInsidePath(path, x, y) {
  const pathArray = path2curve(parsePathString(path));
  let inside = false;
  
  for (let i = 0, ii = pathArray.length; i < ii; i++) {
    const seg = pathArray[i];
    if (seg[0] === "C") {
      // Simplified - treat bezier as line from start to end
      const y1 = seg[2];
      const y2 = seg[6];
      if ((y1 > y) !== (y2 > y)) {
        const x1 = seg[1];
        const x2 = seg[5];
        const slope = (x2 - x1) / (y2 - y1);
        if (x < slope * (y - y1) + x1) {
          inside = !inside;
        }
      }
    }
  }
  
  return inside;
}

// Build new path parts - EXACT from diff.diff
function buildNewPathParts(type, path1Segs, path2Segs, path1String, path2String) {
  const rules = {
    union: { 0: false, 1: false },
    difference: { 0: false, 1: true },
    intersection: { 0: true, 1: true },
  };
  
  const rule = rules[type];
  const newParts = [[], []];
  const inversions = [];
  
  // Process path1 segments
  path1Segs.forEach((segment) => {
    if (segment.items.length === 0) return;
    
    const isInside = isSegInsidePath(segment, path2String);
    const keep = rule[0] ? isInside : !isInside;
    
    if (keep) {
      newParts[0].push(segment);
    }
  });
  
  // Process path2 segments
  path2Segs.forEach((segment) => {
    if (segment.items.length === 0) return;
    
    const isInside = isSegInsidePath(segment, path1String);
    const keep = rule[1] ? isInside : !isInside;
    
    if (keep) {
      newParts[1].push(segment);
      if (rule[1] && type === 'difference') {
        inversions.push(segment);
      }
    }
  });
  
  return { newParts, inversions };
}

// Build part indexes - EXACT structure from diff.diff
function buildPartIndexes(parts) {
  const indexes = [];
  
  parts.forEach((part, partIndex) => {
    const index = [];
    let lastX = null, lastY = null;
    
    part.forEach((segment, segIndex) => {
      if (segment.items.length === 0) return;
      
      const x = segment.items[6];
      const y = segment.items[7];
      
      // Find connecting segments
      const connects = [];
      part.forEach((seg2, idx2) => {
        if (idx2 === segIndex || seg2.items.length === 0) return;
        
        const x2 = seg2.items[0];
        const y2 = seg2.items[1];
        
        if (Math.abs(x - x2) < 0.1 && Math.abs(y - y2) < 0.1) {
          connects.push(idx2);
        }
      });
      
      index.push({
        i: segIndex,
        x: x,
        y: y,
        connects: connects
      });
    });
    
    indexes.push(index);
  });
  
  return indexes;
}

// Build path - needs to use indexes for proper graph traversal
function buildPath(type, parts, indexes, inversions, startIndex, fix) {
  const result = [];
  const allParts = [...parts[0], ...parts[1]];
  const used = new Array(allParts.length).fill(false);
  
  while (true) {
    // Find unused segment
    let start = -1;
    for (let i = 0; i < allParts.length; i++) {
      if (!used[i] && allParts[i].items.length > 0) {
        start = i;
        break;
      }
    }
    
    if (start === -1) break;
    
    const path = [];
    let current = start;
    
    while (current !== -1 && !used[current]) {
      used[current] = true;
      path.push(allParts[current]);
      
      // Find next segment
      const endX = allParts[current].items[6];
      const endY = allParts[current].items[7];
      let next = -1;
      
      for (let i = 0; i < allParts.length; i++) {
        if (used[i] || allParts[i].items.length === 0) continue;
        
        const startX = allParts[i].items[0];
        const startY = allParts[i].items[1];
        
        if (Math.abs(endX - startX) < 0.1 && Math.abs(endY - startY) < 0.1) {
          next = i;
          break;
        }
      }
      
      current = next;
    }
    
    if (path.length > 0) {
      result.push(path);
    }
  }
  
  return result;
}

// Convert segments to path array - EXACT from diff.diff
function pathSegsToArr(segments) {
  const result = [];
  let firstPoint = true;
  
  segments.forEach((segment) => {
    if (Array.isArray(segment)) {
      // Handle subpath
      segment.forEach((seg, i) => {
        if (i === 0 && seg.items.length > 0) {
          result.push(["M", seg.items[0], seg.items[1]]);
        }
        if (seg.items.length > 0) {
          result.push(["C", ...seg.items.slice(2)]);
        }
      });
    } else {
      // Handle single segment
      if (firstPoint && segment.items.length > 0) {
        result.push(["M", segment.items[0], segment.items[1]]);
        firstPoint = false;
      }
      if (segment.items.length > 0) {
        result.push(["C", ...segment.items.slice(2)]);
      }
    }
  });
  
  return result;
}

// Main boolean operation function - EXACT from diff.diff structure
function operateBool(type, path1, path2, fix) {
  const path1Array = parsePathString(path1);
  const path2Array = parsePathString(path2);
  
  const path1Curved = path2curve(path1Array);
  const path2Curved = path2curve(path2Array);
  
  console.log('[DiffDiff] Curved paths:', path1Curved.length, path2Curved.length);
  console.log('[DiffDiff] First curved segment path1:', path1Curved[0]);
  console.log('[DiffDiff] First curved segment path2:', path2Curved[0]);
  
  const path1Segs = generatePathSegments(path1Curved);
  const path2Segs = generatePathSegments(path2Curved);
  
  console.log('[DiffDiff] Generated segments:', path1Segs.length, path2Segs.length);
  
  markSubpathEndings(path1Segs, path2Segs);
  
  const intersections = pathIntersection(path1, path2);
  
  console.log('[DiffDiff] Found intersections:', intersections.length);
  intersections.forEach((int, i) => {
    console.log(`[DiffDiff] Intersection ${i}:`, int);
  });
  
  if (intersections.length > 0) {
    insertIntersectionPoints(path1Segs, 1, intersections);
    insertIntersectionPoints(path2Segs, 2, intersections);
  }
  
  const { newParts, inversions } = buildNewPathParts(
    type,
    path1Segs,
    path2Segs,
    path1,
    path2
  );
  
  const indexes = buildPartIndexes(newParts);
  const result = buildPath(type, newParts, indexes, inversions, 0, fix);
  
  return {
    data: pathSegsToArr(result),
    intersections: intersections.length,
  };
}

// Convert element to path
function elementToPath(element) {
  switch (element.type) {
    case 'rectangle':
      const { x, y, width, height } = element;
      return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
    
    case 'ellipse':
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const rx = element.width / 2;
      const ry = element.height / 2;
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx - rx} ${cy} Z`;
      
    case 'diamond':
      const dcx = element.x + element.width / 2;
      const dcy = element.y + element.height / 2;
      return `M ${dcx} ${element.y} L ${element.x + element.width} ${dcy} L ${dcx} ${element.y + element.height} L ${element.x} ${dcy} Z`;
      
    case 'line':
      if (element.points && element.points.length >= 3) {
        let path = `M ${element.x + element.points[0][0]} ${element.y + element.points[0][1]}`;
        for (let i = 1; i < element.points.length; i++) {
          path += ` L ${element.x + element.points[i][0]} ${element.y + element.points[i][1]}`;
        }
        const first = element.points[0];
        const last = element.points[element.points.length - 1];
        const isClosed = Math.abs(first[0] - last[0]) < 1 && Math.abs(first[1] - last[1]) < 1;
        if (isClosed) path += ' Z';
        return path;
      }
      throw new Error('Line must have at least 3 points');
      
    default:
      throw new Error(`Unsupported element type: ${element.type}`);
  }
}

// Get bounds from path data
function getPathBounds(pathData) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  pathData.forEach(segment => {
    if (segment[0] === 'M' || segment[0] === 'L') {
      minX = Math.min(minX, segment[1]);
      maxX = Math.max(maxX, segment[1]);
      minY = Math.min(minY, segment[2]);
      maxY = Math.max(maxY, segment[2]);
    } else if (segment[0] === 'C') {
      for (let i = 1; i < segment.length; i += 2) {
        minX = Math.min(minX, segment[i]);
        maxX = Math.max(maxX, segment[i]);
        minY = Math.min(minY, segment[i + 1]);
        maxY = Math.max(maxY, segment[i + 1]);
      }
    }
  });
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

// Convert path data to Excalidraw points
function pathDataToPoints(pathData, bounds) {
  const points = [];
  let currentX = 0, currentY = 0;
  
  pathData.forEach(segment => {
    if (segment[0] === 'M') {
      currentX = segment[1];
      currentY = segment[2];
      points.push([currentX - bounds.x, currentY - bounds.y]);
    } else if (segment[0] === 'L') {
      currentX = segment[1];
      currentY = segment[2];
      points.push([currentX - bounds.x, currentY - bounds.y]);
    } else if (segment[0] === 'C') {
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;
        
        const x = mt3 * currentX + 
                  3 * mt2 * t * segment[1] + 
                  3 * mt * t2 * segment[3] + 
                  t3 * segment[5];
        const y = mt3 * currentY + 
                  3 * mt2 * t * segment[2] + 
                  3 * mt * t2 * segment[4] + 
                  t3 * segment[6];
        
        points.push([x - bounds.x, y - bounds.y]);
      }
      currentX = segment[5];
      currentY = segment[6];
    }
  });
  
  if (points.length > 2) {
    const first = points[0];
    const last = points[points.length - 1];
    const distance = Math.sqrt(
      Math.pow(first[0] - last[0], 2) + 
      Math.pow(first[1] - last[1], 2)
    );
    
    if (distance > 0.1) {
      points.push([first[0], first[1]]);
    }
  }
  
  return points;
}

// Generate ID
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Main entry point
function performExcalidrawBooleanOpDiffDiff(elements, operation) {
  console.log('[DiffDiff] Starting operation:', operation, 'on', elements.length, 'elements');
  
  if (elements.length !== 2) {
    throw new Error('Boolean operations require exactly 2 elements');
  }
  
  try {
    const path1 = elementToPath(elements[0]);
    const path2 = elementToPath(elements[1]);
    
    console.log('[DiffDiff] Path 1:', path1);
    console.log('[DiffDiff] Path 2:', path2);
    
    // Check path parsing
    const path1Array = parsePathString(path1);
    const path2Array = parsePathString(path2);
    console.log('[DiffDiff] Parsed path 1:', path1Array);
    console.log('[DiffDiff] Parsed path 2:', path2Array);
    
    let result;
    switch (operation) {
      case 'union':
        result = operateBool('union', path1, path2, false);
        break;
      case 'intersection':
        result = operateBool('intersection', path1, path2, false);
        break;
      case 'difference':
        result = operateBool('difference', path1, path2, false);
        break;
      case 'exclusion':
        const u = operateBool('union', path1, path2, false);
        const i = operateBool('intersection', path1, path2, false);
        if (i.data.length === 0) {
          result = u;
        } else {
          const uPath = pathSegsToArr(u.data);
          const iPath = pathSegsToArr(i.data);
          result = operateBool('difference', uPath, iPath, false);
        }
        break;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
    
    console.log('[DiffDiff] Result:', result);
    
    if (!result || !result.data || result.data.length === 0) {
      throw new Error('Operation resulted in empty shape');
    }
    
    const bounds = getPathBounds(result.data);
    const points = pathDataToPoints(result.data, bounds);
    
    console.log('[DiffDiff] Result bounds:', bounds);
    console.log('[DiffDiff] Result points:', points);
    
    const firstElement = elements[0];
    
    return {
      id: generateId(),
      type: 'line',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      angle: 0,
      strokeColor: firstElement.strokeColor || '#000000',
      backgroundColor: firstElement.backgroundColor || 'transparent',
      fillStyle: firstElement.fillStyle || 'solid',
      strokeWidth: firstElement.strokeWidth || 1,
      strokeStyle: firstElement.strokeStyle || 'solid',
      roughness: firstElement.roughness || 1,
      opacity: firstElement.opacity || 100,
      points: points,
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
      versionNonce: Math.floor(Math.random() * 2000000000),
      updated: Date.now(),
      seed: Math.floor(Math.random() * 2000000000),
      locked: false,
      isDeleted: false,
      boundElements: [],
      link: null,
      customData: null,
      groupIds: [],
      roundness: null,
      frameId: null,
      index: 'a0'
    };
  } catch (error) {
    console.error('[DiffDiff] Error:', error);
    throw error;
  }
};

  // Expose to window
  window.performExcalidrawBooleanOpDiffDiff = performExcalidrawBooleanOpDiffDiff;
  console.log('[DiffDiff] Function defined:', typeof window.performExcalidrawBooleanOpDiffDiff);
  console.log('[DiffDiff] Attached to window:', window.performExcalidrawBooleanOpDiffDiff === performExcalidrawBooleanOpDiffDiff);
})();