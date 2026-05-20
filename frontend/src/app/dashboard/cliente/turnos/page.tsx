'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { BeautifulSpinner } from '@/components/ui/BeautifulSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getAuthHeaders, getJsonAuthHeaders } from '@/lib/auth-headers';
import { formatDate, formatDateTimeReadable, formatTime } from '@/lib/dateUtils';
import { AlertCircle, Calendar, CalendarDays, CheckCircle, Clock, Filter, Loader2, Plus, Search, User, X, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
  sala_nombre?: string;
  fecha_hora: string;
  fecha_hora_fin: string;
  estado: 'pendiente' | 'confirmado' | 'en_proceso' | 'completado' | 'cancelado' | 'no_asistio' | 'pendiente_manual' | 'oferta_enviada' | 'expirada';
  estado_display: string;
  precio_final: string | null;
  servicio_precio?: string;
  senia_pagada?: string;
  monto_pendiente?: string;
  monto_pendiente_original?: string;
  descuento_aplicado?: string;
  tipo_pago?: string;
  metodo_pago?: string | null;
  puede_cancelar: boolean;
  puede_reprogramar?: boolean;
  motivo_no_reprogramable?: string;
  reprogramacion_bloqueada_codigo?: string | null;
  tiene_pago_mp?: boolean;
  pagado_completo?: boolean;
  elegible_credito_cancelacion?: boolean;
  monto_credito_cancelacion?: string;
  notas_cliente?: string;
  notas_empleado?: string;
  created_at: string;
  updated_at: string;
}

interface ComprobanteData {
  empresa?: {
    nombre_empresa?: string;
    razon_social?: string;
    cuit?: string;
    fecha_fundacion?: string;
  };
  turno?: {
    cliente_nombre?: string;
    cliente_email?: string;
    profesional_nombre?: string;
    servicio_nombre?: string;
    fecha_hora?: string;
    senia_pagada?: string;
    precio_final?: string;
  };
  pago?: {
    monto?: string | number;
    moneda?: string;
    payment_id?: string;
  };
}

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

const isFilterFecha = (value: string): value is 'hoy' | 'semana' | 'mes' | 'all' => {
  return ['hoy', 'semana', 'mes', 'all'].includes(value);
};

const isSortBy = (value: string): value is 'fecha' | 'precio' | 'servicio' => {
  return ['fecha', 'precio', 'servicio'].includes(value);
};

