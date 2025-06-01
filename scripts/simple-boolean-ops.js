// Boolean Operations using diff.diff logic
// This implements the exact algorithm from diff.diff

// Convert Excalidraw element to SVG path string
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

// Parse SVG path string to array format
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

// Convert path to absolute coordinates
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

// Convert path to curves only
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

// Helper functions for path conversion
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

function a2c(x1, y1, rx, ry, angle, large_arc_flag, sweep_flag, x2, y2) {
  // Simplified arc to cubic conversion
  const _120 = Math.PI * 120 / 180;
  const rad = Math.PI / 180 * (+angle || 0);
  
  const xy = rotate(x1, y1, -rad);
  x1 = xy.x;
  y1 = xy.y;
  const xy2 = rotate(x2, y2, -rad);
  x2 = xy2.x;
  y2 = xy2.y;
  
  const x = (x1 - x2) / 2;
  const y = (y1 - y2) / 2;
  let h = (x * x) / (rx * rx) + (y * y) / (ry * ry);
  if (h > 1) {
    h = Math.sqrt(h);
    rx = h * rx;
    ry = h * ry;
  }
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const k = (large_arc_flag == sweep_flag ? -1 : 1) *
          Math.sqrt(Math.abs((rx2 * ry2 - rx2 * y * y - ry2 * x * x) / (rx2 * y * y + ry2 * x * x)));
  const cx = k * rx * y / ry + (x1 + x2) / 2;
  const cy = k * -ry * x / rx + (y1 + y2) / 2;
  const f1 = Math.asin(((y1 - cy) / ry).toFixed(9));
  const f2 = Math.asin(((y2 - cy) / ry).toFixed(9));
  
  let df = f2 - f1;
  if (df < 0 && sweep_flag) {
    df += Math.PI * 2;
  } else if (df > 0 && !sweep_flag) {
    df -= Math.PI * 2;
  }
  
  const c1 = Math.cos(f1);
  const s1 = Math.sin(f1);
  const c2 = Math.cos(f2);
  const s2 = Math.sin(f2);
  const t = Math.tan(df / 4);
  const hx = 4 / 3 * rx * t;
  const hy = 4 / 3 * ry * t;
  const m1 = [x1, y1];
  const m2 = [x1 + hx * s1, y1 - hy * c1];
  const m3 = [x2 + hx * s2, y2 - hy * c2];
  const m4 = [x2, y2];
  m2[0] = 2 * m1[0] - m2[0];
  m2[1] = 2 * m1[1] - m2[1];
  
  const res = [m2, m3, m4].join().split(",");
  const newres = [];
  for (let i = 0, ii = res.length; i < ii; i++) {
    newres[i] = i % 2 ? rotate(res[i - 1], res[i], rad).y : rotate(res[i], res[i + 1], rad).x;
  }
  return newres;
}

function rotate(x, y, rad) {
  const X = x * Math.cos(rad) - y * Math.sin(rad);
  const Y = x * Math.sin(rad) + y * Math.cos(rad);
  return {x: X, y: Y};
}

// Get bounding box of a bezier curve
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
    width: maxX - minX,
    height: maxY - minY
  };
}

// Check if two bounding boxes intersect
function isBBoxIntersect(bbox1, bbox2) {
  return bbox1.x <= bbox2.x + bbox2.width &&
         bbox1.x + bbox1.width >= bbox2.x &&
         bbox1.y <= bbox2.y + bbox2.height &&
         bbox1.y + bbox1.height >= bbox2.y;
}

// Subdivide a bezier curve at t=0.5
function subdivideBezier(x0, y0, x1, y1, x2, y2, x3, y3) {
  const t = 0.5;
  
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
  
  return {
    left: [x0, y0, x01, y01, x02, y02, x03, y03],
    right: [x03, y03, x12, y12, x21, y21, x3, y3]
  };
}

