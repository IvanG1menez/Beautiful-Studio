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
import { BeautifulSpinner } from '@/components/ui/BeautifulSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { formatTime } from '@/lib/dateUtils';
import { Turno } from '@/types';
import { AlertCircle, Calendar, Check, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, Printer, Sparkles, User, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
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
  no_asistio: 'No Asistio',
};

export default function AgendaEmpleadoPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [empleadoId, setEmpleadoId] = useState<number | null>(null);
  const [diasTrabajo, setDiasTrabajo] = useState<number[]>([]);
  const [turnosMes, setTurnosMes] = useState<Turno[]>([]);
  const [loadingMes, setLoadingMes] = useState(false);
  const [tableScope, setTableScope] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [tableTurnos, setTableTurnos] = useState<Turno[]>([]);
  const [loadingTabla, setLoadingTabla] = useState(false);
  const [modoCompletar, setModoCompletar] = useState(false);
  const [loadingPendientes, setLoadingPendientes] = useState(false);
  const [errorPendientes, setErrorPendientes] = useState<string | null>(null);
  const [turnosPendientes, setTurnosPendientes] = useState<Turno[]>([]);
  const [selectedPendientesIds, setSelectedPendientesIds] = useState<number[]>([]);

  // Estados para cambiar estado de turno
  const [turnoActual, setTurnoActual] = useState<Turno | null>(null);
  const [cambioEstadoDialog, setCambioEstadoDialog] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [notasEmpleado, setNotasEmpleado] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [resumenHoy, setResumenHoy] = useState<number | null>(null);
  const [resumenSemana, setResumenSemana] = useState<number | null>(null);
  const [procesandoPendientes, setProcesandoPendientes] = useState(false);
  const [datosPruebaActivos, setDatosPruebaActivos] = useState(false);
  const [cantidadDatosPrueba, setCantidadDatosPrueba] = useState(0);
  const [procesandoDatosPrueba, setProcesandoDatosPrueba] = useState(false);

  useEffect(() => {
    const fechaParam = searchParams.get('fecha');
    if (!fechaParam) return;

    const parsed = new Date(`${fechaParam}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      setSelectedDate(parsed);
    }
  }, [searchParams]);

  // Función para obtener el token de autenticación
  const getAuthToken = () => localStorage.getItem('auth_token');

  // Función para hacer peticiones autenticadas
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    if (!token) throw new Error('No authentication token found');

    const baseUrl = '/api';
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

  // Cargar días de trabajo del empleado
  const loadDiasTrabajo = async (empId: number) => {
    try {
      const response = await authenticatedFetch(`/empleados/${empId}/dias-trabajo/`);
      if (response.ok) {
        const data = await response.json();
        setDiasTrabajo(data.dias_trabajo || []);
        console.log('Días de trabajo cargados:', data.dias_trabajo);
      }
    } catch (error) {
      console.error('Error cargando días de trabajo:', error);
    }
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
            loadDiasTrabajo(user.empleado_id); // Cargar días de trabajo
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

          // Cargar días de trabajo
          loadDiasTrabajo(data.id);
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

  // Cargar turnos de todo el mes para la vista mensual
  const loadTurnosMes = async (fechaReferencia: Date) => {
    if (!empleadoId) return;

    try {
      setLoadingMes(true);
      const inicioMes = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), 1);
      const finMes = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth() + 1, 0);

      const desde = inicioMes.toISOString().split('T')[0];
      const hasta = finMes.toISOString().split('T')[0];

      const response = await authenticatedFetch(
        `/turnos/empleado/${empleadoId}?fecha_desde=${desde}&fecha_hasta=${hasta}`
      );

      if (response.ok) {
        const data = await response.json();
        const turnosArray = Array.isArray(data) ? data : data.results || [];
        setTurnosMes(turnosArray);
      }
    } catch (err) {
      console.error('Error cargando turnos del mes:', err);
    } finally {
      setLoadingMes(false);
    }
  };

  // Cargar turnos pendientes de completar (turnos pasados que no están completados/cancelados/no asistió)
  const loadTurnosPendientes = async () => {
    if (!empleadoId) return;

    try {
      setLoadingPendientes(true);
      setErrorPendientes(null);

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const inicio = new Date(hoy);
      inicio.setDate(inicio.getDate() - 30); // últimos 30 días

      const desde = inicio.toISOString().split('T')[0];
      const hasta = hoy.toISOString().split('T')[0];

      const response = await authenticatedFetch(
        `/turnos/empleado/${empleadoId}?fecha_desde=${desde}&fecha_hasta=${hasta}`
      );

      if (!response.ok) {
        console.error('Error al cargar turnos pendientes:', response.status);
        setErrorPendientes('No se pudieron cargar los turnos pendientes');
        return;
      }

      const data = await response.json();
      const turnosArray: Turno[] = Array.isArray(data) ? data : data.results || [];

      const ahora = new Date();
      const pendientes = turnosArray.filter((t) => {
        const fechaTurno = new Date(t.fecha_hora);
        const estado = t.estado.toLowerCase();
        const esEstadoPendiente = !['completado', 'cancelado', 'no_asistio'].includes(estado);
        return fechaTurno < ahora && esEstadoPendiente;
      });

      setTurnosPendientes(pendientes);
    } catch (err: any) {
      console.error('Error cargando turnos pendientes:', err);
      setErrorPendientes(err.message || 'Error al cargar los turnos pendientes');
    } finally {
      setLoadingPendientes(false);
    }
  };

  const loadEstadoDatosPrueba = async () => {
    try {
      const response = await authenticatedFetch('/turnos/datos-prueba-completar/');
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setDatosPruebaActivos(Boolean(data.activo));
      setCantidadDatosPrueba(Number(data.turnos_prueba || 0));
    } catch (err) {
      console.error('Error consultando datos de prueba:', err);
    }
  };

  const toggleDatosPrueba = async () => {
    try {
      setProcesandoDatosPrueba(true);
      const activar = !datosPruebaActivos;

      const response = await authenticatedFetch('/turnos/datos-prueba-completar/', {
        method: 'POST',
        body: JSON.stringify({
          activo: activar,
          cantidad: 2,
          dias: 30,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'No se pudieron actualizar los datos de prueba');
      }

      const data = await response.json();
      setDatosPruebaActivos(Boolean(data.activo));
      setCantidadDatosPrueba(Number(data.turnos_prueba || data.total_prueba_activos || 0));
      setSelectedPendientesIds([]);

      await Promise.all([loadTurnosPendientes(), loadTurnos(selectedDate)]);
      if (viewMode === 'mes') {
        await loadTurnosMes(selectedDate);
      }
    } catch (err: any) {
      console.error('Error al alternar datos de prueba:', err);
      alert(err.message || 'No se pudieron alternar los datos de prueba');
    } finally {
      setProcesandoDatosPrueba(false);
    }
  };

  const completarTurnosSeleccionados = async () => {
    if (selectedPendientesIds.length === 0) {
      return;
    }

    try {
      setProcesandoPendientes(true);

      for (const turnoId of selectedPendientesIds) {
        await authenticatedFetch(`/turnos/${turnoId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ estado: 'completado' }),
        });
      }

      setSelectedPendientesIds([]);
      await loadTurnosPendientes();
      await loadTurnos(selectedDate);
    } catch (err: any) {
      console.error('Error al completar turnos seleccionados:', err);
      alert('Error al completar los turnos seleccionados: ' + (err.message || 'Error desconocido'));
    } finally {
      setProcesandoPendientes(false);
    }
  };

  useEffect(() => {
    if (empleadoId) {
      loadTurnos(selectedDate);
    }
  }, [selectedDate, empleadoId]);

  // Cargar resumen de turnos pendientes cuando se conoce el empleado
  useEffect(() => {
    if (empleadoId) {
      loadTurnosPendientes();
      loadEstadoDatosPrueba();
    }
  }, [empleadoId]);

  // Cargar resúmenes de Hoy (fecha actual) y Esta Semana (semana actual) independientes de la fecha seleccionada
  useEffect(() => {
    if (!empleadoId) return;

    const cargarResumenes = async () => {
      try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const hoyStr = hoy.toISOString().split('T')[0];

        const inicioSemana = new Date(hoy);
        const day = inicioSemana.getDay();
        const diff = (day === 0 ? -6 : 1) - day; // lunes como inicio
        inicioSemana.setDate(inicioSemana.getDate() + diff);
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);

        const desdeSemanaStr = inicioSemana.toISOString().split('T')[0];
        const hastaSemanaStr = finSemana.toISOString().split('T')[0];

        const [respHoy, respSemana] = await Promise.all([
          authenticatedFetch(
            `/turnos/empleado/${empleadoId}?fecha_desde=${hoyStr}&fecha_hasta=${hoyStr}`
          ),
          authenticatedFetch(
            `/turnos/empleado/${empleadoId}?fecha_desde=${desdeSemanaStr}&fecha_hasta=${hastaSemanaStr}`
          ),
        ]);

        if (respHoy.ok) {
          const dataHoy = await respHoy.json();
          const turnosHoy = Array.isArray(dataHoy) ? dataHoy : dataHoy.results || [];
          setResumenHoy(turnosHoy.length);
        }

        if (respSemana.ok) {
          const dataSemana = await respSemana.json();
          const turnosSemana = Array.isArray(dataSemana) ? dataSemana : dataSemana.results || [];
          setResumenSemana(turnosSemana.length);
        }
      } catch (error) {
        console.error('Error cargando resúmenes de agenda:', error);
      }
    };

    cargarResumenes();
  }, [empleadoId]);

  // Validar si una fecha es día de trabajo
  const isWorkDay = (date: Date): boolean => {
    if (diasTrabajo.length === 0) return true;
    const dayOfWeek = date.getDay();
    const adjustedDay = (dayOfWeek + 6) % 7; // Convertir domingo=0 a lunes=0
    return diasTrabajo.includes(adjustedDay);
  };

  // Encontrar el siguiente día de trabajo
  const findNextWorkDay = (startDate: Date, direction: number): Date => {
    const newDate = new Date(startDate);
    let daysChecked = 0;
    const maxDays = 14; // Evitar bucle infinito

    do {
      newDate.setDate(newDate.getDate() + direction);
      daysChecked++;
    } while (!isWorkDay(newDate) && daysChecked < maxDays);

    return newDate;
  };

  // Cambiar fecha (navegar solo por días laborales)
  const changeDate = (days: number) => {
    if (diasTrabajo.length === 0) {
      // Si no hay días de trabajo definidos, navegar normalmente
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + days);
      setSelectedDate(newDate);
    } else {
      // Navegar al siguiente/anterior día laboral
      const newDate = findNextWorkDay(selectedDate, days);
      setSelectedDate(newDate);
    }
  };

  // Ir a hoy
  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const filtrarPorEstado = (lista: Turno[]) => lista.filter(turno => {
    if (filtroEstado === 'todos') return true;
    return turno.estado === filtroEstado;
  });

  // Filtrar turnos
  const turnosFiltrados = filtrarPorEstado(turnos);

  const loadTurnosTabla = async (fechaReferencia: Date, scope: 'dia' | 'semana' | 'mes') => {
    if (!empleadoId) return;

    try {
      setLoadingTabla(true);

      let fechaDesde: string;
      let fechaHasta: string;

      if (scope === 'dia') {
        const fecha = new Date(fechaReferencia);
        fechaDesde = fecha.toISOString().split('T')[0];
        fechaHasta = fechaDesde;
      } else if (scope === 'semana') {
        const inicioSemana = new Date(fechaReferencia);
        const day = inicioSemana.getDay();
        const diff = (day === 0 ? -6 : 1) - day; // lunes como inicio
        inicioSemana.setDate(inicioSemana.getDate() + diff);
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);
        fechaDesde = inicioSemana.toISOString().split('T')[0];
        fechaHasta = finSemana.toISOString().split('T')[0];
      } else {
        const inicioMes = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), 1);
        const finMes = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth() + 1, 0);
        fechaDesde = inicioMes.toISOString().split('T')[0];
        fechaHasta = finMes.toISOString().split('T')[0];
      }

      const response = await authenticatedFetch(
        `/turnos/empleado/${empleadoId}?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}&page_size=1000`
      );

      if (!response.ok) {
        throw new Error('No se pudieron cargar los turnos para la tabla');
      }

      const data = await response.json();
      const turnosArray: Turno[] = Array.isArray(data) ? data : data.results || [];
      setTableTurnos(turnosArray);
    } catch (err) {
      console.error('Error cargando turnos de tabla:', err);
      setTableTurnos([]);
    } finally {
      setLoadingTabla(false);
    }
  };

  // Validar fecha del turno
  const validarFechaTurno = (turno: Turno): { valido: boolean; mensaje: string } => {
    // TODO: Validación deshabilitada para permitir testing
    // Permite finalizar turnos en cualquier momento sin validar la fecha
    return { valido: true, mensaje: '' };
  };

  // Validar horario del turno
  const validarHorarioTurno = (turno: Turno): { valido: boolean; mensaje: string; esAdvertencia: boolean } => {
    const fechaTurno = new Date(turno.fecha_hora);
    const ahora = new Date();

    // Si el turno es antes de ahora, está bien
    if (fechaTurno.getTime() <= ahora.getTime()) {
      return { valido: true, mensaje: '', esAdvertencia: false };
    }

    // Si el turno es en el futuro, mostrar advertencia
    const minutosRestantes = Math.round((fechaTurno.getTime() - ahora.getTime()) / 60000);
    const horasTurno = fechaTurno.getHours();
    const minutosTurno = fechaTurno.getMinutes();
    const horarioTurno = `${horasTurno.toString().padStart(2, '0')}:${minutosTurno.toString().padStart(2, '0')}`;

    return {
      valido: true,
      mensaje: `Aun no es la hora del turno (${horarioTurno}). Faltan ${minutosRestantes} minutos. ¿Deseas finalizarlo ahora?`,
      esAdvertencia: true
    };
  };

  // Abrir dialog para cambiar estado
  const handleCambiarEstado = (turno: Turno) => {
    setTurnoActual(turno);
    setNuevoEstado(turno.estado);
    setNotasEmpleado(turno.notas_empleado || '');
    setCambioEstadoDialog(true);
  };

  // Validar antes de completar
  const handleFinalizarClick = (turno: Turno) => {
    // Validar fecha
    const validacionFecha = validarFechaTurno(turno);
    if (!validacionFecha.valido) {
      alert(validacionFecha.mensaje);
      return;
    }

    // Validar horario
    const validacionHorario = validarHorarioTurno(turno);

    if (validacionHorario.esAdvertencia) {
      // Mostrar advertencia pero permitir continuar
      setConfirmMessage(validacionHorario.mensaje);
      setConfirmAction(() => () => {
        setTurnoActual(turno);
        setNuevoEstado('completado');
        setCambioEstadoDialog(true);
        setShowConfirmDialog(false);
      });
      setShowConfirmDialog(true);
    } else {
      // Todo OK, abrir diálogo directamente
      setTurnoActual(turno);
      setNuevoEstado('completado');
      setCambioEstadoDialog(true);
    }
  };

  // Confirmar cambio de estado
  const confirmarCambioEstado = async () => {
    if (!turnoActual || !nuevoEstado) return;

    if (nuevoEstado === 'en_proceso') {
      const clienteNombre =
        (turnoActual as any)?.cliente_nombre ||
        turnoActual?.cliente?.nombre_completo ||
        (turnoActual as any)?.cliente_email ||
        'el cliente';

      setConfirmMessage(`Vas a iniciar el turno de ${clienteNombre}. ¿Deseas continuar?`);
      setConfirmAction(() => async () => {
        await ejecutarCambioEstado();
        setShowConfirmDialog(false);
      });
      setShowConfirmDialog(true);
      return;
    }

    // Confirmación final usando dialog
    if (nuevoEstado === 'completado') {
      setConfirmMessage('¿Estás seguro de que deseas finalizar este turno?');
      setConfirmAction(() => async () => {
        await ejecutarCambioEstado();
        setShowConfirmDialog(false);
      });
      setShowConfirmDialog(true);
      return;
    }

    await ejecutarCambioEstado();
  };

  const ejecutarCambioEstado = async () => {
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
      const response = await fetch(`/api/turnos/${turnoActual.id}/`, {
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

  const getTurnoDuracion = (turno: Turno): number => {
    const raw = (turno as any).servicio_duracion || turno.servicio?.duracion_minutos || 0;
    if (typeof raw === 'string') {
      const match = raw.match(/\d+/);
      return match ? Number(match[0]) : 0;
    }
    return Number(raw) || 0;
  };

  const getTurnoInicio = (turno: Turno): Date => new Date(turno.fecha_hora);

  const getTurnoFin = (turno: Turno): Date => {
    const inicio = getTurnoInicio(turno);
    const duracion = getTurnoDuracion(turno);
    return new Date(inicio.getTime() + duracion * 60000);
  };

  const formatGap = (minutes: number): string => {
    if (minutes <= 0) return '0 min';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours} h ${mins} min`;
    }
    return `${mins} min`;
  };

  const getRelativeDaysLabel = (dateStr: string): string => {
    const base = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    base.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - base.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays > 1) return `Hace ${diffDays} días`;
    return '';
  };

  const turnosOrdenados = [...turnosFiltrados].sort(
    (a, b) => getTurnoInicio(a).getTime() - getTurnoInicio(b).getTime()
  );

  const proximosTurnos = turnosOrdenados.filter((turno) => {
    const estado = turno.estado.toLowerCase();
    return !['cancelado', 'no_asistio', 'completado'].includes(estado);
  });

  const proximoTurnoId = proximosTurnos.find((turno) => getTurnoInicio(turno) > new Date())?.id;

  // Formatear hora
  // Formatear hora (convertir de UTC a hora local)
  const [viewMode, setViewMode] = useState<'dia' | 'semana' | 'mes' | 'tabla'>('semana');

  const horasDia = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00 a 21:00

  const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();
  const resumenConfirmados = turnosFiltrados.filter((t) => t.estado === 'confirmado').length;
  const resumenPendientes = turnosFiltrados.filter((t) => t.estado === 'pendiente').length;

  const totalTurnosPendientes = turnosPendientes.length;

  const pendientesAgrupados = (() => {
    const mapa: Record<string, Turno[]> = {};
    for (const turno of turnosPendientes) {
      const key = turno.fecha_hora.split('T')[0];
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(turno);
    }
    return Object.entries(mapa).sort(([a], [b]) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });
  })();

  const weekDays = (() => {
    const start = new Date(selectedDate);
    const day = start.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // lunes como inicio
    start.setDate(start.getDate() + diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  })();

  // Agrupar turnos del mes por fecha (YYYY-MM-DD) para la vista mensual
  const turnosMesPorDia = (() => {
    const mapa: Record<string, Turno[]> = {};
    for (const turno of turnosMes) {
      const key = turno.fecha_hora.split('T')[0];
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(turno);
    }
    return mapa;
  })();

  const puedeIniciarTurno = (_turno: Turno): boolean => {
    // Restricción temporal deshabilitada en modo test: se puede iniciar en cualquier momento.
    return true;
  };

  const getMotivoNoIniciable = (_turno: Turno): string => {
    return '';
  };

  const getMontoPendienteTurno = (turno: Turno): number => {
    const montoPendienteApi = Number((turno as any).monto_pendiente || 0);
    if (!Number.isNaN(montoPendienteApi) && montoPendienteApi >= 0) {
      return montoPendienteApi;
    }

    const precio = Number(
      turno.precio_final || (turno as any).servicio_precio || turno.servicio?.precio || 0
    );
    const senia = Number(turno.senia_pagada || 0);
    const pendiente = precio - senia;
    return pendiente > 0 ? pendiente : 0;
  };

  const getPagoLabelTurno = (turno: Turno): string => {
    const pagadoCompleto = Boolean((turno as any).pagado_completo);
    return pagadoCompleto ? 'Servicio completo' : 'Seña';
  };

  // Cuando entro a vista mensual o cambia el mes, cargo turnos del mes
  useEffect(() => {
    if (empleadoId && viewMode === 'mes') {
      loadTurnosMes(selectedDate);
    }
  }, [empleadoId, viewMode, selectedDate]);

  useEffect(() => {
    if (empleadoId && viewMode === 'tabla') {
      void loadTurnosTabla(selectedDate, tableScope);
    }
  }, [empleadoId, viewMode, selectedDate, tableScope]);

  return (
    <div className="min-h-screen bg-background">
      {/* Encabezado principal */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">
              ¡Hola, {user?.first_name || 'Profesional'}!
            </p>
            <h1 className="text-3xl font-bold text-gray-900">Agenda Profesional</h1>
            <p className="text-gray-600 mt-1">Gestiona tus citas y reuniones</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={modoCompletar ? 'outline' : 'default'}
              onClick={() => setModoCompletar((prev) => !prev)}
              className="flex items-center gap-2"
            >
              <span>Completar Turnos</span>
              {totalTurnosPendientes > 0 && (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-black/80 px-2 text-xs font-semibold text-white">
                  {totalTurnosPendientes}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.assign('/dashboard/profesional/reservar-turno')}
            >
              Reservar turno
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={modoCompletar}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir agenda
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {!modoCompletar && (
          <>
            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Hoy</CardTitle>
                  <CardDescription>Turnos del día de hoy</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-purple-600">
                    {resumenHoy !== null ? resumenHoy : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(new Date())}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
                  <CardDescription>Turnos de la semana actual</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-emerald-600">
                    {resumenSemana !== null ? resumenSemana : '-'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Confirmadas</CardTitle>
                  <CardDescription>Citas confirmadas del día seleccionado</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-emerald-600">{resumenConfirmados}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                  <CardDescription>A la espera de confirmación</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-amber-500">{resumenPendientes}</p>
                </CardContent>
              </Card>
            </div>

            {/* Filtros */}
            <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Filtros</CardTitle>
                  <CardDescription>Filtra tus turnos por estado</CardDescription>
                </div>

                <div className="flex items-center gap-4">
                  <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                    <SelectTrigger className="w-[200px]">
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
            </Card>

            {/* Calendario + lista lateral */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Calendario y vista semanal/mensual */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as 'dia' | 'semana' | 'mes' | 'tabla')}>
                        <TabsList className="grid grid-cols-4 w-full max-w-sm">
                          <TabsTrigger value="dia">Día</TabsTrigger>
                          <TabsTrigger value="semana">Semana</TabsTrigger>
                          <TabsTrigger value="mes">Mes</TabsTrigger>
                          <TabsTrigger value="tabla">Tabla</TabsTrigger>
                        </TabsList>
                      </Tabs>

                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={goToToday}
                          disabled={isTodaySelected}
                        >
                          Hoy
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(selectedDate)}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {viewMode === 'dia' && (
                      <div className="rounded-lg border bg-white h-[480px] flex flex-col">
                        <div className="border-b px-4 py-3 flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">Agenda del día</h3>
                            <p className="text-xs text-gray-500">Vista cronológica de tus turnos por hora</p>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-gray-500">
                            <div className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-indigo-500" />
                              <span>Turno</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="h-px w-4 bg-gray-300" />
                              <span>Sin turnos</span>
                            </div>
                          </div>
                        </div>

                        {loading ? (
                          <div className="flex items-center justify-center flex-1">
                            <BeautifulSpinner label="Cargando turnos del día..." />
                          </div>
                        ) : turnosOrdenados.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground">
                            <Calendar className="w-10 h-10 text-gray-300 mb-3" />
                            No hay turnos para este día.
                          </div>
                        ) : (
                          <div className="flex-1 overflow-y-auto">
                            {horasDia.map((hora) => {
                              const turnosEnHora = turnosOrdenados.filter((t) => {
                                const inicio = getTurnoInicio(t);
                                return inicio.getHours() === hora;
                              });

                              const etiquetaHora = `${hora.toString().padStart(2, '0')}:00`;

                              return (
                                <div key={hora} className="flex border-b last:border-b-0">
                                  <div className="w-16 flex items-start justify-end pr-3 pt-3 text-xs text-gray-400">
                                    {etiquetaHora}
                                  </div>
                                  <div className="relative flex-1 py-3">
                                    <div className="absolute left-2 top-0 bottom-0 border-l border-dashed border-gray-200" />
                                    {turnosEnHora.length > 0 ? (
                                      <div className="space-y-2 ml-6">
                                        {turnosEnHora.map((turno) => (
                                          <div
                                            key={turno.id}
                                            className="relative rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-gray-800 shadow-sm"
                                          >
                                            <div className="flex items-center gap-2 mb-1">
                                              <Clock className="w-3 h-3 text-indigo-500" />
                                              <span className="font-semibold text-[11px]">
                                                {formatTime(turno.fecha_hora)}
                                              </span>
                                              <Badge className={`${ESTADO_COLORS[turno.estado]} text-[10px] px-2 py-0.5`}>
                                                {ESTADO_LABELS[turno.estado]}
                                              </Badge>
                                            </div>
                                            <div className="text-[11px] font-medium truncate">
                                              {(turno as any).servicio_nombre || turno.servicio?.nombre || 'Servicio'}
                                            </div>
                                            <div className="text-[11px] text-gray-600 truncate">
                                              {(turno as any).cliente_nombre ||
                                                turno.cliente?.nombre_completo ||
                                                (turno as any).cliente_email ||
                                                'Cliente'}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="ml-6 text-[11px] text-gray-400">
                                        Sin turnos en este horario
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {viewMode === 'semana' && (
                      <div className="grid grid-cols-7 gap-2 text-xs">
                        {weekDays.map((day) => {
                          const isSelected = day.toDateString() === selectedDate.toDateString();
                          const label = day.toLocaleDateString('es-AR', {
                            weekday: 'short',
                            day: '2-digit',
                          });
                          return (
                            <button
                              key={day.toISOString()}
                              type="button"
                              onClick={() => setSelectedDate(day)}
                              className={`flex flex-col items-center rounded-lg border px-2 py-2 transition-colors ${isSelected
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white text-gray-800 hover:bg-gray-50'
                                }`}
                            >
                              <span className="font-medium">{label.split(' ')[0]}</span>
                              <span className="text-lg font-semibold leading-none mt-1">
                                {day.getDate().toString().padStart(2, '0')}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {viewMode === 'mes' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold">
                            {selectedDate.toLocaleDateString('es-AR', {
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                          {loadingMes && (
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Cargando turnos del mes...
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground">
                          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                            <div key={d} className="px-2 py-1 text-center">
                              {d}
                            </div>
                          ))}
                        </div>

                        {(() => {
                          const firstOfMonth = new Date(
                            selectedDate.getFullYear(),
                            selectedDate.getMonth(),
                            1
                          );
                          const firstWeekDay = (firstOfMonth.getDay() + 6) % 7; // lunes=0
                          const startGrid = new Date(firstOfMonth);
                          startGrid.setDate(firstOfMonth.getDate() - firstWeekDay);

                          const cells: JSX.Element[] = [];
                          for (let i = 0; i < 42; i++) {
                            const cellDate = new Date(startGrid);
                            cellDate.setDate(startGrid.getDate() + i);
                            const key = cellDate.toISOString().split('T')[0];
                            const eventos = turnosMesPorDia[key] || [];
                            const isCurrentMonth = cellDate.getMonth() === selectedDate.getMonth();
                            const isSelected =
                              cellDate.toDateString() === selectedDate.toDateString();
                            const isToday =
                              cellDate.toDateString() === new Date().toDateString();

                            const visibles = eventos.slice(0, 2);
                            const restantes = eventos.length - visibles.length;

                            cells.push(
                              <button
                                key={key}
                                type="button"
                                onClick={() => setSelectedDate(cellDate)}
                                className={`flex flex-col rounded-xl border px-2 py-1.5 text-left text-xs transition-colors ${isSelected
                                  ? 'border-indigo-500 bg-indigo-50'
                                  : 'border-transparent hover:border-indigo-200 hover:bg-indigo-50/40'
                                  } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span
                                    className={`text-sm font-medium ${isToday ? 'text-indigo-600' : 'text-gray-800'
                                      }`}
                                  >
                                    {cellDate.getDate()}
                                  </span>
                                  {eventos.length > 0 && (
                                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                      {eventos.length}
                                    </span>
                                  )}
                                </div>

                                <div className="space-y-1">
                                  {visibles.map((evt) => (
                                    <div
                                      key={evt.id}
                                      className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-700"
                                    >
                                      <span className="font-medium">
                                        {formatTime(evt.fecha_hora)}
                                      </span>
                                      <span className="truncate">
                                        {(evt as any).servicio_nombre ||
                                          evt.servicio?.nombre ||
                                          'Turno'}
                                      </span>
                                    </div>
                                  ))}
                                  {restantes > 0 && (
                                    <div className="text-[10px] text-indigo-600 font-medium">
                                      +{restantes} más
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          }

                          return (
                            <div className="grid grid-cols-7 gap-2">
                              {cells}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {viewMode === 'tabla' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-gray-600">
                            Rango de tabla
                          </div>
                          <Select
                            value={tableScope}
                            onValueChange={(val) => setTableScope(val as 'dia' | 'semana' | 'mes')}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Seleccionar rango" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dia">Día</SelectItem>
                              <SelectItem value="semana">Semana</SelectItem>
                              <SelectItem value="mes">Mes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="rounded-lg border bg-white overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Hora</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Pago</TableHead>
                                <TableHead>Método</TableHead>
                                <TableHead className="text-right">Resta pagar</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {loadingTabla ? (
                                <TableRow>
                                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                                    Cargando turnos...
                                  </TableCell>
                                </TableRow>
                              ) : filtrarPorEstado(tableTurnos).length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                                    No hay turnos para mostrar en formato tabla.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                [...filtrarPorEstado(tableTurnos)]
                                  .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
                                  .map((turno) => (
                                    <TableRow key={turno.id}>
                                      <TableCell>
                                        {new Date(turno.fecha_hora).toLocaleDateString('es-AR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                        })}
                                      </TableCell>
                                      <TableCell>{formatTime(turno.fecha_hora)}</TableCell>
                                      <TableCell>
                                        {(turno as any).cliente_nombre ||
                                          turno.cliente?.nombre_completo ||
                                          (turno as any).cliente_email ||
                                          'Cliente'}
                                      </TableCell>
                                      <TableCell>
                                        <Badge className={ESTADO_COLORS[turno.estado]}>
                                          {ESTADO_LABELS[turno.estado]}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>{getPagoLabelTurno(turno)}</TableCell>
                                      <TableCell>{(turno as any).metodo_pago || '—'}</TableCell>
                                      <TableCell className="text-right font-medium">
                                        ${getMontoPendienteTurno(turno).toFixed(2)}
                                      </TableCell>
                                    </TableRow>
                                  ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Lista de turnos del día */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-gray-500">
                        {selectedDate.toLocaleDateString('es-AR', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="text-xl font-semibold text-gray-900">{turnosFiltrados.length} cita{turnosFiltrados.length !== 1 ? 's' : ''}</span>
                    </CardTitle>
                    <CardDescription>Listado detallado de turnos del día</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <BeautifulSpinner label="Cargando turnos del día..." />
                      </div>
                    ) : error ? (
                      <div className="text-center py-8">
                        <p className="text-red-600 mb-4">{error}</p>
                        <Button onClick={() => loadTurnos(selectedDate)} variant="outline">
                          Reintentar
                        </Button>
                      </div>
                    ) : turnosFiltrados.length > 0 ? (
                      <div className="space-y-4">
                        {turnosOrdenados.map((turno, index) => (
                          <div
                            key={turno.id}
                            className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${turno.id === proximoTurnoId ? 'border-blue-400 bg-blue-50/40' : ''
                              }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Clock className="w-5 h-5 text-gray-500" />
                                  <span className="font-semibold text-lg">{formatTime(turno.fecha_hora)}</span>
                                  <Badge className={ESTADO_COLORS[turno.estado]}>
                                    {ESTADO_LABELS[turno.estado]}
                                  </Badge>
                                  <Badge variant="outline" className="text-gray-700">
                                    {getTurnoDuracion(turno)} min
                                  </Badge>
                                  {turno.id === proximoTurnoId && (
                                    <span className="flex items-center text-xs text-blue-700 font-semibold">
                                      <Sparkles className="w-3 h-3 mr-1" />
                                      Proxima cita
                                    </span>
                                  )}
                                </div>

                                <div className="ml-8 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium">
                                      {(turno as any).cliente_nombre ||
                                        turno.cliente?.nombre_completo ||
                                        (turno as any).cliente_email ||
                                        'Cliente'}
                                    </span>
                                  </div>

                                  <div className="text-gray-700">
                                    <span className="font-medium">
                                      {(turno as any).servicio_nombre || turno.servicio?.nombre || 'Servicio'}
                                    </span>
                                    <span className="text-gray-500 text-sm ml-2">
                                      ({(turno as any).servicio_duracion ||
                                        turno.servicio?.duracion_minutos ||
                                        0}{' '}
                                      min)
                                    </span>
                                  </div>

                                  {((turno as any).sala_nombre || (turno as any).sala_nombre) && (
                                    <div className="flex items-center gap-2">
                                      <MapPin className="w-4 h-4 text-gray-400" />
                                      <span className="text-gray-700">
                                        <span className="font-medium">Sala:</span>{' '}
                                        {(turno as any).sala_nombre || (turno as any).sala_nombre}
                                      </span>
                                    </div>
                                  )}

                                  {turno.created_at && (
                                    <div className="text-sm text-gray-600">
                                      <span className="font-medium">Solicitado:</span>{' '}
                                      {new Date(turno.created_at).toLocaleDateString('es-AR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                      })}{' '}
                                      a las{' '}
                                      {new Date(turno.created_at).toLocaleTimeString('es-AR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </div>
                                  )}

                                  <div
                                    className={`text-sm p-3 rounded-lg border ${turno.notas_cliente
                                      ? 'bg-blue-50 border-blue-200'
                                      : 'bg-gray-50 border-gray-200'
                                      }`}
                                  >
                                    <div className="flex items-start gap-2">
                                      <span
                                        className={`font-semibold ${turno.notas_cliente ? 'text-blue-900' : 'text-gray-600'
                                          }`}
                                      >
                                        Nota del cliente:
                                      </span>
                                    </div>
                                    {turno.notas_cliente ? (
                                      <p className="mt-1 text-gray-800 whitespace-pre-wrap">
                                        {turno.notas_cliente}
                                      </p>
                                    ) : (
                                      <p className="mt-1 text-gray-500 italic">Sin notas registradas</p>
                                    )}
                                  </div>

                                  {turno.notas_empleado && (
                                    <div className="text-sm text-gray-700 bg-purple-50 border border-purple-200 p-3 rounded-lg">
                                      <span className="font-semibold text-purple-900">Notas internas:</span>
                                      <p className="mt-1 whitespace-pre-wrap">{turno.notas_empleado}</p>
                                    </div>
                                  )}

                                  {turno.estado === 'completado' && (turno as any).fecha_hora_completado && (
                                    <div className="text-sm text-green-700 bg-green-50 p-2 rounded border border-green-200">
                                      <span className="font-medium">✓ Finalizado:</span>{' '}
                                      {new Date((turno as any).fecha_hora_completado).toLocaleTimeString('es-AR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </div>
                                  )}

                                  <div className="text-sm text-gray-500">
                                    Precio: $
                                    {turno.precio_final ||
                                      (turno as any).servicio_precio ||
                                      turno.servicio?.precio ||
                                      '0'}
                                  </div>
                                </div>
                              </div>

                            </div>

                            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
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
                                    title={!puedeIniciarTurno(turno) ? getMotivoNoIniciable(turno) : ''}
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
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleFinalizarClick(turno)}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Finalizar
                                </Button>
                              )}

                              {turno.estado !== 'completado' &&
                                turno.estado !== 'cancelado' &&
                                turno.estado !== 'no_asistio' && (
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

                            {index < turnosOrdenados.length - 1 && (() => {
                              const finActual = getTurnoFin(turno);
                              const inicioSiguiente = getTurnoInicio(turnosOrdenados[index + 1]);
                              const gapMin = Math.round(
                                (inicioSiguiente.getTime() - finActual.getTime()) / 60000
                              );
                              if (gapMin <= 0) return null;
                              return (
                                <div className="mt-4 ml-8 text-xs text-emerald-700">
                                  Intervalo libre hasta el siguiente turno: {formatGap(gapMin)}
                                </div>
                              );
                            })()}
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
              </div>
            </div>
          </>
        )}

        {modoCompletar && (
          <div className="space-y-6">
            <Card className="bg-linear-to-r from-indigo-500 to-fuchsia-500 text-white border-none shadow-lg">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-2xl font-semibold">Completar Turnos Pendientes</CardTitle>
                  <CardDescription className="text-indigo-100">
                    Selecciona los turnos realizados para marcarlos como completados.
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <span className="text-4xl font-bold leading-none">
                    {totalTurnosPendientes}
                  </span>
                  <span className="text-sm font-medium text-indigo-100">
                    Turnos pendientes
                  </span>
                </div>
              </CardHeader>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">Modo prueba de completar turnos</CardTitle>
                  <CardDescription>
                    Activa datos de prueba para generar turnos viejos en esta seccion. Al desactivar, se borran.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${datosPruebaActivos ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    {datosPruebaActivos
                      ? `Activo (${cantidadDatosPrueba})`
                      : 'Inactivo'}
                  </span>
                  <Button
                    variant={datosPruebaActivos ? 'destructive' : 'default'}
                    onClick={toggleDatosPrueba}
                    disabled={procesandoDatosPrueba}
                  >
                    {procesandoDatosPrueba ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : datosPruebaActivos ? (
                      'Desactivar prueba'
                    ) : (
                      'Activar prueba'
                    )}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {loadingPendientes ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Cargando turnos pendientes...</span>
              </div>
            ) : errorPendientes ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-red-600 mb-4">{errorPendientes}</p>
                <Button variant="outline" onClick={loadTurnosPendientes}>
                  Reintentar
                </Button>
              </div>
            ) : totalTurnosPendientes === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-600 font-medium mb-1">No tienes turnos pendientes por completar</p>
                <p className="text-gray-500 text-sm">¡Todo al día! Los turnos finalizados se marcarán automáticamente como completados.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {selectedPendientesIds.length > 0
                      ? `${selectedPendientesIds.length} turno${selectedPendientesIds.length !== 1 ? 's' : ''} seleccionados`
                      : 'Selecciona los turnos que ya realizaste para completarlos'}
                  </p>
                  <Button
                    size="sm"
                    disabled={selectedPendientesIds.length === 0 || procesandoPendientes}
                    onClick={completarTurnosSeleccionados}
                  >
                    {procesandoPendientes ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Marcando...
                      </>
                    ) : (
                      'Marcar como completados'
                    )}
                  </Button>
                </div>

                {pendientesAgrupados.map(([fechaStr, lista]) => {
                  const fecha = new Date(fechaStr + 'T00:00:00');
                  const relative = getRelativeDaysLabel(fechaStr);
                  const idsDia = lista.map((t) => t.id);
                  const todosSeleccionados = idsDia.every((id) =>
                    selectedPendientesIds.includes(id)
                  );

                  return (
                    <Card key={fechaStr} className="border-slate-200">
                      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <CardTitle className="text-base font-semibold text-slate-900">
                            {formatDate(fecha)}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 text-sm">
                            {relative && <span>{relative}</span>}
                            <span>• {lista.length} turno{lista.length !== 1 ? 's' : ''}</span>
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300"
                              checked={todosSeleccionados}
                              onChange={() => {
                                setSelectedPendientesIds((prev) => {
                                  if (todosSeleccionados) {
                                    return prev.filter((id) => !idsDia.includes(id));
                                  }
                                  const merged = new Set([...prev, ...idsDia]);
                                  return Array.from(merged);
                                });
                              }}
                            />
                            <span>Seleccionar día</span>
                          </label>
                          <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                            Atrasado
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {lista.map((turno) => {
                          const inicio = getTurnoInicio(turno);
                          const fin = getTurnoFin(turno);
                          const seleccionado = selectedPendientesIds.includes(turno.id);
                          const cliente =
                            (turno as any).cliente_nombre ||
                            turno.cliente?.nombre_completo ||
                            (turno as any).cliente_email ||
                            'Cliente';
                          const servicio =
                            (turno as any).servicio_nombre || turno.servicio?.nombre || 'Servicio';
                          const sala = (turno as any).sala_nombre || (turno as any).sala_nombre;

                          return (
                            <div
                              key={turno.id}
                              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3"
                            >
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 rounded border-gray-300"
                                checked={seleccionado}
                                onChange={() => {
                                  setSelectedPendientesIds((prev) =>
                                    seleccionado
                                      ? prev.filter((id) => id !== turno.id)
                                      : [...prev, turno.id]
                                  );
                                }}
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-sm text-slate-900">
                                    {servicio}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {ESTADO_LABELS[turno.estado]}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {cliente}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {inicio.toLocaleTimeString('es-AR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}{' '}
                                    -
                                    {fin.toLocaleTimeString('es-AR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                  {sala && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {sala}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
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
                      <SelectItem value="no_asistio">No Asistio</SelectItem>
                    </>
                  )}
                  {turnoActual?.estado === 'en_proceso' && (
                    <>
                      <SelectItem value="completado">Finalizado</SelectItem>
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

      {/* Dialog de Confirmación */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmación Requerida</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {confirmMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Esto se usa solo para testeo. El producto final tendrá activa esta restricción.
            </span>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  confirmAction();
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Sí, continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
