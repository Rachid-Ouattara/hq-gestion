import { useState } from 'react';
import { Plus } from 'lucide-react';
import { post } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import DataTable from '../../components/DataTable.jsx';
import SlideOver from '../../components/SlideOver.jsx';

export default function CategoriesManager({ open, onClose, categories, onChanged }) {
  const toast = useToast();
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');

  const submit = async () => {
    try {
      await post('/stocks/categories', { nom, description });
      setNom('');
      setDescription('');
      toast.success('Enregistré');
      onChanged();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'nom', label: 'Nom' },
    { key: 'description', label: 'Description', render: (c) => c.description || '—' },
  ];

  return (
    <SlideOver open={open} onClose={onClose} title="Catégories d'articles">
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 p-3">
          <label className="label">Nouvelle catégorie</label>
          <div className="flex gap-2">
            <input className="input" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
            <input className="input" placeholder="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button className="btn-primary mt-2 w-full" onClick={submit} disabled={!nom.trim()}>
            <Plus size={16} /> Ajouter
          </button>
        </div>

        <DataTable columns={columns} rows={categories} emptyLabel="Aucune catégorie." />
      </div>
    </SlideOver>
  );
}