// Find intersections between two bezier curves with proper t parameters
function bezierIntersect(bez1, bez2, threshold = 0.5, t1min = 0, t1max = 1, t2min = 0, t2max = 1) {
  const bbox1 = bezierBBox(...bez1);
  const bbox2 = bezierBBox(...bez2);
  
  if (!isBBoxIntersect(bbox1, bbox2)) {
    return [];
  }
  
  // If bboxes are small enough, check for intersection
  if (Math.max(bbox1.width, bbox1.height, bbox2.width, bbox2.height) < threshold) {
    // Use line approximation for intersection
    const x1a = bez1[0], y1a = bez1[1];
    const x1b = bez1[6], y1b = bez1[7];
    const x2a = bez2[0], y2a = bez2[1];
    const x2b = bez2[6], y2b = bez2[7];
    
    const denom = (x1a - x1b) * (y2a - y2b) - (y1a - y1b) * (x2a - x2b);
    if (Math.abs(denom) < 1e-10) return [];
    
    const t1 = ((x1a - x2a) * (y2a - y2b) - (y1a - y2a) * (x2a - x2b)) / denom;
    const t2 = ((x1a - x2a) * (y1a - y1b) - (y1a - y2a) * (x1a - x1b)) / denom;
    
    if (t1 >= -0.1 && t1 <= 1.1 && t2 >= -0.1 && t2 <= 1.1) {
      // Calculate actual intersection point on the curves
      const t1actual = (t1min + t1max) / 2;
      const t2actual = (t2min + t2max) / 2;
      
      // Calculate point on first bezier at t1actual
      const mt1 = 1 - t1actual;
      const mt1_2 = mt1 * mt1;
      const mt1_3 = mt1_2 * mt1;
      const t1_2 = t1actual * t1actual;
      const t1_3 = t1_2 * t1actual;
      
      const x = mt1_3 * bez1[0] + 3 * mt1_2 * t1actual * bez1[2] + 3 * mt1 * t1_2 * bez1[4] + t1_3 * bez1[6];
      const y = mt1_3 * bez1[1] + 3 * mt1_2 * t1actual * bez1[3] + 3 * mt1 * t1_2 * bez1[5] + t1_3 * bez1[7];
      
      return [{
        x: x,
        y: y,
        t1: t1actual,
        t2: t2actual
      }];
    }
    return [];
  }
  
  // Subdivide both curves
  const split1 = subdivideBezier(...bez1);
  const split2 = subdivideBezier(...bez2);
  const t1mid = (t1min + t1max) / 2;
  const t2mid = (t2min + t2max) / 2;
  
  return [
    ...bezierIntersect(split1.left, split2.left, threshold, t1min, t1mid, t2min, t2mid),
    ...bezierIntersect(split1.left, split2.right, threshold, t1min, t1mid, t2mid, t2max),
    ...bezierIntersect(split1.right, split2.left, threshold, t1mid, t1max, t2min, t2mid),
    ...bezierIntersect(split1.right, split2.right, threshold, t1mid, t1max, t2mid, t2max)
  ];
}

// Find all intersections between two paths
function pathIntersection(path1, path2) {
  const intersections = [];
  const p1 = path2curve(parsePathString(path1));
  const p2 = path2curve(parsePathString(path2));
  
  // Map curved path indices to segment indices
  let segIndex1 = 0;
  let segIndex2 = 0;
  
  for (let i = 0; i < p1.length; i++) {
    if (p1[i][0] === "M") continue; // Skip moveto commands
    if (p1[i][0] !== "C") continue;
    
    const bez1 = [p1[i][1], p1[i][2], p1[i][3], p1[i][4], p1[i][5], p1[i][6], p1[i][7], p1[i][8]];
    segIndex2 = 0;
    
    for (let j = 0; j < p2.length; j++) {
      if (p2[j][0] === "M") continue; // Skip moveto commands  
      if (p2[j][0] !== "C") continue;
      
      const bez2 = [p2[j][1], p2[j][2], p2[j][3], p2[j][4], p2[j][5], p2[j][6], p2[j][7], p2[j][8]];
      
      const ints = bezierIntersect(bez1, bez2);
      ints.forEach(int => {
        int.segment1 = segIndex1;
        int.segment2 = segIndex2;
      });
      intersections.push(...ints);
      segIndex2++;
    }
    segIndex1++;
  }
  
  console.log('[Boolean Ops] Found', intersections.length, 'intersections');
  return intersections;
}

// Split a segment at parameter t
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
    intersectionInfo: intersection,
    subPathStart: segment.subPathStart,
    subPathEnd: false,
    subPathId: segment.subPathId
  };
  
  const seg2 = {
    items: [x03, y03, x12, y12, x21, y21, x3, y3],
    intersection: true,
    intersectionInfo: intersection,
    subPathStart: false,
    subPathEnd: segment.subPathEnd,
    subPathId: segment.subPathId
  };
  
  return [seg1, seg2];
}

