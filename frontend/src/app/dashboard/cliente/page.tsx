'use client';

import { Badge } from '@/components/ui/badge';
import { BeautifulSpinner } from '@/components/ui/BeautifulSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { getAuthHeaders } from '@/lib/auth-headers';
import { formatTime } from '@/lib/dateUtils';
import { turnosService } from '@/services/turnos';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  Loader2,
  Sparkles,
  Sun,
  Sunrise,
  TrendingUp,
  User,
  Wallet,
  XCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

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
  estado: 'pendiente' | 'confirmado' | 'en_proceso' | 'completado' | 'cancelado' | 'no_asistio' | 'pendiente_manual' | 'oferta_enviada' | 'expirada';
  estado_display: string;
  precio_final: string | null;
  servicio_precio?: string;
  senia_pagada?: string;
  monto_pendiente?: string;
  pagado_completo?: boolean;
  monto_pendiente_original?: string;
  descuento_aplicado?: string;
  puede_reprogramar?: boolean;
  motivo_no_reprogramable?: string;
  reprogramacion_bloqueada_codigo?: string | null;
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
  saldo_billetera?: number;
  tiene_billetera?: boolean;
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
}

interface Billetera {
  id: number;
  saldo: string;
  fecha_vencimiento?: string | null;
  esta_por_vencer?: boolean;
}

interface MovimientoBilletera {
  id: number;
  tipo: 'credito' | 'debito';
  tipo_display: string;
  monto: string;
  saldo_anterior: string;
  saldo_nuevo: string;
  descripcion?: string;
  created_at: string;
}

interface ProfesionalOpcion {
  id: number;
  nombre: string;
}

interface EmpleadoApiItem {
  id: number | string;
  first_name?: string;
  last_name?: string;
  user?: {
    full_name?: string;
  };
}

interface SlotAgrupado {
  time: string;
  professionalIds: string[];
  available: boolean;
}

type PasoReprogramacion = 'calendar' | 'time' | 'loading' | 'select-professional' | 'flexible' | 'confirmation' | 'result';
type ReprogramacionViewMode = 'single' | 'all';

