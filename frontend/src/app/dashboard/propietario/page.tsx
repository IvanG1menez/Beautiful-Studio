'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate, formatTime } from '@/lib/dateUtils';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Edit,
  Eye,
  Filter,
  Loader2,
  Plus,
  Scissors,
  Settings,
  Shield,
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
  turnos_completados_hoy: number;
  comision_pendiente: number;
  turnos_pendientes_pago: number;
  turnos_pendientes_aceptacion: number;
  turnos_proximos_48h: number;
}

interface TurnoAdmin {
  id: number;
  cliente: {
    id: number;
    nombre_completo: string;
    email: string;
  };
  empleado: {
    id: number;
    nombre_completo: string;
  };
  servicio: {
    id: number;
    nombre: string;
    precio: number;
  };
  fecha_hora: string;
  estado: string;
  precio_final: number;
  notas?: string;
}

export default function DashboardAdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [turnosRecientes, setTurnosRecientes] = useState<TurnoAdmin[]>([]);
  const [turnosAccion, setTurnosAccion] = useState<TurnoAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [accionTab, setAccionTab] = useState<'proximos_48h' | 'pendientes_pago' | 'pendientes_aceptacion'>('proximos_48h');

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

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
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
  const loadTurnosAccion = async (tipo: 'proximos_48h' | 'pendientes_pago' | 'pendientes_aceptacion') => {
    try {
      const response = await authenticatedFetch(`/turnos/turnos-accion/?tipo=${tipo}&limit=20`);

      if (response.ok) {
        const data = await response.json();
        setTurnosAccion(data.turnos || []);
      } else {
        console.error('Error fetching turnos acción:', response.status);
      }
    } catch (error) {
      console.error('Error loading turnos acción:', error);
    }
  };

  // Manejar cambio de pestaña de acción
  const handleAccionTabChange = (tipo: 'proximos_48h' | 'pendientes_pago' | 'pendientes_aceptacion') => {
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

  // Mostrar loading mientras se verifica autenticación
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header del Dashboard */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Panel de Administración
                </h1>
                <p className="text-gray-600">
                  ¡Hola, {user?.first_name}! Bienvenido al dashboard administrativo
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={() => router.push('/dashboard/propietario/usuarios')}
                className="bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Settings className="w-4 h-4 mr-2" />
                Configuración Global
              </Button>
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="turnos">Turnos</TabsTrigger>
            <TabsTrigger value="reportes">Reportes</TabsTrigger>
          </TabsList>

          {/* Tab: Resumen */}
          <TabsContent value="overview" className="space-y-6">
            {/* Tarjetas de estadísticas principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {loadingData ? <Loader2 className="w-6 h-6 animate-spin" /> : `$${stats?.ingresos_mes?.toFixed(2) || 0}`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    Mes actual
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Turnos Hoy</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingData ? <Loader2 className="w-6 h-6 animate-spin" /> : stats?.turnos_hoy || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.turnos_completados_hoy || 0} completados
                  </p>
                </CardContent>
              </Card>

              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-orange-900">Comisión Pendiente</CardTitle>
                  <DollarSign className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-700">
                    {loadingData ? <Loader2 className="w-6 h-6 animate-spin" /> : `$${stats?.comision_pendiente?.toFixed(2) || 0}`}
                  </div>
                  <p className="text-xs text-orange-600">
                    Por pagar a profesionales
                  </p>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-red-900">Turnos Pendientes de Pago</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-700">
                    {loadingData ? <Loader2 className="w-6 h-6 animate-spin" /> : stats?.turnos_pendientes_pago || 0}
                  </div>
                  <p className="text-xs text-red-600">
                    Requieren cierre de caja
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Estadísticas secundarias */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingData ? <Loader2 className="w-6 h-6 animate-spin" /> : stats?.total_clientes || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Clientes registrados</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Empleados</CardTitle>
                  <Scissors className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingData ? <Loader2 className="w-6 h-6 animate-spin" /> : stats?.total_empleados || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Profesionales activos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Próximos 48h</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingData ? <Loader2 className="w-6 h-6 animate-spin" /> : stats?.turnos_proximos_48h || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Turnos programados</p>
                </CardContent>
              </Card>
            </div>

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
                <Tabs value={accionTab} onValueChange={(value) => handleAccionTabChange(value as any)}>
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
                    {loadingData ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="ml-2">Cargando turnos...</span>
                      </div>
                    ) : turnosAccion.length > 0 ? (
                      <div className="space-y-4">
                        {turnosAccion.map((turno) => {
                          const dateFormatted = formatDate(turno.fecha_hora);
                          const timeFormatted = formatTime(turno.fecha_hora);
                          return (
                            <div key={turno.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                              <div className="flex items-center space-x-4">
                                {getEstadoIcon(turno.estado)}
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium">{turno.servicio.nombre}</span>
                                    <Badge variant={getEstadoBadgeVariant(turno.estado)}>
                                      {turno.estado}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-600">
                                    {turno.cliente.nombre_completo} • {turno.empleado.nombre_completo}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {dateFormatted} - {timeFormatted}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-green-600">
                                  ${turno.precio_final || turno.servicio.precio}
                                </p>
                                <div className="flex space-x-1 mt-1">
                                  <Button size="sm" variant="ghost">
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost">
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
                        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No hay turnos próximos en las siguientes 48 horas</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="pendientes_pago">
                    {loadingData ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="ml-2">Cargando turnos...</span>
                      </div>
                    ) : turnosAccion.length > 0 ? (
                      <div className="space-y-4">
                        {turnosAccion.map((turno) => {
                          const dateFormatted = formatDate(turno.fecha_hora);
                          const timeFormatted = formatTime(turno.fecha_hora);
                          return (
                            <div key={turno.id} className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100">
                              <div className="flex items-center space-x-4">
                                <DollarSign className="w-5 h-5 text-red-600" />
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium">{turno.servicio.nombre}</span>
                                    <Badge className="bg-red-500">Pendiente Pago</Badge>
                                  </div>
                                  <p className="text-sm text-gray-700">
                                    Profesional: {turno.empleado.nombre_completo}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Completado: {dateFormatted} - {timeFormatted}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-red-700">
                                  ${turno.precio_final || turno.servicio.precio}
                                </p>
                                <Button size="sm" className="mt-2 bg-red-600 hover:bg-red-700">
                                  Marcar como Pagado
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                        <p className="text-gray-500">No hay turnos pendientes de pago</p>
                        <p className="text-sm text-gray-400 mt-2">¡Todos los pagos están al día!</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="pendientes_aceptacion">
                    {loadingData ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="ml-2">Cargando turnos...</span>
                      </div>
                    ) : turnosAccion.length > 0 ? (
                      <div className="space-y-4">
                        {turnosAccion.map((turno) => {
                          const dateFormatted = formatDate(turno.fecha_hora);
                          const timeFormatted = formatTime(turno.fecha_hora);
                          return (
                            <div key={turno.id} className="flex items-center justify-between p-4 border border-orange-200 bg-orange-50 rounded-lg hover:bg-orange-100">
                              <div className="flex items-center space-x-4">
                                <Clock className="w-5 h-5 text-orange-600" />
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium">{turno.servicio.nombre}</span>
                                    <Badge className="bg-orange-500">Pendiente</Badge>
                                  </div>
                                  <p className="text-sm text-gray-700">
                                    {turno.cliente.nombre_completo} → {turno.empleado.nombre_completo}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Solicitado para: {dateFormatted} - {timeFormatted}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-orange-700">
                                  ${turno.precio_final || turno.servicio.precio}
                                </p>
                                <div className="flex space-x-2 mt-2">
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                    Aceptar
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-red-600 border-red-600">
                                    Rechazar
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
                        <p className="text-gray-500">No hay solicitudes pendientes</p>
                        <p className="text-sm text-gray-400 mt-2">Todas las solicitudes han sido procesadas</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Turnos */}
          <TabsContent value="turnos" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Gestión de Turnos</CardTitle>
                    <CardDescription>Administra todas las citas del sistema</CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline">
                      <Filter className="w-4 h-4 mr-2" />
                      Filtros
                    </Button>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Nuevo Turno
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4" />
                  <p>Funcionalidad de gestión de turnos en desarrollo</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Reportes */}
          <TabsContent value="reportes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reportes y Análisis</CardTitle>
                <CardDescription>Estadísticas detalladas y reportes del negocio</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4" />
                  <p>Sistema de reportes en desarrollo</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
