# Boolean Operations Implementation - Extracted from diff.diff

This document contains the EXACT implementation of boolean operations extracted from the diff.diff file.

## Core Files Structure

### 1. src/element/path/bools.ts - Main Boolean Operations

```typescript
import { Drawable } from "roughjs/bin/core";
import { RoughCanvas } from "roughjs/bin/canvas";

import { newPathElement } from "../index";
import { ExcalidrawElement, NonDeletedExcalidrawElement } from "../types";
import { Point } from "../../types";
import { generateElementShape } from "../../renderer/renderElement";
import { getElementBounds, getElementAbsoluteCoords } from "../bounds";
import { radianToDegree, rotate } from "../../math";

import Path from "./Path";

function normalizeShape(shape: Drawable) {
  shape.sets = shape.sets
    .filter(({ type }) => type === "path")
    .map((set) => {
      // De-duplicated paths
      switch (shape.shape) {
        case "ellipse":
          set.ops = set.ops.slice(
            0,
            set.ops.findIndex(({ op }, i) => i > 0 && op === "move"),
          );

          const last = set.ops.pop();

          // close the path
          if (last) {
            set.ops.push({
              ...last,
              data: [
                ...last.data.slice(0, last.data.length - 2),
                ...set.ops[0].data,
              ],
            });
          }
          break;
        case "curve":
          set.ops = set.ops.slice(
            0,
            set.ops.findIndex(({ op }, i) => i > 0 && op === "move"),
          );
          break;
        default:
          set.ops = set.ops.filter((_, i) => {
            return i === 0 || i % 4 === 1;
          });
      }

      return set;
    });

  return shape;
}

function objectToPath(rc: RoughCanvas, element: ExcalidrawElement) {
  const shape = generateElementShape(
    {
      ...element,
      roughness: 0,
    } as NonDeletedExcalidrawElement,
    rc.generator,
  );
  let path = null;

  if (element.type !== "path") {
    switch (element.type) {
      case "ellipse":
        path = new Path(element);
        break;
      case "line": {
        const normalizedShape = normalizeShape((shape as Drawable[])[0]);

        const [p] = rc.generator.toPaths(normalizedShape);

        path = new Path(p.d);

        break;
      }
      default:
        const normalizedShape = normalizeShape(shape as Drawable);

        const [p] = rc.generator.toPaths(normalizedShape);

        path = new Path(p.d);
    }
  } else {
    path = new Path(element.d);
  }

  return path;
}

function curveToPoint(move: Point, element: ExcalidrawElement): Point {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  const transformXY = (x: number, y: number) =>
    rotate(element.x + x, element.y + y, cx, cy, element.angle);

  return transformXY(...move);
}

function findIndex(path: Path, move: Point) {
  return path.data.findIndex(
    (c) => c[c.length - 2] === move[0] && c[c.length - 1] === move[1],
  );
}

function getShiftXY(
  originPaths: [Path, Path],
  paths: [Path, Path],
): { move: Point; moveIndex: number; pathIndex: number } {
  let move: Point = [0, 0];
  let moveIndex: number = -1;
  const pathIndex: number = 0;

  for (let i = 0; i < 2; i++) {
    const path = paths[i];

    for (let j = 0; j < path.data.length; j++) {
      const seg = path.data[j];
      move = [seg[seg.length - 2], seg[seg.length - 1]] as [number, number];

      if (originPaths[i ^ 1].data.some((s) => s.includes(move[0]))) {
        return {
          move,
          moveIndex: j,
          pathIndex: i,
        };
      }
    }
  }

  const path = paths[0];

  for (let i = 0; i < path.data.length; i++) {
    const seg = path.data[i];
    move = [seg[seg.length - 2], seg[seg.length - 1]] as [number, number];
    moveIndex = i;

    if (seg[0] === "M") {
      break;
    }
  }

  return {
    move,
    moveIndex,
    pathIndex,
  };
}

export function operateBool(
  element1: NonDeletedExcalidrawElement,
  element2: NonDeletedExcalidrawElement,
  rc: RoughCanvas,
  action: "difference" | "union" | "intersection" | "exclusion",
): NonDeletedExcalidrawElement {
  const [x1, y1] = getElementBounds(element1);
  const [x2, y2] = getElementBounds(element2);

  const offsetX = Math.min(x1, x2);
  const offsetY = Math.min(y1, y2);

  const transform1 = {
    translate: [element1.x - offsetX, element1.y - offsetY],
    rotate: radianToDegree(element1.angle),
  };
  const transform2 = {
    translate: [element2.x - offsetX, element2.y - offsetY],
    rotate: radianToDegree(element2.angle),
  };

  const path1 = objectToPath(rc, element1);
  const path2 = objectToPath(rc, element2);

  const paths: [Path, Path] = [path1, path2];
  const elements: [ExcalidrawElement, ExcalidrawElement] = [element1, element2];
  const transforms = [transform1, transform2];

  paths.forEach((p, i) => p.transform(transforms[i]));

  const originPaths: [Path, Path] = [Path.clone(path1), Path.clone(path2)];

  const [intersection] = path1[action](path2);

  if (!path1.data.length) {
    return (null as unknown) as NonDeletedExcalidrawElement;
  }

  let move: Point = [0, 0];
  let moveIndex: number = -1;
  let pathIndex: number = 0;

  if (intersection) {
    move = [intersection.x, intersection.y];
    moveIndex = findIndex(path1, move);
  } else {
    ({ move, moveIndex, pathIndex } = getShiftXY(originPaths, paths));
  }

  const isPath2InsidePath1 =
    !intersection &&
    path1.data[0][1] === path2.data[0][1] &&
    path1.data[0][2] === path2.data[0][2];
  const element = elements[pathIndex];
  const transform = transforms[pathIndex];

  path1.transform({
    rotate: -transform.rotate,
  });

  const box = path1.getBoundingBox();

  path1.transform({
    translate: [-box.x, -box.y],
  });

  const temp = newPathElement({
    ...element,
    width: box.width,
    height: box.height,
    d: path1.toPathString(),
    hollow: path1.isHollow,
  });

  let [p1x, p1y] = [0, 0];
  let [p2x, p2y] = [0, 0];

  if (!isPath2InsidePath1) {
    [p1x, p1y] = curveToPoint(
      originPaths[pathIndex].transformPoint(move, {
        translate: transform.translate.map((p) => -p),
        rotate: -transform.rotate,
      }),
      element,
    );
    [p2x, p2y] = curveToPoint(
      paths[pathIndex].data[moveIndex].slice(-2) as [number, number],
      temp,
    );
  }

  return newPathElement({
    ...temp,
    x: temp.x - (p2x - p1x),
    y: temp.y - (p2y - p1y),
  });
}
```

