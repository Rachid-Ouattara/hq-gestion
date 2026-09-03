const DEFAULT_STYLE = 'bg-slate-100 text-slate-500';

export default function StatusBadge({ status, map }) {
  const entry = map[status] || { label: status, className: DEFAULT_STYLE };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${entry.className}`}>
      {entry.label}
    </span>
  );
}
