'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAuthHeaders } from '@/lib/auth-headers';
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface RegistroAuditoria {
  id: string;
  fecha_hora: string;
  descripcion: string;
  monto: number | null;
  status: string;
  entidad: string;
  entidad_key: string;
  actor: string;
  actor_email: string;
  detalle: string;
  accion: string;
  accion_key: string;
}

interface ResumenAuditoria {
  total_registros: number;
  ingresos_totales: number;
  creditos_bonos_usados: number;
  balance_neto: number;
  total_creditos: number;
  total_debitos: number;
  saldo_total_sistema: number;
  billeteras_activas: number;
  total_movimientos: number;
}

interface ReporteAuditoriaData {
  fecha_desde: string;
  fecha_hasta: string;
  resumen: ResumenAuditoria;
  paginacion: {
    current_page: number;
    page_size: number;
    total_pages: number;
    total_items: number;
    has_next: boolean;
    has_previous: boolean;
  };
  orden: {
    sort_by: SortField;
    sort_dir: SortDirection;
  };
  filtros: {
    acciones: SelectOption[];
    entidades: SelectOption[];
  };
  registros: RegistroAuditoria[];
}

interface FiltrosState {
  accion: string;
  entidad: string;
  actor: string;
  status: string;
  monto_desde: string;
  monto_hasta: string;
  fecha_desde: string;
  fecha_hasta: string;
}

type SortField = 'fecha_hora' | 'monto' | 'status';
type SortDirection = 'asc' | 'desc';

const todayDate = new Date().toISOString().slice(0, 10);

const defaultFiltros: FiltrosState = {
  accion: 'todas',
  entidad: 'todas',
  actor: '',
  status: 'todos',
  monto_desde: '',
  monto_hasta: '',
  fecha_desde: '',
  fecha_hasta: todayDate,
};

