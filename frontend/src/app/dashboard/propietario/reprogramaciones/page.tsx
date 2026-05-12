'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { formatDate as formatShortDate, formatTime } from '@/lib/dateUtils';
import { turnosService } from '@/services/turnos';
import { SolicitudReprogramacionFlexible } from '@/types';
import { AlertTriangle, ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function ReprogramacionesPropietarioPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudReprogramacionFlexible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [explicaciones, setExplicaciones] = useState<Record<number, string>>({});
  const [guardandoId, setGuardandoId] = useState<number | null>(null);

  const cargarSolicitudes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await turnosService.listarSolicitudesFlexibles({
        estado: 'vencidas',
        page_size: 100,
      });
      const results = response.results || [];
      setSolicitudes(results);
      setExplicaciones(
        results.reduce<Record<number, string>>((acc, solicitud) => {
          acc[solicitud.id] = solicitud.explicacion_vencimiento || '';
          return acc;
        }, {})
      );
    } catch (err: any) {
      console.error('Error cargando reprogramaciones vencidas:', err);
      setError(err.message || 'No se pudieron cargar las solicitudes vencidas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarSolicitudes();
  }, []);

  const guardarExplicacion = async (solicitudId: number) => {
    const explicacion = (explicaciones[solicitudId] || '').trim();
    if (!explicacion) {
      toast.error('Debes escribir una explicación antes de guardar');
      return;
    }

    try {
      setGuardandoId(solicitudId);
      const response = await turnosService.registrarExplicacionSolicitudFlexible(solicitudId, {
        explicacion,
      });
      setSolicitudes((prev) =>
        prev.map((solicitud) =>
          solicitud.id === solicitudId ? response.solicitud : solicitud
        )
      );
      toast.success(response.message);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo guardar la explicación');
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Reprogramaciones vencidas</h1>
            <p className="text-slate-600">
              Seguimiento de solicitudes flexibles que superaron el tiempo configurado.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void cargarSolicitudes()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Solicitudes pendientes vencidas
          </CardTitle>
          <CardDescription>
            Estas solicitudes siguen pendientes de asignación y requieren explicación operativa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando solicitudes vencidas...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && solicitudes.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
              No hay solicitudes vencidas pendientes de revisión.
            </div>
          )}

          {!loading && !error && solicitudes.map((solicitud) => {
            const turno = solicitud.turno;
            const original = `${formatShortDate(turno.fecha_hora)} ${formatTime(turno.fecha_hora)} hs`;
            const vencimiento = solicitud.expires_at
              ? `${formatShortDate(solicitud.expires_at)} ${formatTime(solicitud.expires_at)} hs`
              : 'Sin vencimiento';

            return (
              <div key={solicitud.id} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-900">{solicitud.cliente_nombre}</p>
                      <Badge variant="outline">{solicitud.servicio_nombre}</Badge>
                      <Badge className="bg-amber-100 text-amber-800">Vencida</Badge>
                    </div>
                    <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">Profesional</p>
                        <p>{solicitud.empleado_nombre}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">Turno original</p>
                        <p>{original}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-slate-500">Solicitud creada</p>
                        <p>{formatShortDate(solicitud.created_at)} {formatTime(solicitud.created_at)} hs</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-amber-700">Vencimiento</p>
                        <p>{vencimiento}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">Motivo del cliente:</span>{' '}
                      {solicitud.motivo || 'Sin motivo registrado'}
                    </p>
                  </div>

                  <div className="w-full space-y-2 lg:max-w-md">
                    <p className="text-sm font-semibold text-slate-900">Explicación para revisión</p>
                    <Textarea
                      value={explicaciones[solicitud.id] || ''}
                      onChange={(event) =>
                        setExplicaciones((prev) => ({
                          ...prev,
                          [solicitud.id]: event.target.value,
                        }))
                      }
                      rows={4}
                      placeholder="Ej: no hubo disponibilidad compatible, se contactó al cliente, queda pendiente de asignación..."
                    />
                    <Button
                      onClick={() => void guardarExplicacion(solicitud.id)}
                      disabled={guardandoId === solicitud.id}
                      className="w-full"
                    >
                      {guardandoId === solicitud.id ? 'Guardando...' : 'Guardar explicación'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