// Insert intersection points into path segments
function insertIntersectionPoints(pathSegments, pathId, intersections) {
  // Sort intersections by segment index and t value
  const relevantInts = intersections
    .filter(int => int[`segment${pathId}`] !== undefined)
    .sort((a, b) => {
      const segDiff = a[`segment${pathId}`] - b[`segment${pathId}`];
      if (segDiff !== 0) return segDiff;
      return (a[`t${pathId}`] || 0.5) - (b[`t${pathId}`] || 0.5);
    });
  
  // Process intersections in reverse order to maintain indices
  for (let i = relevantInts.length - 1; i >= 0; i--) {
    const int = relevantInts[i];
    const segIndex = int[`segment${pathId}`];
    const t = int[`t${pathId}`] || 0.5;
    
    if (segIndex < pathSegments.length) {
      const splits = splitSegment(pathSegments[segIndex], t, int);
      
      // Mark the intersection point on both split segments
      splits[0].intersectionEnd = true;
      splits[1].intersectionStart = true;
      pathSegments.splice(segIndex, 1, ...splits);
      
      // Update indices for remaining intersections
      for (let j = i - 1; j >= 0; j--) {
        if (relevantInts[j][`segment${pathId}`] === segIndex) {
          // Adjust t value for the same segment
          const oldT = relevantInts[j][`t${pathId}`];
          if (oldT > t) {
            relevantInts[j][`t${pathId}`] = (oldT - t) / (1 - t);
            relevantInts[j][`segment${pathId}`]++;
          } else {
            relevantInts[j][`t${pathId}`] = oldT / t;
          }
        } else if (relevantInts[j][`segment${pathId}`] > segIndex) {
          relevantInts[j][`segment${pathId}`]++;
        }
      }
    }
  }
}

// Generate path segments from curved path
function generatePathSegments(path) {
  const segments = [];
  
  path.forEach((pathCommand, i) => {
    let seg = {
      items: [],
      subPathStart: false,
      subPathEnd: false,
      subPathId: null
    };
    
    if (pathCommand[0] !== "M") {
      const prevCommand = path[i - 1];
      const prevCommandLength = prevCommand.length;
      
      seg = {
        items: [
          prevCommand[prevCommandLength - 2],
          prevCommand[prevCommandLength - 1],
          ...pathCommand.slice(1),
        ],
        subPathStart: false,
        subPathEnd: false,
        subPathId: null
      };
    }
    
    if (i > 0) {
      segments.push(seg);
    }
  });
  
  return segments;
}

// Mark subpath start and end points
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

// Check if a point is inside a path
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

// Check if a segment is inside a path
function isSegInsidePath(segment, path2) {
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
  
  return isPointInsidePath(path2, x, y);
}

// Build new path parts based on boolean operation rules
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
  path1Segs.forEach((segment, idx) => {
    if (segment.items.length === 0) return;
    
    const isInside = isSegInsidePath(segment, path2String);
    const keep = rule[0] ? isInside : !isInside;
    
    if (keep) {
      segment.pathId = 1;
      segment.originalIndex = idx;
      newParts[0].push(segment);
    }
  });
  
  // Process path2 segments
  path2Segs.forEach((segment, idx) => {
    if (segment.items.length === 0) return;
    
    const isInside = isSegInsidePath(segment, path1String);
    const keep = rule[1] ? isInside : !isInside;
    
    if (keep) {
      segment.pathId = 2;
      segment.originalIndex = idx;
      newParts[1].push(segment);
      
      // Track inversions for difference operation
      if (rule[1] && type === 'difference') {
        inversions.push(segment);
      }
    }
  });
  
  return { newParts, inversions };
}

// Build part indexes for path connectivity
function buildPartIndexes(parts, intersections) {
  const indexes = [];
  const EPSILON = 0.1;
  
  // Create index for each part (path)
  parts.forEach((pathParts, pathIndex) => {
    const index = {
      segments: [],
      connections: {}
    };
    
    pathParts.forEach((segment, segIndex) => {
      if (segment.items.length === 0) return;
      
      const segInfo = {
        index: segIndex,
        segment: segment,
        start: [segment.items[0], segment.items[1]],
        end: [segment.items[6], segment.items[7]],
        connects: []
      };
      
      // Check if this segment ends at an intersection
      if (segment.intersection && segment.intersectionInfo) {
        const intInfo = segment.intersectionInfo;
        segInfo.intersectionEnd = intInfo;
      }
      
      index.segments.push(segInfo);
    });
    
    // Build connectivity between segments
    index.segments.forEach((seg1, idx1) => {
      index.segments.forEach((seg2, idx2) => {
        if (idx1 === idx2) return;
        
        const dist = Math.sqrt(
          Math.pow(seg1.end[0] - seg2.start[0], 2) + 
          Math.pow(seg1.end[1] - seg2.start[1], 2)
        );
        
        if (dist < EPSILON) {
          seg1.connects.push(idx2);
        }
      });
    });
    
    indexes.push(index);
  });
  
  return indexes;
}

