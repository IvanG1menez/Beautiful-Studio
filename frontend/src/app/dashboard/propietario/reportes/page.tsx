'use client';

import { Badge } from '@/components/ui/badge';
import { BeautifulSpinner } from '@/components/ui/BeautifulSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getAuthHeaders } from '@/lib/auth-headers';
import { CalendarDays, ChevronDown, ChevronRight, DollarSign, Filter, RefreshCcw, Search, ShieldCheck, Users } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { PrintReportButton } from './_components/PrintReportButton';

type TableValue = string | number | boolean | null | undefined | string[] | Record<string, unknown> | Array<Record<string, unknown>>;

interface OperativeReport {
  fecha_desde: string;
  fecha_hasta: string;
  resumen: {
    turnos: number;
    clientes: number;
    ofertas: number;
    ingresos: number;
  };
  turnos: TableRowData[];
  clientes: TableRowData[];
  ofertas: TableRowData[];
  profesionales: TableRowData[];
  salas: TableRowData[];
  servicios: TableRowData[];
  finanzas: TableRowData[];
  cambios: TableRowData[];
}

type TableRowData = Record<string, TableValue>;

const sections = [
  { key: 'turnos', title: 'Turnos', description: 'Historial operativo con estado, pago, canal y último cambio.', color: 'from-blue-50 to-sky-50', accent: 'border-blue-200', badge: 'bg-blue-600 hover:bg-blue-600' },
  { key: 'clientes', title: 'Clientes', description: 'Actividad real por cliente, visitas, gasto, Telegram y ofertas.', color: 'from-violet-50 to-purple-50', accent: 'border-violet-200', badge: 'bg-violet-600 hover:bg-violet-600' },
  { key: 'ofertas', title: 'Ofertas y Automatizaciones', description: 'Eventos PA1, PA2 y PA3 con resultado y turno asociado.', color: 'from-cyan-50 to-sky-50', accent: 'border-cyan-200', badge: 'bg-cyan-600 hover:bg-cyan-600' },
  { key: 'profesionales', title: 'Profesionales', description: 'Turnos asignados, completados, cancelados e ingresos asociados.', color: 'from-indigo-50 to-blue-50', accent: 'border-indigo-200', badge: 'bg-indigo-600 hover:bg-indigo-600' },
  { key: 'salas', title: 'Salas', description: 'Uso de salas, capacidad, actividad y estado.', color: 'from-amber-50 to-orange-50', accent: 'border-amber-200', badge: 'bg-amber-600 hover:bg-amber-600' },
  { key: 'servicios', title: 'Servicios', description: 'Reservas, ingresos, clientes y última actividad por servicio.', color: 'from-emerald-50 to-teal-50', accent: 'border-emerald-200', badge: 'bg-emerald-600 hover:bg-emerald-600' },
  { key: 'finanzas', title: 'Finanzas', description: 'Pagos, billetera, montos, estados y detalle financiero.', color: 'from-lime-50 to-emerald-50', accent: 'border-lime-200', badge: 'bg-lime-700 hover:bg-lime-700' },
  { key: 'cambios', title: 'Cambios del Sistema', description: 'Trazabilidad de actor, canal, motivo y campos modificados.', color: 'from-rose-50 to-red-50', accent: 'border-rose-200', badge: 'bg-rose-600 hover:bg-rose-600' },
] as const;

