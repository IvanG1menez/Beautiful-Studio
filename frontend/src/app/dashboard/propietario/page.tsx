'use client';

import { Badge } from '@/components/ui/badge';
import { BeautifulSpinner } from '@/components/ui/BeautifulSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate, formatTime } from '@/lib/dateUtils';
import { formatCurrency } from '@/lib/utils';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Edit,
  Eye,
  Plus,
  Scissors,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface DashboardStats {
  total_clientes: number;
  total_empleados: number;
  turnos_hoy: number;
  ingresos_mes: number;
  ingresos_mes_variacion: number;
  turnos_completados_hoy: number;
  comision_pendiente: number;
  comision_pendiente_variacion: number;
  turnos_pendientes_pago: number;
  turnos_pendientes_pago_variacion: number;
  turnos_pendientes_aceptacion: number;
  turnos_proximos_48h: number;
  turnos_hoy_variacion: number;
  dinero_recuperado: number;
  dinero_recuperado_variacion: number;
  total_servicios?: number;
}

interface TurnoAdmin {
  id: number;
  cliente?: {
    id: number;
    nombre_completo: string;
    email: string;
  };
  cliente_nombre?: string;
  empleado?: {
    id: number;
    nombre_completo: string;
  };
  empleado_nombre?: string;
  servicio?: {
    id: number;
    nombre: string;
    precio: number;
  };
  servicio_nombre?: string;
  servicio_precio?: number;
  fecha_hora: string;
  estado: string;
  precio_final: number;
  notas?: string;
  reacomodamiento_exitoso?: boolean;
  senia_pagada?: number | string | null;
  monto_pendiente?: number | string | null;
  pagado_completo?: boolean;
  metodo_pago?: string | null;
  canal_reserva?: string | null;
  notas_cliente?: string | null;
  notas_empleado?: string | null;
}

type AccionTab = 'proximos_48h' | 'pendientes_pago' | 'pendientes_aceptacion';

const ACCION_TABS: AccionTab[] = ['proximos_48h', 'pendientes_pago', 'pendientes_aceptacion'];

const isAccionTab = (value: string): value is AccionTab => {
  return ACCION_TABS.includes(value as AccionTab);
};

const createEmptyAccionState = (): Record<AccionTab, TurnoAdmin[]> => ({
  proximos_48h: [],
  pendientes_pago: [],
  pendientes_aceptacion: []
});