### 2. src/element/path/Path.ts - Path Class

```typescript
import {
  pathArrToStr,
  parsePathString,
  union,
  difference,
  intersection,
  exclusion,
  getTotalLength,
  getPointAtLength,
  normalizePath,
  pathDimensions,
} from "./raphael";
import Matrix from "./Matrix";
import { Point } from "../../types";

function isHollow(path: (string | number)[][]) {
  const index = path.findIndex(
    ([c], i) => i > 0 && (c as string).toLowerCase() === "m",
  );

  const head = path[0];
  const tail = path[index - 1];

  return !!(
    tail &&
    tail[tail.length - 1] === head[head.length - 1] &&
    tail[tail.length - 2] === head[head.length - 2]
  );
}

interface Transform {
  translate?: number[];
  scale?: number[];
  rotate?: number;
}

function toMarix(transform: Transform, centerPoint: Point) {
  const matrix = new Matrix();

  if (transform.translate) {
    matrix.translate(...(transform.translate as [number, number]));
  }

  if (transform.rotate) {
    matrix.rotate(transform.rotate as number, ...centerPoint);
  }

  if (transform.scale) {
    const [scaleX, scaleY] = transform.scale;

    matrix.scale(scaleX, scaleY, 0, 0);
  }

  return matrix;
}

export default class Path {
  data: (string | number)[][];
  isHollow: boolean = false;

  constructor(d: string | ExcalidrawElement) {
    this.data = typeof d === "string" ? parsePathString(d) : this.toPath(d);
  }

  mapPath(matrix: Matrix) {
    this.data.forEach((path) => {
      for (let i = 1; i < path.length; i += 2) {
        const n1 = path[i] as number;
        const n2 = path[i + 1] as number;
        const newX = matrix.x(n1, n2);
        const newY = matrix.y(n1, n2);
        path[i] = newX;
        path[i + 1] = newY;
      }
    });
  }

  getBoundingBox() {
    return pathDimensions(this.data);
  }

  getCenterPoint(): Point {
    const box = this.getBoundingBox();

    return [box.x + box.width / 2, box.y + box.height / 2];
  }

  transformPoint(point: Point, transform: Transform = {}): Point {
    const matrix = toMarix(transform, this.getCenterPoint());

    const newX = matrix.x(...point);
    const newY = matrix.y(...point);

    return [newX, newY];
  }

  transform(transform: Transform = {}) {
    const matrix = toMarix(transform, this.getCenterPoint());

    this.mapPath(matrix);
  }

  toPathString() {
    return pathArrToStr(this.data);
  }

  /**
   * perform a difference of the two given paths
   *
   * @param object el1 (RaphaelJS element)
   * @param object el2 (RaphaelJS element)
   *
   * @returns string (path string)
   */
  difference(path: Path) {
    const { data, intersections } = difference(this.data, path.data);

    this.data = data;
    this.isHollow = isHollow(this.data);

    return intersections;
  }

  /**
   * perform a union of the two given paths
   *
   * @param object el1 (RaphaelJS element)
   * @param object el2 (RaphaelJS element)
   *
   * @returns string (path string)
   */
  union(path: Path) {
    const { data, intersections } = union(this.data, path.data);
    this.data = data;
    this.isHollow = isHollow(this.data);

    return intersections;
  }

  /**
   * perform a intersection of the two given paths
   *
   * @param object el1 (RaphaelJS element)
   * @param object el2 (RaphaelJS element)
   *
   * @returns string (path string)
   */
  intersection(path: Path) {
    const { data, intersections } = intersection(this.data, path.data);

    this.data = data;
    this.isHollow = isHollow(this.data);

    return intersections;
  }

  /**
   * perform a exclusion of the two given paths
   *
   * @param object el1 (RaphaelJS element)
   * @param object el2 (RaphaelJS element)
   *
   * @returns string (path string)
   */
  exclusion(path: Path) {
    const { data, intersections } = exclusion(this.data, path.data);

    this.data = data;
    this.isHollow = isHollow(this.data);

    return intersections;
  }

  getTotalLength(): number {
    return getTotalLength(this.data) as number;
  }

  getPointAtLength(length: number) {
    return getPointAtLength(this.data, length);
  }

  toPath(element: ExcalidrawElement) {
    const path = [];
    const x = element.width / 2;
    const y = element.height / 2;
    let cornerPoints: [number, number][] = [];
    let rx = 0;
    let ry = 0;

    if (element.type === "ellipse") {
      rx = element.width / 2;
      ry = element.height / 2;
      cornerPoints = [
        [x - rx, y - ry],
        [x + rx, y - ry],
        [x + rx, y + ry],
        [x - rx, y + ry],
      ];
    }

    const radiusShift = [
      [
        [0, 1],
        [1, 0],
      ],
      [
        [-1, 0],
        [0, 1],
      ],
      [
        [0, -1],
        [-1, 0],
      ],
      [
        [1, 0],
        [0, -1],
      ],
    ];
    //iterate all corners
    for (let i = 0; i <= 3; i++) {
      //insert starting point
      if (i === 0) {
        path.push(["M", cornerPoints[0][0], cornerPoints[0][1] + ry]);
      }

      //insert "curveto" (radius factor .446 is taken from Inkscape)
      if (rx > 0) {
        path.push([
          "C",
          cornerPoints[i][0] + radiusShift[i][0][0] * rx * 0.446,
          cornerPoints[i][1] + radiusShift[i][0][1] * ry * 0.446,
          cornerPoints[i][0] + radiusShift[i][1][0] * rx * 0.446,
          cornerPoints[i][1] + radiusShift[i][1][1] * ry * 0.446,
          cornerPoints[i][0] + radiusShift[i][1][0] * rx,
          cornerPoints[i][1] + radiusShift[i][1][1] * ry,
        ]);
      }

      if (i === 3) {
        path.push(["Z"]);
      }
    }

    return normalizePath(pathArrToStr(path));
  }

  static clone(path: Path): Path {
    const clone = new Path(path.toPathString());

    clone.isHollow = path.isHollow;

    return clone;
  }
}
```

