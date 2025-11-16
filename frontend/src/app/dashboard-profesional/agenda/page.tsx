'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatTime } from '@/lib/dateUtils';
import { Turno } from '@/types';
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Loader2, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const ESTADO_COLORS: { [key: string]: string } = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  confirmado: 'bg-blue-100 text-blue-800',
  en_proceso: 'bg-purple-100 text-purple-800',
  completado: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800',
  no_asistio: 'bg-gray-100 text-gray-800',
};

const ESTADO_LABELS: { [key: string]: string } = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_proceso: 'En Proceso',
  completado: 'Completado',
  cancelado: 'Cancelado',
  no_asistio: 'No AsistiÃ³',
};

export default function AgendaEmpleadoPage() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [empleadoId, setEmpleadoId] = useState<number | null>(null);

  // Estados para cambiar estado de turno
  const [turnoActual, setTurnoActual] = useState<Turno | null>(null);
  const [cambioEstadoDialog, setCambioEstadoDialog] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [notasEmpleado, setNotasEmpleado] = useState('');
  const [procesando, setProcesando] = useState(false);

  // Función para obtener el token de autenticación
  const getAuthToken = () => localStorage.getItem('auth_token');

  // Función para hacer peticiones autenticadas
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    if (!token) throw new Error('No authentication token found');

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    return fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
        ...options.headers,
      },
    });
  };

  // Cargar empleado_id del usuario al montar el componente
  useEffect(() => {
    const loadEmpleadoId = async () => {
      try {
        // Primero intentar obtener del localStorage (si ya se logueó)
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.empleado_id) {
            setEmpleadoId(user.empleado_id);
            console.log('Empleado ID desde localStorage:', user.empleado_id);
            return;
          }
        }

        // Si no está en localStorage, cargar desde el API
        const response = await authenticatedFetch('/empleados/me/');
        if (response.ok) {
          const data = await response.json();
          setEmpleadoId(data.id);
          console.log('Empleado ID cargado desde API:', data.id);

          // Actualizar localStorage para futuras cargas
          if (userStr) {
            const user = JSON.parse(userStr);
            user.empleado_id = data.id;
            localStorage.setItem('user', JSON.stringify(user));
          }
        } else {
          console.error('Error al cargar perfil de empleado');
          setError('No se pudo cargar el perfil del empleado');
        }
      } catch (err) {
        console.error('Error loading empleado ID:', err);
        setError('Error de conexión al cargar el perfil');
      }
    };

    loadEmpleadoId();
  }, []);

  // Cargar turnos
  const loadTurnos = async (fecha: Date) => {
    if (!empleadoId) {
      console.log('Esperando ID del empleado...');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const fechaStr = fecha.toISOString().split('T')[0];

      // Usar el mismo endpoint que el dashboard: /turnos/empleado/{id}
      const response = await authenticatedFetch(
        `/turnos/empleado/${empleadoId}?fecha_desde=${fechaStr}&fecha_hasta=${fechaStr}`
      );

      if (response.ok) {
        const data = await response.json();
        const turnosArray = Array.isArray(data) ? data : (data.results || []);
        setTurnos(turnosArray);
        console.log(`Turnos cargados para ${fechaStr}:`, turnosArray.length);
      } else {
        console.error('Error al cargar turnos:', response.status);
        setError('No se pudieron cargar los turnos');
      }
    } catch (err: any) {
      console.error('Error loading turnos:', err);
      setError(err.message || 'Error al cargar los turnos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empleadoId) {
      loadTurnos(selectedDate);
    }
  }, [selectedDate, empleadoId]);

  // Cambiar fecha
  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // Ir a hoy
  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Filtrar turnos
  const turnosFiltrados = turnos.filter(turno => {
    if (filtroEstado === 'todos') return true;
    return turno.estado === filtroEstado;
  });

  // Abrir dialog para cambiar estado
  const handleCambiarEstado = (turno: Turno) => {
    setTurnoActual(turno);
    setNuevoEstado(turno.estado);
    setNotasEmpleado(turno.notas_empleado || '');
    setCambioEstadoDialog(true);
  };

  // Confirmar cambio de estado
  const confirmarCambioEstado = async () => {
    if (!turnoActual || !nuevoEstado) return;

    try {
      setProcesando(true);

      console.log('Intentando actualizar turno:', {
        turnoId: turnoActual.id,
        nuevoEstado,
        notasEmpleado,
        empleadoId
      });

      // Actualizar el turno usando fetch directamente para mejor control
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:8000/api/turnos/${turnoActual.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({
          estado: nuevoEstado,
          notas_empleado: notasEmpleado || ''
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.detail || errorData.error || 'Error al actualizar');
      }

      const updatedTurno = await response.json();
      console.log('Turno actualizado exitosamente:', updatedTurno);

      setCambioEstadoDialog(false);
      loadTurnos(selectedDate);
    } catch (err: any) {
      console.error('Error updating turno:', err);
      alert('Error al actualizar el turno: ' + (err.message || 'Error desconocido'));
    } finally {
      setProcesando(false);
    }
  };

  // Formatear fecha
  const formatDate = (date: Date): string => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    return `${dias[date.getDay()]}, ${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
  };

  // Formatear hora
  // Formatear hora (convertir de UTC a hora local)
  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Mi Agenda</h1>
        <p className="text-gray-600 mt-1">
          Gestiona tus turnos y citas del día
        </p>
      </div>

      {/* Selector de fecha */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeDate(-1)}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>

            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-gray-500" />
              <div className="text-center">
                <p className="text-lg font-semibold">{formatDate(selectedDate)}</p>
                {selectedDate.toDateString() === new Date().toDateString() && (
                  <Badge variant="default" className="mt-1">Hoy</Badge>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => changeDate(1)}
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex justify-center items-center gap-4 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToToday}
              disabled={selectedDate.toDateString() === new Date().toDateString()}
            >
              Ir a Hoy
            </Button>

            {/* Date Picker para saltar a cualquier fecha */}
            <div className="flex items-center gap-2">
              <label htmlFor="date-picker" className="text-sm font-medium text-gray-700">
                Ir a fecha:
              </label>
              <input
                id="date-picker"
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value + 'T12:00:00');
                  setSelectedDate(newDate);
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Turnos del Día</CardTitle>
              <CardDescription>
                {turnosFiltrados.length} turno{turnosFiltrados.length !== 1 ? 's' : ''} {filtroEstado !== 'todos' ? `(${ESTADO_LABELS[filtroEstado]})` : ''}
              </CardDescription>
            </div>

            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="confirmado">Confirmados</SelectItem>
                <SelectItem value="en_proceso">En Proceso</SelectItem>
                <SelectItem value="completado">Completados</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
                <SelectItem value="no_asistio">No Asistieron</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Cargando turnos...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => loadTurnos(selectedDate)} variant="outline">
                Reintentar
              </Button>
            </div>
          ) : turnosFiltrados.length > 0 ? (
            <div className="space-y-4">
              {turnosFiltrados.map((turno) => (
                <div
                  key={turno.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Clock className="w-5 h-5 text-gray-500" />
                        <span className="font-semibold text-lg">{formatTime(turno.fecha_hora)}</span>
                        <Badge className={ESTADO_COLORS[turno.estado]}>
                          {ESTADO_LABELS[turno.estado]}
                        </Badge>
                      </div>

                      <div className="ml-8 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">
                            {(turno as any).cliente_nombre || turno.cliente?.nombre_completo || (turno as any).cliente_email || 'Cliente'}
                          </span>
                        </div>

                        <div className="text-gray-700">
                          <span className="font-medium">{(turno as any).servicio_nombre || turno.servicio?.nombre || 'Servicio'}</span>
                          <span className="text-gray-500 text-sm ml-2">
                            ({(turno as any).servicio_duracion || turno.servicio?.duracion_minutos || 0} min)
                          </span>
                        </div>

                        {turno.notas_cliente && (
                          <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                            <span className="font-medium">Nota del cliente:</span> {turno.notas_cliente}
                          </div>
                        )}

                        {turno.notas_empleado && (
                          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            <span className="font-medium">Mis notas:</span> {turno.notas_empleado}
                          </div>
                        )}

                        <div className="text-sm text-gray-500">
                          Precio: ${turno.precio_final || (turno as any).servicio_precio || turno.servicio?.precio || '0'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {turno.estado === 'pendiente' && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setTurnoActual(turno);
                              setNuevoEstado('confirmado');
                              setNotasEmpleado('');
                              confirmarCambioEstado();
                            }}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCambiarEstado(turno)}
                          >
                            Gestionar
                          </Button>
                        </>
                      )}

                      {turno.estado === 'confirmado' && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setTurnoActual(turno);
                              setNuevoEstado('en_proceso');
                              setNotasEmpleado('');
                              confirmarCambioEstado();
                            }}
                          >
                            Iniciar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCambiarEstado(turno)}
                          >
                            Gestionar
                          </Button>
                        </>
                      )}

                      {turno.estado === 'en_proceso' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleCambiarEstado(turno)}
                        >
                          Completar
                        </Button>
                      )}

                      {turno.estado !== 'completado' && turno.estado !== 'cancelado' && turno.estado !== 'no_asistio' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setTurnoActual(turno);
                            setNuevoEstado('cancelado');
                            setCambioEstadoDialog(true);
                          }}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                No hay turnos para {filtroEstado !== 'todos' ? `estado "${ESTADO_LABELS[filtroEstado]}"` : 'este día'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para cambiar estado */}
      <AlertDialog open={cambioEstadoDialog} onOpenChange={setCambioEstadoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gestionar Turno</AlertDialogTitle>
            <AlertDialogDescription>
              Cliente: {(turnoActual as any)?.cliente_nombre || turnoActual?.cliente?.nombre_completo || (turnoActual as any)?.cliente_email || 'Cliente'}
              <br />
              Servicio: {(turnoActual as any)?.servicio_nombre || turnoActual?.servicio?.nombre || 'Servicio'}
              <br />
              Hora: {turnoActual && formatTime(turnoActual.fecha_hora)}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Estado del Turno</label>
              <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {turnoActual?.estado === 'pendiente' && (
                    <>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </>
                  )}
                  {turnoActual?.estado === 'confirmado' && (
                    <>
                      <SelectItem value="en_proceso">En Proceso</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                      <SelectItem value="no_asistio">No AsistiÃ³</SelectItem>
                    </>
                  )}
                  {turnoActual?.estado === 'en_proceso' && (
                    <>
                      <SelectItem value="completado">Completado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Notas (Opcional)</label>
              <Textarea
                value={notasEmpleado}
                onChange={(e) => setNotasEmpleado(e.target.value)}
                placeholder="Agrega observaciones sobre este turno..."
                rows={3}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarCambioEstado}
              disabled={procesando || !nuevoEstado}
            >
              {procesando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
