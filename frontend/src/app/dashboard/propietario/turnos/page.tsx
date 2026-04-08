'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import apiClient from '@/services/api';
import { empleadosService } from '@/services/empleados';
import { ApiResponse, Empleado, Servicio } from '@/types';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TurnoOwnerRow {
  id: number;
  cliente: number | null;
  cliente_nombre: string | null;
  cliente_email: string | null;
  empleado: number | null;
  empleado_nombre: string | null;
  servicio: number | null;
  servicio_nombre: string | null;
  servicio_precio: string | null;
  fecha_hora: string;
  estado: string;
  estado_display: string;
  precio_final: string | null;
  senia_pagada: string | null;
  canal_reserva: string | null;
  metodo_pago: string | null;
  es_cliente_registrado: boolean;
  walkin_nombre: string | null;
  walkin_dni: string | null;
  walkin_email: string | null;
  walkin_telefono: string | null;
  pagado_completo: boolean;
  monto_pendiente: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

const CANAL_RESERVA_LABELS: Record<string, string> = {
  web_cliente: 'Web cliente',
  panel_profesional: 'Panel profesional',
  panel_propietario: 'Panel propietario',
};

const METODO_PAGO_LABELS: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  mercadopago_qr: 'MP QR en salón',
  efectivo: 'Efectivo / Caja',
  transferencia: 'Transferencia',
  mixto: 'Mixto',
};