// Funciones auxiliares
const getEstadoIcon = (estado: string) => {
  switch (estado.toLowerCase()) {
    case 'confirmado':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'pendiente':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'pendiente_manual':
      return <Clock className="w-4 h-4 text-blue-500" />;
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
    case 'pendiente_manual':
      return 'outline';
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
  const [billetera, setBilletera] = useState<Billetera | null>(null);
  const [movimientosBilletera, setMovimientosBilletera] = useState<MovimientoBilletera[]>([]);
  const [loadingTurnos, setLoadingTurnos] = useState(true);
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [loadingBilletera, setLoadingBilletera] = useState(true);
  const [historialPage, setHistorialPage] = useState(1);
  const [reprogramDialogOpen, setReprogramDialogOpen] = useState(false);
  const [turnoParaReprogramar, setTurnoParaReprogramar] = useState<Turno | null>(null);
  const [nuevaFechaHora, setNuevaFechaHora] = useState('');
  const [fechaReprogramacion, setFechaReprogramacion] = useState('');
  const [viewMode, setViewMode] = useState<ReprogramacionViewMode>('single');
  const [profesionalActivoId, setProfesionalActivoId] = useState<number | null>(null);
  const [agendaProfesional, setAgendaProfesional] = useState<Record<string, string[]>>({});
  const [agendaGlobal, setAgendaGlobal] = useState<Record<string, SlotAgrupado[]>>({});
  const [fechasDisponibles, setFechasDisponibles] = useState<string[]>([]);
  const [profesionalesServicio, setProfesionalesServicio] = useState<ProfesionalOpcion[]>([]);
  const [cargandoAgenda, setCargandoAgenda] = useState(false);
  const [cargandoAlternativas, setCargandoAlternativas] = useState(false);
  const [motivoReprogramacion, setMotivoReprogramacion] = useState('');
  const [reprogramando, setReprogramando] = useState(false);
  const [errorReprogramacion, setErrorReprogramacion] = useState('');
  const [mostrarCambioProfesional, setMostrarCambioProfesional] = useState(false);
  const [profesionalesAlternativos, setProfesionalesAlternativos] = useState<ProfesionalOpcion[]>([]);
  const [profesionalSeleccionadoId, setProfesionalSeleccionadoId] = useState<number | null>(null);
  const [pasoReprogramacion, setPasoReprogramacion] = useState<PasoReprogramacion>('calendar');
  const [mostrarAdvertenciaFueraRango, setMostrarAdvertenciaFueraRango] = useState(false);
  const [penalidadDialogOpen, setPenalidadDialogOpen] = useState(false);
  const [creandoPagoReprogramacion, setCreandoPagoReprogramacion] = useState(false);
  const [esperandoPagoReprogramacion, setEsperandoPagoReprogramacion] = useState(false);
  const [preferenceReprogramacionId, setPreferenceReprogramacionId] = useState('');
  const [avisoPoliticaOpen, setAvisoPoliticaOpen] = useState(false);
  const [turnoPendienteAviso, setTurnoPendienteAviso] = useState<Turno | null>(null);
  const [avisoCooldown, setAvisoCooldown] = useState(5);
  const [resultadoReprogramacion, setResultadoReprogramacion] = useState<{
    fecha_hora: string;
    profesional: string;
    sala?: string;
    seniaPendienteLocal?: boolean;
  } | null>(null);
  const [solicitudFlexibleCreada, setSolicitudFlexibleCreada] = useState(false);
  const [solicitudFlexibleMensaje, setSolicitudFlexibleMensaje] = useState('');
  const [solicitandoFlexible, setSolicitandoFlexible] = useState(false);
  const mpReprogramacionWindowRef = useRef<Window | null>(null);
  const reprogramacionPollingRef = useRef<number | null>(null);
  const reprogramacionTabCheckRef = useRef<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
    } else {
      setIsClient(true);
      loadPerfilData();
      loadTurnosData();
      loadBilleteraData();
    }
  }, [router]);

  const loadPerfilData = async () => {
    try {
      setLoadingPerfil(true);
      const response = await fetch('/api/clientes/me/', {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setPerfilCliente(data);
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
      const response = await fetch('/api/turnos/mis_turnos/?page_size=100', {
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

  const loadBilleteraData = async () => {
    try {
      setLoadingBilletera(true);

      const [billeteraRes, movimientosRes] = await Promise.all([
        fetch('/api/clientes/me/billetera/', { headers: getAuthHeaders() }),
        fetch('/api/clientes/me/billetera/movimientos/', { headers: getAuthHeaders() }),
      ]);

      if (billeteraRes.ok) {
        const data = await billeteraRes.json();
        setBilletera(data);
      }

      if (movimientosRes.ok) {
        const data = await movimientosRes.json();
        setMovimientosBilletera(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading billetera data:', error);
    } finally {
      setLoadingBilletera(false);
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
      case 'pendiente_manual':
        return 'bg-blue-500';
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

  const getDateParts = (fechaISO: string) => {
    const fecha = new Date(fechaISO);
    return {
      day: fecha.getDate().toString().padStart(2, '0'),
      month: fecha.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase(),
    };
  };

  const getDiasHasta = (fechaISO: string) => {
    const hoy = new Date();
    const fecha = new Date(fechaISO);
    hoy.setHours(0, 0, 0, 0);
    fecha.setHours(0, 0, 0, 0);
    const diff = Math.round((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    return `${diff} días`;
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const getPagoResumen = (turno: Turno) => {
    const precioTotal = parseFloat(turno.precio_final || turno.servicio_precio || '0');
    const senia = parseFloat(turno.senia_pagada || '0');
    const pendiente = parseFloat(
      turno.monto_pendiente || String(Math.max(0, precioTotal - senia))
    );

    if (turno.pagado_completo || pendiente <= 0) {
      return 'Pago completo realizado';
    }

    if (senia > 0) {
      return `Seña abonada ${formatCurrency(senia)} · Resta ${formatCurrency(pendiente)} en el local`;
    }

    return `Sin pago previo · Total a abonar en el local ${formatCurrency(precioTotal)}`;
  };

  const dateKeyLocal = (dateValue: Date) => {
    const year = dateValue.getFullYear();
    const month = `${dateValue.getMonth() + 1}`.padStart(2, '0');
    const day = `${dateValue.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const buildAgendaRange = (daysAhead = 45) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: daysAhead }, (_, index) => {
      const candidate = new Date(today);
      candidate.setDate(today.getDate() + index);
      return candidate;
    });
  };

  const dateRange = useMemo(() => buildAgendaRange(45), []);
  const dateScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollDates = (direction: 'left' | 'right') => {
    const container = dateScrollRef.current;
    if (!container) return;
    const amount = direction === 'left' ? -320 : 320;
    container.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const getPeriodKey = (time: string): 'morning' | 'afternoon' => {
    const hour = Number(time.split(':')[0]);
    return hour < 13 ? 'morning' : 'afternoon';
  };

  const getEstadoLabel = (turno: Turno) => {
    if (turno.estado === 'pendiente_manual') {
      return 'Reprogramación en revisión';
    }
    return turno.estado_display || turno.estado;
  };

  const puedeReprogramarTurno = (turno: Turno) => {
    if (turno.puede_reprogramar === false) return false;
    return !['cancelado', 'completado', 'no_asistio', 'pendiente_manual'].includes(turno.estado);
  };

  const getMotivoNoReprogramable = (turno: Turno) => {
    if (turno.motivo_no_reprogramable) return turno.motivo_no_reprogramable;
    if (turno.estado === 'pendiente_manual') return 'Ya tenés una solicitud de reprogramación en revisión.';
    return 'Este turno no se puede reprogramar.';
  };

  const getPeriodConfig = (period: 'morning' | 'afternoon') => {
    switch (period) {
      case 'morning':
        return { label: 'Mañana', icon: Sunrise, className: 'bg-orange-50 text-orange-700 border-orange-200' };
      default:
        return { label: 'Tarde', icon: Sun, className: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
  };

  const mapProfesional = (emp: EmpleadoApiItem): ProfesionalOpcion => ({
    id: Number(emp.id),
    nombre:
      `${emp.first_name || ''} ${emp.last_name || ''}`.trim() ||
      emp?.user?.full_name ||
      `Profesional #${emp.id}`,
  });

  const cargarProfesionalesServicio = async (servicioId: number, profesionalOriginalId: number) => {
    const response = await fetch(
      `/api/empleados/?servicio=${servicioId}&disponible=true&page_size=100`,
      { headers: getAuthHeaders() }
    );

    if (!response.ok) {
      return [] as ProfesionalOpcion[];
    }

    const data = await response.json();
    const empleados = Array.isArray(data?.results) ? data.results : [];
    const profesionales: ProfesionalOpcion[] = empleados.map(mapProfesional);

    setProfesionalesServicio(profesionales);
    setProfesionalesAlternativos(
      profesionales.filter((profesional) => Number(profesional.id) !== Number(profesionalOriginalId))
    );
    setMostrarCambioProfesional(profesionales.length > 1);

    return profesionales;
  };

  const cargarAgendaSingle = async (turno: Turno, empleadoId: number) => {
    const mapa: Record<string, string[]> = {};
    const disponibles: string[] = [];

    await Promise.all(
      dateRange.map(async (fecha) => {
        const fechaISO = dateKeyLocal(fecha);
        const res = await fetch(
          `/api/turnos/disponibilidad/?profesional_id=${empleadoId}&servicio=${turno.servicio}&fecha=${fechaISO}`,
          { headers: getAuthHeaders() }
        );

        const data = res.ok ? await res.json() : null;
        const horarios = Array.isArray(data?.horarios) ? data.horarios : [];
        mapa[fechaISO] = horarios;
        if (horarios.length > 0) {
          disponibles.push(fechaISO);
        }
      })
    );

    setAgendaProfesional(mapa);
    setAgendaGlobal({});
    setFechasDisponibles(disponibles);

    setFechaReprogramacion('');
    setNuevaFechaHora('');
    setPasoReprogramacion('calendar');
  };

  const cargarAgendaGlobal = async (turno: Turno) => {
    const mapaGlobal: Record<string, SlotAgrupado[]> = {};
    const mapaFechas: string[] = [];

    await Promise.all(
      dateRange.map(async (fecha) => {
        const fechaISO = dateKeyLocal(fecha);
        const res = await fetch(
          `/api/turnos/disponibilidad/?profesional_id=null&servicio=${turno.servicio}&fecha=${fechaISO}`,
          { headers: getAuthHeaders() }
        );
        const data = res.ok ? await res.json() : null;
        const slots = Array.isArray(data?.slots) ? data.slots : [];

        const agrupados = slots
          .map((slot: SlotAgrupado) => ({
            time: slot.time,
            professionalIds: slot.professionalIds || [],
            available: Boolean(slot.available),
          }))
          .sort((a: SlotAgrupado, b: SlotAgrupado) => a.time.localeCompare(b.time));

        mapaGlobal[fechaISO] = agrupados;
        if (agrupados.length > 0) mapaFechas.push(fechaISO);
      })
    );

    setAgendaGlobal(mapaGlobal);
    setFechasDisponibles(mapaFechas);

    return { mapaGlobal, mapaFechas };
  };

  const cargarDisponibilidad = async (turno: Turno, empleadoId: number, mode: ReprogramacionViewMode = viewMode) => {
    try {
      setCargandoAgenda(true);
      setCargandoAlternativas(true);
      setErrorReprogramacion('');
      setMostrarCambioProfesional(false);

      await cargarProfesionalesServicio(turno.servicio, empleadoId);

      if (mode === 'all') {
        setProfesionalActivoId(null);
        setProfesionalSeleccionadoId(null);
        const { mapaFechas } = await cargarAgendaGlobal(turno);
        setFechaReprogramacion('');
        setNuevaFechaHora('');
        setFechasDisponibles(mapaFechas);
        setPasoReprogramacion('calendar');
        return;
      }

      await cargarAgendaSingle(turno, empleadoId);
    } finally {
      setCargandoAgenda(false);
      setCargandoAlternativas(false);
    }
  };

  const iniciarFlujoReprogramacion = (turno: Turno) => {
    setTurnoParaReprogramar(turno);
    setNuevaFechaHora('');
    setFechaReprogramacion('');
    setProfesionalActivoId(turno.empleado);
    setProfesionalSeleccionadoId(turno.empleado);
    setAgendaProfesional({});
    setFechasDisponibles([]);
    setMostrarCambioProfesional(false);
    setProfesionalesAlternativos([]);
    setMotivoReprogramacion('');
    setErrorReprogramacion('');
    setPasoReprogramacion('calendar');
    setMostrarAdvertenciaFueraRango(false);
    setPenalidadDialogOpen(false);
    setResultadoReprogramacion(null);
    setSolicitudFlexibleCreada(false);
    setSolicitudFlexibleMensaje('');
    setSolicitandoFlexible(false);
    setViewMode('single');
    setReprogramDialogOpen(true);
    cargarDisponibilidad(turno, turno.empleado, 'single');
  };

  const abrirDialogoReprogramacion = (turno: Turno) => {
    if (requiereConfirmacionPenalidad(turno)) {
      setTurnoPendienteAviso(turno);
      setAvisoCooldown(5);
      setAvisoPoliticaOpen(true);
      return;
    }

    iniciarFlujoReprogramacion(turno);
  };

  const aceptarAvisoPolitica = () => {
    if (!turnoPendienteAviso || avisoCooldown > 0) return;
    const turno = turnoPendienteAviso;
    setAvisoPoliticaOpen(false);
    setTurnoPendienteAviso(null);
    iniciarFlujoReprogramacion(turno);
  };

  const cerrarDialogoReprogramacion = (open: boolean) => {
    setReprogramDialogOpen(open);
    if (!open) {
      setErrorReprogramacion('');
      setPasoReprogramacion('calendar');
      setResultadoReprogramacion(null);
      setSolicitudFlexibleCreada(false);
      setSolicitudFlexibleMensaje('');
      setSolicitandoFlexible(false);
      setPenalidadDialogOpen(false);
    }
  };

  useEffect(() => {
    if (!avisoPoliticaOpen || avisoCooldown <= 0) return;

    const timeout = window.setTimeout(() => {
      setAvisoCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [avisoPoliticaOpen, avisoCooldown]);

  const detenerEsperaPagoReprogramacion = () => {
    if (reprogramacionPollingRef.current) {
      window.clearInterval(reprogramacionPollingRef.current);
      reprogramacionPollingRef.current = null;
    }
    if (reprogramacionTabCheckRef.current) {
      window.clearInterval(reprogramacionTabCheckRef.current);
      reprogramacionTabCheckRef.current = null;
    }
    mpReprogramacionWindowRef.current = null;
  };

  useEffect(() => {
    return () => detenerEsperaPagoReprogramacion();
  }, []);

  useEffect(() => {
    if (!reprogramDialogOpen || !turnoParaReprogramar) return;
    if (!profesionalActivoId) return;
  }, [reprogramDialogOpen, turnoParaReprogramar, profesionalActivoId]);

  const convertirLocalAISO = (valorLocal: string) => {
    const fechaLocal = new Date(valorLocal);
    return fechaLocal.toISOString();
  };

  const fechaMinimaParaCalendario = new Date();
  fechaMinimaParaCalendario.setHours(0, 0, 0, 0);

  const profesionalOriginalNombre = turnoParaReprogramar?.empleado_nombre || 'Maria Gomez';
  const profesionalActualNombre =
    profesionalesServicio.find((prof) => prof.id === profesionalSeleccionadoId)?.nombre ||
    profesionalesAlternativos.find((prof) => prof.id === profesionalSeleccionadoId)?.nombre ||
    profesionalOriginalNombre;

  const fechaSeleccionadaFormateada = fechaReprogramacion
    ? new Date(`${fechaReprogramacion}T00:00:00`).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    : '';

  const fechasBarraReprogramacion = useMemo(() => {
    return dateRange;
  }, [dateRange]);

  const reprogramacionSubtitle = turnoParaReprogramar
    ? viewMode === 'single'
      ? `Con ${turnoParaReprogramar.empleado_nombre} - ${turnoParaReprogramar.servicio_nombre}`
      : `${turnoParaReprogramar.servicio_nombre} - Todos los profesionales`
    : 'Selecciona una nueva fecha y hora para el turno.';

  const penalidadServicioNombre = turnoParaReprogramar?.servicio_nombre || 'servicio';
  const penalidadMonto = parseFloat(
    turnoParaReprogramar?.precio_final || turnoParaReprogramar?.servicio_precio || '0'
  );
  const mensajePenalidadCliente = `Por politicas de la empresa, al reprogramar dentro de las 24 horas previas deberas abonar nuevamente el dia del turno que elijas. El monto del ${penalidadServicioNombre} es de ${formatCurrency(penalidadMonto)}.`;

  const requiereConfirmacionPenalidad = (turno: Turno) => {
    const fechaTurno = new Date(turno.fecha_hora).getTime();
    const limiteSinPenalidad = fechaTurno - 24 * 60 * 60 * 1000;
    return Date.now() > limiteSinPenalidad;
  };
  const isPenaltyApplied = turnoParaReprogramar
    ? requiereConfirmacionPenalidad(turnoParaReprogramar)
    : false;

  const horarioSeleccionado = nuevaFechaHora ? nuevaFechaHora.slice(11, 16) : '';

  const slotsDelDia = viewMode === 'all'
    ? agendaGlobal[fechaReprogramacion] || []
    : (agendaProfesional[fechaReprogramacion] || []).map((time) => ({
      time,
      professionalIds: [String(profesionalSeleccionadoId || turnoParaReprogramar?.empleado || '')],
      available: true,
    }));

  const slotsAgrupados = slotsDelDia.reduce<Record<'morning' | 'afternoon', SlotAgrupado[]>>(
    (acc, slot) => {
      acc[getPeriodKey(slot.time)].push(slot);
      return acc;
    },
    { morning: [], afternoon: [] }
  );

  const selectedSlotProfessionals = useMemo(() => {
    if (!fechaReprogramacion || !horarioSeleccionado) return [] as ProfesionalOpcion[];

    if (viewMode === 'all') {
      const slot = (agendaGlobal[fechaReprogramacion] || []).find((item) => item.time === horarioSeleccionado);
      return (slot?.professionalIds || []).map((id) =>
        profesionalesServicio.find((prof) => String(prof.id) === String(id)) || {
          id: Number(id),
          nombre: `Profesional #${id}`,
        }
      );
    }

    return profesionalesServicio.filter((prof) => Number(prof.id) === Number(profesionalActivoId || turnoParaReprogramar?.empleado || 0));
  }, [agendaGlobal, fechaReprogramacion, horarioSeleccionado, profesionalesServicio, profesionalActivoId, turnoParaReprogramar?.empleado, viewMode]);
  const profesionalesDisponiblesHorario = selectedSlotProfessionals;

  const handleDateSelect = (dateISO: string) => {
    setFechaReprogramacion(dateISO);
    setMostrarAdvertenciaFueraRango(false);
    setErrorReprogramacion('');
    setPenalidadDialogOpen(false);

    const slots = viewMode === 'all' ? (agendaGlobal[dateISO] || []) : (agendaProfesional[dateISO] || []).map((time) => ({
      time,
      professionalIds: [String(profesionalActivoId || turnoParaReprogramar?.empleado || '')],
      available: true,
    }));

    if (slots.length === 0) {
      setNuevaFechaHora('');
      setPasoReprogramacion('select-professional');
      return;
    }

    setNuevaFechaHora(`${dateISO}T${slots[0].time}`);
    setPasoReprogramacion('time');
  };

  const handleTimeSelect = (slot: SlotAgrupado) => {
    if (!fechaReprogramacion) return;
    const originalId = String(turnoParaReprogramar?.empleado || profesionalActivoId || '');
    setNuevaFechaHora(`${fechaReprogramacion}T${slot.time}`);

    const originalDisponible = slot.professionalIds.includes(originalId);
    const profesionalesDelSlot = slot.professionalIds.map((id) =>
      profesionalesServicio.find((prof) => String(prof.id) === String(id)) || {
        id: Number(id),
        nombre: `Profesional #${id}`,
      }
    );

    setProfesionalesAlternativos(profesionalesDelSlot.filter((prof) => String(prof.id) !== originalId));

    if (viewMode === 'single' && originalDisponible) {
      setPasoReprogramacion('confirmation');
      return;
    }

    if (originalDisponible && profesionalesDelSlot.length === 1) {
      setProfesionalSeleccionadoId(Number(originalId));
      setProfesionalActivoId(Number(originalId));
      setPasoReprogramacion('confirmation');
      return;
    }

    setPasoReprogramacion('select-professional');
  };

  const handleProfessionalSelect = (professional: ProfesionalOpcion) => {
    setProfesionalSeleccionadoId(Number(professional.id));
    setProfesionalActivoId(Number(professional.id));
    setPasoReprogramacion('confirmation');
  };

  const toggleViewMode = async (mode: ReprogramacionViewMode) => {
    if (!turnoParaReprogramar) return;
    setViewMode(mode);
    setPasoReprogramacion('calendar');
    await cargarDisponibilidad(turnoParaReprogramar, turnoParaReprogramar.empleado, mode);
  };

  const ejecutarReprogramacion = async (aceptarPenalidad: boolean) => {
    if (!turnoParaReprogramar) return;
    if (!nuevaFechaHora) {
      setErrorReprogramacion('Debes seleccionar una nueva fecha y hora.');
      return;
    }

    try {
      setReprogramando(true);
      setErrorReprogramacion('');

      const payload: {
        nueva_fecha_hora: string;
        motivo?: string;
        nuevo_empleado_id?: number;
        aceptar_penalidad_fuera_rango?: boolean;
      } = {
        nueva_fecha_hora: convertirLocalAISO(nuevaFechaHora),
        motivo: motivoReprogramacion?.trim() || undefined,
      };

      if (
        profesionalSeleccionadoId &&
        profesionalSeleccionadoId !== turnoParaReprogramar.empleado
      ) {
        payload.nuevo_empleado_id = profesionalSeleccionadoId;
      }

      if (aceptarPenalidad) {
        payload.aceptar_penalidad_fuera_rango = true;
      }

      const response = await turnosService.reprogramar(turnoParaReprogramar.id, payload);
      const turnoActualizado = response.turno as unknown as {
        fecha_hora: string;
        empleado_nombre?: string;
        sala_nombre?: string;
      };

      setResultadoReprogramacion({
        fecha_hora: turnoActualizado.fecha_hora,
        profesional: turnoActualizado.empleado_nombre || profesionalActualNombre,
        sala: turnoActualizado.sala_nombre || undefined,
        seniaPendienteLocal:
          response.estado_pago_reprogramacion === 'SENIA_PENDIENTE_LOCAL' ||
          response.penalidad_aplicada ||
          isPenaltyApplied,
      });
      setPasoReprogramacion('result');

      if (response.penalidad_aplicada || isPenaltyApplied) {
        toast.warning('La seña anterior queda perdida. El turno queda con seña pendiente de pago en local.');
      } else {
        toast.success('Turno reprogramado correctamente.');
      }
      await loadTurnosData();
    } catch (error: any) {
      const message = error?.message || 'No se pudo reprogramar el turno.';
      const requiereConfirmarPenalidad =
        /perder[aá]s la seña|deber[aá]s pagar nuevamente|confirma para continuar|politicas de la empresa|abonar nuevamente/i.test(message);

      if (requiereConfirmarPenalidad) {
        setMostrarAdvertenciaFueraRango(true);
        setPenalidadDialogOpen(true);
      }

      setErrorReprogramacion(message);
      toast.error(message);
    } finally {
      setReprogramando(false);
    }
  };

  const iniciarPagoReprogramacion = async (tipoPago: 'SENIA' | 'PAGO_COMPLETO') => {
    if (!turnoParaReprogramar || !nuevaFechaHora) return;

    try {
      setCreandoPagoReprogramacion(true);
      setErrorReprogramacion('');

      const payload: Record<string, unknown> = {
        turno_id: turnoParaReprogramar.id,
        nueva_fecha_hora: convertirLocalAISO(nuevaFechaHora),
        motivo: motivoReprogramacion?.trim() || undefined,
        tipo_pago: tipoPago,
      };

      if (
        profesionalSeleccionadoId &&
        profesionalSeleccionadoId !== turnoParaReprogramar.empleado
      ) {
        payload.nuevo_empleado_id = profesionalSeleccionadoId;
      }

      const response = await fetch('/api/mercadopago/preferencia-reprogramacion/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || data.error || 'No se pudo iniciar el pago de reprogramación.');
      }

      const checkoutUrl = data.init_point || data.sandbox_init_point;
      if (!checkoutUrl) {
        throw new Error('Mercado Pago no devolvió un link de pago.');
      }

      const mpWindow = window.open(checkoutUrl, '_blank');
      if (!mpWindow) {
        throw new Error('No se pudo abrir Mercado Pago. Habilitá las ventanas emergentes e intentá nuevamente.');
      }

      mpReprogramacionWindowRef.current = mpWindow;
      setPreferenceReprogramacionId(data.preference_id || '');
      setEsperandoPagoReprogramacion(true);
      toast.success('Completá el pago en la pestaña de Mercado Pago.');

      const verificarPago = async (finalCheck = false) => {
        try {
          const verifyResponse = await fetch(`/api/mercadopago/verificar-pago/${data.preference_id}/`, {
            headers: getAuthHeaders(),
          });
          const verifyData = await verifyResponse.json().catch(() => ({}));

          if (verifyData.status === 'approved') {
            detenerEsperaPagoReprogramacion();
            setEsperandoPagoReprogramacion(false);
            setPenalidadDialogOpen(false);
            setReprogramDialogOpen(false);
            setPreferenceReprogramacionId('');
            await loadTurnosData();
            toast.success('Pago aprobado y turno reprogramado correctamente.');
            return true;
          }
        } catch (err) {
          console.error('Error verificando pago de reprogramación:', err);
        }

        if (finalCheck) {
          detenerEsperaPagoReprogramacion();
          setEsperandoPagoReprogramacion(false);
          setPreferenceReprogramacionId('');
          setErrorReprogramacion('Hubo un error, intentalo de nuevo.');
          toast.error('Hubo un error, intentalo de nuevo.');
        }

        return false;
      };

      let verificacionFinalEnCurso = false;
      const verificarPagoFinalConReintentos = async () => {
        if (verificacionFinalEnCurso) return;
        verificacionFinalEnCurso = true;

        for (let intento = 0; intento < 10; intento += 1) {
          const aprobado = await verificarPago(false);
          if (aprobado) return;
          await new Promise((resolve) => window.setTimeout(resolve, 3000));
        }

        await verificarPago(true);
      };

      reprogramacionPollingRef.current = window.setInterval(() => {
        void verificarPago(false);
      }, 3000);

      reprogramacionTabCheckRef.current = window.setInterval(() => {
        if (mpReprogramacionWindowRef.current?.closed) {
          void verificarPagoFinalConReintentos();
        }
      }, 1000);
    } catch (error: any) {
      const message = error?.message || 'No se pudo iniciar el pago de reprogramación.';
      setErrorReprogramacion(message);
      toast.error(message);
    } finally {
      setCreandoPagoReprogramacion(false);
    }
  };

  const confirmarReprogramacion = async () => {
    if (!turnoParaReprogramar) return;

    if (isPenaltyApplied) {
      setMostrarAdvertenciaFueraRango(true);
      setPenalidadDialogOpen(true);
      setErrorReprogramacion('');
      return;
    }

    await ejecutarReprogramacion(false);
  };

  const solicitarReprogramacionFlexible = async () => {
    if (!turnoParaReprogramar) return;

    try {
      setSolicitandoFlexible(true);
      setErrorReprogramacion('');

      const response = await turnosService.solicitarReprogramacionFlexible(turnoParaReprogramar.id, {
        motivo: motivoReprogramacion?.trim() || undefined,
        preferencia_fecha: fechaReprogramacion || undefined,
        preferencia_horario: nuevaFechaHora ? nuevaFechaHora.slice(11, 16) : undefined,
      });

      setSolicitudFlexibleCreada(true);
      setSolicitudFlexibleMensaje(
        `${response.message}. Tu solicitud quedó en revisión. El profesional asignará manualmente un nuevo horario disponible y te avisaremos cuando quede confirmado.`
      );
      toast.success(response.message);
      await loadTurnosData();
    } catch (error: any) {
      const message = error?.message || 'No se pudo crear la solicitud flexible.';
      setErrorReprogramacion(message);
      toast.error(message);
    } finally {
      setSolicitandoFlexible(false);
    }
  };

  const saldoBilletera = billetera
    ? parseFloat(billetera.saldo || '0')
    : Number(perfilCliente?.saldo_billetera || 0);

  const fechaVencimientoBilletera = billetera?.fecha_vencimiento
    ? new Date(billetera.fecha_vencimiento).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    : null;

  const devoluciones = movimientosBilletera.filter((mov) => mov.tipo === 'credito');
  const MOVS_PER_PAGE = 5;
  const totalHistorialPages = Math.max(1, Math.ceil(devoluciones.length / MOVS_PER_PAGE));
  const historialActual = devoluciones.slice(
    (historialPage - 1) * MOVS_PER_PAGE,
    historialPage * MOVS_PER_PAGE
  );

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <BeautifulSpinner label="Cargando tu panel de cliente..." />
      </div>
    );
  }

  const proximoCita = proximosTurnos.length > 0 ? proximosTurnos[0] : null;
  const siguientesCitas = proximosTurnos.slice(1, 5);

  return (
    <div className="min-h-screen bg-[#f5eff8]">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-8 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">¡Hola, {perfilCliente?.user?.first_name || 'Cliente'}! ✨</h1>
            <p className="mt-2 text-xl text-slate-500">Te esperamos para consentirte 💖</p>
          </div>

          <Card className="w-full max-w-xl rounded-3xl border border-emerald-300 bg-[#f3fcf6] shadow-lg">
            <CardContent className="p-6">
              {loadingPerfil || loadingBilletera ? (
                <BeautifulSpinner label="Cargando billetera..." />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-300 bg-emerald-100/60 p-3.5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-emerald-500 p-3 text-white">
                          <Wallet className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-emerald-900">Saldo disponible</p>
                          <p className="text-2xl font-extrabold leading-tight text-emerald-800">
                            {formatCurrency(saldoBilletera)}
                          </p>
                          {fechaVencimientoBilletera && (
                            <p className="mt-1 text-sm text-emerald-900">
                              Crédito vigente hasta el {fechaVencimientoBilletera}
                              {billetera?.esta_por_vencer && (
                                <span className="ml-1 font-semibold text-amber-700">(próximo a vencer)</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="max-w-sm text-left text-emerald-900 sm:text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 underline decoration-emerald-500/70 underline-offset-2 hover:text-emerald-900"
                            >
                              <CircleHelp className="h-4 w-4" />
                              ¿Cómo funciona?
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>¿Cómo funciona el crédito de tu billetera?</DialogTitle>
                              <DialogDescription>
                                El crédito se genera automáticamente cuando cancelás un turno con la anticipación mínima definida por el estudio.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3 text-sm text-slate-700">
                              <p>
                                1. Si cancelás dentro del plazo permitido, el sistema acredita el monto correspondiente en tu billetera.
                              </p>
                              <p>
                                2. Ese saldo se descuenta en tus próximas reservas hasta agotarse o hasta su fecha de vencimiento.
                              </p>
                              <p>
                                3. En esta sección podés ver tu saldo actual, vencimiento y todos los movimientos de crédito/débito.
                              </p>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Dialog onOpenChange={(open) => { if (open) setHistorialPage(1); }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                        >
                          Historial
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Historial de devoluciones</DialogTitle>
                          <DialogDescription>
                            Aquí podés ver los créditos acreditados en tu billetera por cancelaciones dentro de término.
                          </DialogDescription>
                        </DialogHeader>

                        {devoluciones.length === 0 ? (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                            Aún no tienes devoluciones registradas.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {historialActual.map((mov) => (
                              <div key={mov.id} className="rounded-xl border border-emerald-200 bg-white p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="mb-1 flex items-center gap-2">
                                      <span className="rounded-full bg-emerald-100 p-1.5">
                                        <TrendingUp className="h-4 w-4 text-emerald-700" />
                                      </span>
                                      <span className="text-base font-semibold text-slate-900">{mov.tipo_display}</span>
                                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                                        +{formatCurrency(parseFloat(mov.monto || '0'))}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-600">{mov.descripcion || 'Sin descripción'}</p>
                                    <p className="mt-2 text-xs text-slate-500">
                                      Saldo anterior: {formatCurrency(parseFloat(mov.saldo_anterior || '0'))}
                                      <span className="mx-2">→</span>
                                      <span className="font-semibold text-slate-700">
                                        Saldo nuevo: {formatCurrency(parseFloat(mov.saldo_nuevo || '0'))}
                                      </span>
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right text-xs text-slate-500">
                                    <p>{new Date(mov.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                    <p>{new Date(mov.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {totalHistorialPages > 1 && (
                              <div className="flex items-center justify-between pt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={historialPage === 1}
                                  onClick={() => setHistorialPage((prev) => Math.max(1, prev - 1))}
                                >
                                  Anterior
                                </Button>
                                <span className="text-sm text-slate-600">
                                  Página {historialPage} de {totalHistorialPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={historialPage === totalHistorialPages}
                                  onClick={() => setHistorialPage((prev) => Math.min(totalHistorialPages, prev + 1))}
                                >
                                  Siguiente
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-600" />
            <h2 className="text-3xl font-bold text-slate-900">Tu Próxima Cita</h2>
          </div>

          {loadingTurnos ? (
            <Card className="rounded-3xl border-slate-200 bg-white">
              <CardContent className="py-12">
                <BeautifulSpinner label="Cargando próxima cita..." />
              </CardContent>
            </Card>
          ) : proximoCita ? (
            <div className="rounded-3xl bg-linear-to-r from-indigo-500 via-violet-500 to-purple-500 p-6 text-white shadow-lg">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-5">
                  <div className="rounded-3xl border border-white/30 bg-white/15 px-6 py-5 text-center backdrop-blur-xs">
                    <p className="text-5xl font-bold leading-none">{getDateParts(proximoCita.fecha_hora).day}</p>
                    <p className="mt-1 text-2xl font-medium">{getDateParts(proximoCita.fecha_hora).month}</p>
                  </div>

                  <div>
                    <h3 className="text-3xl font-bold leading-tight">{proximoCita.servicio_nombre}</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-lg text-white/90">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        <span>{formatTime(proximoCita.fecha_hora)} - {proximoCita.servicio_duracion}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>💁</span>
                        <span>{proximoCita.empleado_nombre}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-left lg:text-right">
                  <p className="text-lg text-white/80">Total</p>
                  <p className="text-5xl font-extrabold leading-tight">
                    ${parseFloat(proximoCita.monto_pendiente || proximoCita.precio_final || proximoCita.servicio_precio || '0').toFixed(0)}
                  </p>
                </div>
              </div>

              <div className="my-5 border-t border-white/20" />

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <p className="text-lg text-white/90">
                  {proximoCita.estado === 'pendiente_manual'
                    ? 'Tu solicitud de reprogramación está en revisión del profesional'
                    : 'Puedes cancelar hasta 24 horas antes del turno'}
                </p>
                <Badge className="w-fit rounded-full bg-white/20 px-6 py-2 text-xl text-white">{getDiasHasta(proximoCita.fecha_hora)}</Badge>
              </div>

              {proximoCita.estado === 'pendiente_manual' && (
                <div className="mt-4 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 text-sm text-white/95">
                  Estado: {getEstadoLabel(proximoCita)}. Te avisaremos cuando el profesional asigne un nuevo horario.
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-sm text-white/95">
                {getPagoResumen(proximoCita)}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  className="h-12 rounded-2xl bg-white text-lg font-semibold text-purple-700 hover:bg-white/95"
                  onClick={() => router.push('/dashboard/cliente/turnos')}
                >
                  Ver mis turnos
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl border-white/30 bg-white/10 text-lg font-semibold text-white hover:bg-white/20"
                  onClick={() => abrirDialogoReprogramacion(proximoCita)}
                  disabled={!puedeReprogramarTurno(proximoCita)}
                  title={!puedeReprogramarTurno(proximoCita) ? getMotivoNoReprogramable(proximoCita) : undefined}
                >
                  {!puedeReprogramarTurno(proximoCita) ? (
                    <span className="inline-flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Reprogramación no disponible
                    </span>
                  ) : (
                    'Reprogramar turno'
                  )}
                </Button>
              </div>
              {!puedeReprogramarTurno(proximoCita) && (
                <div className="mt-3 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 text-sm text-white/95">
                  <span className="font-semibold">No se puede reprogramar:</span>{' '}
                  {getMotivoNoReprogramable(proximoCita)}
                </div>
              )}
            </div>
          ) : (
            <Card className="rounded-3xl border-slate-200 bg-white">
              <CardContent className="py-12 text-center">
                <Calendar className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                <p className="text-xl text-slate-600">No tienes citas próximas</p>
                <Button className="mt-4" onClick={() => router.push('/dashboard/cliente/turnos/nuevo')}>
                  Reservar nuevo turno
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-3xl font-bold text-slate-900">Próximas Citas</h2>
          {loadingTurnos ? (
            <Card className="rounded-3xl border-slate-200 bg-white">
              <CardContent className="py-10">
                <BeautifulSpinner label="Cargando próximas citas..." />
              </CardContent>
            </Card>
          ) : siguientesCitas.length > 0 ? (
            <div className="space-y-4">
              {siguientesCitas.map((turno) => {
                const precio = parseFloat(turno.monto_pendiente || turno.precio_final || turno.servicio_precio || '0');
                return (
                  <div
                    key={turno.id}
                    className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-left transition-all hover:shadow-sm"
                  >
                    <div
                      className="flex cursor-pointer items-center justify-between gap-4"
                      onClick={() => router.push('/dashboard/cliente/turnos')}
                    >
                      <div className="flex min-w-0 items-center gap-5">
                        <div className="rounded-3xl bg-purple-100 px-5 py-3 text-center text-purple-700">
                          <p className="text-4xl font-bold leading-none">{getDateParts(turno.fecha_hora).day}</p>
                          <p className="mt-1 text-xl font-medium">{getDateParts(turno.fecha_hora).month}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-2xl font-bold text-slate-900">{turno.servicio_nombre}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-1 text-base text-slate-600">
                            <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> {formatTime(turno.fecha_hora)}</span>
                            <span>💁 {turno.empleado_nombre}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{getPagoResumen(turno)}</p>
                          {turno.estado === 'pendiente_manual' && (
                            <p className="mt-2 text-sm font-medium text-blue-700">{getEstadoLabel(turno)}</p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-4xl font-bold text-slate-900">${Number.isFinite(precio) ? precio.toFixed(0) : '0'}</p>
                        <p className="mt-1 text-lg text-slate-500">{getDiasHasta(turno.fecha_hora)}</p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <Button
                        variant="outline"
                        className="h-10 rounded-xl border-purple-200 bg-purple-50 px-5 text-base font-semibold text-purple-700 hover:bg-purple-100"
                        onClick={() => abrirDialogoReprogramacion(turno)}
                        disabled={!puedeReprogramarTurno(turno)}
                        title={!puedeReprogramarTurno(turno) ? getMotivoNoReprogramable(turno) : undefined}
                      >
                        {!puedeReprogramarTurno(turno) ? (
                          <span className="inline-flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            No disponible
                          </span>
                        ) : (
                          'Reprogramar'
                        )}
                      </Button>
                      {!puedeReprogramarTurno(turno) && (
                        <p className="mt-2 text-sm text-amber-700">
                          {getMotivoNoReprogramable(turno)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="rounded-3xl border-slate-200 bg-white">
              <CardContent className="py-10 text-center">
                <p className="text-lg text-slate-600">No hay más citas próximas.</p>
              </CardContent>
            </Card>
          )}
        </section>

        <section>
          <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white/40 p-10 text-center">
            <Calendar className="mx-auto mb-4 h-12 w-12 text-purple-600" />
            <h3 className="text-3xl font-bold text-slate-900">¿Quieres agendar otro turno?</h3>
            <p className="mt-2 text-xl text-slate-600">Reserva tu próxima cita en segundos</p>
            <Button
              className="mt-6 h-12 rounded-2xl bg-linear-to-r from-purple-700 to-pink-600 px-8 text-lg font-semibold hover:opacity-95"
              onClick={() => router.push('/dashboard/cliente/turnos/nuevo')}
            >
              Reservar nuevo turno
            </Button>
          </div>
        </section>

        <Dialog
          open={avisoPoliticaOpen}
          onOpenChange={(open) => {
            setAvisoPoliticaOpen(open);
            if (!open) {
              setTurnoPendienteAviso(null);
              setAvisoCooldown(5);
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>AVISO: reprogramación fuera de plazo</DialogTitle>
              <DialogDescription>
                Leé las condiciones antes de continuar con la reprogramación.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-semibold">Según las políticas de la empresa:</p>
              <p>
                Al reprogramar con menos de 24 horas de anticipación perderás el importe abonado del turno anterior.
              </p>
              <p>
                Para confirmar el nuevo horario deberás abonar nuevamente. Podrás elegir si querés pagar una nueva seña o el servicio completo por Mercado Pago.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setAvisoPoliticaOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={aceptarAvisoPolitica}
                disabled={avisoCooldown > 0}
              >
                {avisoCooldown > 0
                  ? `Aceptar y continuar (${avisoCooldown})`
                  : 'Aceptar y continuar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={reprogramDialogOpen} onOpenChange={cerrarDialogoReprogramacion}>
          <DialogContent className="max-w-[1120px] border-0 bg-transparent p-0 shadow-none sm:max-w-[1120px]">
            <div className="flex h-[86vh] max-h-[86vh] min-h-[640px] flex-col overflow-hidden rounded-none bg-[#fbf3fb] shadow-[0_24px_70px_rgba(28,24,40,0.18)] sm:rounded-[18px]">
              {pasoReprogramacion !== 'time' && pasoReprogramacion !== 'confirmation' && pasoReprogramacion !== 'flexible' && !resultadoReprogramacion && (
                <div className="border-b border-slate-200 bg-white">
                  <DialogHeader className="space-y-0 px-6 py-6 text-left sm:px-9">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-[#9a20f4] to-[#e326a7] text-white">
                        {viewMode === 'single' ? <User className="h-8 w-8" /> : <Calendar className="h-8 w-8" />}
                      </div>
                      <div>
                        <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                          Reprogramar Turno
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-base text-slate-700">
                          {reprogramacionSubtitle}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  {viewMode === 'single' && (
                    <div className="px-6 pb-6 sm:px-9">
                      <Button
                        type="button"
                        className="h-14 w-full rounded-lg bg-linear-to-r from-[#9018f5] via-[#bd28d8] to-[#e11690] text-base font-semibold text-white shadow-lg shadow-fuchsia-500/20 hover:opacity-95"
                        onClick={() => void toggleViewMode('all')}
                      >
                        <User className="mr-2 h-5 w-5" />
                        Ver otros profesionales disponibles
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 border-t border-slate-100 px-3 py-5 sm:px-4">
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full bg-white shadow-md" onClick={() => scrollDates('left')}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div ref={dateScrollRef} className="scrollbar-hide flex flex-1 gap-3 overflow-x-auto py-1">
                      {fechasBarraReprogramacion.map((dateValue) => {
                        const fechaISO = dateKeyLocal(dateValue);
                        const disponible = viewMode === 'all'
                          ? (agendaGlobal[fechaISO] || []).length > 0
                          : (agendaProfesional[fechaISO] || []).length > 0;
                        const selected = fechaReprogramacion === fechaISO;
                        const weekday = dateValue.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase();
                        const day = dateValue.getDate().toString().padStart(2, '0');
                        const month = dateValue.toLocaleDateString('es-AR', { month: 'short' });
                        const isToday = fechaISO === dateKeyLocal(new Date());
                        const disabledTitle = viewMode === 'all'
                          ? 'No hay profesionales disponibles este día'
                          : `${profesionalOriginalNombre} no trabaja o no tiene horarios disponibles este día`;

                        return (
                          <button
                            key={fechaISO}
                            type="button"
                            disabled={!disponible}
                            title={disponible ? undefined : disabledTitle}
                            onClick={() => handleDateSelect(fechaISO)}
                            className={`h-[120px] min-w-[82px] rounded-lg border px-3 text-center transition ${selected
                              ? 'border-[#9b20f3] bg-[#f5e7ff] text-slate-950 shadow-sm'
                              : disponible
                                ? 'border-[#e6c8ff] bg-white text-slate-900 hover:border-[#bd8cff]'
                                : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-75'
                              }`}
                          >
                            <p className="text-xs font-semibold uppercase text-slate-500">{weekday}</p>
                            <p className="mt-3 text-3xl font-bold leading-none">{day}</p>
                            <p className="mt-2 text-xs text-slate-500">{month}</p>
                            {isToday && <p className="mt-1 text-xs font-semibold text-purple-700">Hoy</p>}
                            {!disponible && <p className="mt-1 text-[10px] font-medium text-slate-400">No disponible</p>}
                          </button>
                        );
                      })}
                    </div>
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full bg-white shadow-md" onClick={() => scrollDates('right')}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {cargandoAgenda ? (
                  <div className="flex min-h-[640px] items-center justify-center rounded-4xl border border-white/80 bg-white/80">
                    <div className="max-w-md text-center">
                      <Loader2 className="mx-auto mb-5 h-14 w-14 animate-spin text-purple-600" />
                      <p className="text-2xl font-medium text-slate-900">Verificando disponibilidad...</p>
                      <p className="mt-2 text-sm text-slate-600">Estamos buscando la fecha, el horario y si hay otros profesionales que puedan tomar tu turno.</p>
                    </div>
                  </div>
                ) : resultadoReprogramacion ? (
                  <div className="mx-auto max-w-3xl rounded-4xl border border-white/80 bg-white p-8 text-center shadow-[0_18px_60px_rgba(18,24,40,0.08)]">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle className="h-10 w-10" />
                    </div>
                    <h3 className="mt-6 text-3xl font-semibold text-slate-900">¡Turno Reprogramado!</h3>
                    <p className="mt-2 text-lg text-slate-600">Tu turno ha sido reprogramado exitosamente</p>

                    <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
                      <div className="rounded-2xl bg-[#faf5ff] p-5">
                        <p className="text-sm text-slate-500">Fecha</p>
                        <p className="mt-1 text-xl text-slate-900">
                          {new Date(resultadoReprogramacion.fecha_hora).toLocaleDateString('es-AR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#faf5ff] p-5">
                        <p className="text-sm text-slate-500">Horario</p>
                        <p className="mt-1 text-xl text-slate-900">
                          {new Date(resultadoReprogramacion.fecha_hora).toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })} hs
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#faf5ff] p-5">
                        <p className="text-sm text-slate-500">Profesional</p>
                        <p className="mt-1 text-xl text-slate-900">{resultadoReprogramacion.profesional}</p>
                      </div>
                      <div className="rounded-2xl bg-[#faf5ff] p-5">
                        <p className="text-sm text-slate-500">Salón</p>
                        <p className="mt-1 text-xl text-slate-900">{resultadoReprogramacion.sala || 'Centro de Estética Belleza'}</p>
                      </div>
                    </div>

                    {resultadoReprogramacion.seniaPendienteLocal && (
                      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-left text-sm text-red-800">
                        <p className="font-semibold">Seña pendiente de pago</p>
                        <p className="mt-1">
                          La seña anterior quedó marcada como perdida por reprogramar con menos de 24hs de aviso. Deberás abonar una nueva seña en el local para confirmar el nuevo turno.
                        </p>
                      </div>
                    )}

                    <Button className="mt-8 h-14 w-full rounded-2xl bg-slate-300 text-lg font-semibold text-slate-600" disabled>
                      {resultadoReprogramacion.seniaPendienteLocal ? 'Seña pendiente en local' : 'Turno Confirmado'}
                    </Button>
                  </div>
                ) : (
                  <div>
                    {pasoReprogramacion === 'calendar' && (
                      <div className="flex min-h-[365px] items-center justify-center px-6 py-14 text-center">
                        <div>
                          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#efe2ff] text-[#a328ff]">
                            <Sparkles className="h-10 w-10" />
                          </div>
                          <h3 className="mt-5 text-2xl font-semibold text-slate-950">Selecciona una fecha</h3>
                          <p className="mt-3 text-base text-slate-700">
                            {viewMode === 'single'
                              ? `Mostrando fechas disponibles con ${profesionalOriginalNombre}`
                              : 'Mostrando todas las fechas con profesionales disponibles'}
                          </p>
                        </div>
                      </div>
                    )}

                    {pasoReprogramacion === 'time' && (
                      <div>
                        <div className="border-b border-slate-200 bg-white px-6 py-5 sm:px-9">
                          <button
                            type="button"
                            className="mb-4 text-sm font-medium text-purple-700 hover:text-purple-900"
                            onClick={() => setPasoReprogramacion('calendar')}
                          >
                            ← Volver
                          </button>
                          <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-[#9a20f4] to-[#e326a7] text-white">
                              <User className="h-7 w-7" />
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold text-slate-950">{profesionalActualNombre}</h3>
                              <p className="text-sm text-slate-700">{turnoParaReprogramar?.servicio_nombre || 'Servicio'}</p>
                              <p className="text-sm font-medium text-purple-700">{fechaSeleccionadaFormateada}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mx-auto max-w-2xl px-6 py-7">
                          <div className="space-y-6">
                          {(['morning', 'afternoon'] as const).map((period) => {
                            const config = getPeriodConfig(period);
                            const Icon = config.icon;
                            const slots = slotsAgrupados[period];
                            if (slots.length === 0) return null;

                            return (
                              <div key={period}>
                                <div className="mb-3 flex items-center gap-2 text-slate-900">
                                  <Icon className="h-5 w-5" />
                                  <h4 className="text-lg font-semibold">{config.label}</h4>
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  {slots.map((slot) => {
                                    const selected = nuevaFechaHora.endsWith(slot.time);
                                    const originalId = String(turnoParaReprogramar?.empleado || profesionalActivoId || '');
                                    const originalAvailable = slot.professionalIds.includes(originalId);

                                    return (
                                      <button
                                        key={slot.time}
                                        type="button"
                                        onClick={() => handleTimeSelect(slot)}
                                        className={`h-[62px] rounded-lg border px-4 text-base font-semibold transition ${selected
                                          ? 'border-[#9b20f3] bg-[#efe0ff] text-[#7e00ff]'
                                          : originalAvailable
                                            ? 'border-[#ca8cff] bg-[#f5e9ff] text-[#7e00ff] hover:border-[#ab54ff]'
                                            : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                          }`}
                                      >
                                        <div className="flex items-center justify-center gap-2">
                                          <Clock className="h-4 w-4" />
                                          <span>{slot.time}</span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          </div>

                        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                          <p className="text-lg font-semibold text-slate-900">¿No encontrás un horario que te sirva?</p>
                          <p className="mt-1 text-sm text-slate-700">Podés dejar una solicitud flexible para revisión manual sin seña inmediata.</p>
                          <Button type="button" className="mt-4 h-12 w-full rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => setPasoReprogramacion('flexible')}>
                            Solicitar Reprogramación Flexible
                          </Button>
                        </div>
                        </div>
                      </div>
                    )}

                    {pasoReprogramacion === 'select-professional' && (
                      <div className="mx-auto max-w-3xl rounded-4xl border border-white/80 bg-white p-5 shadow-[0_18px_60px_rgba(18,24,40,0.08)]">
                        <div className="flex items-start gap-4 rounded-3xl bg-[#fbf7ff] p-5">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                            <AlertCircle className="h-7 w-7" />
                          </div>
                          <div>
                            <h3 className="text-3xl font-semibold text-slate-900">Horario No Disponible</h3>
                            <p className="mt-1 text-slate-600">
                              {profesionalOriginalNombre} no tiene disponibilidad para {fechaSeleccionadaFormateada || 'la fecha elegida'}
                              {horarioSeleccionado ? ` a las ${horarioSeleccionado} hs` : ''}.
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 rounded-2xl bg-[#fbf7ff] p-5 text-center">
                          <p className="text-xl text-slate-900">
                            Elegí un profesional disponible para las {horarioSeleccionado || 'hora seleccionada'}
                          </p>
                          <p className="mt-2 text-base text-slate-600">
                            {selectedSlotProfessionals.length} profesional{selectedSlotProfessionals.length === 1 ? '' : 'es'} disponible{selectedSlotProfessionals.length === 1 ? '' : 's'} para este horario
                          </p>
                        </div>

                        {cargandoAlternativas && (
                          <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Buscando más profesionales disponibles...
                          </div>
                        )}

                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                          {selectedSlotProfessionals.map((profesional) => (
                            <button
                              key={profesional.id}
                              type="button"
                              onClick={() => handleProfessionalSelect(profesional)}
                              className="rounded-[22px] border border-[#e6d7ff] bg-[#faf5ff] p-4 text-left transition hover:border-purple-300 hover:bg-white"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-pink-500 text-white">
                                  <User className="h-6 w-6" />
                                </div>
                                <div>
                                  <p className="text-lg font-semibold text-slate-900">{profesional.nombre}</p>
                                  <p className="text-sm text-slate-500">Profesional disponible</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                          <Button className="h-14 rounded-2xl bg-[#8b22ff] text-lg font-semibold hover:bg-[#7720db]" onClick={() => setPasoReprogramacion('time')}>
                            No, elegir otro horario
                          </Button>
                          <Button variant="outline" className="h-14 rounded-2xl border-slate-200 bg-[#f2f3f7] text-lg font-semibold text-slate-800 hover:bg-slate-100" onClick={() => void toggleViewMode('all')}>
                            Ver otros profesionales disponibles
                          </Button>
                        </div>
                      </div>
                    )}

                    {pasoReprogramacion === 'flexible' && (
                      <div className="mx-auto max-w-2xl rounded-[30px] bg-white p-6 text-center shadow-[0_18px_60px_rgba(18,24,40,0.08)] sm:p-8">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                          <Sparkles className="h-10 w-10" />
                        </div>

                        <h3 className="mt-6 text-3xl font-semibold text-slate-900">Reprogramación Flexible</h3>
                        <p className="mt-3 text-lg text-slate-600">
                          No encontraste un horario ideal. Podemos dejar una solicitud para revisión manual sin exigir seña inmediata.
                        </p>

                        <div className="mt-8 rounded-3xl bg-[#fbf7ff] p-5 text-left text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Cómo funciona</p>
                          <ul className="mt-3 space-y-2">
                            <li>• El profesional revisará tu solicitud y asignará un nuevo horario disponible.</li>
                            <li>• No se solicita seña en este paso.</li>
                            <li>• Te notificaremos cuando el nuevo turno quede asignado.</li>
                          </ul>
                        </div>

                        {errorReprogramacion && (
                          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
                            {errorReprogramacion}
                          </div>
                        )}

                        {solicitudFlexibleCreada && (
                          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm text-emerald-900">
                            {solicitudFlexibleMensaje || 'Solicitud flexible creada correctamente.'}
                          </div>
                        )}

                        <div className="mt-8 flex flex-col gap-3">
                          <Button
                            className="h-14 rounded-2xl bg-[#8b22ff] text-lg font-semibold hover:bg-[#7720db]"
                            onClick={solicitarReprogramacionFlexible}
                            disabled={solicitandoFlexible || solicitudFlexibleCreada}
                          >
                            {solicitandoFlexible ? 'Enviando...' : 'Solicitar Reprogramación Flexible'}
                          </Button>
                          <Button
                            variant="outline"
                            className="h-14 rounded-2xl border-slate-200 bg-[#f2f3f7] text-lg font-semibold text-slate-800 hover:bg-slate-100"
                            onClick={() => setPasoReprogramacion('time')}
                            disabled={solicitandoFlexible}
                          >
                            Volver a horarios
                          </Button>
                        </div>
                      </div>
                    )}

                    {pasoReprogramacion === 'confirmation' && (
                      <div className="mx-auto max-w-2xl rounded-[30px] bg-white p-6 text-center shadow-[0_18px_60px_rgba(18,24,40,0.08)] sm:p-8">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <CheckCircle className="h-10 w-10" />
                        </div>

                        <h3 className="mt-6 text-3xl font-semibold text-slate-900">Confirmar Reprogramación</h3>
                        <p className="mt-3 text-lg text-slate-600">Por favor verifica los detalles de tu nuevo turno</p>

                        {profesionalSeleccionadoId && turnoParaReprogramar && profesionalSeleccionadoId !== turnoParaReprogramar.empleado && (
                          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900">
                            Tu turno será con {profesionalActualNombre} en lugar de {profesionalOriginalNombre}.
                          </div>
                        )}

                        <div className="mt-8 space-y-4 text-left">
                          <div className="rounded-2xl bg-[#faf5ff] p-5">
                            <p className="text-sm text-slate-500">Fecha</p>
                            <p className="mt-1 text-xl text-slate-900">{fechaSeleccionadaFormateada || 'Sin fecha seleccionada'}</p>
                          </div>
                          <div className="rounded-2xl bg-[#faf5ff] p-5">
                            <p className="text-sm text-slate-500">Horario</p>
                            <p className="mt-1 text-xl text-slate-900">{horarioSeleccionado ? `${horarioSeleccionado} hs` : 'Sin horario seleccionado'}</p>
                          </div>
                          <div className="rounded-2xl bg-[#faf5ff] p-5">
                            <p className="text-sm text-slate-500">Profesional</p>
                            <p className="mt-1 text-xl text-slate-900">{profesionalActualNombre}</p>
                          </div>
                          <div className="rounded-2xl bg-[#faf5ff] p-5">
                            <p className="text-sm text-slate-500">Salón</p>
                            <p className="mt-1 text-xl text-slate-900">Centro de Estética Belleza</p>
                          </div>
                        </div>

                        {isPenaltyApplied && (
                          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-left text-sm text-red-800">
                            <p className="font-semibold">Atención</p>
                            <p className="mt-1">
                              Al reprogramar con menos de 24hs de aviso, deberás abonar una nueva seña en el local/pasarela.
                            </p>
                            <p className="mt-2">{mensajePenalidadCliente}</p>
                            <p className="mt-3 font-medium">
                              Para continuar vas a elegir si abonás una nueva seña o el servicio completo por Mercado Pago.
                            </p>
                          </div>
                        )}

                        <div className="mt-6 space-y-2 text-left">
                          <label className="text-sm font-medium text-slate-700">Motivo (opcional)</label>
                          <textarea
                            value={motivoReprogramacion}
                            onChange={(e) => setMotivoReprogramacion(e.target.value)}
                            rows={3}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-purple-400 focus:outline-none"
                            placeholder="Ej: cambio de agenda"
                          />
                        </div>

                        {errorReprogramacion && (
                          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
                            {errorReprogramacion}
                          </div>
                        )}

                        <div className="mt-8 flex flex-col gap-3">
                          <Button
                            className="h-14 rounded-2xl bg-[#8b22ff] text-lg font-semibold hover:bg-[#7720db]"
                            onClick={confirmarReprogramacion}
                            disabled={reprogramando || !nuevaFechaHora || !fechaReprogramacion}
                          >
                            {reprogramando
                              ? 'Reprogramando...'
                              : isPenaltyApplied
                                ? 'Continuar a pago'
                                : 'Confirmar Reprogramación'}
                          </Button>
                          <Button
                            variant="outline"
                            className="h-14 rounded-2xl border-slate-200 bg-[#f2f3f7] text-lg font-semibold text-slate-800 hover:bg-slate-100"
                            onClick={() => setPasoReprogramacion('time')}
                            disabled={reprogramando}
                          >
                            Volver al calendario
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={penalidadDialogOpen}
          onOpenChange={(open) => {
            if (!esperandoPagoReprogramacion) {
              setPenalidadDialogOpen(open);
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Reprogramacion dentro de las 24 horas</DialogTitle>
              <DialogDescription>
                Este cambio queda sujeto a la politica de reprogramacion del estudio.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p>{mensajePenalidadCliente}</p>
              <p className="mt-2 font-medium">
                Antes de confirmar, elegí cómo querés abonar: nueva seña o servicio completo.
              </p>
            </div>
            {esperandoPagoReprogramacion && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="flex items-center gap-2 font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Esperando confirmación de Mercado Pago
                </div>
                <p className="mt-2">
                  Completá el pago en la pestaña que se abrió. Esta ventana se actualizará cuando el pago sea aprobado.
                </p>
              </div>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setPenalidadDialogOpen(false)}
                disabled={creandoPagoReprogramacion || esperandoPagoReprogramacion}
              >
                Volver
              </Button>
              <Button
                variant="outline"
                onClick={() => void iniciarPagoReprogramacion('SENIA')}
                disabled={creandoPagoReprogramacion || esperandoPagoReprogramacion}
              >
                {creandoPagoReprogramacion ? 'Preparando pago...' : esperandoPagoReprogramacion ? 'Esperando pago...' : 'Abonar seña'}
              </Button>
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => void iniciarPagoReprogramacion('PAGO_COMPLETO')}
                disabled={creandoPagoReprogramacion || esperandoPagoReprogramacion}
              >
                {creandoPagoReprogramacion ? 'Preparando pago...' : esperandoPagoReprogramacion ? 'Esperando pago...' : 'Abonar servicio completo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