### 3. src/element/path/Matrix.ts - Matrix Class

```typescript
function rad(deg: number) {
  return ((deg % 360) * Math.PI) / 180;
}

export default class Matrix {
  a: number = 1;
  b: number = 0;
  c: number = 0;
  d: number = 1;
  e: number = 0;
  f: number = 0;

  /*\
    * Matrix.add
    [ method ]
    **
    * Adds given matrix to existing one.
    > Parameters
    - a (number)
    - b (number)
    - c (number)
    - d (number)
    - e (number)
    - f (number)
    or
    - matrix (object) @Matrix
  \*/
  add(a: number, b: number, c: number, d: number, e: number, f: number) {
    const out: [number?, number?, number?][] = [[], [], []];
    const m = [
      [this.a, this.c, this.e],
      [this.b, this.d, this.f],
      [0, 0, 1],
    ];
    const matrix = [
      [a, c, e],
      [b, d, f],
      [0, 0, 1],
    ];

    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        let res = 0;
        for (let z = 0; z < 3; z++) {
          res += m[x][z] * matrix[z][y];
        }
        out[x][y] = res;
      }
    }

    this.a = out[0][0] as number;
    this.b = out[1][0] as number;
    this.c = out[0][1] as number;
    this.d = out[1][1] as number;
    this.e = out[0][2] as number;
    this.f = out[1][2] as number;
  }
  /*\
    * Matrix.translate
    [ method ]
    **
    * Translate the matrix
    > Parameters
    - x (number)
    - y (number)
  \*/
  translate(x: number, y: number) {
    this.add(1, 0, 0, 1, x, y);
  }
  /*\
    * Matrix.rotate
    [ method ]
    **
    * Rotates the matrix
    > Parameters
    - a (number)
    - x (number)
    - y (number)
  \*/
  rotate(a: number, x: number, y: number) {
    a = rad(a);
    x = x || 0;
    y = y || 0;
    const cos = +Math.cos(a).toFixed(9);
    const sin = +Math.sin(a).toFixed(9);

    this.add(cos, sin, -sin, cos, x, y);
    this.add(1, 0, 0, 1, -x, -y);
  }

  /*\
    * Matrix.scale
    [ method ]
    **
    * Scales the matrix
    > Parameters
    - x (number)
    - y (number) #optional
    - cx (number) #optional
    - cy (number) #optional
  \*/
  scale(x: number, y: number, cx: number, cy: number) {
    y == null && (y = x);
    (cx || cy) && this.add(1, 0, 0, 1, cx, cy);
    this.add(x, 0, 0, y, 0, 0);
    (cx || cy) && this.add(1, 0, 0, 1, -cx, -cy);
  }

  /*\
    * Matrix.x
    [ method ]
    **
    * Return x coordinate for given point after transformation described by the matrix. See also @Matrix.y
    > Parameters
    - x (number)
    - y (number)
    = (number) x
  \*/
  x(x: number, y: number) {
    return x * this.a + y * this.c + this.e;
  }
  /*\
    * Matrix.y
    [ method ]
    **
    * Return y coordinate for given point after transformation described by the matrix. See also @Matrix.x
    > Parameters
    - x (number)
    - y (number)
    = (number) y
  \*/
  y(x: number, y: number) {
    return x * this.b + y * this.d + this.f;
  }
}
```

