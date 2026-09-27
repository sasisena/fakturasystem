import { useRoute } from './router.ts';
import { CustomerDetail, Customers } from './pages/Customers.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { InvoiceDetail } from './pages/InvoiceDetail.tsx';
import { InvoiceEditor } from './pages/InvoiceEditor.tsx';
import { Invoices } from './pages/Invoices.tsx';
import { Settings } from './pages/Settings.tsx';

const NAV: [string, string, string][] = [
  ['', 'Oversikt', '◧'],
  ['fakturaer', 'Fakturaer', '▤'],
  ['ny', 'Ny', '+'],
  ['kunder', 'Kunder', '◉'],
  ['innstillinger', 'Firma', '⚙'],
];

function Page({ route }: { route: string[] }) {
  const [section = '', rawId, sub] = route;
  const [idPart, query = ''] = (rawId ?? '').split('?');
  const id = Number(idPart);
  switch (section.split('?')[0]) {
    case '':
      return <Dashboard />;
    case 'ny':
      return <InvoiceEditor />;
    case 'fakturaer':
      if (id && sub === 'rediger') return <InvoiceEditor key={id} id={id} />;
      if (id) return <InvoiceDetail key={id} id={id} />;
      return <Invoices filter={new URLSearchParams(section.split('?')[1] ?? query).get('status') ?? ''} />;
    case 'kunder':
      return id ? <CustomerDetail key={id} id={id} /> : <Customers />;
    case 'innstillinger':
      return <Settings />;
    default:
      return <p>Fant ikke siden.</p>;
  }
}

export function App() {
  const route = useRoute();
  const current = (route[0] ?? '').split('?')[0];
  return (
    <div className="app">
      <nav className="nav">
        <a href="#/" className="brand">
          Faktura
        </a>
        {NAV.map(([path, label, icon]) => (
          <a key={path} href={`#/${path}`} className={`${current === path ? 'active' : ''} ${path === 'ny' ? 'new' : ''}`}>
            <span className="icon" aria-hidden>
              {icon}
            </span>
            <span className="label">{label}</span>
          </a>
        ))}
      </nav>
      <main>
        <Page route={route} />
      </main>
    </div>
  );
}
