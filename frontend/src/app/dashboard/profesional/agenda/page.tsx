'use client';

export const dynamic = 'force-dynamic';

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { formatTime, toISODate } from '@/lib/dateUtils';
import { Turno } from '@/types';
import { AlertCircle, Calendar, Check, ChevronLeft, ChevronRight, Clock, CreditCard, DollarSign, ExternalLink, Loader2, MapPin, Printer, Sparkles, User } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';

const ESTADO_COLORS: { [key: string]: string } = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  confirmado: 'bg-blue-100 text-blue-800',
  en_proceso: 'bg-purple-100 text-purple-800',
  completado: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800',
  no_asistio: 'bg-gray-100 text-gray-800',
  pendiente_manual: 'bg-blue-100 text-blue-800',
  oferta_enviada: 'bg-indigo-100 text-indigo-800',
  expirada: 'bg-slate-100 text-slate-800',
};

const ESTADO_LABELS: { [key: string]: string } = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_proceso: 'En Proceso',
  completado: 'Completado',
  cancelado: 'Cancelado',
  no_asistio: 'No Asistio',
  pendiente_manual: 'Pendiente manual',
  oferta_enviada: 'Oferta enviada',
  expirada: 'Expirada',
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
  const currentMonthValue = new Date().toISOString().slice(0, 7);
  const [tableScope, setTableScope] = useState<'dia' | 'semana' | 'mes' | 'rango_meses'>('dia');
  const [rangoMesInicio, setRangoMesInicio] = useState(currentMonthValue);
  const [rangoMesFin, setRangoMesFin] = useState(currentMonthValue);
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
  const [confirmActionLabel, setConfirmActionLabel] = useState('Sí, continuar');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [resumenHoy, setResumenHoy] = useState<number | null>(null);
  const [resumenSemana, setResumenSemana] = useState<number | null>(null);
  const [procesandoPendientes, setProcesandoPendientes] = useState(false);
  const [datosPruebaActivos, setDatosPruebaActivos] = useState(false);
  const [cantidadDatosPrueba, setCantidadDatosPrueba] = useState(0);
  const [procesandoDatosPrueba, setProcesandoDatosPrueba] = useState(false);
  const [cobroDialogOpen, setCobroDialogOpen] = useState(false);
  const [cobroMetodo, setCobroMetodo] = useState<'efectivo' | 'mercadopago_qr'>('efectivo');
  const [procesandoCobro, setProcesandoCobro] = useState(false);
  const [qrPreferenceId, setQrPreferenceId] = useState('');
  const [qrPaymentLink, setQrPaymentLink] = useState('');
  const [qrPaymentCode, setQrPaymentCode] = useState('');
  const [qrPaymentCodeError, setQrPaymentCodeError] = useState('');
  const [qrStatusMessage, setQrStatusMessage] = useState('');
  const [qrWaitingPayment, setQrWaitingPayment] = useState(false);
  const [qrPaymentApproved, setQrPaymentApproved] = useState(false);
  const [qrNative, setQrNative] = useState(false);
  const [finalizacionExitosaOpen, setFinalizacionExitosaOpen] = useState(false);
  const [finalizacionExitosaMessage, setFinalizacionExitosaMessage] = useState('El cobro fue registrado correctamente.');
  const qrPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fechaParam = searchParams.get('fecha');
    const turnoFinalizado = searchParams.get('turno_finalizado');

    if (fechaParam) {
      const parsed = new Date(`${fechaParam}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
      }
    }

    if (turnoFinalizado === '1') {
      setFinalizacionExitosaMessage('El cobro fue registrado correctamente.');
      setFinalizacionExitosaOpen(true);
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

    const seleccionados = turnosPendientes.filter((turno) => selectedPendientesIds.includes(turno.id));
    const conSaldoPendiente = seleccionados.filter((turno) => getMontoPendienteTurno(turno) > 0.01);
    if (conSaldoPendiente.length > 0) {
      alert(
        `No se pueden completar ${conSaldoPendiente.length} turno(s) porque tienen saldo pendiente. Cobrales desde la tarjeta del turno antes de finalizarlos.`
      );
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

  const changeMonth = (months: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + months);
    setSelectedDate(newDate);
  };

  const getMonthInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const setSelectedMonth = (value: string) => {
    if (!value) return;
    const [year, month] = value.split('-').map(Number);
    const newDate = new Date(selectedDate);
    newDate.setFullYear(year, month - 1, 1);
    setSelectedDate(newDate);
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

  const loadTurnosTabla = async (fechaReferencia: Date, scope: 'dia' | 'semana' | 'mes' | 'rango_meses') => {
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
      } else if (scope === 'mes') {
        const inicioMes = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), 1);
        const finMes = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth() + 1, 0);
        fechaDesde = inicioMes.toISOString().split('T')[0];
        fechaHasta = finMes.toISOString().split('T')[0];
      } else {
        const [inicioYear, inicioMonth] = rangoMesInicio.split('-').map(Number);
        const [finYear, finMonth] = rangoMesFin.split('-').map(Number);
        const inicioMes = new Date(inicioYear, inicioMonth - 1, 1);
        const finMes = new Date(finYear, finMonth, 0);
        const inicioFinal = inicioMes <= finMes ? inicioMes : finMes;
        const finFinal = inicioMes <= finMes ? finMes : new Date(inicioYear, inicioMonth, 0);
        fechaDesde = inicioFinal.toISOString().split('T')[0];
        fechaHasta = finFinal.toISOString().split('T')[0];
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
    if (getMontoPendienteTurno(turno) > 0.01) {
      abrirCobroPendiente(turno);
      return;
    }

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
      setConfirmActionLabel('Aceptar');
      setConfirmAction(() => () => {
        actualizarEstadoTurno(turno, 'completado');
        setShowConfirmDialog(false);
      });
      setShowConfirmDialog(true);
    } else {
      setConfirmMessage('¿Dar por finalizado este turno? Confirmá solo si el servicio ya terminó.');
      setConfirmActionLabel('Aceptar');
      setConfirmAction(() => () => {
        actualizarEstadoTurno(turno, 'completado');
        setShowConfirmDialog(false);
      });
      setShowConfirmDialog(true);
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
      setConfirmActionLabel('Sí, continuar');
      setConfirmAction(() => async () => {
        await ejecutarCambioEstado();
        setShowConfirmDialog(false);
      });
      setShowConfirmDialog(true);
      return;
    }

    // Confirmación final usando dialog
    if (nuevoEstado === 'completado') {
      if (getMontoPendienteTurno(turnoActual) > 0.01) {
        setCambioEstadoDialog(false);
        abrirCobroPendiente(turnoActual);
        return;
      }

      setConfirmMessage('¿Dar por finalizado este turno? Confirmá solo si el servicio ya terminó.');
      setConfirmActionLabel('Aceptar');
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
      return updatedTurno;
    } catch (err: any) {
      console.error('Error updating turno:', err);
      alert('Error al actualizar el turno: ' + (err.message || 'Error desconocido'));
      return null;
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
  const proximoTurno = proximosTurnos.find((turno) => getTurnoInicio(turno) > new Date()) || null;
  const proximoTurnoResumen = proximoTurno as (Turno & {
    cliente_nombre?: string;
    cliente_email?: string;
    servicio_nombre?: string;
  }) | null;

  // Formatear hora
  // Formatear hora (convertir de UTC a hora local)
  const [viewMode, setViewMode] = useState<'dia' | 'semana' | 'mes' | 'tabla'>('semana');

  const horasDia = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00 a 21:00

  const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();
  const resumenConfirmados = turnosFiltrados.filter((t) => t.estado === 'confirmado').length;
  const resumenPendientes = turnosFiltrados.filter((t) => t.estado === 'pendiente').length;

  const totalTurnosPendientes = turnosPendientes.length;
  const fechasDisponibles = Array.from({ length: 14 }, (_, index) => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const fecha = new Date(base);
    fecha.setDate(base.getDate() + index);
    return {
      date: fecha,
      iso: toISODate(fecha),
    };
  });

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
    const senia = Number(turno.senia_pagada || 0);
    if (pagadoCompleto) return 'Pagado completo';
    if (senia > 0) return 'Seña abonada';
    return 'Sin pago';
  };

  const actualizarEstadoTurno = async (turno: Turno, estado: string, notas = '') => {
    try {
      setProcesando(true);
      const response = await authenticatedFetch(`/turnos/${turno.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          estado,
          notas_empleado: notas,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'Error al actualizar');
      }

      await loadTurnos(selectedDate);
    } catch (err: unknown) {
      console.error('Error updating turno:', err);
      alert('Error al actualizar el turno: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setProcesando(false);
    }
  };

  const confirmarInicioTurno = (turno: Turno) => {
    const turnoConResumen = turno as Turno & { cliente_nombre?: string; cliente_email?: string };
    const clienteNombre =
      turnoConResumen.cliente_nombre ||
      turno.cliente?.nombre_completo ||
      turnoConResumen.cliente_email ||
      'el cliente';

    setConfirmMessage(`Vas a iniciar el turno de ${clienteNombre}. ¿Deseas continuar?`);
    setConfirmActionLabel('Sí, continuar');
    setConfirmAction(() => async () => {
      await actualizarEstadoTurno(turno, 'en_proceso');
      setShowConfirmDialog(false);
    });
    setShowConfirmDialog(true);
  };

  const formatCurrency = (value: number | string | null | undefined): string => {
    const amount = Number(value || 0);
    return amount.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    });
  };

  const getPrecioTotalTurno = (turno: Turno): number => Number(
    turno.precio_final || (turno as any).servicio_precio || turno.servicio?.precio || 0
  );

  const getCanalReservaLabel = (canal?: string | null): string => {
    if (canal === 'web_cliente') return 'Reserva web cliente';
    if (canal === 'panel_profesional') return 'Panel profesional';
    if (canal === 'panel_propietario') return 'Panel propietario';
    return 'Origen no informado';
  };

  const getSalaTurnoLabel = (turno: Turno): string => {
    const turnoConSala = turno as Turno & {
      sala_nombre?: string;
      categoria_nombre?: string;
    };
    return (
      turnoConSala.sala_nombre ||
      turno.servicio?.categoria?.sala_nombre ||
      turnoConSala.categoria_nombre ||
      turno.servicio?.categoria?.nombre ||
      'Sala no asignada'
    );
  };

  const getMovimientoTurnoLabel = (turno: Turno): string | null => {
    const movimiento = (turno as any).ultimo_movimiento_reprogramacion;
    if (!movimiento) return null;
    if (movimiento.tipo === 'adelantado') return 'Adelantado';
    if (movimiento.tipo === 'postergado') return 'Postergado';
    return 'Reprogramado';
  };

  const resetQrCobro = () => {
    if (qrPollingRef.current) {
      clearInterval(qrPollingRef.current);
      qrPollingRef.current = null;
    }
    setQrPreferenceId('');
    setQrPaymentLink('');
    setQrPaymentCode('');
    setQrPaymentCodeError('');
    setQrStatusMessage('');
    setQrWaitingPayment(false);
    setQrPaymentApproved(false);
    setQrNative(false);
  };

  const abrirCobroPendiente = (turno: Turno) => {
    resetQrCobro();
    setTurnoActual(turno);
    setNuevoEstado('completado');
    setNotasEmpleado(turno.notas_empleado || '');
    setCobroMetodo('efectivo');
    setCobroDialogOpen(true);
  };

  const finalizarTurnoActual = async () => {
    const updated = await ejecutarCambioEstado();
    setCobroDialogOpen(false);
    resetQrCobro();
    if (updated && updated.id) {
      setFinalizacionExitosaMessage('El cobro fue registrado correctamente.');
      setFinalizacionExitosaOpen(true);
    }
  };

  const registrarEfectivoYFinalizar = async () => {
    if (!turnoActual) return;
    const montoPendiente = getMontoPendienteTurno(turnoActual);
    try {
      setProcesandoCobro(true);
      const response = await authenticatedFetch(`/turnos/${turnoActual.id}/registrar-pago/`, {
        method: 'POST',
        body: JSON.stringify({ monto: montoPendiente, metodo_pago: 'efectivo' }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.detail || 'No se pudo registrar el pago');
      }
      await finalizarTurnoActual();
    } catch (err: any) {
      alert(err.message || 'No se pudo registrar el pago y finalizar el turno.');
    } finally {
      setProcesandoCobro(false);
    }
  };

  const generarQrSaldo = async () => {
    if (!turnoActual) return;
    try {
      setProcesandoCobro(true);
      setQrPaymentCodeError('');
      const response = await authenticatedFetch('/mercadopago/cobro-turno-staff/', {
        method: 'POST',
        body: JSON.stringify({ turno_id: turnoActual.id }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'No se pudo generar el QR');
      }
      const pref = await response.json();
      const qrLink = pref.qr_data || pref.qr_init_point || pref.init_point || '';
      setQrPreferenceId(pref.preference_id);
      setQrPaymentLink(qrLink);
      setQrNative(Boolean(pref.qr_native));
      setQrStatusMessage('Escaneá el QR y completá el pago desde Mercado Pago.');
      setQrWaitingPayment(true);

      if (qrPollingRef.current) clearInterval(qrPollingRef.current);
      let attempts = 0;
      qrPollingRef.current = setInterval(async () => {
        try {
          attempts += 1;
          if (attempts > 100) {
            if (qrPollingRef.current) clearInterval(qrPollingRef.current);
            qrPollingRef.current = null;
            setQrWaitingPayment(false);
            setQrStatusMessage('No se confirmó automáticamente. Podés cargar el número de operación o forzar el recibimiento para pruebas.');
            return;
          }
          const statusResponse = await authenticatedFetch(`/mercadopago/verificar-pago/${pref.preference_id}/`);
          const body = await statusResponse.json();
          if (body.status === 'approved') {
            if (qrPollingRef.current) clearInterval(qrPollingRef.current);
            qrPollingRef.current = null;
            setQrWaitingPayment(false);
            setQrPaymentApproved(true);
            setQrPaymentCode(String(body.payment_id || ''));
            setQrStatusMessage('Pago confirmado por Mercado Pago. Revisá/cargá el número de operación y finalizá el turno.');
          } else if (body.status === 'cancelled') {
            if (qrPollingRef.current) clearInterval(qrPollingRef.current);
            qrPollingRef.current = null;
            setQrWaitingPayment(false);
            setQrStatusMessage('La transacción fue cancelada. Generá un nuevo QR para continuar.');
          }
        } catch (error) {
          console.error('Error verificando pago QR:', error);
        }
      }, 3000);
    } catch (err: any) {
      setQrPaymentCodeError(err.message || 'No se pudo generar el QR');
    } finally {
      setProcesandoCobro(false);
    }
  };

  const confirmarQrYFinalizar = async () => {
    if (!turnoActual || !qrPreferenceId) return;
    const paymentId = qrPaymentCode.trim();
    if (!paymentId) {
      setQrPaymentCodeError('Ingresá el número de operación o una referencia de prueba.');
      return;
    }
    try {
      setProcesandoCobro(true);
      setQrPaymentCodeError('');
      const response = await authenticatedFetch('/mercadopago/confirmar-cobro-manual/', {
        method: 'POST',
        body: JSON.stringify({
          preference_id: qrPreferenceId,
          payment_id: paymentId,
          motivo: 'Cobro de saldo de turno confirmado por profesional',
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'No se pudo confirmar el cobro');
      }
      await finalizarTurnoActual();
    } catch (err: any) {
      setQrPaymentCodeError(err.message || 'No se pudo confirmar el cobro y finalizar.');
    } finally {
      setProcesandoCobro(false);
    }
  };

  useEffect(() => {
    return () => {
      if (qrPollingRef.current) clearInterval(qrPollingRef.current);
    };
  }, []);

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
  }, [empleadoId, viewMode, selectedDate, tableScope, rangoMesInicio, rangoMesFin]);

  return (
    <div className="min-h-screen bg-[#f5eff8]">
      <div className="border-b border-violet-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Card className="overflow-hidden rounded-[2rem] border-violet-100 bg-linear-to-br from-white via-violet-50/75 to-white shadow-sm">
            <CardContent className="p-0">
              <div className="grid gap-0 lg:grid-cols-[1fr_420px]">
                <div className="p-6 lg:p-8">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700">
                    <Sparkles className="h-4 w-4" />
                    Panel profesional
                  </div>
                  <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                    Hola, {user?.first_name || 'Profesional'}
                  </h1>
                  <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                    Revisá tus turnos, confirmaciones y pagos del día desde una agenda clara y lista para trabajar.
                  </p>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="h-12 rounded-2xl bg-violet-700 px-6 text-base font-semibold text-white hover:bg-violet-800"
                      onClick={() => window.location.assign('/dashboard/profesional/reservar-turno')}
                    >
                      Agendar turno
                    </Button>
                    <Button
                      variant={modoCompletar ? 'default' : 'outline'}
                      onClick={() => setModoCompletar((prev) => !prev)}
                      className={modoCompletar
                        ? 'h-12 rounded-2xl bg-slate-950 px-6 text-base font-semibold text-white hover:bg-slate-800'
                        : 'h-12 rounded-2xl border-violet-200 bg-white px-6 text-base font-semibold text-violet-800 hover:bg-violet-50'
                      }
                    >
                      Turnos por completar
                      {totalTurnosPendientes > 0 && (
                        <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-violet-100 px-2 text-xs font-semibold text-violet-800">
                          {totalTurnosPendientes}
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.print()}
                      disabled={modoCompletar}
                      className="h-12 rounded-2xl border-slate-200 bg-white px-6 text-base font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir
                    </Button>
                  </div>
                </div>

                <div className="border-t border-violet-100 bg-white/80 p-6 lg:border-l lg:border-t-0 lg:p-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-700">Próximo turno</p>
                  {proximoTurno ? (
                    <div className="mt-4 rounded-3xl border border-violet-100 bg-violet-50/70 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-3xl font-extrabold text-slate-950">{formatTime(proximoTurno.fecha_hora)}</p>
                          <p className="mt-2 font-semibold text-slate-800">
                            {proximoTurnoResumen?.cliente_nombre || proximoTurno.cliente?.nombre_completo || proximoTurnoResumen?.cliente_email || 'Cliente'}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {proximoTurnoResumen?.servicio_nombre || proximoTurno.servicio?.nombre || 'Servicio'}
                          </p>
                        </div>
                        <Badge className="rounded-full bg-white px-3 py-1 text-violet-800 hover:bg-white">
                          {ESTADO_LABELS[proximoTurno.estado]}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-3xl border border-dashed border-violet-200 bg-white p-5 text-slate-600">
                      No hay otro turno activo en la agenda seleccionada.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Dialog open={finalizacionExitosaOpen} onOpenChange={setFinalizacionExitosaOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700">
                <Check className="h-5 w-5" />
                Pago registrado y turno finalizado
              </DialogTitle>
              <DialogDescription>{finalizacionExitosaMessage}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => setFinalizacionExitosaOpen(false)}>
                Aceptar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {!modoCompletar && (
          <>
            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-3xl border-violet-100 bg-white shadow-sm">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-violet-700">Turnos hoy</p>
                    <p className="mt-2 text-3xl font-extrabold text-slate-950">{resumenHoy !== null ? resumenHoy : '-'}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(new Date())}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                    <Calendar className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-emerald-100 bg-white shadow-sm">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">Esta semana</p>
                    <p className="mt-2 text-3xl font-extrabold text-slate-950">{resumenSemana !== null ? resumenSemana : '-'}</p>
                    <p className="mt-1 text-xs text-slate-500">Turnos programados</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Clock className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-blue-100 bg-white shadow-sm">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-700">Confirmados</p>
                    <p className="mt-2 text-3xl font-extrabold text-slate-950">{resumenConfirmados}</p>
                    <p className="mt-1 text-xs text-slate-500">Del día seleccionado</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <Check className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-amber-100 bg-white shadow-sm">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-700">Por confirmar</p>
                    <p className="mt-2 text-3xl font-extrabold text-slate-950">{resumenPendientes}</p>
                    <p className="mt-1 text-xs text-slate-500">Esperando respuesta</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Calendario + lista lateral */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Calendario y vista semanal/mensual */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="rounded-3xl border-violet-100 bg-white shadow-sm">
                  <CardHeader className="space-y-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <CardTitle className="text-2xl font-bold text-slate-950">Agenda</CardTitle>
                        <CardDescription>Vista operativa de tus turnos y estados</CardDescription>
                      </div>

                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as 'dia' | 'semana' | 'mes' | 'tabla')}>
                          <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-violet-50 p-1 md:w-[360px]">
                          <TabsTrigger value="dia">Día</TabsTrigger>
                          <TabsTrigger value="semana">Semana</TabsTrigger>
                          <TabsTrigger value="mes">Mes</TabsTrigger>
                          <TabsTrigger value="tabla">Tabla</TabsTrigger>
                          </TabsList>
                        </Tabs>

                        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                          <SelectTrigger className="h-10 rounded-2xl border-violet-100 bg-white md:w-[190px]">
                            <SelectValue placeholder="Filtrar por estado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos los estados</SelectItem>
                            <SelectItem value="pendiente">Pendientes</SelectItem>
                            <SelectItem value="confirmado">Confirmados</SelectItem>
                            <SelectItem value="en_proceso">En proceso</SelectItem>
                            <SelectItem value="completado">Completados</SelectItem>
                            <SelectItem value="cancelado">Cancelados</SelectItem>
                            <SelectItem value="no_asistio">No asistieron</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
                        <Calendar className="h-4 w-4 text-violet-600" />
                        <span>{formatDate(selectedDate)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button className="rounded-xl border-slate-200 bg-white" variant="outline" size="icon" onClick={() => changeDate(-1)}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={goToToday}
                          disabled={isTodaySelected}
                          className="rounded-xl text-slate-700 hover:bg-white"
                        >
                          Hoy
                        </Button>
                        <Button className="rounded-xl border-slate-200 bg-white" variant="outline" size="icon" onClick={() => changeDate(1)}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                        <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
                        <Button className="rounded-xl border-slate-200 bg-white" variant="outline" size="sm" onClick={() => changeMonth(-1)}>
                          Mes anterior
                        </Button>
                        <Input
                          type="month"
                          value={getMonthInputValue(selectedDate)}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="h-9 w-[150px] rounded-xl border-slate-200 bg-white"
                        />
                        <Button className="rounded-xl border-slate-200 bg-white" variant="outline" size="sm" onClick={() => changeMonth(1)}>
                          Mes siguiente
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {viewMode === 'dia' && (
                      <div className="flex h-[480px] flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-950">Agenda del día</h3>
                            <p className="text-xs text-slate-500">Vista cronológica por horario</p>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <div className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-violet-600" />
                              <span>Turno</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="h-px w-4 bg-slate-300" />
                              <span>Sin turnos</span>
                            </div>
                          </div>
                        </div>

                        {loading ? (
                          <div className="flex items-center justify-center flex-1">
                            <BeautifulSpinner label="Cargando turnos del día..." />
                          </div>
                        ) : turnosOrdenados.length === 0 ? (
                          <div className="flex flex-1 flex-col items-center justify-center text-sm text-slate-500">
                            <Calendar className="mb-3 h-10 w-10 text-violet-200" />
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
                                <div key={hora} className="flex border-b border-slate-100 last:border-b-0">
                                  <div className="flex w-16 items-start justify-end pr-3 pt-3 text-xs text-slate-400">
                                    {etiquetaHora}
                                  </div>
                                  <div className="relative flex-1 py-3">
                                    <div className="absolute bottom-0 left-2 top-0 border-l border-dashed border-slate-200" />
                                    {turnosEnHora.length > 0 ? (
                                      <div className="space-y-2 ml-6">
                                        {turnosEnHora.map((turno) => (
                                          <div
                                            key={turno.id}
                                            className={`relative rounded-2xl border px-3 py-2 text-xs shadow-sm ${turno.id === proximoTurnoId ? 'border-violet-300 bg-violet-50 text-slate-900' : 'border-slate-100 bg-white text-slate-800'}`}
                                          >
                                            <div className="flex items-center gap-2 mb-1">
                                              <Clock className="h-3 w-3 text-violet-600" />
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
                                            <div className="truncate text-[11px] text-slate-600">
                                              {(turno as any).cliente_nombre ||
                                                turno.cliente?.nombre_completo ||
                                                (turno as any).cliente_email ||
                                                'Cliente'}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="ml-6 text-[11px] text-slate-400">
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

                          const cells: ReactElement[] = [];
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
                        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                          <div className="text-sm text-gray-600">
                            Rango de tabla
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={tableScope}
                              onValueChange={(val) => setTableScope(val as 'dia' | 'semana' | 'mes' | 'rango_meses')}
                            >
                              <SelectTrigger className="w-[190px] rounded-xl">
                                <SelectValue placeholder="Seleccionar rango" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="dia">Día</SelectItem>
                                <SelectItem value="semana">Semana</SelectItem>
                                <SelectItem value="mes">Mes</SelectItem>
                                <SelectItem value="rango_meses">Rango de meses</SelectItem>
                              </SelectContent>
                            </Select>
                            {tableScope === 'rango_meses' && (
                              <>
                                <Input
                                  type="month"
                                  value={rangoMesInicio}
                                  onChange={(e) => setRangoMesInicio(e.target.value)}
                                  className="h-10 w-[150px] rounded-xl"
                                />
                                <span className="text-sm text-slate-500">hasta</span>
                                <Input
                                  type="month"
                                  value={rangoMesFin}
                                  onChange={(e) => setRangoMesFin(e.target.value)}
                                  className="h-10 w-[150px] rounded-xl"
                                />
                              </>
                            )}
                          </div>
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
                <Card className="rounded-3xl border-violet-100 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex flex-col gap-1">
                      <span className="text-sm font-medium capitalize text-violet-700">
                        {selectedDate.toLocaleDateString('es-AR', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="text-2xl font-bold text-slate-950">{turnosFiltrados.length} turno{turnosFiltrados.length !== 1 ? 's' : ''}</span>
                    </CardTitle>
                    <CardDescription>Detalle del día seleccionado</CardDescription>
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
                        {turnosOrdenados.map((turno, index) => {
                          const clienteNombre =
                            (turno as any).cliente_nombre ||
                            turno.cliente?.nombre_completo ||
                            (turno as any).cliente_email ||
                            'Cliente';
                          const servicioNombre = (turno as any).servicio_nombre || turno.servicio?.nombre || 'Servicio';
                          const pendiente = getMontoPendienteTurno(turno);

                          return (
                            <details
                              key={turno.id}
                              className={`group overflow-hidden rounded-2xl border bg-white transition-colors open:bg-slate-50 ${turno.id === proximoTurnoId ? 'border-violet-300 bg-violet-50/50' : 'border-slate-200'
                                }`}
                            >
                              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                                <div className="min-w-0 flex-1">
                                  <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <Clock className="h-4 w-4 text-slate-500" />
                                    <span className="text-lg font-semibold text-slate-950">{formatTime(turno.fecha_hora)}</span>
                                    <Badge className={ESTADO_COLORS[turno.estado]}>{ESTADO_LABELS[turno.estado]}</Badge>
                                    <Badge variant="outline" className="text-slate-700">{getTurnoDuracion(turno)} min</Badge>
                                    {turno.id === proximoTurnoId && (
                                      <span className="flex items-center text-xs font-semibold text-violet-700">
                                        <Sparkles className="mr-1 h-3 w-3" />
                                        Próximo turno
                                      </span>
                                    )}
                                  </div>
                                  <p className="truncate font-semibold text-slate-900">{clienteNombre}</p>
                                  <p className="truncate text-sm text-slate-600">{servicioNombre}</p>
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                    <span>{getPagoLabelTurno(turno)}</span>
                                    <span className={pendiente > 0 ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
                                      Pendiente: {formatCurrency(pendiente)}
                                    </span>
                                  </div>
                                </div>
                                <span className="shrink-0 rounded-full border border-violet-100 bg-white px-3 py-1 text-xs font-medium text-slate-600 group-open:bg-slate-900 group-open:text-white">
                                  <span className="group-open:hidden">Ver detalle</span>
                                  <span className="hidden group-open:inline">Ocultar</span>
                                </span>
                              </summary>

                              <div className="space-y-3 border-t border-slate-200 p-4 pt-3">
                                <div className="flex items-center gap-2 text-sm text-slate-700">
                                  <MapPin className="h-4 w-4 text-slate-400" />
                                  <span><span className="font-medium">Sala:</span> {getSalaTurnoLabel(turno)}</span>
                                </div>

                                {turno.created_at && (
                                  <div className="text-sm text-slate-600">
                                    <span className="font-medium">Solicitado:</span>{' '}
                                    {new Date(turno.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                                    a las {new Date(turno.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}

                                <div className={`rounded-lg border p-3 text-sm ${turno.notas_cliente ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                                  <span className={turno.notas_cliente ? 'font-semibold text-blue-900' : 'font-semibold text-slate-600'}>Nota del cliente:</span>
                                  {turno.notas_cliente ? (
                                    <p className="mt-1 whitespace-pre-wrap text-slate-800">{turno.notas_cliente}</p>
                                  ) : (
                                    <p className="mt-1 italic text-slate-500">Sin notas registradas</p>
                                  )}
                                </div>

                                {turno.notas_empleado && (
                                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-slate-700">
                                    <span className="font-semibold text-purple-900">Notas internas:</span>
                                    <p className="mt-1 whitespace-pre-wrap">{turno.notas_empleado}</p>
                                  </div>
                                )}

                                {turno.estado === 'completado' && (turno as any).fecha_hora_completado && (
                                  <div className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">
                                    <span className="font-medium">Finalizado:</span>{' '}
                                    {new Date((turno as any).fecha_hora_completado).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}

                                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                                  <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <Badge variant={(turno as any).pagado_completo ? 'default' : 'secondary'}>{getPagoLabelTurno(turno)}</Badge>
                                    {getMovimientoTurnoLabel(turno) && <Badge variant="outline">{getMovimientoTurnoLabel(turno)}</Badge>}
                                    {Boolean((turno as any).reacomodamiento_exitoso) && <Badge className="bg-indigo-600 hover:bg-indigo-600">Reacomodado</Badge>}
                                    {turno.cupon_racha_aplicado && <Badge className="bg-violet-600 hover:bg-violet-600">Cupón racha</Badge>}
                                    {turno.oferta_fidelizacion_aplicada && <Badge className="bg-fuchsia-600 hover:bg-fuchsia-600">Cliente olvidado</Badge>}
                                  </div>
                                  {turno.cupon_racha_aplicado && (
                                    <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 p-2 text-xs text-violet-900">
                                      <span className="font-semibold">Cupón aplicado:</span>{' '}
                                      {turno.cupon_racha_codigo || 'código de racha'} por {formatCurrency(turno.cupon_racha_descuento || 0)}.
                                    </div>
                                  )}
                                  {turno.oferta_fidelizacion_aplicada && (
                                    <div className="mb-3 rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-2 text-xs text-fuchsia-900">
                                      <span className="font-semibold">Oferta de cliente olvidado:</span>{' '}
                                      pagó este turno con descuento de fidelización
                                      {Number(turno.oferta_fidelizacion_descuento || 0) > 0
                                        ? ` (${formatCurrency(turno.oferta_fidelizacion_descuento)} de descuento).`
                                        : '.'}
                                    </div>
                                  )}
                                  <div className="grid gap-2 sm:grid-cols-3">
                                    <div>
                                      <p className="text-xs font-medium uppercase text-slate-500">Total</p>
                                      <p className="font-semibold text-slate-900">{formatCurrency(getPrecioTotalTurno(turno))}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium uppercase text-slate-500">Abonado</p>
                                      <p className="font-semibold text-slate-900">{formatCurrency(turno.senia_pagada || 0)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium uppercase text-slate-500">Pendiente</p>
                                      <p className={pendiente > 0 ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>{formatCurrency(pendiente)}</p>
                                    </div>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                    <span>{getCanalReservaLabel(turno.canal_reserva)}</span>
                                    {turno.metodo_pago && <span>Método: {turno.metodo_pago}</span>}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  {turno.estado === 'pendiente' && (
                                    <Button size="sm" disabled={procesando} onClick={() => actualizarEstadoTurno(turno, 'confirmado')}>
                                      <Check className="mr-1 h-4 w-4" />
                                      Confirmar turno
                                    </Button>
                                  )}
                                  {turno.estado === 'confirmado' && (
                                    <Button size="sm" disabled={procesando} title={!puedeIniciarTurno(turno) ? getMotivoNoIniciable(turno) : ''} onClick={() => confirmarInicioTurno(turno)}>
                                      Iniciar turno
                                    </Button>
                                  )}
                                  {turno.estado === 'en_proceso' && (
                                    <Button size="sm" className={pendiente > 0 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'} onClick={() => handleFinalizarClick(turno)}>
                                      <Check className="mr-1 h-4 w-4" />
                                      {pendiente > 0 ? 'Cobrar diferencia' : 'Finalizar turno'}
                                    </Button>
                                  )}
                                  {turno.estado !== 'completado' && turno.estado !== 'cancelado' && turno.estado !== 'no_asistio' && (
                                    <Button size="sm" variant="outline" onClick={() => handleCambiarEstado(turno)}>
                                      Más opciones
                                    </Button>
                                  )}
                                </div>

                                {index < turnosOrdenados.length - 1 && (() => {
                                  const finActual = getTurnoFin(turno);
                                  const inicioSiguiente = getTurnoInicio(turnosOrdenados[index + 1]);
                                  const gapMin = Math.round((inicioSiguiente.getTime() - finActual.getTime()) / 60000);
                                  if (gapMin <= 0) return null;
                                  return <div className="text-xs text-emerald-700">Intervalo libre hasta el siguiente turno: {formatGap(gapMin)}</div>;
                                })()}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <Calendar className="mx-auto mb-4 h-16 w-16 text-violet-200" />
                        <p className="text-lg text-slate-500">
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
                          const sala = getSalaTurnoLabel(turno);

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
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {sala}
                                  </span>
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

      <Dialog
        open={cobroDialogOpen}
        onOpenChange={(open) => {
          setCobroDialogOpen(open);
          if (!open) resetQrCobro();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cobrar saldo pendiente</DialogTitle>
            <DialogDescription>
              Para finalizar este turno primero registrá el pago faltante.
            </DialogDescription>
          </DialogHeader>

          {turnoActual && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {(turnoActual as any).cliente_nombre || turnoActual.cliente?.nombre_completo || 'Cliente'}
                    </p>
                    <p className="text-sm text-slate-600">
                      {(turnoActual as any).servicio_nombre || turnoActual.servicio?.nombre || 'Servicio'}
                    </p>
                  </div>
                  <Badge variant="secondary">{getPagoLabelTurno(turnoActual)}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Total</p>
                    <p className="font-semibold">{formatCurrency(getPrecioTotalTurno(turnoActual))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Abonado</p>
                    <p className="font-semibold">{formatCurrency(turnoActual.senia_pagada || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">A cobrar</p>
                    <p className="font-semibold text-amber-700">{formatCurrency(getMontoPendienteTurno(turnoActual))}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setCobroMetodo('efectivo')}
                  className={`rounded-xl border p-4 text-left transition ${cobroMetodo === 'efectivo' ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <DollarSign className="mb-2 h-5 w-5 text-green-600" />
                  <p className="font-semibold">Efectivo</p>
                  <p className="text-sm text-slate-500">Registrar cobro local y finalizar.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setCobroMetodo('mercadopago_qr')}
                  className={`rounded-xl border p-4 text-left transition ${cobroMetodo === 'mercadopago_qr' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <CreditCard className="mb-2 h-5 w-5 text-blue-600" />
                  <p className="font-semibold">Mercado Pago QR</p>
                  <p className="text-sm text-slate-500">QR, operación y opción forzada de prueba.</p>
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notas-cierre">Notas internas al finalizar</Label>
                <Textarea
                  id="notas-cierre"
                  value={notasEmpleado}
                  onChange={(event) => setNotasEmpleado(event.target.value)}
                  placeholder="Observaciones opcionales del cierre..."
                  rows={3}
                />
              </div>

              {cobroMetodo === 'mercadopago_qr' && (
                <div className="space-y-4 rounded-xl border p-4">
                  {!qrPreferenceId ? (
                    <Button type="button" onClick={generarQrSaldo} disabled={procesandoCobro} className="w-full">
                      {procesandoCobro ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Generar QR por saldo pendiente
                    </Button>
                  ) : (
                    <>
                      {qrPaymentLink && (
                        <div className="flex justify-center rounded-lg border bg-white p-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrPaymentLink)}`}
                            alt="QR de pago Mercado Pago"
                            className="h-60 w-60"
                          />
                        </div>
                      )}
                      <div className={`rounded-md border px-3 py-2 text-sm ${qrPaymentApproved ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                        <div className="flex items-center justify-center gap-2">
                          {qrWaitingPayment && !qrPaymentApproved && <Loader2 className="h-4 w-4 animate-spin" />}
                          <span>{qrStatusMessage || 'Esperando pago...'}</span>
                        </div>
                      </div>
                      {!qrNative && qrPaymentLink && (
                        <Button type="button" variant="outline" onClick={() => window.open(qrPaymentLink, '_blank')}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Abrir link
                        </Button>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="qr-payment-code">Número de operación o referencia de prueba</Label>
                        <Input
                          id="qr-payment-code"
                          value={qrPaymentCode}
                          onChange={(event) => setQrPaymentCode(event.target.value.trim())}
                          placeholder="Ej: 1234567890"
                        />
                        <p className="text-xs text-slate-500">
                          Si Mercado Pago falla, cargá una referencia y usá la confirmación forzada solo para pruebas.
                        </p>
                        {qrPaymentCodeError && <p className="text-xs text-red-600">{qrPaymentCodeError}</p>}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCobroDialogOpen(false)}
              disabled={procesandoCobro}
            >
              Cancelar
            </Button>
            {cobroMetodo === 'efectivo' ? (
              <Button type="button" onClick={registrarEfectivoYFinalizar} disabled={procesandoCobro}>
                {procesandoCobro ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Registrar efectivo y finalizar
              </Button>
            ) : (
              <Button
                type="button"
                onClick={confirmarQrYFinalizar}
                disabled={procesandoCobro || !qrPreferenceId || !qrPaymentCode.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {procesandoCobro ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar/forzar recibimiento y finalizar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          {!/sobre-turnar|reservado por/i.test(confirmMessage) && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Esto se usa solo para testeo. El producto final tendrá activa esta restricción.
              </span>
            </div>
          )}
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
              {confirmActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
