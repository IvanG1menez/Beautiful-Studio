'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getAuthHeaders } from '@/lib/auth-headers';
import { formatDate } from '@/lib/dateUtils';
import {
  Calendar,
  CheckCircle,
  Crown,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Star,
  TrendingUp,
  User,
  Users,
  ChevronDown,
  DoorOpen
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Cliente {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  user_dni: string;
  is_active: boolean;
  fecha_nacimiento: string;
  direccion: string;
  preferencias: string;
  fecha_primera_visita: string;
  is_vip: boolean;
  nombre_completo: string;
  edad: number;
  tiempo_como_cliente: number;
  total_turnos: number;
  ultimo_turno: string;
  turnos_completados: number;
  ultimos_turnos?: ClienteTurnoResumen[];
  created_at: string;
  updated_at: string;
}

interface ClienteTurnoResumen {
  id: number;
  fecha_hora: string;
  estado: string;
  estado_display: string;
  servicio_nombre: string;
  categoria_nombre?: string;
  sala_nombre?: string;
}

export default function MisClientesPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroVIP, setFiltroVIP] = useState<'todos' | 'vip' | 'regulares'>('todos');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
    } else {
      loadClientes();
    }
  }, [router]);

  useEffect(() => {
    filtrarClientes();
  }, [searchTerm, filtroVIP, clientes]);

  const loadClientes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/clientes/mis_clientes/?page_size=100', {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        const clientesData = data.results || data;
        setClientes(Array.isArray(clientesData) ? clientesData : []);
      } else {
        console.error('Error loading clientes:', response.status);
      }
    } catch (error) {
      console.error('Error loading clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtrarClientes = () => {
    let resultado = [...clientes];

    // Filtrar por término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      resultado = resultado.filter(cliente =>
        cliente.nombre_completo.toLowerCase().includes(term) ||
        cliente.email.toLowerCase().includes(term) ||
        cliente.phone?.toLowerCase().includes(term) ||
        cliente.user_dni?.toLowerCase().includes(term)
      );
    }

    // Filtrar por VIP
    if (filtroVIP === 'vip') {
      resultado = resultado.filter(c => c.is_vip);
    } else if (filtroVIP === 'regulares') {
      resultado = resultado.filter(c => !c.is_vip);
    }

    setClientesFiltrados(resultado);
  };

  const getClienteStats = () => {
    const totalClientes = clientes.length;
    const clientesVIP = clientes.filter(c => c.is_vip).length;
    const clientesFrecuentes = clientes.filter(c => c.total_turnos >= 5).length;
    const promedioTurnos = clientes.length > 0
      ? (clientes.reduce((sum, c) => sum + (c.total_turnos || 0), 0) / clientes.length).toFixed(1)
      : '0';

    return { totalClientes, clientesVIP, clientesFrecuentes, promedioTurnos };
  };

  const getFrecuenciaLabel = (totalTurnos: number) => {
    if (totalTurnos >= 10) return { label: 'Muy Frecuente', color: 'bg-green-500' };
    if (totalTurnos >= 5) return { label: 'Frecuente', color: 'bg-blue-500' };
    if (totalTurnos >= 3) return { label: 'Regular', color: 'bg-yellow-500' };
    return { label: 'Nuevo', color: 'bg-gray-500' };
  };

  const getEstadoTurnoStyle = (estado: string) => {
    switch (estado) {
      case 'completado':
        return 'border-emerald-200 bg-emerald-50 text-emerald-800';
      case 'confirmado':
        return 'border-blue-200 bg-blue-50 text-blue-800';
      case 'pendiente':
      case 'pendiente_manual':
        return 'border-amber-200 bg-amber-50 text-amber-800';
      case 'cancelado':
      case 'no_asistio':
      case 'expirada':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'en_proceso':
        return 'border-violet-200 bg-violet-50 text-violet-800';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-700';
    }
  };

  const stats = getClienteStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Cargando clientes...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-8 h-8" />
          Mis Clientes
        </h1>
        <p className="text-gray-600 mt-1">
          Gestiona y visualiza tu base de clientes
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Clientes</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalClientes}</p>
              </div>
              <Users className="w-10 h-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Clientes VIP</p>
                <p className="text-3xl font-bold text-amber-600">{stats.clientesVIP}</p>
              </div>
              <Crown className="w-10 h-10 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Frecuentes</p>
                <p className="text-3xl font-bold text-green-600">{stats.clientesFrecuentes}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Promedio Turnos</p>
                <p className="text-3xl font-bold text-purple-600">{stats.promedioTurnos}</p>
              </div>
              <Star className="w-10 h-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y búsqueda */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Buscar por nombre, email, teléfono o DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filtroVIP === 'todos' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroVIP('todos')}
              >
                Todos
              </Button>
              <Button
                variant={filtroVIP === 'vip' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroVIP('vip')}
                className={filtroVIP === 'vip' ? 'bg-amber-600 hover:bg-amber-700' : ''}
              >
                <Crown className="w-4 h-4 mr-1" />
                VIP
              </Button>
              <Button
                variant={filtroVIP === 'regulares' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroVIP('regulares')}
              >
                Regulares
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de clientes */}
      <Card>
        <CardHeader>
          <CardTitle>
            Clientes ({clientesFiltrados.length})
          </CardTitle>
          <CardDescription>
            {clientesFiltrados.length === 0 && clientes.length > 0
              ? 'No se encontraron clientes con los filtros aplicados'
              : 'Clientes que han tenido turnos contigo'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientesFiltrados.length > 0 ? (
            <div className="space-y-4">
              {clientesFiltrados.map((cliente) => {
                const frecuencia = getFrecuenciaLabel(cliente.total_turnos || 0);
                return (
                  <details
                    key={cliente.id}
                    className="group overflow-hidden rounded-lg border bg-white transition-colors open:bg-gray-50"
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                      {/* Info principal */}
                      <div className="flex items-start gap-4 flex-1">
                        {/* Avatar */}
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                          {cliente.first_name?.charAt(0).toUpperCase() || 'C'}
                        </div>

                        {/* Datos */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{cliente.nombre_completo}</h3>
                            {cliente.is_vip && (
                              <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                                <Crown className="w-3 h-3 mr-1" />
                                VIP
                              </Badge>
                            )}
                            <Badge
                              className={`${frecuencia.color} text-white`}
                            >
                              {frecuencia.label}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              <span>{cliente.email}</span>
                            </div>
                            {cliente.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                <span>{cliente.phone}</span>
                              </div>
                            )}
                            {cliente.edad && (
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <span>{cliente.edad} años</span>
                              </div>
                            )}
                            {cliente.direccion && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <span className="truncate">{cliente.direccion}</span>
                              </div>
                            )}
                          </div>

                          {/* Preferencias */}
                          {cliente.preferencias && (
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                              <p className="text-blue-900">
                                <span className="font-medium">Notas:</span> {cliente.preferencias}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Estadísticas */}
                      <div className="flex flex-col items-end gap-2 min-w-[180px]">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Total de turnos</p>
                          <p className="text-2xl font-bold text-gray-900">{cliente.total_turnos || 0}</p>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>{cliente.turnos_completados || 0} completados</span>
                        </div>
                        {cliente.ultimo_turno && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" />
                            <span>Último: {formatDate(cliente.ultimo_turno)}</span>
                          </div>
                        )}
                        {cliente.tiempo_como_cliente && (
                          <div className="text-sm text-gray-500">
                            Cliente hace {cliente.tiempo_como_cliente} días
                          </div>
                        )}
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium text-slate-600 group-open:bg-slate-900 group-open:text-white">
                          <span className="group-open:hidden">Ver historial</span>
                          <span className="hidden group-open:inline">Ocultar historial</span>
                          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                        </span>
                      </div>
                    </summary>

                    <div className="border-t border-slate-200 bg-slate-50/70 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">Últimos turnos con este cliente</p>
                          <p className="text-sm text-slate-500">Estado, servicio y sala asignada</p>
                        </div>
                      </div>

                      {cliente.ultimos_turnos && cliente.ultimos_turnos.length > 0 ? (
                        <div className="grid gap-3 lg:grid-cols-2">
                          {cliente.ultimos_turnos.map((turno) => (
                            <div key={turno.id} className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900">{turno.servicio_nombre}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                                    <span className="flex items-center gap-1.5">
                                      <Calendar className="h-4 w-4" />
                                      {formatDate(turno.fecha_hora)}
                                    </span>
                                    {(turno.sala_nombre || turno.categoria_nombre) && (
                                      <span className="flex items-center gap-1.5">
                                        <DoorOpen className="h-4 w-4" />
                                        {turno.sala_nombre || turno.categoria_nombre}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Badge variant="outline" className={`${getEstadoTurnoStyle(turno.estado)} shrink-0`}>
                                  {turno.estado_display || turno.estado}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                          No hay historial detallado disponible para este cliente.
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {clientes.length === 0
                  ? 'Aún no tienes clientes'
                  : 'No se encontraron clientes con los filtros aplicados'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