### 4. src/element/path/raphaelBools.js - Core Boolean Operations Implementation

```javascript
/**
 * execute the bool operation
 *
 * @param string type (name of the boolean operation)
 * @param array path1Segs (segment representation of path1)
 * @param array path2Segs (segment representation of path2)
 *
 * @return array newPath (segment representation of the resulting path)
 */
function operateBool(type, path1, path2, fix) {
  const path1Segs = generatePathSegments(path1);
  const path2Segs = generatePathSegments(path2);

  markSubpathEndings(path1Segs, path2Segs);

  //get intersections of both paths
  var intersections = getIntersections(path1, path2);

  //if any insert intersections into paths
  if (intersections.length > 0) {
    insertIntersectionPoints(path1Segs, 1, intersections);
    insertIntersectionPoints(path2Segs, 2, intersections);
  }

  var newParts = buildNewPathParts(type, path1Segs, path2Segs, fix);
  var indexes = buildPartIndexes(newParts);

  let result;

  try {
    result = buildNewPath(
      type,
      newParts,
      indexes.inversions,
      indexes.startIndex,
      fix,
    );
  } catch (error) {
    if (retried) {
      retried = false;

      return;
    }

    retried = true;

    return operateBool(type, path1, path2, true);
  }

  return {
    data: pathSegsToArr(result),
    intersections,
  };
}

/**
 * perform a union of the two given paths
 *
 * @param object path1: Path
 * @param object path2: Path
 *
 * @returns {
    data,
    intersections,
  }
 */
export function union(path1, path2) {
  return operateBool("union", path1, path2);
}

/**
 * perform a difference of the two given paths
 *
 * @param object path1: Path
 * @param object path2: Path
 *
 * @returns {
    data,
    intersections,
  }
 */
export function difference(path1, path2) {
  return operateBool("difference", path1, path2);
}

/**
 * perform an intersection of the two given paths
 *
 * @param object path1: Path
 * @param object path2: Path
 *
 * @returns {
    data,
    intersections,
  }
 */
export function intersection(path1, path2) {
  return operateBool("intersection", path1, path2);
}

/**
 * perform an exclusion of the two given paths -> A Exclusion B = (A Union B) Difference (A Intersection B)
 *
 * @param object path1: Path
 * @param object path2: Path
 *
 * @returns {
    data,
    intersections,
  }
 */
export function exclusion(path1, path2) {
  const r1 = operateBool("union", path1, path2);
  const r2 = operateBool("intersection", path1, path2);

  return {
    ...operateBool("difference", r1.data, r2.data),
    intersections: r1.intersections,
  };
}
```

