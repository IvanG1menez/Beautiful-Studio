'use client';

export const dynamic = 'force-dynamic';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ArrowLeft, CalendarDays, CheckCircle2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TurnoFinalizadoPage() {
  const router = useRouter();
  const params = useSearchParams();
  const turnoId = params.get('turno_id');

  const [info, setInfo] = useState<{ turnoId: string | null }>({ turnoId });

  useEffect(() => {
    setInfo({ turnoId: turnoId });
  }, [turnoId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2 pt-10">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-green-100 p-5 shadow-inner">
              <CheckCircle2 className="h-16 w-16 text-green-500" strokeWidth={1.5} />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Turno finalizado con éxito</h1>
          <p className="text-gray-500 text-base">Se registró el pago y se finalizó el turno correctamente.</p>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-4 pb-10 pt-4 px-8">
          {info.turnoId && (
            <div className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span className="font-medium">ID de Turno:</span>
                <span className="font-mono">{info.turnoId}</span>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-gray-400 mt-1">Se enviará la comprobación correspondiente al cliente.</p>

          <div className="flex flex-col w-full gap-3 mt-2">
            <Button
              onClick={() => router.push('/dashboard/profesional/agenda')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-5"
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Volver a Agenda
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="w-full py-5 text-gray-600 border-gray-300 hover:bg-gray-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Ir atrás
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
