import { Plus, Trash2 } from 'lucide-react';

const EMPTY_ROW = { designation: '', quantite: '1', unite: '', prix: '0' };

export default function LineItemsEditor({ lines, onChange, priceLabel = 'Prix unitaire', priceKey = 'prix' }) {
  const update = (index, field, value) => {
    const next = lines.map((l, i) => (i === index ? { ...l, [field]: value } : l));
    onChange(next);
  };

  const addRow = () => onChange([...lines, { ...EMPTY_ROW }]);
  const removeRow = (index) => onChange(lines.filter((_, i) => i !== index));

  const total = lines.reduce((sum, l) => sum + (Number(l.quantite) || 0) * (Number(l[priceKey]) || 0), 0);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2">Désignation</th>
              <th className="px-3 py-2">Qté</th>
              <th className="px-3 py-2">Unité</th>
              <th className="px-3 py-2">{priceLabel}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5">
                  <input
                    className="input"
                    value={l.designation}
                    onChange={(e) => update(i, 'designation', e.target.value)}
                    placeholder="Article ou service"
                  />
                </td>
                <td className="w-24 px-2 py-1.5">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.quantite}
                    onChange={(e) => update(i, 'quantite', e.target.value)}
                  />
                </td>
                <td className="w-24 px-2 py-1.5">
                  <input className="input" value={l.unite} onChange={(e) => update(i, 'unite', e.target.value)} placeholder="u." />
                </td>
                <td className="w-32 px-2 py-1.5">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={l[priceKey]}
                    onChange={(e) => update(i, priceKey, e.target.value)}
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={lines.length <= 1}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={addRow} className="btn-ghost mt-2 !py-1.5 text-xs">
        <Plus size={14} /> Ajouter une ligne
      </button>

      <p className="mt-2 text-right text-sm font-medium text-slate-600">
        Total : {total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}