// Build the actual path by traversing segments
function buildPath(type, parts, indexes, inversions, startIndex = 0) {
  const paths = [];
  const allSegments = [];
  
  // Collect all segments from both parts
  parts.forEach((pathParts, partIndex) => {
    pathParts.forEach((segment, segIndex) => {
      if (segment.items.length > 0) {
        allSegments.push({
          segment: segment,
          partIndex: partIndex,
          segIndex: segIndex,
          used: false
        });
      }
    });
  });
  
  // Build paths by following connections
  while (true) {
    // Find an unused segment to start
    let startSeg = null;
    for (let i = 0; i < allSegments.length; i++) {
      if (!allSegments[i].used) {
        startSeg = allSegments[i];
        break;
      }
    }
    
    if (!startSeg) break; // All segments used
    
    const currentPath = [];
    let current = startSeg;
    const visited = new Set();
    
    // Trace path from this starting segment
    while (current && !current.used) {
      current.used = true;
      currentPath.push(current.segment);
      
      // Find next segment
      const currentEnd = [current.segment.items[6], current.segment.items[7]];
      let nextSeg = null;
      let minDist = 0.1; // threshold
      
      // First, look for connecting segment from same path
      for (let i = 0; i < allSegments.length; i++) {
        if (allSegments[i].used) continue;
        
        const seg = allSegments[i];
        const segStart = [seg.segment.items[0], seg.segment.items[1]];
        const dist = Math.sqrt(
          Math.pow(currentEnd[0] - segStart[0], 2) + 
          Math.pow(currentEnd[1] - segStart[1], 2)
        );
        
        if (dist < minDist) {
          // At intersection, apply boolean operation rules
          if (current.segment.intersectionEnd && seg.segment.intersectionStart) {
            // We're at an intersection - decide which path to follow
            if (type === 'union') {
              // For union, prefer segments from different paths
              if (seg.partIndex !== current.partIndex) {
                nextSeg = seg;
                break;
              }
            } else if (type === 'intersection') {
              // For intersection, prefer segments from same path
              if (seg.partIndex === current.partIndex) {
                nextSeg = seg;
                break;
              }
            } else if (type === 'difference') {
              // For difference, follow specific rules
              if (current.partIndex === 0 && seg.partIndex !== current.partIndex) {
                // From path1, switch to path2
                nextSeg = seg;
                break;
              } else if (current.partIndex === 1 && seg.partIndex === current.partIndex) {
                // From path2, stay on path2
                nextSeg = seg;
                break;
              }
            }
          } else if (seg.partIndex === current.partIndex) {
            // Not at intersection, prefer same path
            nextSeg = seg;
          } else if (!nextSeg) {
            // If no same-path segment found, consider other path
            nextSeg = seg;
          }
        }
      }
      
      current = nextSeg;
    }
    
    if (currentPath.length > 0) {
      paths.push(currentPath);
    }
  }
  
  return paths;
}

// Convert path segments to array format
function pathSegsToArr(paths) {
  const result = [];
  
  paths.forEach((path, pathIndex) => {
    if (path.length === 0) return;
    
    let firstInPath = true;
    let pathStartX = null, pathStartY = null;
    let lastX = null, lastY = null;
    
    path.forEach((segment) => {
      if (segment.items.length > 0) {
        if (firstInPath) {
          pathStartX = segment.items[0];
          pathStartY = segment.items[1];
          result.push(["M", pathStartX, pathStartY]);
          firstInPath = false;
        }
        result.push(["C", ...segment.items.slice(2)]);
        lastX = segment.items[6];
        lastY = segment.items[7];
      }
    });
    
    // Close path if endpoints are close
    if (pathStartX !== null && lastX !== null) {
      const dist = Math.sqrt(
        Math.pow(lastX - pathStartX, 2) + 
        Math.pow(lastY - pathStartY, 2)
      );
      if (dist < 1) {
        result.push(["Z"]);
      }
    }
  });
  
  return result;
}

