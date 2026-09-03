import { useEffect, useState } from 'react';
import { get } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import StatCard from './StatCard.jsx';

function formatValue(value, format) {
  if (value == null) return undefined;
  return format === 'currency'
    ? Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2 })
    : String(value);
}

export default function ModuleOverview({ moduleCode, metrics }) {
  const toast = useToast();
  const [kpi, setKpi] = useState(null);

  useEffect(() => {
    get(`/${moduleCode}/kpi`).then(setKpi).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleCode]);

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">Aperçu du module — indicateurs clés.</p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map(({ key, label, Icon, format }) => (
          <StatCard key={key} label={label} Icon={Icon} value={kpi ? formatValue(kpi[key], format) : undefined} />
        ))}
      </div>
    </div>
  );
}
