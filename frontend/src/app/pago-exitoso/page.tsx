'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CalendarDays, CheckCircle2, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PagoExitosoPage() {
  const router = useRouter();
  const [paymentInfo, setPaymentInfo] = useState<{
    paymentId: string | null;
    status: string | null;
    externalReference: string | null;
    merchantOrderId: string | null;
  }>({ paymentId: null, status: null, externalReference: null, merchantOrderId: null });

  useEffect(() => {
    // Mercado Pago envía estos parámetros en la URL luego del pago
    const params = new URLSearchParams(window.location.search);
    setPaymentInfo({
      paymentId: params.get('payment_id'),
      status: params.get('status'),
      externalReference: params.get('external_reference'),
      merchantOrderId: params.get('merchant_order_id'),
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2 pt-10">
          {/* Icono check animado */}
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-green-100 p-5 shadow-inner">
              <CheckCircle2 className="h-16 w-16 text-green-500" strokeWidth={1.5} />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">¡Pago Confirmado!</h1>
          <p className="text-gray-500 text-base">Tu turno ha sido reservado con éxito.</p>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-4 pb-10 pt-4 px-8">
          {/* Detalle del pago si MP envió parámetros */}
          {paymentInfo.paymentId && (
            <div className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span className="font-medium">ID de pago:</span>
                <span className="font-mono">{paymentInfo.paymentId}</span>
              </div>
              {paymentInfo.status && (
                <div className="flex justify-between">
                  <span className="font-medium">Estado:</span>
                  <span className="capitalize text-green-600 font-semibold">{paymentInfo.status}</span>
                </div>
              )}
              {paymentInfo.merchantOrderId && (
                <div className="flex justify-between">
                  <span className="font-medium">Orden:</span>
                  <span className="font-mono">{paymentInfo.merchantOrderId}</span>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-sm text-gray-400 mt-1">
            Recibirás una confirmación por correo electrónico en breve.
          </p>

          {/* Botones de acción */}
          <div className="flex flex-col w-full gap-3 mt-2">
            <Button
              onClick={() => router.push('/dashboard/cliente/turnos')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-5"
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Ver Mis Turnos
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              className="w-full py-5 text-gray-600 border-gray-300 hover:bg-gray-50"
            >
              <Home className="mr-2 h-4 w-4" />
              Volver al Inicio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
