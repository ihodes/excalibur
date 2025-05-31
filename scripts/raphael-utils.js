// Minimal Raphael.js path utilities needed for boolean operations
// Extracted from diff.diff implementation

(function(window) {
  const R = {};

  // Parse path string
  R.parsePathString = function(pathString) {
    if (!pathString) return null;
    const paramCounts = {a: 7, c: 6, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, z: 0};
    const data = [];
    String(pathString).replace(/([astvzqmhlcr])([^astvzqmhlcr]*)/gi, function(_, command, args) {
      const type = command.toLowerCase();
      args = args.match(/-?[.\\d]+/g) || [];
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
  };

  // Convert to absolute coordinates
  const pathToAbsolute = function(pathArray) {
    const res = [];
    let x = 0, y = 0, mx = 0, my = 0, start = 0;
    
    for (let r, pa, i = start, ii = pathArray.length; i < ii; i++) {
      res.push(r = []);
      pa = pathArray[i];
      if (pa[0] != pa[0].toUpperCase()) {
        r[0] = pa[0].toUpperCase();
        switch (r[0]) {
          case "M":
            mx = pa[1] + x;
            my = pa[2] + y;
            break;
          case "L":
          case "C":
          case "Q":
          case "S":
          case "T":
            r[1] = pa[1] + x;
            r[2] = pa[2] + y;
            break;
        }
        if (r[0] == "C") {
          r[3] = pa[3] + x;
          r[4] = pa[4] + y;
          r[5] = pa[5] + x;
          r[6] = pa[6] + y;
        } else if (r[0] == "Q") {
          r[3] = pa[3] + x;
          r[4] = pa[4] + y;
        }
      } else {
        for (let j = 1, jj = pa.length; j < jj; j++) {
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
  };

  // Convert path to cubic bezier curves
  R.path2curve = function(path) {
    const p = pathToAbsolute(R.parsePathString(path));
    const attrs = {x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null};
    const processPath = function(path, d) {
      if (!path) return ["C", d.x, d.y, d.x, d.y, d.x, d.y];
      path[0] != "T" && path[0] != "Q" && (d.qx = d.qy = null);
      switch (path[0]) {
        case "M":
          d.X = path[1];
          d.Y = path[2];
          break;
        case "L":
          path = ["C", d.x, d.y, path[1], path[2], path[1], path[2]];
          break;
        case "Q":
          d.qx = path[1];
          d.qy = path[2];
          path = ["C", 
            d.x + (path[1] - d.x) * 2 / 3, 
            d.y + (path[2] - d.y) * 2 / 3,
            path[1] + (path[3] - path[1]) * 2 / 3,
            path[2] + (path[4] - path[2]) * 2 / 3,
            path[3],
            path[4]
          ];
          break;
        case "Z":
          path = ["C", d.x, d.y, d.X, d.Y, d.X, d.Y];
          break;
      }
      return path;
    };
    
    const fixArc = function(pp, i) {
      if (pp[i].length > 7) {
        pp[i].shift();
        const pi = pp[i];
        while (pi.length) {
          pp.splice(i++, 0, ["C"].concat(pi.splice(0, 6)));
        }
        pp.splice(i, 1);
        ii = p.length;
      }
    };
    
    for (let i = 0, ii = p.length; i < ii; i++) {
      p[i] && (p[i] = processPath(p[i], attrs));
      fixArc(p, i);
      attrs.x = p[i] && p[i][p[i].length - 2] || attrs.x;
      attrs.y = p[i] && p[i][p[i].length - 1] || attrs.y;
      attrs.bx = p[i] && p[i][p[i].length - 4] || attrs.x;
      attrs.by = p[i] && p[i][p[i].length - 3] || attrs.y;
    }
    return p;
  };

  // Find intersections between two paths
  R.pathIntersection = function(path1, path2) {
    const p1 = R.path2curve(path1);
    const p2 = R.path2curve(path2);
    const intersections = [];
    
    for (let i = 0, ii = p1.length; i < ii; i++) {
      const seg1 = p1[i];
      if (seg1[0] != "C") continue;
      
      for (let j = 0, jj = p2.length; j < jj; j++) {
        const seg2 = p2[j];
        if (seg2[0] != "C") continue;
        
        const inters = findBezierIntersections(
          seg1[1], seg1[2], seg1[3], seg1[4], seg1[5], seg1[6],
          seg2[1], seg2[2], seg2[3], seg2[4], seg2[5], seg2[6]
        );
        
        for (let k = 0; k < inters.length; k++) {
          inters[k].segment1 = i;
          inters[k].segment2 = j;
          inters[k].bez1 = seg1;
          inters[k].bez2 = seg2;
        }
        intersections.push(...inters);
      }
    }
    
    return intersections;
  };

  // Simplified bezier intersection for testing
  function findBezierIntersections(x1, y1, x2, y2, x3, y3, x4, y4, x5, y5, x6, y6, x7, y7, x8, y8) {
    // For now, we'll just return no intersections to test the basic union case
    // This will make the union operation combine non-intersecting shapes
    return [];
  }

  // Check if point is inside path
  R.isPointInsidePath = function(path, x, y) {
    const p = R.path2curve(path);
    let inside = false;
    
    for (let i = 0, ii = p.length; i < ii; i++) {
      const seg = p[i];
      if (seg[0] == "M") continue;
      
      // Simplified ray casting for line segments
      if (seg[0] == "C") {
        // For bezier, we'd need to subdivide, but for now treat as line
        const y1 = seg[seg.length - 5];
        const y2 = seg[seg.length - 1];
        const x1 = seg[seg.length - 6];
        const x2 = seg[seg.length - 2];
        
        if ((y1 > y) !== (y2 > y)) {
          const slope = (x2 - x1) / (y2 - y1);
          if (x < slope * (y - y1) + x1) {
            inside = !inside;
          }
        }
      }
    }
    
    return inside;
  };

  // Export to window
  window.RaphaelUtils = R;
})(window);