export default function TurnosClientePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
  const [confirmMessage, setConfirmMessage] = useState({ title: '', description: '' });
  const [confirmCreditMessage, setConfirmCreditMessage] = useState('');

  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({
    title: '',
    description: '',
    type: 'success' as 'success' | 'error'
  });

  // Estado para comprobante de pago
  const [comprobanteDialogOpen, setComprobanteDialogOpen] = useState(false);
  const [comprobanteData, setComprobanteData] = useState<ComprobanteData | null>(null);

  // Estado para cancelación con motivo
  const [turnoACancelar, setTurnoACancelar] = useState<Turno | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const motivoCancelacionValido = motivoCancelacion.trim().length > 0;
  const [turnoAFinalizar, setTurnoAFinalizar] = useState<Turno | null>(null);
  const [finalizarConfirmOpen, setFinalizarConfirmOpen] = useState(false);
  const [pagoFinalOpen, setPagoFinalOpen] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [qrPreferenceId, setQrPreferenceId] = useState('');
  const [qrPaymentLink, setQrPaymentLink] = useState('');
  const [qrPaymentCode, setQrPaymentCode] = useState('');
  const [qrPaymentError, setQrPaymentError] = useState('');
  const [qrStatusMessage, setQrStatusMessage] = useState('');
  const [generandoQr, setGenerandoQr] = useState(false);
  const qrPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const detenerPollingQrFinal = () => {
    if (qrPollingRef.current) {
      clearInterval(qrPollingRef.current);
      qrPollingRef.current = null;
    }
  };

  // Cargar turnos
  const fetchTurnos = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/turnos/mis_turnos/?page_size=1000', { headers });

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

  useEffect(() => {
    return () => detenerPollingQrFinal();
  }, []);

  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'pasados' || filterParam === 'proximos' || filterParam === 'todos') {
      setFilter(filterParam);
    }
  }, [searchParams]);

  const handleDescargarComprobantePDF = () => {
    if (!comprobanteData) return;

    const popup = window.open('', '_blank', 'width=900,height=1100');
    if (!popup) return;

    const html = `
      <html>
        <head>
          <title>Comprobante de pago</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 12px 0; font-size: 24px; }
            .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
            .label { color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
            p { margin: 4px 0; }
          </style>
        </head>
        <body>
          <h1>Comprobante de pago</h1>
          <div class="box">
            <div class="label">Empresa</div>
            <p><strong>${comprobanteData.empresa?.nombre_empresa || 'Beautiful Studio'}</strong></p>
            ${comprobanteData.empresa?.razon_social ? `<p>Razón social: ${comprobanteData.empresa.razon_social}</p>` : ''}
            ${comprobanteData.empresa?.cuit ? `<p>CUIT: ${comprobanteData.empresa.cuit}</p>` : ''}
          </div>
          <div class="box">
            <div class="label">Detalle del turno</div>
            <p>Cliente: ${comprobanteData.turno?.cliente_nombre || '-'}</p>
            <p>Profesional: ${comprobanteData.turno?.profesional_nombre || '-'}</p>
            <p>Servicio: ${comprobanteData.turno?.servicio_nombre || '-'}</p>
            <p>Fecha y hora: ${comprobanteData.turno?.fecha_hora ? formatDateTimeReadable(comprobanteData.turno.fecha_hora) : '-'}</p>
          </div>
          <div class="box">
            <div class="label">Pago</div>
            <p>Monto cobrado: <strong>$${comprobanteData.pago?.monto || '-'}</strong> ${comprobanteData.pago?.moneda || ''}</p>
            ${comprobanteData.turno?.senia_pagada ? `<p>Seña pagada: $${comprobanteData.turno.senia_pagada}</p>` : ''}
            ${comprobanteData.turno?.precio_final ? `<p>Precio final turno: $${comprobanteData.turno.precio_final}</p>` : ''}
            ${comprobanteData.pago?.payment_id ? `<p>ID de pago: ${comprobanteData.pago.payment_id}</p>` : ''}
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  // Función para abrir el diálogo de cancelación con mensaje según crédito
  const showConfirmDialog = (turno: Turno) => {
    const fecha = formatDateTimeReadable(turno.fecha_hora);
    const baseDescription = `¿Estás seguro de que deseas cancelar el turno de "${turno.servicio_nombre}" para el ${fecha}?`;

    let creditMessage = '';
    if (turno.elegible_credito_cancelacion && turno.monto_credito_cancelacion) {
      const monto = parseFloat(turno.monto_credito_cancelacion || '0');
      creditMessage = `Al cancelar este turno vas a recibir $${monto.toFixed(2)} de crédito en tu billetera.`;
    } else {
      creditMessage = 'No vas a recibir crédito, simplemente se va a cancelar el turno.';
    }

    setTurnoACancelar(turno);
    setMotivoCancelacion('');
    setCancelError('');
    setConfirmMessage({ title: '¿Cancelar turno?', description: baseDescription });
    setConfirmCreditMessage(creditMessage);
    setConfirmDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!turnoACancelar) return;

    const motivo = motivoCancelacion.trim();
    if (!motivo) {
      setCancelError('Por favor ingresá un motivo de cancelación.');
      return;
    }

    setCancelLoading(true);
    setCancelError('');

    try {
      const response = await fetch(`/api/turnos/${turnoACancelar.id}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ motivo }),
      });

      if (response.ok) {
        let descripcion = 'El turno ha sido cancelado correctamente.';
        try {
          const data = await response.json();
          const montoCredito =
            typeof data.monto_credito === 'number'
              ? data.monto_credito
              : parseFloat(data.monto_credito || '0');

          if (data.credito_aplicado && montoCredito > 0) {
            descripcion = `El turno ha sido cancelado correctamente. Vas a recibir $${montoCredito.toFixed(2)} de crédito en tu billetera.`;
          } else if (!Number.isNaN(montoCredito)) {
            descripcion = 'El turno ha sido cancelado correctamente. No se generó crédito en tu billetera.';
          }
        } catch {
          // Si no se puede parsear el cuerpo, usamos el mensaje por defecto
        }

        showNotification('Turno cancelado', descripcion, 'success');
        setConfirmDialogOpen(false);
        setTurnoACancelar(null);
        window.dispatchEvent(new Event('wallet-updated'));
        fetchTurnos();
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'No se pudo cancelar el turno';
        setCancelError(errorMessage);
      }
    } catch (error) {
      console.error('Error:', error);
      setCancelError('Error de conexión. No se pudo conectar con el servidor');
    } finally {
      setCancelLoading(false);
    }
  };

  // Función para mostrar notificación modal
  const showNotification = (title: string, description: string, type: 'success' | 'error') => {
    setNotificationMessage({ title, description, type });
    setNotificationDialogOpen(true);
  };

  // Ver comprobante
  const handleVerComprobante = async (turnoId: number) => {
    try {
      const response = await fetch(`/api/mercadopago/comprobante/${turnoId}/`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setComprobanteData(data);
        setComprobanteDialogOpen(true);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.detail || 'No se pudo obtener el comprobante de pago';
        showNotification('Error al cargar comprobante', msg, 'error');
      }
    } catch (error) {
      console.error('Error comprobante:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor', 'error');
    }
  };

  // Cancelar turno: abre diálogo con detalle de crédito y motivo
  const handleCancelarTurno = (turno: Turno) => {
    showConfirmDialog(turno);
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
          return parseMoney(b.precio_final) - parseMoney(a.precio_final);
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

  const parseMoney = (value?: string | null) => {
    const parsed = parseFloat(value || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getEstadoLabel = (turno: Turno) => {
    if (turno.estado === 'pendiente_manual') return 'Reprogramación en revisión';
    if (turno.estado === 'oferta_enviada') return 'Oferta enviada';
    if (turno.estado === 'expirada') return 'Solicitud expirada';
    return turno.estado_display || turno.estado;
  };

  const puedeReprogramarTurno = (turno: Turno) => {
    if (turno.puede_reprogramar === false) return false;
    return !['cancelado', 'completado', 'no_asistio', 'pendiente_manual', 'oferta_enviada', 'expirada'].includes(turno.estado);
  };

  const getMotivoNoReprogramable = (turno: Turno) => {
    if (turno.motivo_no_reprogramable) return turno.motivo_no_reprogramable;
    if (turno.estado === 'pendiente_manual') return 'Ya tenés una solicitud de reprogramación en revisión.';
    if (turno.estado === 'oferta_enviada') return 'Tenés una oferta de reprogramación pendiente de respuesta.';
    if (turno.estado === 'expirada') return 'La solicitud de reprogramación expiró.';
    return 'Este turno no se puede reprogramar por su estado actual.';
  };

  const abrirReprogramacion = (turno: Turno) => {
    if (!puedeReprogramarTurno(turno)) return;
    router.push(`/dashboard/cliente?reprogramar=${turno.id}`);
  };

  // Obtener color del badge según estado
  const getEstadoBadgeVariant = (estado: string) => {
    switch (estado) {
      case 'confirmado':
        return 'default';
      case 'pendiente':
      case 'pendiente_manual':
      case 'oferta_enviada':
        return 'secondary';
      case 'en_proceso':
        return 'default';
      case 'completado':
        return 'default';
      case 'cancelado':
        return 'destructive';
      case 'no_asistio':
      case 'expirada':
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
      case 'pendiente_manual':
        return 'bg-blue-500';
      case 'oferta_enviada':
        return 'bg-indigo-500';
      case 'expirada':
        return 'bg-orange-600';
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

  const getCancelDeadline = (fechaHora: string) => {
    const turnoDate = new Date(fechaHora);
    const cancelBefore = new Date(turnoDate.getTime() - 24 * 60 * 60 * 1000);
    return formatDateTimeReadable(cancelBefore.toISOString());
  };

  const getDiasBadge = (fechaHora: string) => {
    const now = new Date();
    const fecha = new Date(fechaHora);
    now.setHours(0, 0, 0, 0);
    fecha.setHours(0, 0, 0, 0);
    const diff = Math.round((fecha.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    return `${diff} días`;
  };

  const getPagoDetalle = (turno: Turno) => {
    const precioTotal = parseFloat(turno.precio_final || turno.servicio_precio || '0');
    const senia = parseFloat(turno.senia_pagada || '0');
    const restante = parseFloat(
      turno.monto_pendiente || String(Math.max(0, precioTotal - senia))
    );

    if (turno.pagado_completo || restante <= 0) {
      return {
        badge: 'Pago completo',
        texto: 'Este turno ya está abonado por completo.',
      };
    }

    if (senia > 0) {
      return {
        badge: 'Seña abonada',
        texto: `Seña: $${senia.toFixed(2)} · Resta en local: $${restante.toFixed(2)}`,
      };
    }

    return {
      badge: 'Sin pago previo',
      texto: `Monto a abonar en local: $${precioTotal.toFixed(2)}`,
    };
  };

  const getMontoPendiente = (turno: Turno) => {
    const precioTotal = parseFloat(turno.precio_final || turno.servicio_precio || '0');
    const senia = parseFloat(turno.senia_pagada || '0');
    const pendiente = parseFloat(turno.monto_pendiente || String(Math.max(0, precioTotal - senia)));
    return Number.isFinite(pendiente) ? Math.max(0, pendiente) : 0;
  };

  const abrirFinalizar = (turno: Turno) => {
    detenerPollingQrFinal();
    setTurnoAFinalizar(turno);
    setQrPreferenceId('');
    setQrPaymentLink('');
    setQrPaymentCode('');
    setQrPaymentError('');
    setQrStatusMessage('');

    if (getMontoPendiente(turno) > 0.01) {
      setPagoFinalOpen(true);
      return;
    }

    setFinalizarConfirmOpen(true);
  };

  const cerrarPagoFinalizacion = (open: boolean) => {
    setPagoFinalOpen(open);
    if (!open) {
      detenerPollingQrFinal();
      setQrStatusMessage('');
    }
  };

  const finalizarTurno = async () => {
    if (!turnoAFinalizar) return;
    setFinalizando(true);
    try {
      const response = await fetch(`/api/turnos/${turnoAFinalizar.id}/`, {
        method: 'PATCH',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({ estado: 'completado' }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.estado?.[0] || body.error || body.detail || 'No se pudo finalizar el turno');
      }

      setFinalizarConfirmOpen(false);
      setPagoFinalOpen(false);
      setTurnoAFinalizar(null);
      await fetchTurnos();
      showNotification('Turno finalizado', 'Tu turno quedó marcado como finalizado correctamente.', 'success');
    } catch (error: unknown) {
      showNotification('No se pudo finalizar', getErrorMessage(error, 'Intentá nuevamente.'), 'error');
    } finally {
      setFinalizando(false);
    }
  };

  const generarQrFinalizacion = async () => {
    if (!turnoAFinalizar) return;
    setGenerandoQr(true);
    setQrPaymentError('');
    try {
      const response = await fetch('/api/mercadopago/cobro-turno-staff/', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({ turno_id: turnoAFinalizar.id }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || body.error || 'No se pudo generar el QR');
      }

      const pref = await response.json();
      setQrPreferenceId(pref.preference_id);
      setQrPaymentLink(pref.qr_data || pref.qr_init_point || pref.init_point || '');
      setQrStatusMessage('Escaneá el QR y completá el pago desde Mercado Pago. Se confirmará automáticamente cuando impacte.');

      detenerPollingQrFinal();
      let attempts = 0;
      qrPollingRef.current = setInterval(async () => {
        try {
          attempts += 1;
          if (attempts > 100) {
            detenerPollingQrFinal();
            setQrStatusMessage('No se confirmó automáticamente. Si el pago figura recibido, ingresá el número de operación y usá Forzar pago.');
            return;
          }

          const statusResponse = await fetch(`/api/mercadopago/verificar-pago/${pref.preference_id}/`, {
            headers: getAuthHeaders(),
          });
          if (!statusResponse.ok) return;

          const body = await statusResponse.json();
          if (body.status === 'approved') {
            detenerPollingQrFinal();
            setQrPaymentCode(String(body.payment_id || ''));
            setQrStatusMessage('Pago confirmado por Mercado Pago. Finalizando turno...');
            await finalizarTurno();
          } else if (body.status === 'cancelled') {
            detenerPollingQrFinal();
            setQrStatusMessage('La transacción fue cancelada. Generá un nuevo QR para continuar.');
          }
        } catch (error) {
          console.error('Error verificando pago final:', error);
        }
      }, 3000);
    } catch (error: unknown) {
      setQrPaymentError(getErrorMessage(error, 'No se pudo generar el QR'));
    } finally {
      setGenerandoQr(false);
    }
  };

  const forzarPagoYFinalizar = async () => {
    if (!turnoAFinalizar || !qrPreferenceId) return;
    const codigo = qrPaymentCode.trim();
    if (!codigo) {
      setQrPaymentError('Ingresá el número de operación para forzar el pago.');
      return;
    }

    setFinalizando(true);
    setQrPaymentError('');
    try {
      detenerPollingQrFinal();
      const response = await fetch('/api/mercadopago/confirmar-cobro-manual/', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({
          preference_id: qrPreferenceId,
          payment_id: codigo,
          motivo: 'Pago final de turno forzado por cliente',
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || body.error || 'No se pudo forzar el pago');
      }

      await finalizarTurno();
    } catch (error: unknown) {
      setQrPaymentError(getErrorMessage(error, 'No se pudo forzar el pago'));
      setFinalizando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <BeautifulSpinner label="Cargando tus turnos..." />
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

          {/* Filtros principales (Próximos/Auditoría/Todos) */}
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
                  <SelectItem value="pendiente_manual">Reprogramación en revisión</SelectItem>
                  <SelectItem value="oferta_enviada">Oferta enviada</SelectItem>
                  <SelectItem value="expirada">Solicitud expirada</SelectItem>
                  <SelectItem value="en_proceso">🔄 En Proceso</SelectItem>
                  <SelectItem value="completado">✔️ Completado</SelectItem>
                  <SelectItem value="cancelado">❌ Cancelado</SelectItem>
                  <SelectItem value="no_asistio">⛔ No Asistió</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro por rango de fecha */}
              <Select value={filterFecha} onValueChange={(value) => {
                if (isFilterFecha(value)) setFilterFecha(value);
              }}>
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
              <Select value={sortBy} onValueChange={(value) => {
                if (isSortBy(value)) setSortBy(value);
              }}>
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
          {filter === 'proximos' && (
            <div className="mb-4 rounded-2xl border border-orange-300 bg-orange-50 p-4 text-orange-900">
              <div className="mb-1 flex items-center gap-2 text-xl font-semibold">
                <AlertCircle className="h-4 w-4" />
                Política de Cancelación
              </div>
              <p className="text-base">
                Las cancelaciones deben realizarse con al menos 24 horas de anticipación para evitar cargos.
              </p>
            </div>
          )}

          {/* Lista de turnos */}
          <div className="space-y-4">
            {filteredTurnos.map((turno) => {
              const isPendiente = turno.estado === 'pendiente';
              const isConfirmado = turno.estado === 'confirmado';
              const isCompletado = turno.estado === 'completado';
              const isCancelado = turno.estado === 'cancelado' || turno.estado === 'no_asistio';

              if (filter === 'proximos') {
                const badgeDia = getDiasBadge(turno.fecha_hora);
                const pagoDetalle = getPagoDetalle(turno);
                return (
                  <div
                    key={turno.id}
                    className="rounded-3xl border border-slate-300 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-2xl font-bold text-slate-900">{turno.servicio_nombre}</h3>
                            <Badge className={`${getEstadoColor(turno.estado)} rounded-full px-4 py-1 text-sm font-semibold text-white`}>
                              {getEstadoLabel(turno)}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xl text-slate-700">👩‍🔧 {turno.empleado_nombre}</p>
                        </div>

                        <p className="text-4xl font-extrabold text-purple-600">
                          ${parseMoney(turno.monto_pendiente || turno.precio_final).toFixed(0)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900">
                        <p className="font-semibold">{pagoDetalle.badge}</p>
                        <p>{pagoDetalle.texto}</p>
                      </div>

                      {!puedeReprogramarTurno(turno) && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          <p className="font-semibold">Reprogramación no disponible</p>
                          <p>{getMotivoNoReprogramable(turno)}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-base text-slate-700 md:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-purple-600" />
                          <span>{formatDate(turno.fecha_hora)}</span>
                          <Badge variant="outline" className="rounded-lg border-purple-200 bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-700">
                            {badgeDia}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-purple-600" />
                          <span>{formatTime(turno.fecha_hora)} ({turno.servicio_duracion})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-5 w-5 text-purple-600" />
                          <span>{turno.sala_nombre || turno.categoria_nombre}</span>
                        </div>
                        <div className="flex items-center gap-2 text-orange-700">
                          <AlertCircle className="h-5 w-5 text-orange-500" />
                          <span>Cancelar antes: {getCancelDeadline(turno.fecha_hora)}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-200" />

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {turno.tiene_pago_mp && (
                          <Button
                            variant="outline"
                            className="h-11 rounded-2xl border-emerald-300 bg-white text-base font-semibold text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleVerComprobante(turno.id)}
                          >
                            Ver comprobante
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="h-11 rounded-2xl border-slate-300 bg-white text-base font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => abrirReprogramacion(turno)}
                          disabled={!puedeReprogramarTurno(turno)}
                          title={!puedeReprogramarTurno(turno) ? getMotivoNoReprogramable(turno) : undefined}
                        >
                          {puedeReprogramarTurno(turno) ? 'Reprogramar' : 'No se puede reprogramar'}
                        </Button>
                        {turno.puede_cancelar ? (
                          <Button
                            variant="outline"
                            className="h-11 rounded-2xl border-red-300 bg-white text-base font-semibold text-red-600 hover:bg-red-50"
                            onClick={() => handleCancelarTurno(turno)}
                          >
                            Cancelar
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="h-11 rounded-2xl border-slate-300 bg-slate-100 text-base font-semibold text-slate-500"
                            disabled
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

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
                        {getEstadoLabel(turno)}
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
                        <span className="text-lg font-bold text-primary flex flex-col items-start">
                          {(() => {
                            const montoPendiente = parseMoney(turno.monto_pendiente || turno.precio_final);
                            const montoOriginal = parseMoney(turno.monto_pendiente_original || turno.monto_pendiente || turno.precio_final);
                            const descuento = parseMoney(turno.descuento_aplicado);

                            if (descuento > 0 && montoOriginal > 0) {
                              return (
                                <>
                                  <span className="line-through text-gray-400 text-xs">Antes ${montoOriginal.toFixed(2)}</span>
                                  <span className="text-green-700 font-bold text-sm">Ahora ${montoPendiente.toFixed(2)}</span>
                                  <span className="text-xs text-green-600">Bono aplicado: -${descuento.toFixed(2)}</span>
                                </>
                              );
                            }

                            return <span>${montoPendiente.toFixed(2)}</span>;
                          })()}
                          <span className="mt-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-800">
                            {getPagoDetalle(turno).texto}
                          </span>
                        </span>
                      </div>
                    </div>

                    {!puedeReprogramarTurno(turno) && filter !== 'pasados' && (
                      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <p className="font-semibold">Reprogramación no disponible</p>
                        <p>{getMotivoNoReprogramable(turno)}</p>
                      </div>
                    )}

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
                    {turno.tiene_pago_mp && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerComprobante(turno.id)}
                        className="whitespace-nowrap"
                      >
                        <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                        Ver comprobante
                      </Button>
                    )}
                    {turno.estado === 'en_proceso' && (
                      <Button
                        size="sm"
                        onClick={() => abrirFinalizar(turno)}
                        className="whitespace-nowrap bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Finalizar
                      </Button>
                    )}
                    {filter !== 'pasados' && !isCompletado && !isCancelado && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirReprogramacion(turno)}
                        disabled={!puedeReprogramarTurno(turno)}
                        title={!puedeReprogramarTurno(turno) ? getMotivoNoReprogramable(turno) : undefined}
                        className="whitespace-nowrap"
                      >
                        {puedeReprogramarTurno(turno) ? 'Reprogramar' : 'No disponible'}
                      </Button>
                    )}
                    {(filter === 'pasados' || turno.estado === 'completado') && turno.estado !== 'cancelado' && (
                      <Button
                        variant="outline"
                        className="h-10 whitespace-nowrap rounded-xl border-purple-200 bg-purple-100 px-5 text-base font-semibold text-purple-700 hover:bg-purple-200"
                        onClick={() => router.push(`/dashboard/cliente/turnos/nuevo?servicio=${turno.servicio}`)}
                      >
                        Reservar de nuevo
                      </Button>
                    )}
                    {turno.puede_cancelar && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelarTurno(turno)}
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
                  {filter === 'pasados' && searchTerm === '' && filtrosActivos === 0 && 'No tienes turnos en la auditoría'}
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

      {/* Modal de comprobante de pago */}
      <AlertDialog open={comprobanteDialogOpen} onOpenChange={setComprobanteDialogOpen}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Comprobante de pago</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-gray-800">
                {comprobanteData ? (
                  <>
                    <div>
                      <p className="font-semibold">{comprobanteData.empresa?.nombre_empresa}</p>
                      {comprobanteData.empresa?.razon_social && (
                        <p>Razón social: {comprobanteData.empresa.razon_social}</p>
                      )}
                      {comprobanteData.empresa?.cuit && (
                        <p>CUIT: {comprobanteData.empresa.cuit}</p>
                      )}
                      {comprobanteData.empresa?.fecha_fundacion && (
                        <p>Fecha de inicio: {formatDate(comprobanteData.empresa.fecha_fundacion)}</p>
                      )}
                    </div>

                    <div className="border-t pt-2">
                      <p>
                        Cliente: <span className="font-medium">{comprobanteData.turno?.cliente_nombre}</span>
                      </p>
                      {comprobanteData.turno?.cliente_email && (
                        <p>Email: {comprobanteData.turno.cliente_email}</p>
                      )}
                      <p>Profesional: {comprobanteData.turno?.profesional_nombre}</p>
                      <p>Servicio: {comprobanteData.turno?.servicio_nombre}</p>
                      {comprobanteData.turno?.fecha_hora && (
                        <p>
                          Fecha y hora: {formatDateTimeReadable(comprobanteData.turno.fecha_hora)}
                        </p>
                      )}
                    </div>

                    <div className="border-t pt-2">
                      <p>
                        Monto cobrado:{' '}
                        <span className="font-semibold">
                          ${comprobanteData.pago?.monto}
                        </span>{' '}
                        {comprobanteData.pago?.moneda}
                      </p>
                      {comprobanteData.turno?.senia_pagada && (
                        <p>Seña pagada: ${comprobanteData.turno.senia_pagada}</p>
                      )}
                      {comprobanteData.turno?.precio_final && (
                        <p>Precio final turno: ${comprobanteData.turno.precio_final}</p>
                      )}
                      {comprobanteData.pago?.payment_id && (
                        <p>ID de pago: {comprobanteData.pago.payment_id}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p>No se pudo cargar el comprobante.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDescargarComprobantePDF}>
              Descargar PDF
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => setComprobanteDialogOpen(false)}>
              Cerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de confirmación y motivo de cancelación */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmMessage.title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>{confirmMessage.description}</p>
                {confirmCreditMessage && (
                  <p className="text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-md p-2">
                    {confirmCreditMessage}
                  </p>
                )}

                <div className="space-y-2 mt-2">
                  <Label htmlFor="motivo-cancelacion">Motivo de la cancelación</Label>
                  <Textarea
                    id="motivo-cancelacion"
                    placeholder="Contanos brevemente por qué necesitás cancelar este turno"
                    value={motivoCancelacion}
                    onChange={(e) => {
                      setMotivoCancelacion(e.target.value);
                      if (cancelError && e.target.value.trim()) {
                        setCancelError('');
                      }
                    }}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Este comentario es obligatorio para cancelar el turno.
                  </p>
                  {cancelError && (
                    <p className="text-sm text-red-600">{cancelError}</p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>No, mantener turno</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className="bg-red-600 hover:bg-red-700"
              disabled={cancelLoading || !motivoCancelacionValido}
            >
              {cancelLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelando...
                </span>
              ) : (
                'Sí, cancelar turno'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={finalizarConfirmOpen} onOpenChange={setFinalizarConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar por finalizado el turno?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmá solo si el servicio ya terminó. El turno quedará marcado como finalizado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={finalizarTurno} disabled={finalizando} className="bg-green-600 hover:bg-green-700">
              {finalizando ? 'Finalizando...' : 'Sí, finalizar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pagoFinalOpen} onOpenChange={cerrarPagoFinalizacion}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pago pendiente para finalizar</DialogTitle>
            <DialogDescription>
              Antes de finalizar el turno tenés que abonar el saldo restante.
            </DialogDescription>
          </DialogHeader>

          {turnoAFinalizar && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-900">{turnoAFinalizar.servicio_nombre}</p>
                <p className="text-slate-600">Profesional: {turnoAFinalizar.empleado_nombre}</p>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-slate-600">Saldo a pagar</span>
                  <span className="text-xl font-bold text-amber-700">${getMontoPendiente(turnoAFinalizar).toFixed(0)}</span>
                </div>
              </div>

              {!qrPreferenceId ? (
                <Button onClick={generarQrFinalizacion} disabled={generandoQr} className="w-full">
                  {generandoQr ? 'Generando QR...' : 'Generar QR de Mercado Pago'}
                </Button>
              ) : (
                <div className="space-y-4">
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
                  {qrStatusMessage && (
                    <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                      {qrStatusMessage}
                    </p>
                  )}
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <Label htmlFor="final-payment-code">Número de operación</Label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        id="final-payment-code"
                        value={qrPaymentCode}
                        onChange={(event) => setQrPaymentCode(event.target.value.replace(/\D/g, ''))}
                        placeholder="Ej: 1234567890"
                      />
                      <Button onClick={forzarPagoYFinalizar} disabled={!qrPaymentCode.trim() || finalizando} variant="outline">
                        {finalizando ? 'Forzando...' : 'Forzar pago'}
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-amber-800">
                      Usalo solo si el pago figura recibido en Mercado Pago.
                    </p>
                  </div>
                </div>
              )}
              {qrPaymentError && <p className="text-sm text-red-600">{qrPaymentError}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => cerrarPagoFinalizacion(false)} disabled={finalizando}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
