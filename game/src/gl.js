
export function m4ident() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function m4persp(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

export function m4lookAt(ex, ey, ez, cx, cy, cz, ux, uy, uz) {
  let zx = ex - cx, zy = ey - cy, zz = ez - cz;
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * ex + xy * ey + xz * ez),
    -(yx * ex + yy * ey + yz * ez),
    -(zx * ex + zy * ey + zz * ez), 1,
  ]);
}

export function m4mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
        + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

export function m4compose(x, y, z, ry, s) {
  const c = Math.cos(ry), sn = Math.sin(ry);
  return new Float32Array([
    c * s, 0, -sn * s, 0,
    0, s, 0, 0,
    sn * s, 0, c * s, 0,
    x, y, z, 1,
  ]);
}

export function m4basis(xa, ya, za, ox, oy, oz) {
  return new Float32Array([
    xa[0], xa[1], xa[2], 0,
    ya[0], ya[1], ya[2], 0,
    za[0], za[1], za[2], 0,
    ox, oy, oz, 1,
  ]);
}

export function m3normal(m) {
  return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
}

const rgbCache = new Map();
export function rgb(hex) {
  let v = rgbCache.get(hex);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  v = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  rgbCache.set(hex, v);
  return v;
}

export function shade(hex, f) {
  const c = rgb(hex);
  return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
}

export function signUV(i) {
  const u0 = (i % 4) * 0.25;
  const v1 = 1 - Math.floor(i / 4) * 0.5;
  return [u0, v1 - 0.5, u0 + 0.25, v1];
}

export class Builder {
  constructor() {
    this.pos = []; this.nor = []; this.col = []; this.kind = []; this.part = [];
    this.uv = [];
    this.idx = [];
  }

  vert(x, y, z, nx, ny, nz, color, kind = 0, part = 0, u = 0, v = 0) {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.col.push(color[0], color[1], color[2]);
    this.kind.push(kind);
    this.part.push(part);
    this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }

