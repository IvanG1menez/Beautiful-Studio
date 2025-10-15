'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { Empleado, Turno } from '@/types';
import {
  AlertCircle,
  Award,
  Calendar,
  CalendarDays,
  CheckCircle,
  Clock,
  Loader2,
  Mail,
  Phone,
  Scissors,
  Star,
  Timer,
  User,
  XCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface EmpleadoStats {
  turnos_hoy: number;
  turnos_semana: number;
  turnos_completados: number;
  ingresos_mes: number;
  calificacion_promedio: number;
}

export default function DashboardEmpleadoPage() {
  // Estados del componente
  const [isLoading, setIsLoading] = useState(true);
  const [turnosHoy, setTurnosHoy] = useState<Turno[]>([]);
  const [proximosTurnos, setProximosTurnos] = useState<Turno[]>([]);
  const [perfilEmpleado, setPerfilEmpleado] = useState<Empleado | null>(null);
  const [stats, setStats] = useState<EmpleadoStats | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const router = useRouter();

  // Verificar autenticación y redirigir si es necesario
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('authToken');
      const savedUser = localStorage.getItem('user');

      if (!token || !savedUser) {
        router.push('/login');
        return false;
      }

      try {
        const userData = JSON.parse(savedUser);
        // Verificar que el usuario tenga rol de empleado/profesional
        if (userData.role !== 'empleado' && userData.role !== 'profesional') {
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
    return localStorage.getItem('authToken');
  };

  // Función para hacer peticiones autenticadas
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
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
        loadTurnosHoy(),
        loadProximosTurnos(),
        loadPerfilEmpleado(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoadingData(false);
    }
  };

  // Cargar turnos de hoy del empleado
  const loadTurnosHoy = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await authenticatedFetch(
        `/api/turnos/?empleado=${user?.id}&fecha=${today}&ordering=fecha_hora`
      );

      if (response.ok) {
        const data = await response.json();
        setTurnosHoy(data.results || []);
      } else {
        console.error('Error fetching turnos de hoy:', response.status);
      }
    } catch (error) {
      console.error('Error loading turnos de hoy:', error);
    }
  };

  // Cargar próximos turnos del empleado
  const loadProximosTurnos = async () => {
    try {
      const response = await authenticatedFetch(
        `/api/turnos/?empleado=${user?.id}&estado=pendiente,confirmado&ordering=fecha_hora&limit=10`
      );

      if (response.ok) {
        const data = await response.json();
        // Filtrar solo turnos futuros
        const now = new Date();
        const turnosFuturos = data.results?.filter((turno: Turno) =>
          new Date(turno.fecha_hora) > now
        ) || [];
        setProximosTurnos(turnosFuturos);
      } else {
        console.error('Error fetching próximos turnos:', response.status);
      }
    } catch (error) {
      console.error('Error loading próximos turnos:', error);
    }
  };

  // Cargar perfil del empleado
  const loadPerfilEmpleado = async () => {
    try {
      const response = await authenticatedFetch(`/api/empleados/${user?.id}/`);

      if (response.ok) {
        const data = await response.json();
        setPerfilEmpleado(data);
      } else {
        console.error('Error fetching perfil empleado:', response.status);
      }
    } catch (error) {
      console.error('Error loading perfil empleado:', error);
    }
  };

  // Cargar estadísticas del empleado
  const loadStats = async () => {
    try {
      const response = await authenticatedFetch(`/api/empleados/${user?.id}/stats/`);

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

  // Función para formatear fecha y hora
  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    const dateFormatted = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit'
    });
    const timeFormatted = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return { dateFormatted, timeFormatted };
  };

  // Función para obtener el icono según el estado del turno
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
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  // Función para obtener el color del badge según el estado
  const getEstadoBadgeVariant = (estado: string): "default" | "secondary" | "destructive" | "outline" => {
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
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-green-600 rounded-xl flex items-center justify-center">
                <Scissors className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  ¡Hola, {user?.first_name}!
                </h1>
                <p className="text-gray-600">
                  Panel profesional - Beautiful Studio
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={() => router.push('/calendario')}
                variant="outline"
              >
                <CalendarDays className="w-4 h-4 mr-2" />
                Mi Calendario
              </Button>
              <Button
                onClick={() => router.push('/perfil-empleado')}
                className="bg-gradient-to-r from-blue-500 to-green-600 hover:from-blue-600 hover:to-green-700"
              >
                <User className="w-4 h-4 mr-2" />
                Mi Perfil
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Columna Principal */}
          <div className="lg:col-span-2 space-y-8">
            {/* Estadísticas del Empleado */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Turnos Hoy</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingData ? <Loader2 className="w-6 h-6 animate-spin" /> : stats?.turnos_hoy || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Citas programadas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
                  <Timer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingData ? <Loader2 className="w-6 h-6 animate-spin" /> : stats?.turnos_semana || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Turnos programados</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completados</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingData ? <Loader2 className="w-6 h-6 animate-spin" /> : stats?.turnos_completados || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Total del mes</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Calificación</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingData ? <Loader2 className="w-6 h-6 animate-spin" /> : (stats?.calificacion_promedio || 0).toFixed(1)}
                  </div>
                  <p className="text-xs text-muted-foreground">Promedio</p>
                </CardContent>
              </Card>
            </div>

            {/* Turnos de Hoy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Turnos de Hoy
                </CardTitle>
                <CardDescription>
                  Tus citas programadas para hoy
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Cargando turnos...</span>
                  </div>
                ) : turnosHoy.length > 0 ? (
                  <div className="space-y-4">
                    {turnosHoy.map((turno) => {
                      const { timeFormatted } = formatDateTime(turno.fecha_hora);
                      return (
                        <div key={turno.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                {getEstadoIcon(turno.estado)}
                                <h3 className="font-semibold text-lg">
                                  {turno.servicio.nombre}
                                </h3>
                                <Badge variant={getEstadoBadgeVariant(turno.estado)}>
                                  {turno.estado.charAt(0).toUpperCase() + turno.estado.slice(1)}
                                </Badge>
                              </div>
                              <p className="text-gray-600 mb-1">
                                <strong>Cliente:</strong> {turno.cliente.nombre_completo}
                              </p>
                              <p className="text-gray-600 mb-1">
                                <strong>Hora:</strong> {timeFormatted}
                              </p>
                              <p className="text-gray-600">
                                <strong>Duración:</strong> {turno.servicio.duracion_minutos} min
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600">
                                ${turno.precio_final || turno.servicio.precio}
                              </p>
                              {turno.estado === 'pendiente' && (
                                <Button size="sm" variant="outline" className="mt-2">
                                  Confirmar
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No tienes turnos programados para hoy</p>
                    <p className="text-sm text-gray-400">¡Disfruta tu día libre!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Próximos Turnos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Próximos Turnos
                </CardTitle>
                <CardDescription>
                  Tus próximas citas programadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Cargando próximos turnos...</span>
                  </div>
                ) : proximosTurnos.length > 0 ? (
                  <div className="space-y-3">
                    {proximosTurnos.slice(0, 5).map((turno) => {
                      const { dateFormatted, timeFormatted } = formatDateTime(turno.fecha_hora);
                      return (
                        <div key={turno.id} className="border rounded-lg p-3 bg-gray-50">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="flex items-center space-x-2 mb-1">
                                {getEstadoIcon(turno.estado)}
                                <span className="font-medium">{turno.servicio.nombre}</span>
                                <Badge variant={getEstadoBadgeVariant(turno.estado)}>
                                  {turno.estado}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600">
                                {turno.cliente.nombre_completo} • {dateFormatted} • {timeFormatted}
                              </p>
                            </div>
                            <span className="font-semibold text-green-600">
                              ${turno.precio_final || turno.servicio.precio}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No tienes próximos turnos programados</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Mi Perfil Profesional */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Mi Perfil Profesional
                </CardTitle>
                <CardDescription>
                  Tu información como profesional
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Avatar y nombre */}
                    <div className="text-center">
                      <Avatar className="w-20 h-20 mx-auto mb-4">
                        <AvatarFallback className="text-lg">
                          {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="font-semibold text-lg">
                        {user?.first_name} {user?.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {perfilEmpleado?.especialidades || 'Profesional'}
                      </p>
                      {perfilEmpleado?.is_disponible && (
                        <Badge className="mt-2 bg-green-100 text-green-800">
                          Activo
                        </Badge>
                      )}
                    </div>

                    <Separator />

                    {/* Información de contacto */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{user?.email}</span>
                      </div>

                      {user?.phone && (
                        <div className="flex items-center space-x-3">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">{user.phone}</span>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Estadísticas del mes */}
                    <div className="space-y-3">
                      <h4 className="font-medium">Estadísticas del Mes</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Servicios completados</span>
                          <span className="text-sm font-medium">{stats?.turnos_completados || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Ingresos generados</span>
                          <span className="text-sm font-medium">${stats?.ingresos_mes || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Calificación promedio</span>
                          <div className="flex items-center">
                            <Star className="w-3 h-3 text-yellow-400 mr-1" />
                            <span className="text-sm font-medium">
                              {(stats?.calificacion_promedio || 0).toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Especialidad */}
                    <div>
                      <h4 className="font-medium mb-2">Especialidad</h4>
                      <Badge variant="outline" className="text-xs">
                        {perfilEmpleado?.especialidades || 'General'}
                      </Badge>
                    </div>

                    {/* Botón editar perfil */}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => router.push('/perfil-empleado')}
                    >
                      Editar Perfil
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}