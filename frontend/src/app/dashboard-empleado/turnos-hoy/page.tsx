'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { Turno } from '@/types';
import { formatTime, formatDate, getCurrentDateISO } from '@/lib/dateUtils';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Filter,
  Loader2,
  Mail,
  Phone,
  Scissors,
  Search,
  User,
  XCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const ESTADO_COLORS = {
  pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  confirmado: 'bg-blue-100 text-blue-800 border-blue-300',
  completado: 'bg-green-100 text-green-800 border-green-300',
  cancelado: 'bg-red-100 text-red-800 border-red-300',
  no_asistio: 'bg-gray-100 text-gray-800 border-gray-300',
};

const ESTADO_ICONS = {
  pendiente: <Clock className="w-4 h-4" />,
  confirmado: <CheckCircle className="w-4 h-4" />,
  completado: <CheckCircle className="w-4 h-4" />,
  cancelado: <XCircle className="w-4 h-4" />,
  no_asistio: <AlertCircle className="w-4 h-4" />,
};

const ESTADO_LABELS = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  completado: 'Completado',
  cancelado: 'Cancelado',
  no_asistio: 'No Asistió',
};

export default function TurnosHoyPage() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [turnosFiltrados, setTurnosFiltrados] = useState<Turno[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [showNotasDialog, setShowNotasDialog] = useState(false);
  const [showCancelarDialog, setShowCancelarDialog] = useState(false);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [notificacionesActivas, setNotificacionesActivas] = useState(true);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('auth_token');
      const savedUser = localStorage.getItem('user');

      if (!token || !savedUser) {
        router.push('/login');
        return false;
      }

      try {
        const userData = JSON.parse(savedUser);
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
      loadTurnosHoy();
    }
  }, [router]);

  // Verificar próximos turnos y notificar
  useEffect(() => {
    if (turnos.length === 0 || !notificacionesActivas) return;

    const intervalo = setInterval(() => {
      const ahora = new Date();
      const en15Minutos = new Date(ahora.getTime() + 15 * 60000);

      turnos.forEach(turno => {
        if (turno.estado !== 'confirmado') return;

        const horaTurno = new Date(turno.fecha_hora);

        // Notificar si el turno es en los próximos 15 minutos
        if (horaTurno > ahora && horaTurno <= en15Minutos) {
          const minutosRestantes = Math.round((horaTurno.getTime() - ahora.getTime()) / 60000);

          // Verificar si ya notificamos este turno
          const notificado = sessionStorage.getItem(`notificado_${turno.id}`);
          if (!notificado) {
            reproducirNotificacion();

            // Mostrar notificación del navegador si está permitido
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Próximo Turno', {
                body: `${(turno as any).cliente_nombre} - ${(turno as any).servicio_nombre} en ${minutosRestantes} minutos`,
                icon: '/icon.png',
                tag: `turno_${turno.id}`
              });
            }

            sessionStorage.setItem(`notificado_${turno.id}`, 'true');
          }
        }
      });
    }, 60000); // Verificar cada minuto

    return () => clearInterval(intervalo);
  }, [turnos, notificacionesActivas]);

  // Solicitar permiso para notificaciones
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const getAuthToken = (): string | null => {
    return localStorage.getItem('auth_token');
  };

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    // La URL base ya incluye /api, no agregar nuevamente
    const fullUrl = url.startsWith('http')
      ? url
      : `${baseUrl}${url}`;

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

  const loadTurnosHoy = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const today = getCurrentDateISO();

      const response = await authenticatedFetch(
        `/turnos/?fecha_desde=${today}&fecha_hasta=${today}&page_size=1000`
      );
      
      if (response.ok) {
        const data = await response.json();
        const turnosData = data.results || data;

        // Ordenar por hora
        const turnosOrdenados = turnosData.sort((a: Turno, b: Turno) => {
          return new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime();
        });

        setTurnos(turnosOrdenados);
        setTurnosFiltrados(turnosOrdenados);
      } else {
        throw new Error('Error al cargar los turnos');
      }
    } catch (error) {
      console.error('Error loading turnos:', error);
      setError('No se pudieron cargar los turnos de hoy');
    } finally {
      setIsLoading(false);
    }
  };

  // Aplicar filtros
  useEffect(() => {
    let resultado = [...turnos];

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter(t => t.estado === filtroEstado);
    }

    // Filtro por búsqueda de cliente
    if (busquedaCliente.trim()) {
      const busqueda = busquedaCliente.toLowerCase();
      resultado = resultado.filter(t => {
        const nombreCliente = ((t as any).cliente_nombre || t.cliente?.nombre_completo || '').toLowerCase();
        const emailCliente = ((t as any).cliente_email || '').toLowerCase();
        return nombreCliente.includes(busqueda) || emailCliente.includes(busqueda);
      });
    }

    setTurnosFiltrados(resultado);
  }, [turnos, filtroEstado, busquedaCliente]);

  const handleConfirmarTurno = async (turnoId: number) => {
    try {
      setLoadingAction(turnoId);
      const response = await authenticatedFetch(`/turnos/${turnoId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'confirmado' }),
      });

      if (response.ok) {
        await loadTurnosHoy();
      } else {
        const errorData = await response.json();
        console.error('Error del servidor:', errorData);
        const errorMessage = errorData.estado?.[0] || errorData.detail || 'Error al confirmar el turno';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error confirmando turno:', error);
      alert(error.message || 'No se pudo confirmar el turno. Por favor, intenta de nuevo.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCompletarTurno = async () => {
    if (!selectedTurno) return;

    try {
      setLoadingAction(selectedTurno.id);
      const response = await authenticatedFetch(`/turnos/${selectedTurno.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          estado: 'completado',
          notas_empleado: notas || undefined,
        }),
      });

      if (response.ok) {
        setShowNotasDialog(false);
        setNotas('');
        setSelectedTurno(null);
        await loadTurnosHoy();
      } else {
        const errorData = await response.json();
        console.error('Error del servidor:', errorData);
        const errorMessage = errorData.estado?.[0] || errorData.detail || 'Error al completar el turno';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error completando turno:', error);
      alert(error.message || 'No se pudo completar el turno. Por favor, intenta de nuevo.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancelarTurno = async () => {
    if (!selectedTurno) return;

    try {
      setLoadingAction(selectedTurno.id);
      const response = await authenticatedFetch(`/turnos/${selectedTurno.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          estado: 'cancelado',
          notas_empleado: notas || undefined,
        }),
      });

      if (response.ok) {
        setShowCancelarDialog(false);
        setNotas('');
        setSelectedTurno(null);
        await loadTurnosHoy();
      } else {
        const errorData = await response.json();
        console.error('Error del servidor:', errorData);
        const errorMessage = errorData.estado?.[0] || errorData.detail || 'Error al cancelar el turno';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error cancelando turno:', error);
      alert(error.message || 'No se pudo cancelar el turno. Por favor, intenta de nuevo.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleNoAsistio = async (turnoId: number) => {
    if (!confirm('¿Confirmas que el cliente no asistió a este turno?')) {
      return;
    }

    try {
      setLoadingAction(turnoId);
      const response = await authenticatedFetch(`/turnos/${turnoId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'no_asistio' }),
      });

      if (response.ok) {
        await loadTurnosHoy();
      } else {
        const errorData = await response.json();
        console.error('Error del servidor:', errorData);
        const errorMessage = errorData.estado?.[0] || errorData.detail || 'Error al marcar como no asistió';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error marcando no asistió:', error);
      alert(error.message || 'No se pudo actualizar el turno. Por favor, intenta de nuevo.');
    } finally {
      setLoadingAction(null);
    }
  };

  const openCompletarDialog = (turno: Turno) => {
    setSelectedTurno(turno);
    setNotas(turno.notas_empleado || '');
    setShowNotasDialog(true);
  };

  const openCancelarDialog = (turno: Turno) => {
    setSelectedTurno(turno);
    setNotas('');
    setShowCancelarDialog(true);
  };

  const getTurnosPorHora = () => {
    const ahora = new Date();
    const pasados = turnosFiltrados.filter(t => new Date(t.fecha_hora) < ahora && t.estado !== 'completado' && t.estado !== 'cancelado');
    const proximos = turnosFiltrados.filter(t => new Date(t.fecha_hora) >= ahora || t.estado === 'completado' || t.estado === 'cancelado');

    return { pasados, proximos };
  };

  const { pasados, proximos } = getTurnosPorHora();

  // Función para exportar turnos del día
  const exportarTurnos = () => {
    const fechaHoy = new Date().toLocaleDateString('es-AR');

    let contenido = `TURNOS DEL DÍA - ${fechaHoy}\n`;
    contenido += `${'='.repeat(80)}\n\n`;

    turnosFiltrados.forEach((turno, index) => {
      contenido += `${index + 1}. ${formatTime(turno.fecha_hora)} - ${(turno as any).servicio_nombre || turno.servicio?.nombre}\n`;
      contenido += `   Cliente: ${(turno as any).cliente_nombre || turno.cliente?.nombre_completo}\n`;
      contenido += `   Teléfono: ${(turno as any).cliente_telefono || 'N/A'}\n`;
      contenido += `   Estado: ${ESTADO_LABELS[turno.estado as keyof typeof ESTADO_LABELS]}\n`;
      contenido += `   Duración: ${(turno as any).servicio_duracion || turno.servicio?.duracion_minutos} min\n`;
      contenido += `   Precio: $${turno.precio_final || (turno as any).servicio_precio || turno.servicio?.precio}\n`;
      if (turno.notas_cliente) {
        contenido += `   Nota cliente: ${turno.notas_cliente}\n`;
      }
      contenido += `\n`;
    });

    contenido += `\nRESUMEN:\n`;
    contenido += `Total de turnos: ${turnosFiltrados.length}\n`;
    contenido += `Pendientes: ${turnosFiltrados.filter(t => t.estado === 'pendiente').length}\n`;
    contenido += `Confirmados: ${turnosFiltrados.filter(t => t.estado === 'confirmado').length}\n`;
    contenido += `Completados: ${turnosFiltrados.filter(t => t.estado === 'completado').length}\n`;

    const ingresoTotal = turnosFiltrados
      .filter(t => t.estado === 'completado')
      .reduce((sum, t) => sum + Number(t.precio_final || (t as any).servicio_precio || 0), 0);
    contenido += `Ingresos completados: $${ingresoTotal}\n`;

    // Crear y descargar archivo
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `turnos_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Reproducir sonido de notificación
  const reproducirNotificacion = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS56+ijUBELTKXh8LdkHQU2jdXxy3ksBSV3yPDej0ALE1y06+qnVRQLRp/h8r5sIQYsgc7y2Yk2Chhju+vnpVISC0yl4fC3ZR0FNo3V8ct5LAYld8jw3o9ACxNctOvqp1UVC0af4fK+bCEGLIHO8tmJNgoZY7vr56VSEgtMpeHwt2UdBTaN1fHLeSw');
    audio.play().catch(e => console.log('No se pudo reproducir el sonido'));
  };

  const renderTurnoCard = (turno: Turno, isPasado: boolean = false) => {
    const isPendiente = turno.estado === 'pendiente';
    const isConfirmado = turno.estado === 'confirmado';
    const isCompletado = turno.estado === 'completado';
    const isCancelado = turno.estado === 'cancelado';

    // Verificar si el turno es en los próximos 30 minutos
    const ahora = new Date();
    const horaTurno = new Date(turno.fecha_hora);
    const minutosHasta = Math.round((horaTurno.getTime() - ahora.getTime()) / 60000);
    const esProximo = minutosHasta > 0 && minutosHasta <= 30 && isConfirmado;

    return (
      <Card key={turno.id} className={`${isPasado ? 'border-orange-300 bg-orange-50/30' : ''} ${esProximo ? 'border-blue-500 border-2 bg-blue-50/30 shadow-lg' : ''}`}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Información principal */}
            <div className="flex-1 space-y-4">
              {/* Header con hora y estado */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`${esProximo ? 'bg-blue-500 animate-pulse' : 'bg-blue-100'} p-3 rounded-lg`}>
                    <Clock className={`w-6 h-6 ${esProximo ? 'text-white' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatTime(turno.fecha_hora)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {isPasado && '⏰ Hora pasada'}
                      {esProximo && (
                        <span className="text-blue-600 font-semibold flex items-center gap-1">
                          <Bell className="w-3 h-3 animate-bounce" />
                          ¡En {minutosHasta} minutos!
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Badge className={`${ESTADO_COLORS[turno.estado as keyof typeof ESTADO_COLORS]} border flex items-center gap-1`}>
                  {ESTADO_ICONS[turno.estado as keyof typeof ESTADO_ICONS]}
                  {ESTADO_LABELS[turno.estado as keyof typeof ESTADO_LABELS]}
                </Badge>
              </div>

              <Separator />

              {/* Servicio */}
              <div className="flex items-start gap-3">
                <Scissors className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="font-semibold text-lg text-gray-900">
                    {(turno as any).servicio_nombre || turno.servicio?.nombre || 'Servicio'}
                  </div>
                  <div className="text-sm text-gray-600">
                    Duración: {(turno as any).servicio_duracion || turno.servicio?.duracion_minutos || 0} minutos
                  </div>
                </div>
              </div>

              {/* Cliente */}
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="font-medium text-gray-900">
                    {(turno as any).cliente_nombre || turno.cliente?.nombre_completo || 'Cliente'}
                  </div>
                  {(turno as any).cliente_telefono && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                      <Phone className="w-4 h-4" />
                      {(turno as any).cliente_telefono}
                    </div>
                  )}
                  {(turno as any).cliente_email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                      <Mail className="w-4 h-4" />
                      {(turno as any).cliente_email}
                    </div>
                  )}
                </div>
              </div>

              {/* Precio */}
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-green-600" />
                <div className="text-xl font-bold text-green-600">
                  ${turno.precio_final || (turno as any).servicio_precio || turno.servicio?.precio || '0'}
                </div>
              </div>

              {/* Notas del cliente */}
              {turno.notas_cliente && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-900 mb-1">
                    Nota del cliente:
                  </div>
                  <div className="text-sm text-blue-800">
                    {turno.notas_cliente}
                  </div>
                </div>
              )}

              {/* Notas del empleado */}
              {turno.notas_empleado && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    Mis notas:
                  </div>
                  <div className="text-sm text-gray-700">
                    {turno.notas_empleado}
                  </div>
                </div>
              )}
            </div>

            {/* Acciones */}
            {!isCompletado && !isCancelado && (
              <div className="flex flex-col gap-2 min-w-[180px]">
                {isPendiente && (
                  <Button
                    onClick={() => handleConfirmarTurno(turno.id)}
                    disabled={loadingAction === turno.id}
                    className="w-full"
                    variant="default"
                  >
                    {loadingAction === turno.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Confirmar
                  </Button>
                )}

                {isConfirmado && (
                  <>
                    <Button
                      onClick={() => openCompletarDialog(turno)}
                      disabled={loadingAction === turno.id}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {loadingAction === turno.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Completar
                    </Button>

                    <Button
                      onClick={() => handleNoAsistio(turno.id)}
                      disabled={loadingAction === turno.id}
                      variant="outline"
                      className="w-full"
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      No Asistió
                    </Button>
                  </>
                )}

                {!isCompletado && !isCancelado && (
                  <Button
                    onClick={() => openCancelarDialog(turno)}
                    disabled={loadingAction === turno.id}
                    variant="destructive"
                    className="w-full"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando turnos de hoy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard-empleado')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Dashboard
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Calendar className="w-10 h-10 text-blue-600" />
                Turnos de Hoy
              </h1>
              <p className="text-gray-600 text-lg">
                {formatDate(new Date().toISOString())}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setNotificacionesActivas(!notificacionesActivas)}
                variant={notificacionesActivas ? "default" : "outline"}
                title={notificacionesActivas ? "Notificaciones activadas" : "Notificaciones desactivadas"}
              >
                <Bell className={`w-4 h-4 ${notificacionesActivas ? 'animate-pulse' : ''}`} />
              </Button>

              <Button
                onClick={reproducirNotificacion}
                variant="outline"
                title="Probar sonido de notificación"
              >
                <Bell className="w-4 h-4" />
                Probar
              </Button>

              <Button
                onClick={exportarTurnos}
                variant="outline"
                disabled={turnosFiltrados.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>

              <Button
                onClick={loadTurnosHoy}
                variant="outline"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Calendar className="w-4 h-4 mr-2" />
                )}
                Actualizar
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Búsqueda por cliente */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Buscar por nombre o email del cliente..."
                    value={busquedaCliente}
                    onChange={(e) => setBusquedaCliente(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filtro por estado */}
              <div className="w-full md:w-64">
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger>
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="pendiente">Pendientes</SelectItem>
                    <SelectItem value="confirmado">Confirmados</SelectItem>
                    <SelectItem value="completado">Completados</SelectItem>
                    <SelectItem value="cancelado">Cancelados</SelectItem>
                    <SelectItem value="no_asistio">No Asistió</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Botón limpiar filtros */}
              {(filtroEstado !== 'todos' || busquedaCliente) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFiltroEstado('todos');
                    setBusquedaCliente('');
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Limpiar
                </Button>
              )}
            </div>

            {/* Contador de resultados filtrados */}
            {(filtroEstado !== 'todos' || busquedaCliente) && (
              <div className="mt-3 text-sm text-gray-600">
                Mostrando {turnosFiltrados.length} de {turnos.length} turnos
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{turnosFiltrados.length}</div>
                <div className="text-sm text-gray-600">
                  {filtroEstado !== 'todos' || busquedaCliente ? 'Filtrados' : 'Total Turnos'}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {turnos.filter(t => t.estado === 'pendiente').length}
                </div>
                <div className="text-sm text-gray-600">Pendientes</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {turnos.filter(t => t.estado === 'confirmado').length}
                </div>
                <div className="text-sm text-gray-600">Confirmados</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-600">
                  {turnos.filter(t => t.estado === 'completado').length}
                </div>
                <div className="text-sm text-gray-600">Completados</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Lista de turnos */}
        {turnosFiltrados.length === 0 && turnos.length > 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="text-center">
                <Search className="w-20 h-20 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No se encontraron turnos
                </h3>
                <p className="text-gray-500 mb-6">
                  No hay turnos que coincidan con los filtros aplicados
                </p>
                <Button
                  onClick={() => {
                    setFiltroEstado('todos');
                    setBusquedaCliente('');
                  }}
                >
                  Limpiar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : turnos.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="text-center">
                <Calendar className="w-20 h-20 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No tienes turnos para hoy
                </h3>
                <p className="text-gray-500 mb-6">
                  ¡Disfruta tu día libre o aprovecha para otras tareas!
                </p>
                <Button onClick={() => router.push('/dashboard-empleado/agenda')}>
                  Ver Agenda Completa
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Turnos con hora pasada */}
            {pasados.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-orange-700 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Requieren Atención ({pasados.length})
                </h2>
                <div className="space-y-4">
                  {pasados.map(turno => renderTurnoCard(turno, true))}
                </div>
              </div>
            )}

            {/* Próximos turnos */}
            {proximos.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {pasados.length > 0 ? 'Próximos Turnos' : 'Tus Turnos'} ({proximos.length})
                </h2>
                <div className="space-y-4">
                  {proximos.map(turno => renderTurnoCard(turno))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dialog para completar turno */}
        <Dialog open={showNotasDialog} onOpenChange={setShowNotasDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Completar Turno</DialogTitle>
              <DialogDescription>
                Agrega notas sobre el servicio realizado (opcional)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Ej: Aplicado tinte rubio platinado, recomendado uso de shampoo sin sulfatos..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={4}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNotasDialog(false);
                  setNotas('');
                  setSelectedTurno(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCompletarTurno}
                disabled={loadingAction !== null}
                className="bg-green-600 hover:bg-green-700"
              >
                {loadingAction ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Completar Turno
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para cancelar turno */}
        <Dialog open={showCancelarDialog} onOpenChange={setShowCancelarDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar Turno</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas cancelar este turno? Agrega un motivo (opcional)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Motivo de la cancelación..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelarDialog(false);
                  setNotas('');
                  setSelectedTurno(null);
                }}
              >
                No, mantener turno
              </Button>
              <Button
                onClick={handleCancelarTurno}
                disabled={loadingAction !== null}
                variant="destructive"
              >
                {loadingAction ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Sí, cancelar turno
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