### 5. Key Helper Functions

```javascript
/**
 * convert raphael's internal path representation (must be converted to curves before) to segments / bezier curves
 *
 * @returns array segments (path as a collection of segments)
 */
function generatePathSegments(path) {
  const segments = [];

  path.forEach((pathCommand, i) => {
    let seg = {
      items: [],
    };

    //if command is a moveto create new sub-path
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

    //add empty segments for "moveto", because Raphael counts it when calculating interceptions
    if (i > 0) {
      segments.push(seg);
    }
  });

  return segments;
}

/**
 * collect the parts of the resulting path according to given rules for the type of boolean operation
 * a part is characterized as a bunch of segments - first and last segment hosts a sub-path starting / ending point or intersection point
 *
 * @param string type (type of boolean operation)
 * @param array path1Segs (path1 in segment representation)
 * @param array path1Segs (path2 in segment representation)
 *
 * @returns array newParts (array of arrays holding segments)
 */
function buildNewPathParts(type, path1Segs, path2Segs, fix) {
  let IOSituationChecked = false;
  let insideOtherPath; //temporary flag
  let partNeeded = false;
  let newPathPart = { segments: [] };
  const newParts = [];

  /*
  Add-Part-to-new-Path-Rules:
    union:
    path1 - segment NOT inside path2
    path2 - segment NOT inside path1
    difference:
    path1 - segment NOT inside path2
    path2 - segment inside path1
    intersection:
    path1 - segment inside path2
    path2 - segment inside path1
  */
  const rules = {
    union: {
      0: false,
      1: false,
    },
    difference: {
      0: false,
      1: true,
    },
    intersection: {
      0: true,
      1: true,
    },
  };

  var paths = [
    {
      segs: path1Segs,
      nr: 1,
    },
    {
      segs: path2Segs,
      nr: 2,
    },
  ];

  //iterate both paths and collect parts that are needed according to rules
  for (let p = 0; p <= 1; p++) {
    const path = paths[p];

    for (let s = 0; s < path.segs.length; s++) {
      const segment = path.segs[s];
      const segCoords = segment.items;

      if (segCoords.length === 0) {
        continue;
      }
      if (!IOSituationChecked) {
        insideOtherPath = isSegInsidePath(
          segCoords,
          pathSegsToStr(paths[p ^ 1].segs),
          fix,
        );

        IOSituationChecked = true;
        partNeeded = rules[type][p] === insideOtherPath;
      }

      //if conditions are satisfied add current segment to new part
      if (partNeeded) {
        newPathPart.segments.push(segment);
      }

      if (typeof segment.endPoint !== "undefined") {
        if (partNeeded) {
          newPathPart.pathNr = path.nr;
          newParts.push(newPathPart);
        }
        newPathPart = { segments: [] };
        IOSituationChecked = false;
      }
    }
  }

  return newParts;
}
```

