'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAuthHeaders } from '@/lib/auth-headers';
import { formatCurrency } from '@/lib/utils';
import { CalendarDays, Filter, Loader2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PrintReportButton } from './PrintReportButton';

interface TurnoSummary {
  id: number;
  fecha_hora: string | null;
  estado: string;
  cliente: string;
  profesional: string;
  servicio: string;
  sala: string;
  metodo_pago: string;
  precio_final: number;
}

interface ReportRow {
  id: number;
  nombre: string;
  email?: string;
  activo?: boolean;
  disponible?: boolean;
  capacidad_simultanea?: number;
  total_turnos: number;
  reservados_activos?: number;
  completados: number;
  cancelados?: number;
  ingresos: number;
  ultimo_turno?: TurnoSummary | null;
  ultimo_turno_agendado?: TurnoSummary | null;
  ultimo_turno_en_sala?: TurnoSummary | null;
  ultimo_turno_ofrecido?: TurnoSummary | null;
}

interface ReportData {
  resumen: Record<string, number>;
  registros: ReportRow[];
}

interface Props {
  title: string;
  description: string;
  endpoint: string;
  entityLabel: string;
  mode: 'clientes' | 'salas' | 'profesionales';
}

const ESTADOS = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'no_asistio', label: 'No asistió' },
];

export function OperationalReportPage({ title, description, endpoint, entityLabel, mode }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const past = new Date();
  past.setDate(past.getDate() - 90);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState(past.toISOString().slice(0, 10));
  const [fechaHasta, setFechaHasta] = useState(today);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (estado !== 'todos') params.set('estado', estado);
      if (fechaDesde) params.set('fecha_desde', fechaDesde);
      if (fechaHasta) params.set('fecha_hasta', fechaHasta);

      const response = await fetch(`/api/turnos/reportes/${endpoint}/?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setData(await response.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const chartMax = Math.max(1, ...(data?.registros ?? []).map((row) => row.total_turnos));
  const ingresosMax = Math.max(1, ...(data?.registros ?? []).map((row) => row.ingresos));

  const renderTurno = (label: string, turno?: TurnoSummary | null) => (
    <div className="rounded-lg border bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      {turno ? (
        <div className="mt-2 space-y-1 text-sm">
          <p className="font-medium">#{turno.id} · {formatDate(turno.fecha_hora)}</p>
          <p>{turno.cliente} · {turno.servicio}</p>
          <p className="text-slate-500">{turno.profesional} · {turno.sala}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline">{turno.estado}</Badge>
            <Badge variant="secondary">{turno.metodo_pago}</Badge>
            <Badge>{formatCurrency(turno.precio_final)}</Badge>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Sin turnos en el período.</p>
      )}
    </div>
  );

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900">
            <CalendarDays className="h-7 w-7 text-blue-600" />
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-slate-600">{description}</p>
        </div>
        <PrintReportButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros de reporte</CardTitle>
          <CardDescription>Filtrá por texto, estado del turno y rango de fechas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar cliente, servicio, sala o profesional" />
          </div>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ESTADOS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={fechaDesde} onChange={(event) => setFechaDesde(event.target.value)} />
          <Input type="date" value={fechaHasta} onChange={(event) => setFechaHasta(event.target.value)} />
          <Button onClick={() => void fetchData()} disabled={loading} className="md:col-start-5">
            <Filter className="mr-2 h-4 w-4" />
            Buscar
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-slate-500">{entityLabel}</p><p className="mt-2 text-3xl font-bold">{data?.registros.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-slate-500">Turnos filtrados</p><p className="mt-2 text-3xl font-bold">{data?.resumen.turnos ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-slate-500">Completados</p><p className="mt-2 text-3xl font-bold">{data?.registros.reduce((acc, row) => acc + row.completados, 0) ?? 0}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Actividad por {entityLabel.toLowerCase()}</CardTitle>
            <CardDescription>Comparativa de turnos del período filtrado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.registros ?? []).slice(0, 10).map((row) => (
              <div key={`turnos-${row.id}`} className="space-y-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{row.nombre}</span>
                  <span className="font-medium">{row.total_turnos}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${(row.total_turnos / chartMax) * 100}%` }} />
                </div>
              </div>
            ))}
            {!data?.registros.length && <p className="text-sm text-slate-500">Sin datos para graficar.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingresos asociados</CardTitle>
            <CardDescription>Ingresos de turnos completados del período.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.registros ?? []).slice(0, 10).map((row) => (
              <div key={`ingresos-${row.id}`} className="space-y-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{row.nombre}</span>
                  <span className="font-medium">{formatCurrency(row.ingresos)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${(row.ingresos / ingresosMax) * 100}%` }} />
                </div>
              </div>
            ))}
            {!data?.registros.length && <p className="text-sm text-slate-500">Sin datos para graficar.</p>}
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : (
        <div className="grid gap-4">
          {(data?.registros ?? []).map((row) => (
            <Card key={row.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>{row.nombre}</CardTitle>
                    {row.email && <CardDescription>{row.email}</CardDescription>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.activo !== undefined && <Badge variant={row.activo ? 'default' : 'secondary'}>{row.activo ? 'Activo' : 'Inactivo'}</Badge>}
                    {row.disponible !== undefined && <Badge variant="outline">{row.disponible ? 'Disponible' : 'No disponible'}</Badge>}
                    {row.capacidad_simultanea !== undefined && <Badge variant="outline">Capacidad {row.capacidad_simultanea}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div><p className="text-xs text-slate-500">Turnos</p><p className="text-xl font-bold">{row.total_turnos}</p></div>
                  <div><p className="text-xs text-slate-500">Completados</p><p className="text-xl font-bold">{row.completados}</p></div>
                  <div><p className="text-xs text-slate-500">Cancelados</p><p className="text-xl font-bold">{row.cancelados ?? 0}</p></div>
                  <div><p className="text-xs text-slate-500">Ingresos</p><p className="text-xl font-bold">{formatCurrency(row.ingresos)}</p></div>
                </div>
                {mode === 'salas' ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {renderTurno('Último turno agendado en la sala', row.ultimo_turno_agendado)}
                    {renderTurno('Último turno reservado para la sala', row.ultimo_turno_en_sala)}
                  </div>
                ) : mode === 'profesionales' ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {renderTurno('Último turno asignado', row.ultimo_turno)}
                    {renderTurno('Último turno ofrecido', row.ultimo_turno_ofrecido)}
                  </div>
                ) : (
                  renderTurno('Último turno reservado del cliente', row.ultimo_turno)
                )}
              </CardContent>
            </Card>
          ))}
          {!data?.registros.length && <Card><CardContent className="py-12 text-center text-slate-500">No hay datos para los filtros seleccionados.</CardContent></Card>}
        </div>
      )}
    </div>
  );
}
