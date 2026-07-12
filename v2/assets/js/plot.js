/* Minimal declarative SVG plotting core. No dependencies.
   Every chart on this site is a line/band/points plot over a 1-D grid, so this
   is all that is needed. Redraw by calling render(el, spec) again. */

const NS = 'http://www.w3.org/2000/svg';

/* Colorblind-safe palette (Okabe-Ito derived).
   ink and gray are theme variables, not fixed hexes: a near-black curve on the dark-mode
   background is invisible, and in two panels that curve carries the whole point. */
export const C = {
  blue:   '#0a4d8c',
  orange: '#e07b39',
  green:  '#1b7f5c',
  purple: '#7b52ab',
  red:    '#c0392b',
  teal:   '#0f8b9e',
  gold:   '#b8860b',
  gray:   'var(--series-gray)',
  ink:    'var(--ink)',
};

/* A presentation attribute is parsed as a CSS *value*, not a declaration, so var() is not
   valid there: stroke="var(--ink)" silently yields no stroke. Route any var() paint through
   the style declaration instead, where custom properties do resolve. */
const el = (name, attrs = {}, text = null) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'string' && v.includes('var(')) n.style.setProperty(k, v);
    else n.setAttribute(k, v);
  }
  if (text !== null) n.textContent = text;
  return n;
};

/* "Nice" axis ticks. */
function ticks(lo, hi, count = 5) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) {
    out.push(Math.abs(t) < step * 1e-9 ? 0 : t);
  }
  return out;
}

function logTicks(lo, hi) {
  const out = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    const v = Math.pow(10, e);
    if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v);
  }
  return out;
}

const fmt = (v) => {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1e4 || a < 1e-3) return v.toExponential(0).replace('e+', 'e');
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return (Math.round(v * 10) / 10).toString();
  if (a >= 1) return (Math.round(v * 100) / 100).toString();
  return (Math.round(v * 1000) / 1000).toString();
};

/* spec = {
     xlabel, ylabel, xlim:[lo,hi], ylim:[lo,hi]|null, xlog, ylog,
     series: [ {type:'band', x, y0, y1, color, label}
               {type:'line', x, y, color, label, dash, width}
               {type:'points', x, y, color, label}
               {type:'vline'|'hline', at, color, label, dash}
               {type:'marker', x, y, color, label} ],
     caption: string
   } */