  tri(a, b, c) { this.idx.push(a, b, c); }

  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }

  box(cx, cy, cz, sx, sy, sz, color, opt = {}) {
    const kind = opt.kind || 0;
    const part = opt.part || 0;
    const ry = opt.ry || 0;
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const corner = (x, y, z) => [cx + x * cs + z * sn, cy + y, cz - x * sn + z * cs];
    const nrm = (x, y, z) => [x * cs + z * sn, y, -x * sn + z * cs];
    const faces = [
      { n: [1, 0, 0], c: [[hx, -hy, -hz], [hx, -hy, hz], [hx, hy, hz], [hx, hy, -hz]] },
      { n: [-1, 0, 0], c: [[-hx, -hy, hz], [-hx, -hy, -hz], [-hx, hy, -hz], [-hx, hy, hz]] },
      { n: [0, 1, 0], c: [[-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz]] },
      { n: [0, -1, 0], c: [[-hx, -hy, hz], [hx, -hy, hz], [hx, -hy, -hz], [-hx, -hy, -hz]] },
      { n: [0, 0, 1], c: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
      { n: [0, 0, -1], c: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    ];
    for (const f of faces) {
      const n = nrm(f.n[0], f.n[1], f.n[2]);
      const topFace = f.n[1] === 1;
      const k = topFace && opt.kindTop !== undefined ? opt.kindTop : kind;
      const ids = f.c.map(([x, y, z]) => {
        const p = corner(x, y, z);
        return this.vert(p[0], p[1], p[2], n[0], n[1], n[2], color, k, part);
      });
      this.quad(ids[0], ids[1], ids[2], ids[3]);
    }
  }

  panel(x, y, z, w, h, a, color, opt = {}) {
    const kind = opt.kind || 0;
    const dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
    const nx = -Math.sin(a), nz = Math.cos(a);
    const a1 = this.vert(x - dx, y, z - dz, nx, 0, nz, color, kind);
    const a2 = this.vert(x + dx, y, z + dz, nx, 0, nz, color, kind);
    const a3 = this.vert(x + dx, y + h, z + dz, nx, 0, nz, color, kind);
    const a4 = this.vert(x - dx, y + h, z - dz, nx, 0, nz, color, kind);
    this.quad(a1, a2, a3, a4);
    const b1 = this.vert(x - dx, y, z - dz, -nx, 0, -nz, color, kind);
    const b2 = this.vert(x + dx, y, z + dz, -nx, 0, -nz, color, kind);
    const b3 = this.vert(x + dx, y + h, z + dz, -nx, 0, -nz, color, kind);
    const b4 = this.vert(x - dx, y + h, z - dz, -nx, 0, -nz, color, kind);
    this.quad(b2, b1, b4, b3);
  }

  spanel(x, y, z, w, h, a, i) {
    const [u0, v0, u1, v1] = signUV(i);
    const c = [1, 1, 1];
    const dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
    const nx = -Math.sin(a), nz = Math.cos(a);
    const a1 = this.vert(x - dx, y, z - dz, nx, 0, nz, c, 7, 0, u0, v0);
    const a2 = this.vert(x + dx, y, z + dz, nx, 0, nz, c, 7, 0, u1, v0);
    const a3 = this.vert(x + dx, y + h, z + dz, nx, 0, nz, c, 7, 0, u1, v1);
    const a4 = this.vert(x - dx, y + h, z - dz, nx, 0, nz, c, 7, 0, u0, v1);
    this.quad(a1, a2, a3, a4);
    const b1 = this.vert(x - dx, y, z - dz, -nx, 0, -nz, c, 7, 0, u1, v0);
    const b2 = this.vert(x + dx, y, z + dz, -nx, 0, -nz, c, 7, 0, u0, v0);
    const b3 = this.vert(x + dx, y + h, z + dz, -nx, 0, -nz, c, 7, 0, u0, v1);
    const b4 = this.vert(x - dx, y + h, z - dz, -nx, 0, -nz, c, 7, 0, u1, v1);
    this.quad(b2, b1, b4, b3);
  }

  cyl(cx, cy, cz, rTop, rBot, h, seg, color, opt = {}) {
    const kind = opt.kind || 0;
    const y0 = cy - h / 2, y1 = cy + h / 2;
    let prevB = null, prevT = null;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const b = this.vert(cx + ca * rBot, y0, cz + sa * rBot, ca, 0, sa, color, kind);
      const t = this.vert(cx + ca * rTop, y1, cz + sa * rTop, ca, 0, sa, color, kind);
      if (prevB !== null) this.quad(prevB, b, t, prevT);
      prevB = b; prevT = t;
    }
    if (opt.cap) {
      const cTop = this.vert(cx, y1, cz, 0, 1, 0, color, kind);
      const cBot = this.vert(cx, y0, cz, 0, -1, 0, color, kind);
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        const t0 = this.vert(cx + Math.cos(a0) * rTop, y1, cz + Math.sin(a0) * rTop, 0, 1, 0, color, kind);
        const t1 = this.vert(cx + Math.cos(a1) * rTop, y1, cz + Math.sin(a1) * rTop, 0, 1, 0, color, kind);
        this.tri(cTop, t1, t0);
        const b0 = this.vert(cx + Math.cos(a0) * rBot, y0, cz + Math.sin(a0) * rBot, 0, -1, 0, color, kind);
        const b1 = this.vert(cx + Math.cos(a1) * rBot, y0, cz + Math.sin(a1) * rBot, 0, -1, 0, color, kind);
        this.tri(cBot, b0, b1);
      }
    }
  }

  torus(cx, cy, cz, radius, tube, seg, color, opt = {}) {
    const kind = opt.kind || 0;
    const ring = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const px = cx, py = cy + Math.cos(a) * radius, pz = cz + Math.sin(a) * radius;
      const row = [];
      for (let j = 0; j <= 4; j++) {
        const b = (j / 4) * Math.PI * 2;
        const nx = Math.cos(b), ny = Math.cos(a) * Math.sin(b), nz = Math.sin(a) * Math.sin(b);
        row.push(this.vert(px + nx * tube, py + ny * tube, pz + nz * tube, nx, ny, nz, color, kind));
      }
      ring.push(row);
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < 4; j++) {
        this.quad(ring[i][j], ring[i + 1][j], ring[i + 1][j + 1], ring[i][j + 1]);
      }
    }
  }

  counts() {
    return { verts: this.pos.length / 3, tris: this.idx.length / 3 };
  }
}

export class BuilderA {
  constructor() { this.pos = []; this.col = []; this.idx = []; }