export default function DashboardAdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [turnosAccion, setTurnosAccion] = useState<Record<AccionTab, TurnoAdmin[]>>(createEmptyAccionState);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingAccionTab, setLoadingAccionTab] = useState<AccionTab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accionTab, setAccionTab] = useState<AccionTab>('proximos_48h');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [selectedTurno, setSelectedTurno] = useState<TurnoAdmin | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { user } = useAuth();
  const router = useRouter();

  // Verificar autenticación y rol de administrador
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('auth_token'); // ← Corregido: usar 'auth_token'
      const savedUser = localStorage.getItem('user');

      if (!token || !savedUser) {
        router.push('/login');
        return false;
      }

      try {
        const userData = JSON.parse(savedUser);
        // Verificar que el usuario tenga rol de administrador
        if (userData.role !== 'propietario' && userData.role !== 'superusuario') {
          router.push('/login');
          return false;
        }
        return true;
      } catch (error) {
        console.error('Error parsing user data:', error);
        router.push('/login');
        return false;
      }
    };

    if (checkAuth()) {
      setIsLoading(false);
      loadDashboardData();
    }
  }, [router]);

  // Función para obtener el token de autenticación
  const getAuthToken = (): string | null => {
    return localStorage.getItem('auth_token');
  };

  // Función para hacer peticiones autenticadas
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const baseUrl = '/api';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Token ${token}`,
    };

    return fetch(fullUrl, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
  };

  // Cargar todos los datos del dashboard
  const loadDashboardData = async () => {
    setLoadingData(true);
    setError(null);

    try {
      await Promise.all([
        loadStats(),
        loadTurnosAccion('proximos_48h')
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoadingData(false);
    }
  };

  // Cargar estadísticas generales
  const loadStats = async () => {
    try {
      const response = await authenticatedFetch('/turnos/metricas-propietario/');

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error('Error fetching stats:', response.status);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Cargar turnos que requieren acción
  const loadTurnosAccion = async (tipo: AccionTab) => {
    try {
      setLoadingAccionTab(tipo);
      const response = await authenticatedFetch(`/turnos/turnos-accion/?tipo=${tipo}&limit=20`);

      if (response.ok) {
        const data = await response.json();
        setTurnosAccion((prev) => ({
          ...prev,
          [tipo]: data.turnos || []
        }));
      } else {
        console.error('Error fetching turnos acción:', response.status);
      }
    } catch (error) {
      console.error('Error loading turnos acción:', error);
    } finally {
      setLoadingAccionTab((current) => (current === tipo ? null : current));
    }
  };

  // Manejar cambio de pestaña de acción
  const handleAccionTabChange = (tipo: AccionTab) => {
    setAccionTab(tipo);
    loadTurnosAccion(tipo);
  };

  // Función para formatear fecha y hora
  // Función para obtener el color del badge según el estado
  const getEstadoBadgeVariant = (estado: string) => {
    switch (estado.toLowerCase()) {
      case 'confirmado':
        return 'default';
      case 'pendiente':
        return 'secondary';
      case 'completado':
        return 'outline';
      case 'cancelado':
      case 'no_asistio':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Función para obtener el icono según el estado
  const getEstadoIcon = (estado: string) => {
    switch (estado.toLowerCase()) {
      case 'confirmado':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pendiente':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'completado':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'cancelado':
      case 'no_asistio':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDelta = (value?: number | null) => {
    if (value === null || value === undefined) {
      return '--';
    }
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const renderDelta = (value: number | null | undefined, label: string) => {
    const isPositive = (value ?? 0) >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    return (
      <div className={`text-xs flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        <Icon className="w-3 h-3" />
        <span>{formatDelta(value)}</span>
        <span className="text-muted-foreground">{label}</span>
      </div>
    );
  };

  const getServicioNombre = (turno: TurnoAdmin) => {
    return turno.servicio?.nombre || turno.servicio_nombre || 'Servicio';
  };

  const getClienteNombre = (turno: TurnoAdmin) => {
    return turno.cliente?.nombre_completo || turno.cliente_nombre || 'Cliente';
  };

  const getEmpleadoNombre = (turno: TurnoAdmin) => {
    return turno.empleado?.nombre_completo || turno.empleado_nombre || 'Profesional';
  };

  const getPrecioTurno = (turno: TurnoAdmin) => {
    if (turno.precio_final) {
      return turno.precio_final;
    }
    return turno.servicio?.precio || turno.servicio_precio || 0;
  };

  const getMontoPendienteTurno = (turno: TurnoAdmin) => {
    if (turno.monto_pendiente !== undefined && turno.monto_pendiente !== null) {
      const montoPendiente = Number(turno.monto_pendiente);
      if (!Number.isNaN(montoPendiente) && montoPendiente >= 0) {
        return montoPendiente;
      }
    }

    const precio = Number(getPrecioTurno(turno));
    const senia = Number(turno.senia_pagada || 0);
    const pendiente = precio - senia;
    return pendiente > 0 ? pendiente : 0;
  };

  const openDetalleTurno = (turno: TurnoAdmin) => {
    setSelectedTurno(turno);
    setDetailDialogOpen(true);
  };

  const changeTurnoEstado = async (turnoId: number, estado: string, observaciones?: string) => {
    try {
      setActionLoadingId(turnoId);
      setError(null);
      const response = await authenticatedFetch(`/turnos/${turnoId}/cambiar_estado/`, {
        method: 'POST',
        body: JSON.stringify({
          estado,
          observaciones
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'No se pudo actualizar el estado del turno.';
        setError(errorMessage);
        return false;
      }

      await Promise.all([
        loadTurnosAccion(accionTab),
        loadStats()
      ]);
      return true;
    } catch (error) {
      console.error('Error cambiando estado del turno:', error);
      setError('No se pudo actualizar el estado del turno. Por favor, intenta nuevamente.');
      return false;
    } finally {
      setActionLoadingId(null);
    }
  };

  const registrarPagoTurno = async (turno: TurnoAdmin) => {
    const montoPendiente = getMontoPendienteTurno(turno);
    if (montoPendiente <= 0.01) {
      setError('Este turno no tiene saldo pendiente para registrar.');
      return;
    }

    try {
      setActionLoadingId(turno.id);
      setError(null);
      const response = await authenticatedFetch(`/turnos/${turno.id}/registrar-pago/`, {
        method: 'POST',
        body: JSON.stringify({
          monto: montoPendiente,
          metodo_pago: 'efectivo'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || errorData.detail || 'No se pudo registrar el pago.');
        return;
      }

      await Promise.all([
        loadTurnosAccion(accionTab),
        loadStats()
      ]);
      setDetailDialogOpen(false);
      setSelectedTurno(null);
    } catch (error) {
      console.error('Error registrando pago:', error);
      setError('No se pudo registrar el pago. Por favor, intenta nuevamente.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderTurnoDetalleModal = () => {
    if (!selectedTurno) return null;

    const pendiente = getMontoPendienteTurno(selectedTurno);
    const fecha = formatDate(selectedTurno.fecha_hora);
    const hora = formatTime(selectedTurno.fecha_hora);
    const isPendienteAceptacion = selectedTurno.estado.toLowerCase() === 'pendiente';
    const isPagoPendiente = selectedTurno.estado.toLowerCase() === 'completado' && pendiente > 0.01;

    return (
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del turno</DialogTitle>
            <DialogDescription>
              Información operativa y acciones rápidas para resolver este turno.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold text-sm text-muted-foreground">Turno</h3>
              <div>
                <p className="text-sm text-muted-foreground">Servicio</p>
                <p className="font-medium">{getServicioNombre(selectedTurno)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha y hora</p>
                <p className="font-medium">{fecha} - {hora}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge variant={getEstadoBadgeVariant(selectedTurno.estado)}>{selectedTurno.estado}</Badge>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold text-sm text-muted-foreground">Personas</h3>
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{getClienteNombre(selectedTurno)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Profesional</p>
                <p className="font-medium">{getEmpleadoNombre(selectedTurno)}</p>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4 md:col-span-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Pago</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-semibold">{formatCurrency(getPrecioTurno(selectedTurno))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Seña</p>
                  <p className="font-semibold">{formatCurrency(Number(selectedTurno.senia_pagada || 0))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p className={pendiente > 0.01 ? 'font-semibold text-red-700' : 'font-semibold text-green-700'}>
                    {formatCurrency(pendiente)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Método</p>
                  <p className="font-semibold">{selectedTurno.metodo_pago || 'Sin informar'}</p>
                </div>
              </div>
            </div>

            {(selectedTurno.notas_cliente || selectedTurno.notas_empleado) && (
              <div className="space-y-2 rounded-lg border p-4 md:col-span-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Notas</h3>
                {selectedTurno.notas_cliente && <p className="text-sm">Cliente: {selectedTurno.notas_cliente}</p>}
                {selectedTurno.notas_empleado && <p className="text-sm">Interna: {selectedTurno.notas_empleado}</p>}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/propietario/turnos?turno=${selectedTurno.id}`)}
            >
              Ver en Turnos
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              {isPagoPendiente && (
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => registrarPagoTurno(selectedTurno)}
                  disabled={actionLoadingId === selectedTurno.id}
                >
                  {actionLoadingId === selectedTurno.id ? 'Procesando...' : 'Registrar pago'}
                </Button>
              )}
              {isPendienteAceptacion && (
                <>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={async () => {
                      const ok = await changeTurnoEstado(selectedTurno.id, 'confirmado');
                      if (ok) setDetailDialogOpen(false);
                    }}
                    disabled={actionLoadingId === selectedTurno.id}
                  >
                    {actionLoadingId === selectedTurno.id ? 'Procesando...' : 'Aceptar'}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-600"
                    onClick={async () => {
                      const ok = await changeTurnoEstado(selectedTurno.id, 'cancelado');
                      if (ok) setDetailDialogOpen(false);
                    }}
                    disabled={actionLoadingId === selectedTurno.id}
                  >
                    {actionLoadingId === selectedTurno.id ? 'Procesando...' : 'Rechazar'}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const turnosAccionActual = turnosAccion[accionTab];
  const loadingAccionActual = loadingAccionTab === accionTab;

  // Mostrar loading mientras se verifica autenticación
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <BeautifulSpinner label="Verificando autenticación del propietario..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header del Dashboard */}
      <div className="bg-card/90 backdrop-blur shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Panel de Administración
                </h1>
                <p className="text-muted-foreground">
                  ¡Hola, {user?.first_name}! Bienvenido al dashboard administrativo
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mostrar error si existe */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              className="mt-2"
            >
              Intentar de nuevo
            </Button>
          </div>
        )}
        <div className="space-y-6">
          {/* Tarjetas de estadísticas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {loadingData ? <BeautifulSpinner label="" className="scale-75" /> : `$${stats?.ingresos_mes?.toFixed(2) || 0}`}
                </div>
                {renderDelta(stats?.ingresos_mes_variacion, 'vs mes pasado')}
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-900">Turnos de Hoy</CardTitle>
                <Calendar className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">
                  {loadingData ? <BeautifulSpinner label="" className="scale-75" /> : stats?.turnos_hoy || 0}
                </div>
                {renderDelta(stats?.turnos_hoy_variacion, 'vs ayer')}
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-900">Solicitudes Pendientes</CardTitle>
                <Clock className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-700">
                  {loadingData ? <BeautifulSpinner label="" className="scale-75" /> : stats?.turnos_pendientes_aceptacion || 0}
                </div>
                <p className="text-xs text-muted-foreground">Turnos esperando aceptación</p>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-900">Pagos Pendientes</CardTitle>
                <DollarSign className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">
                  {loadingData ? <BeautifulSpinner label="" className="scale-75" /> : stats?.turnos_pendientes_pago || 0}
                </div>
                {renderDelta(stats?.turnos_pendientes_pago_variacion, 'vs ayer')}
              </CardContent>
            </Card>
          </div>

          {/* Acciones rápidas */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Acciones rápidas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Clientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">
                        {loadingData ? <BeautifulSpinner label="" className="scale-75" /> : stats?.total_clientes || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Clientes registrados</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => router.push('/dashboard/propietario/clientes/nuevo')}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Profesionales</CardTitle>
                  <Scissors className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">
                        {loadingData ? <BeautifulSpinner label="" className="scale-75" /> : stats?.total_empleados || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Profesionales activos</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => router.push('/dashboard/propietario/profesionales/nuevo')}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Servicios</CardTitle>
                  <Scissors className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">
                        {loadingData ? <BeautifulSpinner label="" className="scale-75" /> : stats?.total_servicios || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Servicios configurados</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => router.push('/dashboard/propietario/servicios/nuevo')}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Acción Requerida / Próximos Turnos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
                Acción Requerida / Próximos Turnos
              </CardTitle>
              <CardDescription>
                Turnos que requieren tu atención inmediata
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={accionTab}
                onValueChange={(value) => {
                  if (isAccionTab(value)) {
                    handleAccionTabChange(value);
                  }
                }}
              >
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="proximos_48h" className="relative">
                    Próximos (48h)
                    {stats && stats.turnos_proximos_48h > 0 && (
                      <Badge className="ml-2 bg-blue-500">{stats.turnos_proximos_48h}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="pendientes_pago" className="relative">
                    Pendientes de Pago
                    {stats && stats.turnos_pendientes_pago > 0 && (
                      <Badge className="ml-2 bg-red-500">{stats.turnos_pendientes_pago}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="pendientes_aceptacion" className="relative">
                    Pendientes de Aceptación
                    {stats && stats.turnos_pendientes_aceptacion > 0 && (
                      <Badge className="ml-2 bg-orange-500">{stats.turnos_pendientes_aceptacion}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="proximos_48h">
                  {loadingAccionActual ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <BeautifulSpinner label="Cargando turnos..." />
                    </div>
                  ) : turnosAccionActual.length > 0 ? (
                    <div className="space-y-4">
                      {turnosAccionActual.map((turno) => {
                        const dateFormatted = formatDate(turno.fecha_hora);
                        const timeFormatted = formatTime(turno.fecha_hora);
                        return (
                          <div key={turno.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-center space-x-4">
                              {getEstadoIcon(turno.estado)}
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">{getServicioNombre(turno)}</span>
                                  <Badge variant={getEstadoBadgeVariant(turno.estado)}>
                                    {turno.estado}
                                  </Badge>
                                  {turno.reacomodamiento_exitoso && (
                                    <span className="flex items-center text-xs text-blue-600">
                                      <Sparkles className="w-3 h-3 mr-1" />
                                      Reacomodado
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {getClienteNombre(turno)} • {getEmpleadoNombre(turno)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {dateFormatted} - {timeFormatted}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600">
                                ${getPrecioTurno(turno)}
                              </p>
                              <div className="flex space-x-1 mt-1">
                                <Button size="sm" variant="ghost" onClick={() => openDetalleTurno(turno)}>
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => openDetalleTurno(turno)}>
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay turnos próximos en las siguientes 48 horas</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="pendientes_pago">
                  {loadingAccionActual ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <BeautifulSpinner label="Cargando turnos pendientes de pago..." />
                    </div>
                  ) : turnosAccionActual.length > 0 ? (
                    <div className="space-y-4">
                      {turnosAccionActual.map((turno) => {
                        const dateFormatted = formatDate(turno.fecha_hora);
                        const timeFormatted = formatTime(turno.fecha_hora);
                        return (
                          <div key={turno.id} className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100">
                            <div className="flex items-center space-x-4">
                              <DollarSign className="w-5 h-5 text-red-600" />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">{getServicioNombre(turno)}</span>
                                  <Badge className="bg-red-500">Pendiente Pago</Badge>
                                  {turno.reacomodamiento_exitoso && (
                                    <span className="flex items-center text-xs text-blue-600">
                                      <Sparkles className="w-3 h-3 mr-1" />
                                      Reacomodado
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Profesional: {getEmpleadoNombre(turno)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Completado: {dateFormatted} - {timeFormatted}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-red-700">
                                ${getPrecioTurno(turno)}
                              </p>
                              <Button
                                size="sm"
                                className="mt-2 bg-red-600 hover:bg-red-700"
                                onClick={() => registrarPagoTurno(turno)}
                                disabled={actionLoadingId === turno.id}
                              >
                                {actionLoadingId === turno.id ? 'Procesando...' : 'Marcar como Pagado'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay turnos pendientes de pago</p>
                      <p className="text-sm text-muted-foreground mt-2">¡Todos los pagos están al día!</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="pendientes_aceptacion">
                  {loadingAccionActual ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <BeautifulSpinner label="Cargando turnos pendientes de aceptación..." />
                    </div>
                  ) : turnosAccionActual.length > 0 ? (
                    <div className="space-y-4">
                      {turnosAccionActual.map((turno) => {
                        const dateFormatted = formatDate(turno.fecha_hora);
                        const timeFormatted = formatTime(turno.fecha_hora);
                        return (
                          <div key={turno.id} className="flex items-center justify-between p-4 border border-orange-200 bg-orange-50 rounded-lg hover:bg-orange-100">
                            <div className="flex items-center space-x-4">
                              <Clock className="w-5 h-5 text-orange-600" />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">{getServicioNombre(turno)}</span>
                                  <Badge className="bg-orange-500">Pendiente</Badge>
                                  {turno.reacomodamiento_exitoso && (
                                    <span className="flex items-center text-xs text-blue-600">
                                      <Sparkles className="w-3 h-3 mr-1" />
                                      Reacomodado
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {getClienteNombre(turno)} → {getEmpleadoNombre(turno)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Solicitado para: {dateFormatted} - {timeFormatted}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-orange-700">
                                ${getPrecioTurno(turno)}
                              </p>
                              <div className="flex space-x-2 mt-2">
                                <Button size="sm" variant="ghost" onClick={() => openDetalleTurno(turno)}>
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => changeTurnoEstado(turno.id, 'confirmado')}
                                  disabled={actionLoadingId === turno.id}
                                >
                                  {actionLoadingId === turno.id ? 'Procesando...' : 'Aceptar'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-600"
                                  onClick={() => changeTurnoEstado(turno.id, 'cancelado')}
                                  disabled={actionLoadingId === turno.id}
                                >
                                  {actionLoadingId === turno.id ? 'Procesando...' : 'Rechazar'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay solicitudes pendientes</p>
                      <p className="text-sm text-muted-foreground mt-2">Todas las solicitudes han sido procesadas</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
      {renderTurnoDetalleModal()}
    </div>
  );
}
