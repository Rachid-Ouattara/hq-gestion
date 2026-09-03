export default function StatCard({ label, value, Icon, accent = false }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        {Icon && <Icon size={18} className={accent ? 'text-hq-orange' : 'text-hq-ink'} />}
      </div>
      <p className="text-2xl font-semibold text-hq-blue">{value ?? '—'}</p>
    </div>
  );
}