### 6. Path Utility Functions

```javascript
/**
 * convert a path array into path string
 *
 * @param arr pathArr
 *
 * @returns string
 */
export function pathArrToStr(pathArr) {
  return pathArr.join(",").replace(/,?([achlmqrstvxz]),?/gi, "$1");
}

export function parsePathString(pathString) {
  const paramCounts = {
    a: 7,
    c: 6,
    h: 1,
    l: 2,
    m: 2,
    r: 4,
    q: 4,
    s: 4,
    t: 2,
    v: 1,
    z: 0,
  };
  const data = [];

  if (!data.length) {
    pathString.replace(pathCommand, function (a, b, c) {
      var params = [],
        name = b.toLowerCase();
      c.replace(pathValues, function (a, b) {
        b && params.push(+b);
      });
      while (params.length >= paramCounts[name]) {
        data.push([b].concat(params.splice(0, paramCounts[name])));
        if (!paramCounts[name]) {
          break;
        }
      }
    });
  }

  return data;
}

export function normalizePath(path) {
  if (typeof path === "string") {
    if (notcurvepath.test(path)) {
      return _path2curve(parsePathString(path));
    }

    return parsePathString(path);
  }

  return path;
}

export function pathDimensions(path) {
  path = normalizePath(path);

  var x = 0,
    y = 0,
    X = [],
    Y = [],
    p;
  for (var i = 0, ii = path.length; i < ii; i++) {
    p = path[i];
    if (p[0] === "M") {
      x = p[1];
      y = p[2];
      X.push(x);
      Y.push(y);
    } else {
      var dim = curveDim(x, y, p[1], p[2], p[3], p[4], p[5], p[6]);
      X = X.concat(dim.min.x, dim.max.x);
      Y = Y.concat(dim.min.y, dim.max.y);
      x = p[5];
      y = p[6];
    }
  }
  var xmin = Math.min.apply(0, X),
    ymin = Math.min.apply(0, Y),
    xmax = Math.max.apply(0, X),
    ymax = Math.max.apply(0, Y),
    width = xmax - xmin,
    height = ymax - ymin,
    bb = {
      x: xmin,
      y: ymin,
      x2: xmax,
      y2: ymax,
      width: width,
      height: height,
      cx: xmin + width / 2,
      cy: ymin + height / 2,
    };
  return bb;
}
```

### 7. New Element Function

```typescript
export function newPathElement(
  opts: {
    d: string;
    hollow?: boolean;
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawPathElement> {
  return {
    ..._newElementBase<ExcalidrawPathElement>("path", opts),
    d: opts.d || "",
    hollow: opts.hollow || false,
  };
}
```

### 8. Type Definitions

```typescript
export type ExcalidrawPathElement = _ExcalidrawElementBase &
  Readonly<{
    type: "path";
    d: string;
    hollow: boolean;
  }>;
```

### 9. Math Utilities

```typescript
export function radianToDegree(radian: number) {
  return (180 * radian) / Math.PI;
}
```

## Key Integration Points

1. The boolean operations are exposed through the `operateBool` function in `src/element/path/bools.ts`
2. The Path class provides methods for union, difference, intersection, and exclusion
3. The implementation uses RaphaelJS algorithms for path operations
4. The system handles transformation of different shape types (ellipse, line, etc.) to paths before performing operations
5. Results are returned as new path elements with proper positioning and transformations applied

## Usage in ActionManager

From the diff, boolean operations are integrated into the action system:

```typescript
return actionBooleanOperations.booleanOperation(
  action,
  elements,
  appState,
  app,
);
```

Where `action` can be: "difference", "union", "intersection", or "exclusion".