export default function ReportesBilleteraPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReporteAuditoriaData | null>(null);
  const [filtros, setFiltros] = useState<FiltrosState>(defaultFiltros);
  const [draftFiltros, setDraftFiltros] = useState<FiltrosState>(defaultFiltros);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<SortField>('fecha_hora');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const fetchData = async (
    filtrosActuales: FiltrosState,
    options?: {
      page?: number;
      pageSize?: number;
      sortField?: SortField;
      sortDirection?: SortDirection;
      syncDraft?: boolean;
    }
  ) => {
    setLoading(true);
    try {
      const requestedPage = options?.page ?? currentPage;
      const requestedPageSize = options?.pageSize ?? pageSize;
      const requestedSortField = options?.sortField ?? sortField;
      const requestedSortDirection = options?.sortDirection ?? sortDirection;
      const shouldSyncDraft = options?.syncDraft ?? false;

      const params = new URLSearchParams();

      if (filtrosActuales.accion && filtrosActuales.accion !== 'todas') {
        params.set('accion', filtrosActuales.accion);
      }

      if (filtrosActuales.entidad && filtrosActuales.entidad !== 'todas') {
        params.set('entidad', filtrosActuales.entidad);
      }

      if (filtrosActuales.actor.trim()) {
        params.set('actor', filtrosActuales.actor.trim());
      }

      if (filtrosActuales.status !== 'todos') {
        params.set('status', filtrosActuales.status);
      }

      if (filtrosActuales.monto_desde.trim()) {
        params.set('monto_desde', filtrosActuales.monto_desde.trim());
      }

      if (filtrosActuales.monto_hasta.trim()) {
        params.set('monto_hasta', filtrosActuales.monto_hasta.trim());
      }

      if (filtrosActuales.fecha_desde) {
        params.set('fecha_desde', filtrosActuales.fecha_desde);
      }

      if (filtrosActuales.fecha_hasta) {
        params.set('fecha_hasta', filtrosActuales.fecha_hasta);
      }

      params.set('page', String(requestedPage));
      params.set('page_size', String(requestedPageSize));
      params.set('sort_by', requestedSortField);
      params.set('sort_dir', requestedSortDirection);

      const query = params.toString();
      const url = `/api/turnos/reportes/billetera/${query ? `?${query}` : ''}`;
      const response = await fetch(url, { headers: getAuthHeaders() });

      if (!response.ok) {
        throw new Error('No se pudo cargar la auditoría');
      }

      const result: ReporteAuditoriaData = await response.json();
      setData(result);

      const synced = {
        ...filtrosActuales,
        fecha_desde: filtrosActuales.fecha_desde || result.fecha_desde,
        fecha_hasta: filtrosActuales.fecha_hasta || result.fecha_hasta,
      };

      setFiltros(synced);
      if (shouldSyncDraft) {
        setDraftFiltros(synced);
      }
      setCurrentPage(result.paginacion.current_page);
      setPageSize(result.paginacion.page_size);
      setSortField(result.orden.sort_by);
      setSortDirection(result.orden.sort_dir);
    } catch (error) {
      console.error('Error fetching auditoria:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData(defaultFiltros, {
      page: 1,
      pageSize,
      sortField,
      sortDirection,
      syncDraft: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarFiltros = async () => {
    await fetchData(draftFiltros, {
      page: 1,
      pageSize,
      sortField,
      sortDirection,
      syncDraft: true,
    });
  };

  const statusOptions = Array.from(
    new Set((data?.registros ?? []).map((item) => item.status).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const registrosPaginados = data?.registros ?? [];
  const totalRegistrosFiltrados = data?.paginacion.total_items ?? 0;
  const totalPages = data?.paginacion.total_pages ?? 1;
  const safeCurrentPage = data?.paginacion.current_page ?? 1;

  const exportarCsv = async () => {
    if (!data || totalRegistrosFiltrados === 0) {
      return;
    }

    const params = new URLSearchParams();
    if (filtros.accion !== 'todas') params.set('accion', filtros.accion);
    if (filtros.entidad !== 'todas') params.set('entidad', filtros.entidad);
    if (filtros.actor.trim()) params.set('actor', filtros.actor.trim());
    if (filtros.status !== 'todos') params.set('status', filtros.status);
    if (filtros.monto_desde.trim()) params.set('monto_desde', filtros.monto_desde.trim());
    if (filtros.monto_hasta.trim()) params.set('monto_hasta', filtros.monto_hasta.trim());
    if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde);
    if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta);
    params.set('sort_by', sortField);
    params.set('sort_dir', sortDirection);
    params.set('page', '1');
    params.set('page_size', String(Math.min(200, Math.max(50, totalRegistrosFiltrados))));

    const response = await fetch(`/api/turnos/reportes/billetera/?${params.toString()}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      return;
    }

    const exportData: ReporteAuditoriaData = await response.json();
    const registrosExport = exportData.registros ?? [];

    const headers = [
      'Fecha y Hora',
      'Descripción',
      'Monto',
      'Status',
      'Entidad',
      'Actor',
      'Detalle',
      'Acción',
    ];

    const rows = registrosExport.map((item) => [
      formatDate(item.fecha_hora),
      item.descripcion,
      item.monto ?? '',
      item.status,
      item.entidad,
      item.actor,
      item.detalle,
      item.accion,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const toggleSort = (field: SortField) => {
    const nextSortField: SortField = field;
    let nextSortDirection: SortDirection = 'asc';

    if (sortField === field) {
      nextSortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      nextSortDirection = field === 'fecha_hora' ? 'desc' : 'asc';
    }

    setSortField(nextSortField);
    setSortDirection(nextSortDirection);
    setCurrentPage(1);
    void fetchData(filtros, {
      page: 1,
      pageSize,
      sortField: nextSortField,
      sortDirection: nextSortDirection,
      syncDraft: false,
    });
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5" />;
    }

    if (sortDirection === 'asc') {
      return <ChevronUp className="h-3.5 w-3.5" />;
    }

    return <ChevronDown className="h-3.5 w-3.5" />;
  };

  const getStatusStyles = (status: string) => {
    const normalized = status.toLowerCase();
    if (
      ['aprobado', 'aplicado', 'activo', 'aceptada', 'enviada', 'confirmado', 'completado'].includes(
        normalized
      )
    ) {
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }

    if (['pendiente', 'en proceso'].includes(normalized)) {
      return 'bg-amber-100 text-amber-700 border-amber-200';
    }

    if (['rechazado', 'cancelado', 'expirado', 'eliminado', 'inactivo'].includes(normalized)) {
      return 'bg-red-100 text-red-700 border-red-200';
    }

    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="mx-auto w-full space-y-6 p-6">
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-blue-100 p-4 text-blue-700">
                <CircleDollarSign className="h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-4xl font-extrabold tracking-tight text-slate-900">
                  Auditoría Financiera y Operativa
                </CardTitle>
                <CardDescription className="mt-2 text-xl text-slate-600">
                  Monitoreo completo de transacciones, créditos y operaciones del sistema
                </CardDescription>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => void fetchData(filtros)}
                disabled={loading}
                className="h-11 px-5"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
              <Button onClick={exportarCsv} disabled={loading || !totalRegistrosFiltrados} className="h-11 px-5">
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-500">Total Registros</p>
                <p className="mt-4 text-5xl font-bold text-slate-900">{data.resumen.total_registros}</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/60">
              <CardContent className="pt-6">
                <p className="text-sm text-emerald-700">Ingresos Totales</p>
                <p className="mt-4 text-5xl font-bold text-emerald-800">
                  {formatCurrency(data.resumen.ingresos_totales)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/60">
              <CardContent className="pt-6">
                <p className="text-sm text-blue-700">Créditos/Bonos Usados</p>
                <p className="mt-4 text-5xl font-bold text-blue-800">
                  {formatCurrency(data.resumen.creditos_bonos_usados)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-violet-200 bg-violet-50/60">
              <CardContent className="pt-6">
                <p className="text-sm text-violet-700">Balance Neto</p>
                <p className="mt-4 text-5xl font-bold text-violet-800">
                  {formatCurrency(data.resumen.balance_neto)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-4xl font-bold text-slate-900">
                <Filter className="h-8 w-8 text-blue-600" />
                Filtros de Búsqueda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Acción</p>
                  <Select
                    value={draftFiltros.accion}
                    onValueChange={(value) =>
                      setDraftFiltros((prev) => ({ ...prev, accion: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las acciones" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.filtros.acciones.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Entidad</p>
                  <Select
                    value={draftFiltros.entidad}
                    onValueChange={(value) =>
                      setDraftFiltros((prev) => ({ ...prev, entidad: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las entidades" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.filtros.entidades.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Actor (Quién)</p>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      value={draftFiltros.actor}
                      onChange={(event) =>
                        setDraftFiltros((prev) => ({ ...prev, actor: event.target.value }))
                      }
                      className="pl-8"
                      placeholder="Buscar por nombre..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Status</p>
                  <Select
                    value={draftFiltros.status}
                    onValueChange={(value) =>
                      setDraftFiltros((prev) => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los status</SelectItem>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Monto desde</p>
                  <Input
                    type="number"
                    step="0.01"
                    value={draftFiltros.monto_desde}
                    onChange={(event) =>
                      setDraftFiltros((prev) => ({ ...prev, monto_desde: event.target.value }))
                    }
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Monto hasta</p>
                  <Input
                    type="number"
                    step="0.01"
                    value={draftFiltros.monto_hasta}
                    onChange={(event) =>
                      setDraftFiltros((prev) => ({ ...prev, monto_hasta: event.target.value }))
                    }
                    placeholder="100000"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Desde</p>
                  <Input
                    type="date"
                    value={draftFiltros.fecha_desde}
                    onChange={(event) =>
                      setDraftFiltros((prev) => ({ ...prev, fecha_desde: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Hasta</p>
                  <Input
                    type="date"
                    value={draftFiltros.fecha_hasta}
                    onChange={(event) =>
                      setDraftFiltros((prev) => ({ ...prev, fecha_hasta: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="mt-6">
                <Button onClick={aplicarFiltros} className="h-11 px-6">
                  <Filter className="mr-2 h-4 w-4" />
                  Aplicar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-lg text-slate-600">
            Mostrando <span className="font-semibold text-slate-900">{totalRegistrosFiltrados}</span> registros
          </p>

          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-sm font-semibold text-slate-700">
                      <th className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort('fecha_hora')}
                          className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                        >
                          Fecha y Hora
                          {renderSortIcon('fecha_hora')}
                        </button>
                      </th>
                      <th className="px-4 py-3">Descripción</th>
                      <th className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort('monto')}
                          className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                        >
                          $ Monto
                          {renderSortIcon('monto')}
                        </button>
                      </th>
                      <th className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort('status')}
                          className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                        >
                          Status
                          {renderSortIcon('status')}
                        </button>
                      </th>
                      <th className="px-4 py-3">Entidad</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrosPaginados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                          No hay registros para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      registrosPaginados.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 text-sm">
                          <td className="px-4 py-3 text-slate-600">{formatDate(item.fecha_hora)}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{item.descripcion}</td>
                          <td
                            className={`px-4 py-3 font-semibold ${item.monto == null
                              ? 'text-slate-400'
                              : item.monto >= 0
                                ? 'text-emerald-700'
                                : 'text-red-700'
                              }`}
                          >
                            {item.monto == null ? '-' : formatCurrency(item.monto)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusStyles(
                                item.status
                              )}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{item.entidad}</td>
                          <td className="px-4 py-3">
                            <div className="text-slate-900">{item.actor}</div>
                            {item.actor_email && (
                              <div className="text-xs text-slate-500">{item.actor_email}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.detalle}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Filas por página</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      const nextPageSize = Number(value);
                      setPageSize(nextPageSize);
                      setCurrentPage(1);
                      void fetchData(filtros, {
                        page: 1,
                        pageSize: nextPageSize,
                        sortField,
                        sortDirection,
                        syncDraft: false,
                      });
                    }}
                  >
                    <SelectTrigger className="w-[90px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-sm text-slate-600">
                  Página {safeCurrentPage} de {totalPages}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextPage = Math.max(1, safeCurrentPage - 1);
                      setCurrentPage(nextPage);
                      void fetchData(filtros, {
                        page: nextPage,
                        pageSize,
                        sortField,
                        sortDirection,
                        syncDraft: false,
                      });
                    }}
                    disabled={safeCurrentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextPage = Math.min(totalPages, safeCurrentPage + 1);
                      setCurrentPage(nextPage);
                      void fetchData(filtros, {
                        page: nextPage,
                        pageSize,
                        sortField,
                        sortDirection,
                        syncDraft: false,
                      });
                    }}
                    disabled={safeCurrentPage >= totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