const columns: Record<string, Array<{ key: string; label: string }>> = {
  turnos: [
    { key: 'fecha', label: 'Fecha' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'servicio', label: 'Servicio' },
    { key: 'estado', label: 'Estado' },
    { key: 'canal', label: 'Canal' },
    { key: 'ultimo_cambio', label: 'Último cambio' },
  ],
  clientes: [
    { key: 'nombre', label: 'Cliente' },
    { key: 'telegram', label: 'Telegram' },
    { key: 'ultima_visita', label: 'Última visita' },
    { key: 'dias_sin_venir', label: 'Días sin venir' },
    { key: 'turnos', label: 'Turnos' },
  ],
  ofertas: [
    { key: 'pa', label: 'Automatización' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'estado', label: 'Estado' },
    { key: 'resultado', label: 'Resultado' },
  ],
  profesionales: [
    { key: 'nombre', label: 'Profesional' },
    { key: 'turnos', label: 'Turnos' },
    { key: 'completados', label: 'Completados' },
    { key: 'cancelados', label: 'Cancelados' },
    { key: 'estado', label: 'Estado' },
  ],
  salas: [
    { key: 'nombre', label: 'Sala' },
    { key: 'capacidad', label: 'Capacidad' },
    { key: 'turnos', label: 'Turnos' },
    { key: 'activos', label: 'Activos' },
    { key: 'estado', label: 'Estado' },
  ],
  servicios: [
    { key: 'nombre', label: 'Servicio' },
    { key: 'categoria', label: 'Categoría' },
    { key: 'turnos', label: 'Turnos' },
    { key: 'ingresos', label: 'Ingresos' },
  ],
  finanzas: [
    { key: 'fecha', label: 'Fecha' },
    { key: 'entidad', label: 'Entidad' },
    { key: 'actor', label: 'Cliente/actor' },
    { key: 'accion', label: 'Acción' },
    { key: 'monto', label: 'Monto' },
    { key: 'estado', label: 'Estado' },
  ],
  cambios: [
    { key: 'fecha', label: 'Fecha' },
    { key: 'entidad', label: 'Entidad' },
    { key: 'objeto_id', label: 'ID' },
    { key: 'accion', label: 'Acción' },
    { key: 'actor', label: 'Actor' },
    { key: 'canal', label: 'Canal' },
  ],
};

const hiddenKeys = new Set(['id']);

const today = new Date();
const defaultFrom = new Date(today);
defaultFrom.setDate(today.getDate() - 90);

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value: TableValue) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
}