export default function TurnosPropietarioPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [turnos, setTurnos] = useState<TurnoOwnerRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<string>('todos');
  const [selectedServicioId, setSelectedServicioId] = useState<string>('todos');
  const [selectedCanal, setSelectedCanal] = useState<string>('todos');
  const [selectedMetodoPago, setSelectedMetodoPago] = useState<string>('todos');
  const [selectedRegistrado, setSelectedRegistrado] = useState<string>('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'propietario' && user.role !== 'superusuario') {
      router.push('/dashboard');
      return;
    }

    void cargarDatosIniciales();
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || authLoading) return;
    void cargarTurnos();
  }, [
    user,
    authLoading,
    currentPage,
    searchQuery,
    selectedEmpleadoId,
    selectedServicioId,
    selectedCanal,
    selectedMetodoPago,
    selectedRegistrado,
    fechaDesde,
    fechaHasta,
  ]);

  const cargarDatosIniciales = async () => {
    try {
      setLoading(true);
      setError(null);

      const [empleadosRes, serviciosRes] = await Promise.all([
        empleadosService.list({ page: 1, page_size: 1000 }),
        apiClient.get<ApiResponse<Servicio>>('/servicios/', {
          params: { page: 1, page_size: 1000 },
        }),
      ]);

      setEmpleados(empleadosRes.results || []);
      const serviciosData = serviciosRes.data;
      setServicios(serviciosData.results || []);
    } catch (err) {
      console.error('Error cargando datos iniciales de turnos:', err);
      setError('No se pudieron cargar los datos iniciales');
    } finally {
      setLoading(false);
    }
  };

  const cargarTurnos = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string | number | boolean> = {
        page: currentPage,
        page_size: PAGE_SIZE,
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      if (selectedEmpleadoId !== 'todos') {
        params.empleado = selectedEmpleadoId;
      }

      if (selectedServicioId !== 'todos') {
        params.servicio = selectedServicioId;
      }

      if (selectedCanal !== 'todos') {
        params.canal_reserva = selectedCanal;
      }

      if (selectedMetodoPago !== 'todos') {
        params.metodo_pago = selectedMetodoPago;
      }

      if (selectedRegistrado === 'registrado') {
        params.es_cliente_registrado = true;
      } else if (selectedRegistrado === 'walkin') {
        params.es_cliente_registrado = false;
      }

      if (fechaDesde) {
        params.fecha_desde = fechaDesde;
      }

      if (fechaHasta) {
        params.fecha_hasta = fechaHasta;
      }

      const response = await apiClient.get<ApiResponse<TurnoOwnerRow>>('/turnos/', {
        params,
      });

      setTurnos(response.data.results || []);
      setTotalCount(response.data.count || 0);
    } catch (err) {
      console.error('Error cargando turnos:', err);
      setError('No se pudieron cargar los turnos');
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedEmpleadoId('todos');
    setSelectedServicioId('todos');
    setSelectedCanal('todos');
    setSelectedMetodoPago('todos');
    setSelectedRegistrado('todos');
    setFechaDesde('');
    setFechaHasta('');
    setCurrentPage(1);
  };

  const getClienteNombre = (turno: TurnoOwnerRow) => {
    if (turno.es_cliente_registrado && turno.cliente_nombre) {
      return turno.cliente_nombre;
    }
    if (!turno.es_cliente_registrado && turno.walkin_nombre) {
      return `${turno.walkin_nombre} (walk-in)`;
    }
    return 'Sin datos';
  };

  const getClienteEtiqueta = (turno: TurnoOwnerRow) => {
    return turno.es_cliente_registrado ? 'Registrado' : 'Walk-in';
  };

  const getCanalLabel = (canal: string | null) => {
    if (!canal) return '—';
    return CANAL_RESERVA_LABELS[canal] || canal;
  };

  const getMetodoPagoLabel = (metodo: string | null) => {
    if (!metodo) return '—';
    return METODO_PAGO_LABELS[metodo] || metodo;
  };

  const getEstadoBadgeVariant = (estado: string) => {
    switch (estado.toLowerCase()) {
      case 'confirmado':
        return 'default' as const;
      case 'pendiente':
        return 'secondary' as const;
      case 'completado':
        return 'outline' as const;
      case 'cancelado':
      case 'no_asistio':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Cargando...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-blue-600" />
            Turnos
          </h1>
          <p className="text-gray-600 mt-1 max-w-2xl">
            Vista consolidada de todos los turnos del salón, con filtros por profesional, servicio, canal y método de pago.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCurrentPage(1);
            void cargarTurnos();
          }}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-md">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>
                Combina filtros para analizar turnos por profesional, servicio, canal de reserva y método de pago.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handleClearFilters}
              >
                <Filter className="w-4 h-4" />
                Limpiar filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="col-span-1 md:col-span-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por cliente, profesional o servicio"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-500">Profesional</span>
              <Select
                value={selectedEmpleadoId}
                onValueChange={(value) => {
                  setSelectedEmpleadoId(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {empleados.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-500">Servicio</span>
              <Select
                value={selectedServicioId}
                onValueChange={(value) => {
                  setSelectedServicioId(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {servicios.map((serv) => (
                    <SelectItem key={serv.id} value={String(serv.id)}>
                      {serv.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-500">Canal de reserva</span>
              <Select
                value={selectedCanal}
                onValueChange={(value) => {
                  setSelectedCanal(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="web_cliente">Web cliente</SelectItem>
                  <SelectItem value="panel_profesional">Panel profesional</SelectItem>
                  <SelectItem value="panel_propietario">Panel propietario</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-500">Método de pago</span>
              <Select
                value={selectedMetodoPago}
                onValueChange={(value) => {
                  setSelectedMetodoPago(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                  <SelectItem value="mercadopago_qr">MP QR en salón</SelectItem>
                  <SelectItem value="efectivo">Efectivo / Caja</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="mixto">Mixto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-500">Cliente</span>
              <Select
                value={selectedRegistrado}
                onValueChange={(value) => {
                  setSelectedRegistrado(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="registrado">Registrados</SelectItem>
                  <SelectItem value="walkin">Walk-in</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-xs font-medium text-gray-500">Desde</span>
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => {
                    setFechaDesde(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-gray-500">Hasta</span>
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => {
                    setFechaHasta(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Listado de turnos</CardTitle>
            <CardDescription>
              Se muestran {turnos.length} de {totalCount} turnos encontrados.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Cargando turnos...</span>
            </div>
          ) : turnos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <CalendarDays className="w-10 h-10 mb-2" />
              <p className="font-medium">No se encontraron turnos con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Registrado</TableHead>
                    <TableHead>Profesional</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Método pago</TableHead>
                    <TableHead className="text-right">Seña</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado pago</TableHead>
                    <TableHead>Estado turno</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {turnos.map((turno) => {
                    const senia = turno.senia_pagada ? Number(turno.senia_pagada) : 0;
                    const total = turno.precio_final
                      ? Number(turno.precio_final)
                      : turno.servicio_precio
                        ? Number(turno.servicio_precio)
                        : 0;

                    return (
                      <TableRow key={turno.id} className="hover:bg-gray-50">
                        <TableCell>{formatDateTime(turno.fecha_hora)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{getClienteNombre(turno)}</span>
                            {turno.cliente_email && (
                              <span className="text-xs text-gray-500">
                                {turno.cliente_email}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={turno.es_cliente_registrado ? 'default' : 'outline'}
                            className={turno.es_cliente_registrado ? 'bg-emerald-600 hover:bg-emerald-600' : ''}
                          >
                            {getClienteEtiqueta(turno)}
                          </Badge>
                        </TableCell>
                        <TableCell>{turno.empleado_nombre || '—'}</TableCell>
                        <TableCell>{turno.servicio_nombre || '—'}</TableCell>
                        <TableCell>{getCanalLabel(turno.canal_reserva)}</TableCell>
                        <TableCell>{getMetodoPagoLabel(turno.metodo_pago)}</TableCell>
                        <TableCell className="text-right">
                          {senia > 0 ? formatCurrency(senia) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {total > 0 ? formatCurrency(total) : '—'}
                        </TableCell>
                        <TableCell>
                          {turno.pagado_completo ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600">
                              Pagado completo
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getEstadoBadgeVariant(turno.estado)}>
                            {turno.estado_display}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
            <div className="text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === 1 || loading}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === totalPages || loading}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
