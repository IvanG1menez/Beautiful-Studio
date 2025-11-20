'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, formatTime } from '@/lib/dateUtils';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  Phone,
  User,
  XCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Interfaces
interface Turno {
  id: number;
  cliente: number;
  cliente_nombre: string;
  empleado: number;
  empleado_nombre: string;
  empleado_especialidad: string;
  servicio: number;
  servicio_nombre: string;
  servicio_duracion: string;
  categoria_nombre: string;
  fecha_hora: string;
  fecha_hora_fin: string;
  estado: 'pendiente' | 'confirmado' | 'en_proceso' | 'completado' | 'cancelado' | 'no_asistio';
  estado_display: string;
  precio_final: string;
  notas_cliente?: string;
  notas_empleado?: string;
  created_at: string;
  updated_at: string;
}

interface Cliente {
  id: number;
  nombre_completo: string;
  fecha_nacimiento: string;
  direccion: string;
  preferencias: string;
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
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
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [perfilCliente, setPerfilCliente] = useState<Cliente | null>(null);
  const [loadingTurnos, setLoadingTurnos] = useState(true);
  const [loadingPerfil, setLoadingPerfil] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
    } else {
      setIsClient(true);
      loadPerfilData();
      loadTurnosData();
    }
  }, [router]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Token ${token}` : ''
    };
  };

  const loadPerfilData = async () => {
    try {
      setLoadingPerfil(true);
      const response = await fetch('http://localhost:8000/api/users/profile/', {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setPerfilCliente(data.cliente_profile);
      }
    } catch (error) {
      console.error('Error loading perfil:', error);
    } finally {
      setLoadingPerfil(false);
    }
  };

  const loadTurnosData = async () => {
    try {
      setLoadingTurnos(true);
      const response = await fetch('http://localhost:8000/api/turnos/mis_turnos/?page_size=100', {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        const turnosData = data.results || data;
        setTurnos(Array.isArray(turnosData) ? turnosData : []);
      }
    } catch (error) {
      console.error('Error loading turnos:', error);
    } finally {
      setLoadingTurnos(false);
    }
  };

  // Filtrar turnos
  const now = new Date();
  const proximosTurnos = turnos.filter(turno => {
    const fechaTurno = new Date(turno.fecha_hora);
    return fechaTurno >= now && turno.estado !== 'cancelado' && turno.estado !== 'completado';
  }).sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime());

  const historialTurnos = turnos.filter(turno => {
    const fechaTurno = new Date(turno.fecha_hora);
    return fechaTurno < now || turno.estado === 'completado' || turno.estado === 'cancelado';
  }).sort((a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime());

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'confirmado':
        return 'bg-green-500';
      case 'pendiente':
        return 'bg-yellow-500';
      case 'en_proceso':
        return 'bg-blue-500';
      case 'completado':
        return 'bg-gray-500';
      case 'cancelado':
        return 'bg-red-500';
      case 'no_asistio':
        return 'bg-red-700';
      default:
        return 'bg-gray-400';
    }
  };

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const proximoCita = proximosTurnos.length > 0 ? proximosTurnos[0] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con saludo y próxima cita */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                ¡Hola, {perfilCliente?.user?.first_name || 'Cliente'}!
              </h1>
              <p className="text-gray-600 mt-1">
                Gestiona tus citas y servicios
              </p>
            </div>

            {/* Card de Próxima Cita */}
            {loadingTurnos ? (
              <Card className="md:w-96">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Cargando...</span>
                  </div>
                </CardContent>
              </Card>
            ) : proximoCita ? (
              <Card className="md:w-96 border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 mb-1">Próxima cita</p>
                      <p className="text-lg font-bold text-blue-950">{proximoCita.servicio_nombre}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm text-blue-800">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(proximoCita.fecha_hora)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-blue-800">
                        <Clock className="w-4 h-4" />
                        <span>{formatTime(proximoCita.fecha_hora)}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                      onClick={() => router.push('/dashboard/cliente/turnos')}
                    >
                      Ver detalle
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="md:w-96 border-gray-200">
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500 text-center">Sin citas próximas</p>
                  <Button
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => router.push('/dashboard/cliente/turnos/nuevo')}
                  >
                    Reservar Nuevo Turno
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sección principal - Mis Turnos */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Mis Turnos</CardTitle>
                <CardDescription>
                  Gestiona tus citas programadas y consulta el historial
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="proximos" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="proximos">
                      Próximos Turnos
                      {proximosTurnos.length > 0 && (
                        <Badge variant="secondary" className="ml-2">{proximosTurnos.length}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="historial">
                      Historial
                      {historialTurnos.length > 0 && (
                        <Badge variant="secondary" className="ml-2">{historialTurnos.length}</Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="proximos" className="mt-0">
                    {loadingTurnos ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-gray-500">Cargando turnos...</span>
                      </div>
                    ) : proximosTurnos.length > 0 ? (
                      <div className="space-y-3">
                        {proximosTurnos.map((turno) => (
                          <div
                            key={turno.id}
                            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => router.push('/dashboard/cliente/turnos')}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-lg">{turno.servicio_nombre}</h3>
                                  <Badge
                                    variant={getEstadoBadgeVariant(turno.estado)}
                                    className={`${getEstadoColor(turno.estado)} text-white`}
                                  >
                                    {turno.estado_display}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <User className="w-4 h-4" />
                                    <span>{turno.empleado_nombre}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>{formatDate(turno.fecha_hora)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>{formatTime(turno.fecha_hora)} - {formatTime(turno.fecha_hora_fin)}</span>
                                  </div>
                                  <div className="font-medium text-gray-900">
                                    ${turno.precio_final}
                                  </div>
                                </div>
                              </div>
                              <ArrowRight className="w-5 h-5 text-gray-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg mb-4">No tienes turnos próximos</p>
                        <Button onClick={() => router.push('/dashboard/cliente/turnos/nuevo')}>
                          Reservar Turno
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="historial" className="mt-0">
                    {loadingTurnos ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-gray-500">Cargando historial...</span>
                      </div>
                    ) : historialTurnos.length > 0 ? (
                      <div className="space-y-3">
                        {historialTurnos.slice(0, 10).map((turno) => (
                          <div
                            key={turno.id}
                            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => router.push('/dashboard/cliente/turnos')}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-lg">{turno.servicio_nombre}</h3>
                                  <Badge
                                    variant={getEstadoBadgeVariant(turno.estado)}
                                    className={`${getEstadoColor(turno.estado)} text-white`}
                                  >
                                    {turno.estado_display}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <User className="w-4 h-4" />
                                    <span>{turno.empleado_nombre}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>{formatDate(turno.fecha_hora)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>{formatTime(turno.fecha_hora)}</span>
                                  </div>
                                  <div className="font-medium text-gray-900">
                                    ${turno.precio_final}
                                  </div>
                                </div>
                              </div>
                              <ArrowRight className="w-5 h-5 text-gray-400" />
                            </div>
                          </div>
                        ))}
                        {historialTurnos.length > 10 && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => router.push('/dashboard/cliente/turnos')}
                          >
                            Ver todos los turnos
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No tienes historial de turnos</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Mi Perfil */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Mi Perfil</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPerfil ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500">Cargando perfil...</span>
                  </div>
                ) : perfilCliente ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                        {perfilCliente.user.first_name?.charAt(0).toUpperCase() || 'C'}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{perfilCliente.nombre_completo}</p>
                        <p className="text-sm text-gray-500">Cliente</p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t">
                      <div className="flex items-start gap-3 text-sm">
                        <User className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-gray-500">Email</p>
                          <p className="font-medium text-gray-900">{perfilCliente.user.email}</p>
                        </div>
                      </div>

                      {perfilCliente.user.phone && (
                        <div className="flex items-start gap-3 text-sm">
                          <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-gray-500">Teléfono</p>
                            <p className="font-medium text-gray-900">{perfilCliente.user.phone}</p>
                          </div>
                        </div>
                      )}

                      {perfilCliente.fecha_nacimiento && (
                        <div className="flex items-start gap-3 text-sm">
                          <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-gray-500">Fecha de nacimiento</p>
                            <p className="font-medium text-gray-900">
                              {new Date(perfilCliente.fecha_nacimiento).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                      )}

                      {perfilCliente.direccion && (
                        <div className="flex items-start gap-3 text-sm">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-gray-500">Dirección</p>
                            <p className="font-medium text-gray-900">{perfilCliente.direccion}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No se pudo cargar el perfil</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => router.push('/dashboard/cliente/turnos/nuevo')}
                >
                  Reservar Nuevo Turno
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/dashboard/cliente/perfil')}
                >
                  Editar Perfil
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
