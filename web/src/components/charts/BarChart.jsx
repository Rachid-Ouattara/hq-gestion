import { useMemo, useState } from 'react';

const WIDTH = 800;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };
const GAP = 2; // interstice de surface entre segments empilés et entre barres voisines
const MAX_BAR_W = 24;

function niceMax(value) {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatDayLabel(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/** Barres empilées par jour. Conforme au skill dataviz : barres <=24px, extrémité
 * arrondie 4px sur le segment le plus haut de chaque pile uniquement (la pile est
 * carrée à la ligne de base), interstice de 2px entre segments, infobulle par
 * segment au survol (la marque est la cible, pas de repère vertical). */
export default function BarChart({ data, legend, formatValue = (v) => v.toLocaleString('fr-FR'), emptyLabel = 'Aucune donnée sur cette période.' }) {
  const [hover, setHover] = useState(null);

  const { maxTotal } = useMemo(() => {
    const totals = data.map((d) => d.segments.reduce((sum, s) => sum + s.value, 0));
    return { maxTotal: niceMax(Math.max(1, ...totals)) };
  }, [data]);

  const hasData = data.some((d) => d.segments.some((s) => s.value > 0));
  if (!hasData) {
    return <div className="grid h-[260px] place-items-center text-sm text-slate-400">{emptyLabel}</div>;
  }

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(MAX_BAR_W, slot * 0.6);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxTotal * t));
  const yFor = (v) => PAD.top + innerH - (v / maxTotal) * innerH;

  return (
    <div>
      {legend && legend.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4">
          {legend.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yFor(t)} y2={yFor(t)} stroke="#E2E8F0" strokeWidth="1" />
              <text x={PAD.left - 8} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#94A3B8">
                {t.toLocaleString('fr-FR')}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const total = d.segments.reduce((sum, s) => sum + s.value, 0);
            let cursorY = PAD.top + innerH; // on empile depuis la ligne de base
            const visibleSegments = d.segments.filter((s) => s.value > 0);
            return (
              <g key={d.x}>
                {visibleSegments.map((s, si) => {
                  const h = Math.max(0, (s.value / maxTotal) * innerH - (si < visibleSegments.length - 1 ? GAP : 0));
                  const isTop = si === visibleSegments.length - 1;
                  const y = cursorY - h;
                  cursorY = y - GAP;
                  const isHovered = hover?.dayIndex === i && hover?.segKey === s.key;
                  return (
                    <path
                      key={s.key}
                      d={
                        isTop
                          ? roundedTopRect(cx - barW / 2, y, barW, h, 4)
                          : `M${cx - barW / 2},${y} h${barW} v${h} h${-barW} Z`
                      }
                      fill={s.color}
                      opacity={isHovered ? 0.85 : 1}
                      onMouseMove={() => setHover({ dayIndex: i, segKey: s.key })}
                      onMouseLeave={() => setHover((h2) => (h2?.dayIndex === i && h2?.segKey === s.key ? null : h2))}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                })}
                {total > 0 && (
                  <text x={cx} y={cursorY - GAP - 4} textAnchor="middle" fontSize="10" fill="#64748B">
                    {total}
                  </text>
                )}
                {i % Math.ceil(data.length / 10 || 1) === 0 && (
                  <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize="10" fill="#94A3B8">
                    {formatDayLabel(d.x)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hover && (() => {
          const day = data[hover.dayIndex];
          const seg = day.segments.find((s) => s.key === hover.segKey);
          if (!seg) return null;
          const cx = PAD.left + slot * hover.dayIndex + slot / 2;
          return (
            <div
              className="pointer-events-none absolute top-2 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
              style={{ left: `${(cx / WIDTH) * 100}%`, transform: 'translateX(-50%)' }}
            >
              <p className="mb-1 font-medium text-slate-700">{formatDayLabel(day.x)}</p>
              <p className="flex items-center gap-1.5 text-slate-600">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
                <span className="font-semibold text-slate-800">{formatValue(seg.value)}</span>
                <span>{seg.label}</span>
              </p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function roundedTopRect(x, y, w, h, r) {
  const radius = Math.min(r, h, w / 2);
  if (h <= 0) return '';
  return `M${x},${y + h} v${-(h - radius)} q0,${-radius} ${radius},${-radius} h${w - 2 * radius} q${radius},0 ${radius},${radius} v${h - radius} Z`;
}
