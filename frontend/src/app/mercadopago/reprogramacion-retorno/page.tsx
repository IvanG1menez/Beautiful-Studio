'use client';

import { getAuthHeaders } from '@/lib/auth-headers';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function ReprogramacionRetornoContent() {
  const searchParams = useSearchParams();
  const [mensaje, setMensaje] = useState('Confirmando pago con Mercado Pago...');

  useEffect(() => {
    const confirmarPago = async () => {
      const paymentId =
        searchParams.get('payment_id') ||
        searchParams.get('collection_id') ||
        '';
      const preferenceId = searchParams.get('preference_id') || '';

      if (!paymentId) {
        setMensaje('No pudimos leer el identificador del pago. Volvé a la pestaña anterior.');
        return;
      }

      const params = new URLSearchParams({ payment_id: paymentId });
      if (preferenceId) params.set('preference_id', preferenceId);

      try {
        const response = await fetch(`/api/mercadopago/verificar-pago-retorno/?${params.toString()}`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json().catch(() => ({}));

        localStorage.setItem(
          'mp_reprogramacion_result',
          JSON.stringify({
            status: data.status,
            preference_id: data.preference_id || preferenceId,
            payment_id: data.payment_id || paymentId,
            turno_id: data.turno_id,
            timestamp: Date.now(),
          })
        );

        if (data.status === 'approved') {
          setMensaje('Pago aprobado. Ya podés volver a la pestaña anterior.');
        } else {
          setMensaje('El pago todavía no figura aprobado. Volvé a la pestaña anterior para reintentar.');
        }
      } catch (error) {
        console.error('Error confirmando pago de reprogramación:', error);
        setMensaje('Hubo un error confirmando el pago. Volvé a la pestaña anterior para reintentar.');
      }
    };

    void confirmarPago();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-purple-600" />
        <h1 className="text-2xl font-semibold text-slate-900">Reprogramación</h1>
        <p className="mt-3 text-slate-600">{mensaje}</p>
      </div>
    </div>
  );
}

export default function ReprogramacionRetornoPage() {
  return (
    <Suspense fallback={null}>
      <ReprogramacionRetornoContent />
    </Suspense>
  );
}