function formatDate(value: TableValue) {
  if (!value || typeof value !== 'string') return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function renderValue(key: string, value: TableValue) {
  if (Array.isArray(value) && value.some((item) => typeof item === 'object')) return `${value.length} registros`;
  if (value && typeof value === 'object' && !Array.isArray(value)) return 'Ver detalle';
  if (key.includes('fecha') || key.includes('ultima') || key === 'ultimo_turno') return formatDate(value);
  if (key.includes('monto') || key.includes('ingresos') || key.includes('gasto')) return formatCurrency(value);
  if (key === 'telegram') return value ? <Badge className="bg-sky-600 hover:bg-sky-600">Vinculado</Badge> : <Badge variant="outline">No</Badge>;
  if (key === 'canal') return <Badge className={String(value).toLowerCase() === 'telegram' ? 'bg-sky-600 hover:bg-sky-600' : ''} variant={String(value).toLowerCase() === 'telegram' ? 'default' : 'outline'}>{String(value || 'panel')}</Badge>;
  if (key === 'estado') return <Badge className="border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-100" variant="outline">{String(value || '-')}</Badge>;
  if (key === 'pa') return <Badge className="bg-cyan-600 hover:bg-cyan-600">{String(value || '-')}</Badge>;
  if (key === 'accion') return <Badge className="bg-rose-600 hover:bg-rose-600">{String(value || '-')}</Badge>;
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return value === null || value === undefined || value === '' ? '-' : String(value);
}

function labelFor(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderDetailValue(key: string, value: TableValue) {
  if (Array.isArray(value) && value.some((item) => typeof item === 'object')) {
    return (
      <div className="space-y-2">
        {(value as Array<Record<string, unknown>>).map((item, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid gap-2 md:grid-cols-3">
              {Object.entries(item).map(([itemKey, itemValue]) => (
                <div key={itemKey}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{labelFor(itemKey)}</p>
                  <div className="text-sm text-slate-800">{renderValue(itemKey, itemValue as TableValue)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return renderValue(key, value);
}

function DataSection({ title, description, rows, tableColumns, color, accent, badge }: { title: string; description: string; rows: TableRowData[]; tableColumns: Array<{ key: string; label: string }>; color: string; accent: string; badge: string }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('7');
  const visibleCount = Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / visibleCount));
  const visibleRows = rows.slice((page - 1) * visibleCount, page * visibleCount);
  const visibleColumnKeys = new Set(tableColumns.map((column) => column.key));

  const toggleRow = (key: string) => {
    setExpandedKey((current) => current === key ? null : key);
  };

  return (
    <Card className={`overflow-hidden border-2 ${accent} shadow-sm`}>
      <CardHeader className={`border-b bg-gradient-to-r ${color}`}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={badge}>{rows.length} resultados</Badge>
            <Select value={pageSize} onValueChange={(value) => { setPageSize(value); setPage(1); }}>
              <SelectTrigger className="h-8 w-[110px] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 por página</SelectItem>
                <SelectItem value="7">7 por página</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-white/80">
              <TableHead className="w-10" />
              {tableColumns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tableColumns.length + 1} className="h-24 text-center text-slate-500">
                  No hay datos para los filtros aplicados.
                </TableCell>
              </TableRow>
            ) : visibleRows.map((row, index) => {
              const rowKey = `${row.id || title}-${(page - 1) * visibleCount + index}`;
              const isExpanded = expandedKey === rowKey;
              const detailEntries = Object.entries(row).filter(([key]) => !hiddenKeys.has(key));
              return (
                <Fragment key={rowKey}>
                  <TableRow key={rowKey} className="h-16 cursor-pointer bg-white transition hover:bg-slate-50" onClick={() => toggleRow(rowKey)}>
                    <TableCell>{isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}</TableCell>
                    {tableColumns.map((column) => (
                      <TableCell key={column.key} className="max-w-[260px] overflow-hidden text-ellipsis py-4">
                        {renderValue(column.key, row[column.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${rowKey}-detail`} className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableCell colSpan={tableColumns.length + 1} className="p-4">
                        <div className={`rounded-xl border ${accent} bg-white p-4 shadow-sm`}>
                          <div className="mb-3 flex items-center justify-between">
                            <p className="font-semibold text-slate-900">Detalle completo</p>
                            <Badge variant="outline">Click en la fila para cerrar</Badge>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {detailEntries.map(([key, value]) => (
                              <div key={key} className={`rounded-lg border p-3 ${visibleColumnKeys.has(key) ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{labelFor(key)}</p>
                                <div className="whitespace-normal break-words text-sm text-slate-800">{renderDetailValue(key, value)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        {rows.length > visibleCount && (
          <div className="flex flex-col gap-3 border-t bg-white px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AuditoriaReportesHubPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<OperativeReport | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    fecha_desde: formatDateInput(defaultFrom),
    fecha_hasta: formatDateInput(today),
    search: '',
    cliente: '',
    profesional: '',
    servicio: '',
    sala: '',
    estado: 'todos',
    canal: 'todos',
    tipo: 'todos',
  });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'todos') params.append(key, value);
      });
      const response = await fetch(`/api/turnos/reportes/auditoria-operativa/?${params.toString()}`, { headers: getAuthHeaders() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.error || 'No se pudo cargar el reporte');
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      fecha_desde: formatDateInput(defaultFrom),
      fecha_hasta: formatDateInput(today),
      search: '',
      cliente: '',
      profesional: '',
      servicio: '',
      sala: '',
      estado: 'todos',
      canal: 'todos',
      tipo: 'todos',
    });
  };

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Auditoría y Reportes</h1>
          <p className="mt-1 text-slate-600">Tablas operativas filtrables para que cada búsqueda cambie datos concretos.</p>
        </div>
        <PrintReportButton />
      </div>

      <div className="mx-auto max-w-[1500px] space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Usá búsqueda general para cliente, profesional, servicio, sala o email. Los filtros exactos están en “Más filtros”.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="space-y-2"><Label>Desde</Label><Input type="date" value={filters.fecha_desde} onChange={(event) => updateFilter('fecha_desde', event.target.value)} /></div>
              <div className="space-y-2"><Label>Hasta</Label><Input type="date" value={filters.fecha_hasta} onChange={(event) => updateFilter('fecha_hasta', event.target.value)} /></div>
              <div className="space-y-2 xl:col-span-2"><Label>Buscar</Label><Input placeholder="Cliente, profesional, servicio, sala o email" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') fetchData(); }} /></div>
              <div className="space-y-2">
                <Label>Ver</Label>
                <Select value={filters.tipo} onValueChange={(value) => updateFilter('tipo', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todo</SelectItem>
                    {sections.map((section) => <SelectItem key={section.key} value={section.key}>{section.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={filters.estado} onValueChange={(value) => updateFilter('estado', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="en_proceso">En proceso</SelectItem>
                    <SelectItem value="completado">Completado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                    <SelectItem value="no_asistio">No asistió</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select value={filters.canal} onValueChange={(value) => updateFilter('canal', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="panel">Panel</SelectItem>
                    <SelectItem value="web">Web</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="sistema">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" className="w-full" onClick={() => setShowAdvancedFilters((current) => !current)}>
                  <Filter className="mr-2 h-4 w-4" />
                  {showAdvancedFilters ? 'Ocultar filtros' : 'Más filtros'}
                </Button>
              </div>
            </div>
            {showAdvancedFilters && (
              <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2"><Label>Cliente exacto</Label><Input placeholder="Nombre, email o DNI" value={filters.cliente} onChange={(event) => updateFilter('cliente', event.target.value)} /></div>
                <div className="space-y-2"><Label>Profesional exacto</Label><Input placeholder="Nombre o email" value={filters.profesional} onChange={(event) => updateFilter('profesional', event.target.value)} /></div>
                <div className="space-y-2"><Label>Servicio exacto</Label><Input placeholder="Nombre del servicio" value={filters.servicio} onChange={(event) => updateFilter('servicio', event.target.value)} /></div>
                <div className="space-y-2"><Label>Sala exacta</Label><Input placeholder="Nombre de sala" value={filters.sala} onChange={(event) => updateFilter('sala', event.target.value)} /></div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={fetchData} disabled={loading}><Search className="mr-2 h-4 w-4" />Buscar</Button>
              <Button variant="outline" onClick={clearFilters}><RefreshCcw className="mr-2 h-4 w-4" />Limpiar</Button>
            </div>
          </CardContent>
        </Card>

        {error && <Card className="border-red-200 bg-red-50"><CardContent className="py-4 text-red-700">{error}</CardContent></Card>}

        {data && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="pt-6"><CalendarDays className="h-6 w-6 text-blue-600" /><p className="mt-3 text-2xl font-bold">{data.resumen.turnos}</p><p className="text-sm text-slate-500">Turnos encontrados</p></CardContent></Card>
            <Card><CardContent className="pt-6"><Users className="h-6 w-6 text-purple-600" /><p className="mt-3 text-2xl font-bold">{data.resumen.clientes}</p><p className="text-sm text-slate-500">Clientes con actividad</p></CardContent></Card>
            <Card><CardContent className="pt-6"><ShieldCheck className="h-6 w-6 text-sky-600" /><p className="mt-3 text-2xl font-bold">{data.resumen.ofertas}</p><p className="text-sm text-slate-500">Eventos PA/ofertas</p></CardContent></Card>
            <Card><CardContent className="pt-6"><DollarSign className="h-6 w-6 text-emerald-600" /><p className="mt-3 text-2xl font-bold">{formatCurrency(data.resumen.ingresos)}</p><p className="text-sm text-slate-500">Ingresos completados</p></CardContent></Card>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><BeautifulSpinner /></div>
        ) : data && sections.map((section) => {
          if (filters.tipo !== 'todos' && filters.tipo !== section.key) return null;
          return <DataSection key={section.key} title={section.title} description={section.description} rows={data[section.key]} tableColumns={columns[section.key]} color={section.color} accent={section.accent} badge={section.badge} />;
        })}
      </div>
    </div>
  );
}