  vert(x, y, z, color) {
    this.pos.push(x, y, z);
    this.col.push(color[0], color[1], color[2], color[3]);
    return this.pos.length / 3 - 1;
  }

  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }

  groundQuad(x, y, z, w, d, color, ry = 0) {
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const hw = w / 2, hd = d / 2;
    const pt = (lx, lz) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs];
    const p1 = pt(-hw, -hd), p2 = pt(hw, -hd), p3 = pt(hw, hd), p4 = pt(-hw, hd);
    const a = this.vert(p1[0], y, p1[2], color);
    const b = this.vert(p2[0], y, p2[2], color);
    const c = this.vert(p3[0], y, p3[2], color);
    const e = this.vert(p4[0], y, p4[2], color);
    this.quad(a, b, c, e);
  }

  disc(x, y, z, r, color, aIn, aOut, seg = 18) {
    const c = this.vert(x, y, z, [color[0], color[1], color[2], aIn]);
    let prev = null, first = null;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const v = this.vert(x + Math.cos(a) * r, y, z + Math.sin(a) * r,
        [color[0], color[1], color[2], aOut]);
      if (prev !== null) this.tri(c, prev, v);
      if (first === null) first = v;
      prev = v;
    }
  }

  cone(color, aTop, aBot, seg = 20) {
    let prevT = null, prevB = null;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const t = this.vert(0, 0, 0, [color[0], color[1], color[2], aTop]);
      const b = this.vert(ca, -1, sa, [color[0], color[1], color[2], aBot]);
      if (prevT !== null) this.quad(prevT, prevB, b, t);
      prevT = t; prevB = b;
    }
  }

  counts() { return { verts: this.pos.length / 3, tris: this.idx.length / 3 }; }
}

export function createGL(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) return null;
  gl.enable(gl.DEPTH_TEST);
  return gl;
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

export function createProgram(gl, vsSrc, fsSrc, attribs = null) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  if (attribs) {
    for (const [name, loc] of Object.entries(attribs)) {
      gl.bindAttribLocation(prog, loc, name);
    }
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program: ' + gl.getProgramInfoLog(prog));
  }
  const cache = new Map();
  return {
    prog,
    u(name) {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(prog, name));
      return cache.get(name);
    },
    a(name) { return gl.getAttribLocation(prog, name); },
  };
}