export function render(host, spec) {
  const W = 640, H = 400;
  const m = { t: 16, r: 14, b: 54, l: 62 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;

  /* Series carry either arrays (line/band/points) or scalars (marker/vline/hline). */
  const vals = (v) => Array.isArray(v) ? v.filter(Number.isFinite)
    : Number.isFinite(v) ? [v] : [];

  const all = [];
  for (const s of spec.series || []) {
    all.push(...vals(s.x));
    if (s.type === 'bar') { all.push(Math.min(...s.x) - 0.6, Math.max(...s.x) + 0.6); }
    if (s.type === 'vline') all.push(...vals(s.at));
  }
  const xlim = spec.xlim || [Math.min(...all), Math.max(...all)];

  let ylo, yhi;
  if (spec.ylim) { [ylo, yhi] = spec.ylim; }
  else {
    const ys = [];
    for (const s of spec.series || []) {
      for (const arr of [s.y, s.y0, s.y1]) ys.push(...vals(arr));
      if (s.type === 'hline') ys.push(...vals(s.at));
    }
    ylo = Math.min(...ys); yhi = Math.max(...ys);
    const pad = (yhi - ylo) * 0.08 || Math.abs(yhi) * 0.1 || 1;
    ylo -= pad; yhi += pad;
    if (spec.ymin !== undefined) ylo = spec.ymin;
    if (spec.ylog) ylo = Math.max(ylo, 1e-12);
  }

  const sx = (v) => spec.xlog
    ? m.l + iw * (Math.log10(v) - Math.log10(xlim[0])) / (Math.log10(xlim[1]) - Math.log10(xlim[0]))
    : m.l + iw * (v - xlim[0]) / (xlim[1] - xlim[0]);
  const sy = (v) => spec.ylog
    ? m.t + ih - ih * (Math.log10(v) - Math.log10(ylo)) / (Math.log10(yhi) - Math.log10(ylo))
    : m.t + ih - ih * (v - ylo) / (yhi - ylo);

  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'chart',
    preserveAspectRatio: 'xMidYMid meet', role: 'img',
    'aria-label': spec.caption || `${spec.ylabel} versus ${spec.xlabel}`,
  });

  const xt = spec.xticks ? spec.xticks.map((t) => t.at)
    : spec.xlog ? logTicks(xlim[0], xlim[1]) : ticks(xlim[0], xlim[1]);
  const xtLabel = (t, i) => spec.xticks ? spec.xticks[i].label : fmt(t);
  const yt = spec.ylog ? logTicks(ylo, yhi) : ticks(ylo, yhi);

  /* Gridlines */
  for (const t of xt) svg.appendChild(el('line', { x1: sx(t), x2: sx(t), y1: m.t, y2: m.t + ih, class: 'grid' }));
  for (const t of yt) svg.appendChild(el('line', { x1: m.l, x2: m.l + iw, y1: sy(t), y2: sy(t), class: 'grid' }));

  const clip = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const path = (xs, ys) => xs.map((x, i) =>
    `${i ? 'L' : 'M'}${sx(x).toFixed(2)},${clip(sy(ys[i]), m.t - 2, m.t + ih + 2).toFixed(2)}`).join(' ');

  /* Series, bands first so lines sit on top. */
  const ordered = [...(spec.series || [])].sort((a, b) => (a.type === 'band' ? -1 : b.type === 'band' ? 1 : 0));
  for (const s of ordered) {
    if (s.type === 'band') {
      const up = s.x.map((x, i) => `${i ? 'L' : 'M'}${sx(x).toFixed(2)},${clip(sy(s.y1[i]), m.t, m.t + ih).toFixed(2)}`).join(' ');
      const dn = s.x.map((x, i) => [sx(x).toFixed(2), clip(sy(s.y0[i]), m.t, m.t + ih).toFixed(2)])
        .reverse().map(([a, b]) => `L${a},${b}`).join(' ');
      svg.appendChild(el('path', { d: `${up} ${dn} Z`, fill: s.color, 'fill-opacity': s.opacity ?? 0.16, stroke: 'none' }));
    } else if (s.type === 'line') {
      svg.appendChild(el('path', {
        d: path(s.x, s.y), fill: 'none', stroke: s.color,
        'stroke-width': s.width ?? 2.4, 'stroke-dasharray': s.dash || 'none',
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }));
    } else if (s.type === 'bar') {
      const bw = (s.bw ?? 0.34);
      s.x.forEach((x, i) => {
        const x0 = sx(x - bw / 2), x1 = sx(x + bw / 2);
        const yTop = sy(s.y[i]), yBase = sy(Math.max(ylo, 0));
        svg.appendChild(el('rect', {
          x: Math.min(x0, x1), width: Math.abs(x1 - x0),
          y: Math.min(yTop, yBase), height: Math.abs(yBase - yTop),
          fill: s.color, rx: 3,
        }));
        if (s.text && s.text[i] !== undefined) {
          svg.appendChild(el('text', {
            x: (x0 + x1) / 2, y: yTop - 7, class: 'tick', 'text-anchor': 'middle',
          }, s.text[i]));
        }
      });
    } else if (s.type === 'points') {
      s.x.forEach((x, i) => svg.appendChild(
        el('circle', { cx: sx(x), cy: sy(s.y[i]), r: s.r ?? 3.6, fill: s.color, stroke: 'var(--bg)', 'stroke-width': 1 })));
    } else if (s.type === 'marker') {
      /* hollow: ring a point that is already plotted, without hiding it. */
      svg.appendChild(s.hollow
        ? el('circle', { cx: sx(s.x), cy: sy(s.y), r: 9, fill: 'none', stroke: s.color, 'stroke-width': 2.4 })
        : el('circle', { cx: sx(s.x), cy: sy(s.y), r: 6, fill: s.color, stroke: 'var(--bg)', 'stroke-width': 2 }));
    } else if (s.type === 'vline') {
      svg.appendChild(el('line', {
        x1: sx(s.at), x2: sx(s.at), y1: m.t, y2: m.t + ih,
        stroke: s.color, 'stroke-width': 1.8, 'stroke-dasharray': s.dash || '5 4',
      }));
    } else if (s.type === 'hline') {
      svg.appendChild(el('line', {
        x1: m.l, x2: m.l + iw, y1: sy(s.at), y2: sy(s.at),
        stroke: s.color, 'stroke-width': 1.8, 'stroke-dasharray': s.dash || '5 4',
      }));
    }
  }

  /* Axes */
  svg.appendChild(el('line', { x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih, class: 'axis' }));
  svg.appendChild(el('line', { x1: m.l, x2: m.l, y1: m.t, y2: m.t + ih, class: 'axis' }));
  for (const t of xt) {
    svg.appendChild(el('line', { x1: sx(t), x2: sx(t), y1: m.t + ih, y2: m.t + ih + 5, class: 'axis' }));
    svg.appendChild(el('text', { x: sx(t), y: m.t + ih + 20, class: 'tick', 'text-anchor': 'middle' },
      xtLabel(t, xt.indexOf(t))));
  }
  for (const t of yt) {
    svg.appendChild(el('line', { x1: m.l - 5, x2: m.l, y1: sy(t), y2: sy(t), class: 'axis' }));
    svg.appendChild(el('text', { x: m.l - 9, y: sy(t) + 4, class: 'tick', 'text-anchor': 'end' }, fmt(t)));
  }
  svg.appendChild(el('text', { x: m.l + iw / 2, y: H - 10, class: 'axlab', 'text-anchor': 'middle' }, spec.xlabel || ''));
  const yl = el('text', { x: 14, y: m.t + ih / 2, class: 'axlab', 'text-anchor': 'middle',
    transform: `rotate(-90 14 ${m.t + ih / 2})` }, spec.ylabel || '');
  svg.appendChild(yl);

  host.replaceChildren(svg);

  /* HTML legend below the SVG (keeps text selectable and wraps on mobile). */
  const legend = (spec.series || []).filter((s) => s.label);
  if (legend.length) {
    const ul = document.createElement('ul');
    ul.className = 'legend';
    for (const s of legend) {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = s.color;
      if (s.dash) sw.classList.add('dashed');
      if (s.type === 'band') sw.style.opacity = '0.35';
      li.append(sw, document.createTextNode(s.label));
      ul.appendChild(li);
    }
    host.appendChild(ul);
  }
}

/* Linearly spaced grid. */
export const seq = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
/* Log-spaced grid. */
export const logseq = (a, b, n) => Array.from({ length: n },
  (_, i) => Math.pow(10, Math.log10(a) + (Math.log10(b) - Math.log10(a)) * i / (n - 1)));
