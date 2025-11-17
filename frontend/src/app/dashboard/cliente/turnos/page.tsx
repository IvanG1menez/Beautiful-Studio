'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateTimeReadable, formatTime } from '@/lib/dateUtils';
import { Calendar, Clock, Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Turno {
  id: number;
  cliente: number;
  cliente_nombre: string;
  cliente_email: string;
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
  puede_cancelar: boolean;
  notas_cliente?: string;
  created_at: string;
  updated_at: string;
}

export default function TurnosClientePage() {
  const router = useRouter();

  // Estados
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'proximos' | 'pasados'>('proximos');

  // Estados para modales
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState({ title: '', description: '' });

  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({
    title: '',
    description: '',
    type: 'success' as 'success' | 'error'
  });

  // Función para obtener token y headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Token ${token}` : ''
    };
  };

  // Cargar turnos
  const fetchTurnos = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await fetch('http://localhost:8000/api/turnos/mis_turnos/?page_size=1000', { headers });

      if (response.ok) {
        const data = await response.json();
        const turnosData = data.results || data;
        setTurnos(Array.isArray(turnosData) ? turnosData : []);
      } else {
        showNotification(
          'Error al cargar turnos',
          'No se pudieron cargar los turnos',
          'error'
        );
      }
    } catch (error) {
      console.error('Error fetching turnos:', error);
      showNotification(
        'Error de conexión',
        'No se pudo conectar con el servidor',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTurnos();
  }, []);

  // Función para mostrar confirmación modal
  const showConfirmDialog = (title: string, description: string, action: () => void) => {
    setConfirmMessage({ title, description });
    setConfirmAction(() => action);
    setConfirmDialogOpen(true);
  };

  const handleConfirmAction = () => {
    if (confirmAction) {
      confirmAction();
    }
    setConfirmDialogOpen(false);
  };

  // Función para mostrar notificación modal
  const showNotification = (title: string, description: string, type: 'success' | 'error') => {
    setNotificationMessage({ title, description, type });
    setNotificationDialogOpen(true);
  };

  // Cancelar turno
  const handleCancelarTurno = async (turnoId: number, servicioNombre: string, fecha: string) => {
    showConfirmDialog(
      '¿Cancelar turno?',
      `¿Estás seguro de que deseas cancelar el turno de "${servicioNombre}" para el ${fecha}?`,
      async () => {
        try {
          const response = await fetch(`http://localhost:8000/api/turnos/${turnoId}/`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });

          if (response.ok) {
            showNotification(
              'Turno cancelado',
              'El turno ha sido cancelado correctamente.',
              'success'
            );
            fetchTurnos();
          } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || 'No se pudo cancelar el turno';
            showNotification('Error al cancelar', errorMessage, 'error');
          }
        } catch (error) {
          console.error('Error:', error);
          showNotification(
            'Error de conexión',
            'No se pudo conectar con el servidor',
            'error'
          );
        }
      }
    );
  };

  // Filtrar turnos
  const getFilteredTurnos = () => {
    const now = new Date();

    if (filter === 'proximos') {
      return turnos.filter(turno => {
        const fechaTurno = new Date(turno.fecha_hora);
        return fechaTurno >= now && turno.estado !== 'cancelado' && turno.estado !== 'completado';
      });
    } else if (filter === 'pasados') {
      return turnos.filter(turno => {
        const fechaTurno = new Date(turno.fecha_hora);
        return fechaTurno < now || turno.estado === 'completado' || turno.estado === 'cancelado';
      });
    }

    return turnos;
  };
  // Obtener color del badge según estado
  const getEstadoBadgeVariant = (estado: string) => {
    switch (estado) {
      case 'confirmado':
        return 'default';
      case 'pendiente':
        return 'secondary';
      case 'en_proceso':
        return 'default';
      case 'completado':
        return 'default';
      case 'cancelado':
        return 'destructive';
      case 'no_asistio':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Cargando turnos...</span>
      </div>
    );
  }

  const filteredTurnos = getFilteredTurnos();

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-8 h-8" />
          Mis Turnos
        </h1>
        <p className="text-gray-600 mt-1">
          Gestiona tus citas y reservas
        </p>
      </div>

      {/* Card principal */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Turnos Agendados</CardTitle>
              <CardDescription>
                Total de {filteredTurnos.length} turno{filteredTurnos.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button onClick={() => router.push('/dashboard/cliente/turnos/nuevo')}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Turno
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex gap-2 mt-4">
            <Button
              variant={filter === 'proximos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('proximos')}
            >
              Próximos
            </Button>
            <Button
              variant={filter === 'pasados' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pasados')}
            >
              Historial
            </Button>
            <Button
              variant={filter === 'todos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('todos')}
            >
              Todos
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Lista de turnos */}
          <div className="space-y-4">
            {filteredTurnos.map((turno) => (
              <div
                key={turno.id}
                className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  {/* Servicio y categoría */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-semibold text-lg">{turno.servicio_nombre}</h3>
                    <Badge variant="outline">{turno.categoria_nombre}</Badge>
                    <Badge
                      variant={getEstadoBadgeVariant(turno.estado)}
                      className={`${getEstadoColor(turno.estado)} text-white`}
                    >
                      {turno.estado_display}
                    </Badge>
                  </div>

                  {/* Información del turno */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className="capitalize">{formatDate(turno.fecha_hora)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>
                        {formatTime(turno.fecha_hora)} - {formatTime(turno.fecha_hora_fin)}
                        {' '}({turno.servicio_duracion})
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Profesional:</span> {turno.empleado_nombre}
                    </div>
                    <div>
                      <span className="font-medium">Precio:</span> ${turno.precio_final}
                    </div>
                  </div>

                  {/* Notas del cliente */}
                  {turno.notas_cliente && (
                    <div className="mt-2 text-sm text-gray-500">
                      <span className="font-medium">Notas:</span> {turno.notas_cliente}
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2 mt-4 md:mt-0 md:ml-4">
                  {turno.puede_cancelar && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancelarTurno(
                        turno.id,
                        turno.servicio_nombre,
                        formatDateTimeReadable(turno.fecha_hora)
                      )}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {filteredTurnos.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 text-lg mb-4">
                  {filter === 'proximos' && 'No tienes turnos próximos'}
                  {filter === 'pasados' && 'No tienes turnos en el historial'}
                  {filter === 'todos' && 'No tienes turnos agendados'}
                </p>
                <Button onClick={() => router.push('/dashboard/cliente/turnos/nuevo')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agendar mi primer turno
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de confirmación */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmMessage.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMessage.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener turno</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} className="bg-red-600 hover:bg-red-700">
              Sí, cancelar turno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de notificación */}
      <AlertDialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={notificationMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}>
              {notificationMessage.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {notificationMessage.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setNotificationDialogOpen(false)}
              className={notificationMessage.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              Aceptar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