export const LIT_VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec3 aCol; in float aKind; in float aPart;
in vec2 aUv;
uniform mat4 uProj, uView, uModel; uniform mat3 uNorm;
uniform float uTime, uWalk, uWalkAmp; uniform vec3 uTint;
out vec3 vCol; out vec3 vNor; out vec3 vWorld; out float vKind;
out vec2 vUv;
void main() {
  vec3 pos = aPos; vec3 nor = aNor;
  if (aPart > 0.5) {
    float isLeg = aPart < 2.5 ? 1.0 : 0.0;
    float side = (aPart == 1.0 || aPart == 3.0) ? 1.0 : -1.0;
    float ang = sin(uWalk) * 0.6 * side * mix(-0.75, 1.0, isLeg) * uWalkAmp;
    float piv = mix(18.4, 9.5, isLeg);
    float c = cos(ang), s = sin(ang);
    float dx = pos.x, dy = pos.y - piv;
    pos.x = dx * c - dy * s;
    pos.y = piv + dx * s + dy * c;
    float nx = nor.x, ny = nor.y;
    nor.x = nx * c - ny * s; nor.y = nx * s + ny * c;
  }
  vec4 wp = uModel * vec4(pos, 1.0);
  if (aKind > 1.5 && aKind < 2.5) {
    wp.y += sin(uTime * 1.4 + wp.x * 0.045 + wp.z * 0.06) * 0.5;
  }
  vWorld = wp.xyz;
  vNor = uNorm * nor;
  vCol = aCol * (aKind > 5.5 && aKind < 6.5 ? uTint : vec3(1.0));
  vKind = aKind;
  vUv = aUv;
  gl_Position = uProj * uView * wp;
}`;

export const LIT_FS = `#version 300 es
precision highp float;
in vec3 vCol; in vec3 vNor; in vec3 vWorld; in float vKind;
in vec2 vUv;
uniform vec3 uSunDir, uSunCol, uAmb, uCamPos, uFogCol;
uniform float uFogDen, uBlink;
uniform sampler2D uTex;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNor);
  vec3 col = vCol;
  float kind = vKind;
  if (kind > 6.5 && kind < 7.5) {
    outColor = vec4(texture(uTex, vUv).rgb * 1.12, 1.0); return;
  }
  if (kind > 2.5 && kind < 3.5) { outColor = vec4(col, 1.0); return; }
  if (kind > 3.5 && kind < 5.5) {
    float on = kind < 4.5 ? uBlink : 1.0 - uBlink;
    outColor = vec4(col * (0.22 + 1.7 * on), 1.0); return;
  }
  if (kind > 0.5 && kind < 1.5 && abs(n.y) < 0.5) {
    vec2 uvw = abs(n.x) > 0.5 ? vec2(vWorld.z, vWorld.y) : vec2(vWorld.x, vWorld.y);
    vec2 g = uvw / vec2(7.0, 8.5);
    vec2 f = fract(g);
    vec2 id = floor(g);
    float h = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
    bool win = f.x > 0.28 && f.x < 0.72 && f.y > 0.32 && f.y < 0.78 && uvw.y > 3.5;
    if (win) {
      col *= 0.5;
      if (h > 0.6) col += vec3(1.0, 0.72, 0.38) * 0.9;
    }
  }
  if (kind > 1.5 && kind < 2.5) {
    n = normalize(vec3(sin(vWorld.x * 0.11 + sin(vWorld.z * 0.13) * 2.1) * 0.27, 1.0,
      cos(vWorld.z * 0.09 + sin(vWorld.x * 0.07) * 2.1) * 0.27));
    vec3 hv = normalize(normalize(uCamPos - vWorld) + uSunDir);
    col += uSunCol * (pow(max(dot(n, hv), 0.0), 70.0) * 1.9
      + pow(max(dot(n, hv), 0.0), 8.0) * 0.32);
  }
  float dif = max(dot(n, uSunDir), 0.0);
  vec3 lit = col * (uAmb + uSunCol * dif);
  float d = distance(uCamPos, vWorld);
  float f = 1.0 - exp(-uFogDen * uFogDen * d * d);
  outColor = vec4(mix(lit, uFogCol, clamp(f, 0.0, 1.0)), 1.0);
}`;

export class Mesh {
  constructor(gl, builder) {
    this.count = builder.idx.length;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this._bufs = [];
    const mk = (arr, size, loc) => {
      if (loc < 0) return;
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      this._bufs.push(b);
    };
    mk(builder.pos, 3, 0);
    mk(builder.nor, 3, 1);
    mk(builder.col, 3, 2);
    mk(builder.kind, 1, 3);
    mk(builder.part, 1, 4);
    mk(builder.uv, 2, 5);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(builder.idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }

  draw(gl) {
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
}

export class MeshA {
  constructor(gl, builder, dynamic = false) {
    this.dynamic = dynamic;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.posBuf = gl.createBuffer();
    this.colBuf = gl.createBuffer();
    this.idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    if (builder) this.upload(gl, builder);
  }

  upload(gl, builder) {
    const usage = this.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(builder.pos), usage);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(builder.col), usage);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(builder.idx), usage);
    this.count = builder.idx.length;
    gl.bindVertexArray(null);
  }

  draw(gl, mode = gl.TRIANGLES) {
    if (!this.count) return;
    gl.bindVertexArray(this.vao);
    gl.drawElements(mode, this.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
}

export const ALPHA_VS = `#version 300 es
in vec3 aPos; in vec4 aCol;
uniform mat4 uProj, uView, uModel;
out vec4 vCol;
void main() {
  vCol = aCol;
  gl_Position = uProj * uView * uModel * vec4(aPos, 1.0);
}`;

export const ALPHA_FS = `#version 300 es
precision highp float;
in vec4 vCol;
out vec4 outColor;
void main() { outColor = vCol; }`;

export class Points {
  constructor(gl, max = 2048) {
    this.max = max;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.posBuf = gl.createBuffer();
    this.colBuf = gl.createBuffer();
    this.sizeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuf);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.count = 0;
  }

  upload(gl, pos, col, size) {
    this.count = Math.min(this.max, size.length);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, col, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, size, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
  }

  draw(gl) {
    if (!this.count) return;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);
  }
}

export const POINTS_VS = `#version 300 es
in vec3 aPos; in vec4 aCol; in float aSize;
uniform mat4 uProj, uView;
out vec4 vCol;
void main() {
  vCol = aCol;
  vec4 mv = uView * vec4(aPos, 1.0);
  gl_PointSize = aSize * 320.0 / max(1.0, -mv.z);
  gl_Position = uProj * mv;
}`;

export const POINTS_FS = `#version 300 es
precision highp float;
in vec4 vCol;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.12, d) * vCol.a;
  outColor = vec4(vCol.rgb, a);
}`;

export const SKY_VS = `#version 300 es
in vec3 aPos;
out vec2 vNdc;
void main() {
  vNdc = aPos.xy;
  gl_Position = vec4(aPos.xy, 0.99999, 1.0);
}`;

export const SKY_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform vec3 uRight, uUp, uBack, uSunDir, uZen, uHor, uSunCol;
uniform float uTan, uAspect;
out vec4 outColor;
void main() {
  vec3 dv = normalize(vec3(vNdc.x * uAspect * uTan, vNdc.y * uTan, -1.0));
  vec3 d = normalize(uRight * dv.x + uUp * dv.y + uBack * dv.z);
  float t = pow(max(d.y, 0.0), 0.38);
  vec3 col = mix(uHor, uZen, t);
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(s, 700.0) * 2.2 + pow(s, 220.0) * 1.4 + pow(s, 8.0) * 0.30);
  if (d.y < 0.0) col = mix(col, uHor * 0.92, min(1.0, -d.y * 3.0));
  outColor = vec4(col, 1.0);
}`;
