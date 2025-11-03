'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, formatDateTimeReadable, formatTime } from '@/lib/dateUtils';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  XCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Interfaces
interface Turno {
  id: number;
  cliente: {
    id: number;
    nombre_completo: string;
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
}

// Funciones auxiliares
const getEstadoIcon = (estado: string) => {
  switch (estado.toLowerCase()) {
    case 'confirmado':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'pendiente':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'cancelado':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'completado':
      return <CheckCircle className="w-4 h-4 text-blue-500" />;
    default:
      return <AlertCircle className="w-4 h-4 text-gray-500" />;
  }
};

const getEstadoBadgeVariant = (estado: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (estado.toLowerCase()) {
    case 'confirmado':
      return 'default';
    case 'pendiente':
      return 'secondary';
    case 'cancelado':
      return 'destructive';
    case 'completado':
      return 'outline';
    default:
      return 'secondary';
  }
};

export default function DashboardClientePage() {
  // Estados del componente
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [proximosTurnos, setProximosTurnos] = useState<Turno[]>([]);
  const [historialTurnos, setHistorialTurnos] = useState<Turno[]>([]);
  const [perfilCliente, setPerfilCliente] = useState<any | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null); // Estado para el usuario

  // Lógica de protección de ruta
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
    } else {
      setIsClient(true);
      loadUserData();
      loadTurnosData();
    }
  }, [router]);

  // Función para obtener el token de autenticación
  const getAuthToken = (): string | null => {
    return localStorage.getItem('auth_token');
  };

  // Función para hacer peticiones autenticadas
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  };

  // Función para cargar datos del usuario
  const loadUserData = async () => {
    try {
      const response = await authenticatedFetch('http://localhost:8000/api/users/profile/');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setPerfilCliente(userData.cliente_profile || null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setError('Error al cargar datos del usuario');
    }
  };

  // Función para cargar datos de turnos
  const loadTurnosData = async () => {
    setLoadingData(true);
    try {
      const [proximosResponse, historialResponse] = await Promise.all([
        authenticatedFetch('http://localhost:8000/api/turnos/proximos/'),
        authenticatedFetch('http://localhost:8000/api/turnos/historial/')
      ]);

      if (proximosResponse.ok) {
        const proximosData = await proximosResponse.json();
        setProximosTurnos(proximosData);
      }

      if (historialResponse.ok) {
        const historialData = await historialResponse.json();
        setHistorialTurnos(historialData);
      }
    } catch (error) {
      console.error('Error loading turnos data:', error);
      setError('Error al cargar datos de turnos');
    } finally {
      setLoadingData(false);
    }
  };

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Verificando autenticación...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                ¡Hola, {user?.first_name || 'Cliente'}!
              </h1>
              <p className="text-gray-600 mt-1">
                Gestiona tus citas y servicios
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Próxima cita</p>
                <p className="font-semibold">
                  {proximosTurnos.length > 0
                    ? formatDateTimeReadable(proximosTurnos[0].fecha_hora)
                    : 'Sin citas próximas'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Mis Turnos</CardTitle>
                <CardDescription>
                  Gestiona tus citas programadas y consulta el historial
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="proximos" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="proximos">Próximos Turnos</TabsTrigger>
                    <TabsTrigger value="historial">Historial</TabsTrigger>
                  </TabsList>

                  <TabsContent value="proximos">
                    {loadingData ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="ml-2">Cargando turnos...</span>
                      </div>
                    ) : proximosTurnos.length > 0 ? (
                      <div className="space-y-4">
                        {proximosTurnos.map((turno) => {
                          const dateFormatted = formatDate(turno.fecha_hora);
                          const timeFormatted = formatTime(turno.fecha_hora);
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
                                    <strong>Profesional:</strong> {turno.empleado.nombre_completo}
                                  </p>
                                  <p className="text-gray-600 mb-1">
                                    <strong>Fecha:</strong> {dateFormatted}
                                  </p>
                                  <p className="text-gray-600 mb-1">
                                    <strong>Hora:</strong> {timeFormatted}
                                  </p>
                                  <p className="text-gray-600 mb-1">
                                    <strong>Precio:</strong> ${turno.precio_final}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        No tienes turnos próximos
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="historial">
                    {loadingData ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="ml-2">Cargando historial...</span>
                      </div>
                    ) : historialTurnos.length > 0 ? (
                      <div className="space-y-4">
                        {historialTurnos.map((turno) => {
                          const dateFormatted = formatDate(turno.fecha_hora);
                          const timeFormatted = formatTime(turno.fecha_hora);
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
                                    <strong>Profesional:</strong> {turno.empleado.nombre_completo}
                                  </p>
                                  <p className="text-gray-600 mb-1">
                                    <strong>Fecha:</strong> {dateFormatted}
                                  </p>
                                  <p className="text-gray-600 mb-1">
                                    <strong>Hora:</strong> {timeFormatted}
                                  </p>
                                  <p className="text-gray-600 mb-1">
                                    <strong>Precio:</strong> ${turno.precio_final}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        No tienes historial de turnos
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Mi Perfil</CardTitle>
              </CardHeader>
              <CardContent>
                {perfilCliente ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-lg">
                          {user?.first_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold">{perfilCliente.nombre_completo}</p>
                        <p className="text-gray-600 text-sm">{user?.email}</p>
                      </div>
                    </div>
                    {perfilCliente.fecha_nacimiento && (
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(perfilCliente.fecha_nacimiento).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    )}
                    {perfilCliente.direccion && (
                      <div className="flex items-center space-x-2 text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>{perfilCliente.direccion}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">Cargando perfil...</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/reservar-turno')}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Reservar Nuevo Turno
                  </button>
                  <button
                    onClick={() => router.push('/perfil')}
                    className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Editar Perfil
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}