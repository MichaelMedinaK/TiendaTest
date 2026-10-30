import { QuoteForm } from './QuoteForm';

export const dynamic = 'force-dynamic';

export default function DeliveryQuotePage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Cotizar envio</h1>
        <p className="text-sm text-slate-500">Consulta cuanto cuesta el delivery hasta una direccion</p>
      </header>

      <QuoteForm />
    </section>
  );
}