// Convert path array to string
function pathArrayToString(pathArray) {
  let str = "";
  pathArray.forEach((cmd) => {
    str += cmd[0];
    for (let i = 1; i < cmd.length; i++) {
      str += cmd[i];
      if (i < cmd.length - 1) str += " ";
    }
    str += " ";
  });
  return str;
}

// Main boolean operation function
function operateBool(type, path1, path2) {
  const path1Array = parsePathString(path1);
  const path2Array = parsePathString(path2);
  
  const path1Curved = path2curve(path1Array);
  const path2Curved = path2curve(path2Array);
  
  const path1Segs = generatePathSegments(path1Curved);
  const path2Segs = generatePathSegments(path2Curved);
  
  // Find intersections between the two paths
  const intersections = pathIntersection(path1, path2);
  
  // Insert intersection points into both paths
  if (intersections.length > 0) {
    console.log('[Boolean Ops] Inserting intersections into paths');
    insertIntersectionPoints(path1Segs, 1, intersections);
    insertIntersectionPoints(path2Segs, 2, intersections);
    console.log('[Boolean Ops] Path1 segments after split:', path1Segs.length);
    console.log('[Boolean Ops] Path2 segments after split:', path2Segs.length);
  }
  
  // Mark subpath endings
  markSubpathEndings(path1Segs, path2Segs);
  
  const { newParts, inversions } = buildNewPathParts(type, path1Segs, path2Segs, path1, path2);
  console.log('[Boolean Ops] New parts:', newParts[0].length, 'from path1,', newParts[1].length, 'from path2');
  
  // Build part indexes for connectivity
  const indexes = buildPartIndexes(newParts, intersections);
  
  // Build the final path
  const paths = buildPath(type, newParts, indexes, inversions);
  console.log('[Boolean Ops] Built', paths.length, 'paths');
  paths.forEach((path, idx) => {
    console.log(`[Boolean Ops] Path ${idx}: ${path.length} segments`);
  });
  
  return {
    data: pathSegsToArr(paths),
    intersections: intersections.length
  };
}

// Boolean operation functions
function union(path1, path2) {
  return operateBool("union", path1, path2);
}

function difference(path1, path2) {
  return operateBool("difference", path1, path2);
}

function intersection(path1, path2) {
  return operateBool("intersection", path1, path2);
}

function exclusion(path1, path2) {
  // Exclusion is (A ∪ B) - (A ∩ B)
  const u = union(path1, path2);
  const i = intersection(path1, path2);
  
  if (i.data.length === 0) {
    return u;
  }
  
  const uPath = pathArrayToString(u.data);
  const iPath = pathArrayToString(i.data);
  
  return difference(uPath, iPath);
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
      // For cubic bezier, check all control points and end point
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
      // Sample the cubic bezier at several points
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
  
  // Ensure the path is closed if needed
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

// Generate a random ID
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Main entry point for boolean operations
window.performExcalidrawBooleanOp = function(elements, operation) {
  console.log('[Boolean Ops] Starting operation:', operation, 'on', elements.length, 'elements');
  
  if (elements.length !== 2) {
    throw new Error('Boolean operations require exactly 2 elements');
  }
  
  try {
    // Convert elements to SVG paths
    const path1 = elementToPath(elements[0]);
    const path2 = elementToPath(elements[1]);
    
    console.log('[Boolean Ops] Path 1:', path1);
    console.log('[Boolean Ops] Path 2:', path2);
    
    // Perform the operation
    let result;
    switch (operation) {
      case 'union':
        result = union(path1, path2);
        break;
      case 'intersection':
        result = intersection(path1, path2);
        break;
      case 'difference':
        result = difference(path1, path2);
        break;
      case 'exclusion':
        result = exclusion(path1, path2);
        break;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
    
    console.log('[Boolean Ops] Result:', result);
    
    if (!result || !result.data || result.data.length === 0) {
      throw new Error('Operation resulted in empty shape');
    }
    
    // Get bounds and convert to Excalidraw format
    const bounds = getPathBounds(result.data);
    const points = pathDataToPoints(result.data, bounds);
    
    console.log('[Boolean Ops] Result bounds:', bounds);
    console.log('[Boolean Ops] Result points:', points);
    
    // Create new element
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
    console.error('[Boolean Ops] Error:', error);
    throw error;
  }
};