'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, CheckCircle2, CreditCard, Gift, Loader2, Wallet, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

type OfferStatus = 'sent' | 'accepted' | 'payment_pending' | 'taken_by_other' | 'expired' | 'cancelled';

interface PromotionOffer {
  token: string;
  status: OfferStatus;
  beneficio: 'wallet' | 'discount';
  expires_at: string;
  cliente: { nombre: string };
  servicio: { id: number; nombre: string; duracion_minutos: number };
  empleado: { id: number; nombre: string };
  fecha_hora: string;
  precios: {
    original: string;
    final: string;
    descuento: string;
    senia: string;
    saldo_billetera: string;
  };
  turno_id?: number | null;
}

const money = (value: string | number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value || 0));

function PromotionConfirmInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [offer, setOffer] = useState<PromotionOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [paymentType, setPaymentType] = useState<'SENIA' | 'PAGO_COMPLETO'>('SENIA');
  const [paymentStarted, setPaymentStarted] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');

  useEffect(() => {
    const loadOffer = async () => {
      if (!token) {
        setError('El enlace de la oferta no es válido.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/promociones/${token}/`, {
          headers: { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'No se pudo cargar la oferta.');
        setOffer(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la oferta.');
      } finally {
        setLoading(false);
      }
    };

    loadOffer();
  }, [token]);

  const aceptarSinSaldo = async () => {
    if (!token) return;
    setProcessing(true);
    setError('');
    try {
      const res = await fetch(`/api/promociones/${token}/aceptar/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo aceptar la oferta.');
      setOffer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la oferta.');
    } finally {
      setProcessing(false);
    }
  };

  const iniciarPago = async () => {
    if (!token) return;
    setProcessing(true);
    setError('');
    try {
      const res = await fetch(`/api/promociones/${token}/pago/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ tipo_pago: paymentType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo iniciar el pago.');
      if (data.status === 'free' || data.status === 'accepted') {
        setOffer(data);
        return;
      }
      setPaymentStarted(true);
      setOffer(current => current ? { ...current, status: 'payment_pending' } : current);
      const target = data.init_point || data.sandbox_init_point;
      if (target) {
        setPaymentUrl(target);
        window.open(target, '_blank');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el pago.');
    } finally {
      setProcessing(false);
    }
  };

  const forzarPago = async () => {
    if (!token) return;
    setProcessing(true);
    setError('');
    try {
      const res = await fetch(`/api/promociones/${token}/forzar-pago/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo forzar el pago.');
      setOffer(data);
      setPaymentStarted(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo forzar el pago.');
    } finally {
      setProcessing(false);
    }
  };

  const fecha = offer ? new Date(offer.fecha_hora) : null;
  const saldo = Number(offer?.precios.saldo_billetera || 0);
  const montoElegido = paymentType === 'SENIA' ? Number(offer?.precios.senia || 0) : Number(offer?.precios.final || 0);
  const creditoAplicable = Math.min(saldo, montoElegido);
  const diferencia = Math.max(0, montoElegido - creditoAplicable);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-700" /></div>;
  }

  if (error && !offer) {
    return <StateCard title="No pudimos abrir la oferta" message={error} kind="error" />;
  }

  if (!offer) return null;

  if (offer.status === 'taken_by_other') {
    return <StateCard title="Oferta tomada" message="Esta oferta ya fue tomada por otro cliente." kind="error" />;
  }

  if (offer.status === 'expired' || offer.status === 'cancelled') {
    return <StateCard title="Oferta no disponible" message="Esta oferta ya no está disponible." kind="error" />;
  }

  if (offer.status === 'payment_pending') {
    return (
      <WaitingPaymentCard
        error={error}
        paymentUrl={paymentUrl}
        processing={processing}
        onForce={forzarPago}
      />
    );
  }

  if (offer.status === 'accepted') {
    return (
      <StateCard
        title="Tu turno quedó reservado"
        message={offer.beneficio === 'wallet' ? 'La reserva quedó confirmada con el pago seleccionado.' : 'Tu turno quedó pendiente. Podés pagar el día del turno.'}
        kind="success"
      />
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f5d0fe,_transparent_35%),linear-gradient(135deg,_#fff7ed,_#faf5ff)] px-4 py-8">
      <Card className="mx-auto max-w-2xl overflow-hidden border-purple-100 shadow-2xl">
        <CardHeader className="bg-linear-to-r from-purple-700 to-fuchsia-600 text-white">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
            <Gift className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Tenemos un turno para vos</CardTitle>
          <CardDescription className="text-purple-100">Revisá la propuesta y confirmá en pocos pasos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo continuar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {paymentStarted && (
            <Alert className="border-amber-200 bg-amber-50">
              <CreditCard className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-amber-900">
                Abrimos Mercado Pago en otra pestaña. Cuando el pago se apruebe, tu turno quedará confirmado.
              </AlertDescription>
            </Alert>
          )}

          {paymentUrl && (
            <Button className="w-full" variant="outline" onClick={() => window.open(paymentUrl, '_blank')}>
              Abrir Mercado Pago
            </Button>
          )}

          <div className="grid gap-3 rounded-2xl border bg-white p-4">
            <InfoRow label="Cliente" value={offer.cliente.nombre} />
            <InfoRow label="Servicio" value={offer.servicio.nombre} />
            <InfoRow label="Profesional" value={offer.empleado.nombre} />
            <InfoRow label="Fecha y hora" value={fecha ? fecha.toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' }) : 'A confirmar'} />
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
              <CalendarClock className="h-5 w-5 text-purple-700" />
              Detalle de la oferta
            </div>
            <InfoRow label="Precio habitual" value={money(offer.precios.original)} />
            {Number(offer.precios.descuento) > 0 && <InfoRow label="Beneficio" value={`-${money(offer.precios.descuento)}`} />}
            <InfoRow label="Total promocional" value={money(offer.precios.final)} strong />
          </div>

          {offer.beneficio === 'wallet' ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold text-emerald-950">
                <Wallet className="h-5 w-5" />
                Tu saldo disponible: {money(offer.precios.saldo_billetera)}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant={paymentType === 'SENIA' ? 'default' : 'outline'} onClick={() => setPaymentType('SENIA')}>Pagar seña</Button>
                <Button variant={paymentType === 'PAGO_COMPLETO' ? 'default' : 'outline'} onClick={() => setPaymentType('PAGO_COMPLETO')}>Pagar completo</Button>
              </div>
              <div className="mt-4 grid gap-1 text-sm text-emerald-950">
                <InfoRow label="Monto elegido" value={money(montoElegido)} />
                <InfoRow label="Saldo aplicado" value={`-${money(creditoAplicable)}`} />
                <InfoRow label="Diferencia a pagar" value={money(diferencia)} strong />
              </div>
            </div>
          ) : (
            <Alert className="border-purple-100 bg-purple-50">
              <AlertDescription className="text-purple-950">
                Al aceptar, tu turno queda pendiente y podés pagarlo el día de la visita.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={() => router.push('/login')}>Ingresar a mi cuenta</Button>
          {offer.beneficio === 'wallet' ? (
            <Button className="bg-purple-700 hover:bg-purple-800" onClick={iniciarPago} disabled={processing}>
              {processing ? 'Procesando...' : diferencia > 0 ? 'Reservar y pagar' : 'Reservar con mi saldo'}
            </Button>
          ) : (
            <Button className="bg-purple-700 hover:bg-purple-800" onClick={aceptarSinSaldo} disabled={processing}>
              {processing ? 'Procesando...' : 'Aceptar oferta'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}

function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? 'font-bold text-slate-950' : 'font-medium text-slate-800'}>{value}</span>
    </div>
  );
}

function StateCard({ title, message, kind }: { title: string; message: string; kind: 'success' | 'error' }) {
  const Icon = kind === 'success' ? CheckCircle2 : XCircle;
  return (
    <main className="min-h-screen bg-linear-to-br from-purple-50 to-orange-50 px-4 py-10">
      <Card className="mx-auto max-w-xl text-center shadow-xl">
        <CardContent className="space-y-4 pt-8">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${kind === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            <Icon className="h-9 w-9" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="text-base">{message}</CardDescription>
          <Button variant="outline" onClick={() => window.location.assign('/login')}>Ingresar a mi cuenta</Button>
        </CardContent>
      </Card>
    </main>
  );
}

function WaitingPaymentCard({
  error,
  paymentUrl,
  processing,
  onForce,
}: {
  error: string;
  paymentUrl: string;
  processing: boolean;
  onForce: () => void;
}) {
  return (
    <main className="min-h-screen bg-linear-to-br from-purple-50 to-orange-50 px-4 py-10">
      <Card className="mx-auto max-w-xl shadow-xl">
        <CardContent className="space-y-5 pt-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Loader2 className="h-9 w-9 animate-spin" />
          </div>
          <CardTitle>Esperando confirmación de Mercado Pago</CardTitle>
          <CardDescription className="text-base">
            Cuando Mercado Pago confirme la operación, el turno se registrará automáticamente.
          </CardDescription>
          {error && (
            <Alert variant="destructive" className="text-left">
              <AlertTitle>No se pudo continuar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {paymentUrl && (
            <Button variant="outline" onClick={() => window.open(paymentUrl, '_blank')}>
              Abrir Mercado Pago
            </Button>
          )}
          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={onForce}
              disabled={processing}
              className="text-xs text-slate-400 underline-offset-4 hover:text-slate-600 hover:underline disabled:opacity-50"
            >
              {processing ? 'Procesando...' : 'forzar pago'}
            </button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function PromotionConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <PromotionConfirmInner />
    </Suspense>
  );
}
