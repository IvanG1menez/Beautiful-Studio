'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, formatDateTimeReadable, formatTime } from '@/lib/dateUtils';
import { Calendar, CalendarDays, CheckCircle, Clock, Filter, Loader2, Plus, Search, User, X, XCircle } from 'lucide-react';
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
  notas_empleado?: string;
  created_at: string;
  updated_at: string;
}

export default function TurnosClientePage() {
  const router = useRouter();

  // Estados
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'proximos' | 'pasados'>('proximos');

  // Nuevos estados para filtros avanzados
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('all');
  const [filterCategoria, setFilterCategoria] = useState<string>('all');
  const [filterProfesional, setFilterProfesional] = useState<string>('all');
  const [filterFecha, setFilterFecha] = useState<'hoy' | 'semana' | 'mes' | 'all'>('all');
  const [sortBy, setSortBy] = useState<'fecha' | 'precio' | 'servicio'>('fecha');

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
    let filtered = turnos;

    // Filtro temporal (próximos/pasados/todos)
    if (filter === 'proximos') {
      filtered = filtered.filter(turno => {
        const fechaTurno = new Date(turno.fecha_hora);
        return fechaTurno >= now && turno.estado !== 'cancelado' && turno.estado !== 'completado';
      });
    } else if (filter === 'pasados') {
      filtered = filtered.filter(turno => {
        const fechaTurno = new Date(turno.fecha_hora);
        return fechaTurno < now || turno.estado === 'completado' || turno.estado === 'cancelado';
      });
    }

    // Filtro por búsqueda de texto
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(turno =>
        turno.servicio_nombre.toLowerCase().includes(searchLower) ||
        turno.empleado_nombre.toLowerCase().includes(searchLower) ||
        turno.categoria_nombre.toLowerCase().includes(searchLower) ||
        turno.notas_cliente?.toLowerCase().includes(searchLower)
      );
    }

    // Filtro por estado
    if (filterEstado !== 'all') {
      filtered = filtered.filter(turno => turno.estado === filterEstado);
    }

    // Filtro por categoría
    if (filterCategoria !== 'all') {
      filtered = filtered.filter(turno => turno.categoria_nombre === filterCategoria);
    }

    // Filtro por profesional
    if (filterProfesional !== 'all') {
      filtered = filtered.filter(turno => turno.empleado_nombre === filterProfesional);
    }

    // Filtro por rango de fecha
    if (filterFecha !== 'all') {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      filtered = filtered.filter(turno => {
        const fechaTurno = new Date(turno.fecha_hora);
        fechaTurno.setHours(0, 0, 0, 0);

        switch (filterFecha) {
          case 'hoy':
            return fechaTurno.getTime() === hoy.getTime();
          case 'semana':
            const unaSemana = new Date(hoy);
            unaSemana.setDate(hoy.getDate() + 7);
            return fechaTurno >= hoy && fechaTurno <= unaSemana;
          case 'mes':
            const unMes = new Date(hoy);
            unMes.setMonth(hoy.getMonth() + 1);
            return fechaTurno >= hoy && fechaTurno <= unMes;
          default:
            return true;
        }
      });
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'fecha':
          return new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime();
        case 'precio':
          return parseFloat(b.precio_final) - parseFloat(a.precio_final);
        case 'servicio':
          return a.servicio_nombre.localeCompare(b.servicio_nombre);
        default:
          return 0;
      }
    });

    return filtered;
  };

  // Obtener categorías únicas
  const categoriasUnicas = [...new Set(turnos.map(t => t.categoria_nombre))].sort();

  // Obtener profesionales únicos
  const profesionalesUnicos = [...new Set(turnos.map(t => t.empleado_nombre))].sort();

  // Función para limpiar todos los filtros
  const limpiarFiltros = () => {
    setSearchTerm('');
    setFilterEstado('all');
    setFilterCategoria('all');
    setFilterProfesional('all');
    setFilterFecha('all');
    setSortBy('fecha');
  };

  // Contar filtros activos
  const filtrosActivos = [
    searchTerm !== '',
    filterEstado !== 'all',
    filterCategoria !== 'all',
    filterProfesional !== 'all',
    filterFecha !== 'all'
  ].filter(Boolean).length;
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
                {filteredTurnos.length} de {turnos.length} turno{turnos.length !== 1 ? 's' : ''}
                {filtrosActivos > 0 && ` (${filtrosActivos} filtro${filtrosActivos > 1 ? 's' : ''} activo${filtrosActivos > 1 ? 's' : ''})`}
              </CardDescription>
            </div>
            <Button onClick={() => router.push('/dashboard/cliente/turnos/nuevo')}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Turno
            </Button>
          </div>

          {/* Filtros principales (Próximos/Historial/Todos) */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <Button
              variant={filter === 'proximos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('proximos')}
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              Próximos
            </Button>
            <Button
              variant={filter === 'pasados' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pasados')}
            >
              <Clock className="w-4 h-4 mr-2" />
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

          {/* Filtros avanzados */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Filter className="w-4 h-4" />
              <span>Filtros Avanzados</span>
              {filtrosActivos > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={limpiarFiltros}
                  className="ml-auto text-xs h-7"
                >
                  <X className="w-3 h-3 mr-1" />
                  Limpiar filtros
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Búsqueda por texto */}
              <div className="relative col-span-full md:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por servicio, profesional..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtro por estado */}
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">⏳ Pendiente</SelectItem>
                  <SelectItem value="confirmado">✅ Confirmado</SelectItem>
                  <SelectItem value="en_proceso">🔄 En Proceso</SelectItem>
                  <SelectItem value="completado">✔️ Completado</SelectItem>
                  <SelectItem value="cancelado">❌ Cancelado</SelectItem>
                  <SelectItem value="no_asistio">⛔ No Asistió</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro por rango de fecha */}
              <Select value={filterFecha} onValueChange={(v) => setFilterFecha(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Rango de fecha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las fechas</SelectItem>
                  <SelectItem value="hoy">📅 Hoy</SelectItem>
                  <SelectItem value="semana">📆 Esta semana</SelectItem>
                  <SelectItem value="mes">🗓️ Este mes</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro por categoría */}
              {categoriasUnicas.length > 1 && (
                <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categoriasUnicas.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Filtro por profesional */}
              {profesionalesUnicos.length > 1 && (
                <Select value={filterProfesional} onValueChange={setFilterProfesional}>
                  <SelectTrigger>
                    <SelectValue placeholder="Profesional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los profesionales</SelectItem>
                    {profesionalesUnicos.map(prof => (
                      <SelectItem key={prof} value={prof}>
                        <User className="w-3 h-3 inline mr-2" />
                        {prof}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Ordenamiento */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fecha">📅 Fecha</SelectItem>
                  <SelectItem value="precio">💰 Precio</SelectItem>
                  <SelectItem value="servicio">✂️ Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Lista de turnos */}
          <div className="space-y-4">
            {filteredTurnos.map((turno) => {
              const isPendiente = turno.estado === 'pendiente';
              const isConfirmado = turno.estado === 'confirmado';
              const isCompletado = turno.estado === 'completado';
              const isCancelado = turno.estado === 'cancelado' || turno.estado === 'no_asistio';

              return (
                <div
                  key={turno.id}
                  className={`relative flex flex-col md:flex-row md:items-start justify-between p-5 border-l-4 rounded-lg transition-all hover:shadow-md ${isConfirmado ? 'border-l-green-500 bg-green-50/30' :
                      isPendiente ? 'border-l-yellow-500 bg-yellow-50/30' :
                        isCompletado ? 'border-l-blue-500 bg-blue-50/30' :
                          'border-l-gray-400 bg-gray-50/30'
                    }`}
                >
                  {/* Indicador visual de estado */}
                  <div className="absolute top-3 right-3">
                    {isConfirmado && <CheckCircle className="w-5 h-5 text-green-600" />}
                    {isCancelado && <XCircle className="w-5 h-5 text-red-600" />}
                  </div>

                  <div className="flex-1 pr-4">
                    {/* Servicio y categoría */}
                    <div className="flex items-start gap-2 mb-3 flex-wrap">
                      <h3 className="font-bold text-xl text-gray-900">{turno.servicio_nombre}</h3>
                      <Badge variant="outline" className="font-medium">
                        {turno.categoria_nombre}
                      </Badge>
                      <Badge
                        variant={getEstadoBadgeVariant(turno.estado)}
                        className={`${getEstadoColor(turno.estado)} text-white font-medium`}
                      >
                        {turno.estado_display}
                      </Badge>
                    </div>

                    {/* Información del turno en grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-medium capitalize">{formatDate(turno.fecha_hora)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-medium">
                          {formatTime(turno.fecha_hora)} - {formatTime(turno.fecha_hora_fin)}
                          <span className="text-gray-500 ml-1">({turno.servicio_duracion})</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <User className="w-4 h-4 text-primary shrink-0" />
                        <span>
                          <span className="font-medium">{turno.empleado_nombre}</span>
                          <span className="text-gray-500 text-xs ml-1">({turno.empleado_especialidad})</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <span className="text-lg font-bold text-primary">${turno.precio_final}</span>
                      </div>
                    </div>

                    {/* Nota del cliente - Siempre visible pero con diseño mejorado */}
                    {turno.notas_cliente && (
                      <div className="mt-3 p-3 rounded-lg border bg-blue-50 border-blue-200">
                        <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-1">
                          <span className="text-blue-600">💬</span>
                          Mis notas
                        </div>
                        <div className="text-sm text-blue-800 whitespace-pre-wrap">
                          {turno.notas_cliente}
                        </div>
                      </div>
                    )}

                    {/* Nota del profesional */}
                    {turno.notas_empleado && (
                      <div className="mt-3 p-3 rounded-lg border bg-amber-50 border-amber-200">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 mb-1">
                          <span className="text-amber-600">📝</span>
                          Nota del profesional
                        </div>
                        <div className="text-sm text-amber-800 whitespace-pre-wrap">
                          {turno.notas_empleado}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div className="flex gap-2 mt-4 md:mt-0 md:ml-4 md:flex-col md:justify-start">
                    {turno.puede_cancelar && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelarTurno(
                          turno.id,
                          turno.servicio_nombre,
                          formatDateTimeReadable(turno.fecha_hora)
                        )}
                        className="whitespace-nowrap"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar Turno
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredTurnos.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No se encontraron turnos
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {filter === 'proximos' && searchTerm === '' && filtrosActivos === 0 && 'No tienes turnos próximos. ¡Agenda tu próxima cita!'}
                  {filter === 'pasados' && searchTerm === '' && filtrosActivos === 0 && 'No tienes turnos en el historial'}
                  {filter === 'todos' && searchTerm === '' && filtrosActivos === 0 && 'No tienes turnos agendados'}
                  {(searchTerm !== '' || filtrosActivos > 0) && 'No hay turnos que coincidan con los filtros seleccionados. Intenta ajustar tu búsqueda.'}
                </p>
                {filtrosActivos > 0 ? (
                  <Button variant="outline" onClick={limpiarFiltros}>
                    <X className="w-4 h-4 mr-2" />
                    Limpiar filtros
                  </Button>
                ) : (
                  <Button onClick={() => router.push('/dashboard/cliente/turnos/nuevo')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Agendar mi primer turno
                  </Button>
                )}
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
