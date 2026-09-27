import { useState } from 'react';
import { api } from '../api.ts';
import { navigate } from '../router.ts';
import { ErrorBox, Loading, useLoad } from '../ui.tsx';
import { CustomerForm } from './CustomerForm.tsx';

export function Customers() {
  const [customers, error, reload] = useLoad(api.customers);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  if (error) return <ErrorBox error={error} />;
  if (!customers) return <Loading />;
  const q = query.toLowerCase();
  const shown = customers.filter((c) => c.name.toLowerCase().includes(q) || c.orgNumber.includes(q));

  return (
    <>
      <header className="page-head">
        <h1>Kunder</h1>
        {!adding && <button onClick={() => setAdding(true)}>+ Ny kunde</button>}
      </header>
      {adding && (
        <section className="card">
          <h2>Ny kunde</h2>
          <CustomerForm
            onSaved={() => {
              setAdding(false);
              reload();
            }}
            onCancel={() => setAdding(false)}
          />
        </section>
      )}
      {customers.length > 5 && <input type="search" placeholder="Søk" value={query} onChange={(e) => setQuery(e.target.value)} className="search" />}
      {customers.length === 0 && !adding && <p className="muted">Ingen kunder ennå.</p>}
      <ul className="list">
        {shown.map((c) => (
          <li key={c.id}>
            <a href={`#/kunder/${c.id}`}>
              <strong>{c.name}</strong>
              <span className="muted">{[c.email, c.city].filter(Boolean).join(' · ')}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

export function CustomerDetail({ id }: { id: number }) {
  const [customer, error] = useLoad(() => api.customer(id), [id]);
  const [deleteError, setDeleteError] = useState<unknown>(null);
  if (error) return <ErrorBox error={error} />;
  if (!customer) return <Loading />;

  const remove = async () => {
    if (!confirm(`Slette ${customer.name}?`)) return;
    try {
      await api.deleteCustomer(id);
      navigate('/kunder');
    } catch (e) {
      setDeleteError(e);
    }
  };

  return (
    <>
      <header className="page-head">
        <h1>{customer.name}</h1>
      </header>
      <section className="card">
        <CustomerForm initial={customer} onSaved={() => navigate('/kunder')} onCancel={() => navigate('/kunder')} />
      </section>
      <ErrorBox error={deleteError} />
      <button className="link danger" onClick={remove}>
        Slett kunde
      </button>
    </>
  );
}
