import { useMemo, useState } from 'react';

const WIDTH = 800;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

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

/** Courbe multi-séries, axe X en jours. Conforme au skill dataviz : traits 2px,
 * marqueurs >=8px avec anneau de surface, repère vertical + infobulle unique
 * listant toutes les séries au survol, légende toujours présente si >=2 séries. */
export default function LineChart({ series, formatValue = (v) => v.toLocaleString('fr-FR'), emptyLabel = 'Aucune donnée sur cette période.' }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const { dates, byDate, maxY } = useMemo(() => {
    const dateSet = new Set();
    for (const s of series) for (const p of s.points) dateSet.add(p.x);
    const sortedDates = [...dateSet].sort();
    const lookup = sortedDates.map((d) => {
      const row = { date: d };
      for (const s of series) {
        const found = s.points.find((p) => p.x === d);
        row[s.key] = found ? found.y : 0;
      }
      return row;
    });
    const max = niceMax(Math.max(1, ...lookup.flatMap((r) => series.map((s) => r[s.key] || 0))));
    return { dates: sortedDates, byDate: lookup, maxY: max };
  }, [series]);

  const hasData = dates.length > 0 && series.some((s) => s.points.some((p) => p.y > 0));

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const xFor = (i) => PAD.left + (dates.length <= 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW);
  const yFor = (v) => PAD.top + innerH - (v / maxY) * innerH;

  const yTicks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxY * t)))];

  if (!hasData) {
    return <div className="grid h-[260px] place-items-center text-sm text-slate-400">{emptyLabel}</div>;
  }

  const onMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const xPx = xRatio * WIDTH;
    let closest = 0;
    let bestDist = Infinity;
    dates.forEach((_, i) => {
      const dist = Math.abs(xFor(i) - xPx);
      if (dist < bestDist) { bestDist = dist; closest = i; }
    });
    setHoverIndex(closest);
  };

  const hoverRow = hoverIndex != null ? byDate[hoverIndex] : null;

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yFor(t)} y2={yFor(t)} stroke="#E2E8F0" strokeWidth="1" />
              <text x={PAD.left - 8} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#94A3B8">
                {t.toLocaleString('fr-FR')}
              </text>
            </g>
          ))}

          {dates.map((d, i) => (
            i % Math.ceil(dates.length / 7 || 1) === 0 && (
              <text key={d} x={xFor(i)} y={HEIGHT - 8} textAnchor="middle" fontSize="10" fill="#94A3B8">
                {formatDayLabel(d)}
              </text>
            )
          ))}

          {series.map((s) => {
            const points = dates.map((d, i) => `${xFor(i)},${yFor(byDate[i][s.key] || 0)}`).join(' ');
            const last = dates.length - 1;
            return (
              <g key={s.key}>
                <polyline points={points} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={xFor(last)} cy={yFor(byDate[last][s.key] || 0)} r="5" fill={s.color} stroke="#fff" strokeWidth="2" />
              </g>
            );
          })}

          {hoverIndex != null && (
            <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#94A3B8" strokeWidth="1" />
          )}
          {hoverIndex != null && series.map((s) => (
            <circle key={s.key} cx={xFor(hoverIndex)} cy={yFor(hoverRow[s.key] || 0)} r="5" fill={s.color} stroke="#fff" strokeWidth="2" />
          ))}
        </svg>

        {hoverRow && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
            style={{ left: `${(xFor(hoverIndex) / WIDTH) * 100}%`, transform: 'translateX(-50%)' }}
          >
            <p className="mb-1 font-medium text-slate-700">{formatDayLabel(hoverRow.date)}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-1.5 text-slate-600">
                <span className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-semibold text-slate-800">{formatValue(hoverRow[s.key] || 0)}</span>
                <span>{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
