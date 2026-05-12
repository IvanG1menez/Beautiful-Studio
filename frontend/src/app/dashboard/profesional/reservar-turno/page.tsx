'use client';

import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Mail,
  Phone,
  QrCode,
  Search,
  User as UserIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';

import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import apiClient from '@/services/api';
import {
  PreferenciaStaffPayload,
  profesionalTurnosApi,
  ReservaStaffPayload,
} from '@/services/profesionalTurnos';
import { ApiResponse, EmpleadoServicio, Servicio } from '@/types';

interface HorarioDisponible {
  disponible: boolean;
  horarios: string[];
  mensaje?: string;
}

interface ClienteLookupData {
  id: number;
  user?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    dni?: string;
  };
}

type MetodoPago = 'efectivo' | 'mercadopago_qr';
type TipoPago = 'PAGO_COMPLETO' | 'SENIA';
type ServicioReserva = Servicio & {
  porcentaje_sena?: string | number;
  monto_sena_fijo?: string | number;
};

const API_BASE_URL = '/api';
const HORARIOS_REFERENCIA = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
];

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const isPastOrSunday = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const candidate = new Date(date);
  candidate.setHours(0, 0, 0, 0);

  return candidate < today || candidate.getDay() === 0;
};

export default function ReservarTurnoProfesionalPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [dni, setDni] = useState('');
  const [clienteRegistrado, setClienteRegistrado] = useState<boolean | null>(null);
  const [clienteData, setClienteData] = useState<ClienteLookupData | null>(null);
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteApellido, setClienteApellido] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [checkingDni, setCheckingDni] = useState(false);
  const [dniError, setDniError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [telefonoError, setTelefonoError] = useState('');
  const [emailAsociado, setEmailAsociado] = useState(false);
  const [ultimoDniBuscado, setUltimoDniBuscado] = useState('');
  const [turnoExistenteCliente, setTurnoExistenteCliente] = useState<{
    id: number;
    fecha_hora: string;
    estado_display: string;
    servicio_nombre?: string;
  } | null>(null);

  const [servicioSeleccionado, setServicioSeleccionado] = useState<ServicioReserva | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | undefined>(undefined);
  const [horariosDisponibles, setHorariosDisponibles] = useState<string[]>([]);
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [minutoSeleccionado, setMinutoSeleccionado] = useState('');
  const [loadingServicios, setLoadingServicios] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [profesionalInicializado, setProfesionalInicializado] = useState(false);
  const [notasCliente, setNotasCliente] = useState('');

  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [tipoPago, setTipoPago] = useState<TipoPago>('PAGO_COMPLETO');
  const [montoRecibido, setMontoRecibido] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [preferenceId, setPreferenceId] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clienteBloqueado = clienteRegistrado === true && Boolean(clienteData);
  const horarioSeleccionado = horaSeleccionada && minutoSeleccionado
    ? `${horaSeleccionada}:${minutoSeleccionado}`
    : '';
  const horarioDisponible = Boolean(
    fechaSeleccionada &&
    horarioSeleccionado &&
    horariosDisponibles.includes(horarioSeleccionado),
  );
  const horarioNoDisponible = Boolean(
    fechaSeleccionada &&
    horarioSeleccionado &&
    !loadingHorarios &&
    !horarioDisponible,
  );

  const precioServicio = servicioSeleccionado ? parseFloat(servicioSeleccionado.precio) || 0 : 0;
  const porcentajeSena = servicioSeleccionado ? Number(servicioSeleccionado.porcentaje_sena) || 0 : 0;
  const montoSeniaFijo = servicioSeleccionado ? Number(servicioSeleccionado.monto_sena_fijo) || 0 : 0;
  const montoSenia = montoSeniaFijo > 0 ? montoSeniaFijo : (precioServicio * porcentajeSena) / 100;
  const montoACobrar = tipoPago === 'PAGO_COMPLETO' ? precioServicio : montoSenia;
  const montoRecibidoNumerico = Number(montoRecibido.replace(',', '.')) || 0;
  const vuelto = Math.max(0, montoRecibidoNumerico - montoACobrar);
  const pagoExacto = metodoPago === 'efectivo' && tipoPago === 'PAGO_COMPLETO' && montoRecibidoNumerico === montoACobrar && montoACobrar > 0;
  const nombreIncompleto = clienteRegistrado === false && !clienteNombre.trim();
  const apellidoIncompleto = clienteRegistrado === false && !clienteApellido.trim();
  const telefonoIncompleto = clienteRegistrado === false && !clienteTelefono.trim();
  const horariosParaMostrar = Array.from(new Set([...HORARIOS_REFERENCIA, ...horariosDisponibles])).sort();

  useEffect(() => {
    const fetchServicios = async () => {
      setLoadingServicios(true);
      try {
        if (!user?.empleado_id) {
          setServicioSeleccionado(null);
          setError('Tu usuario no esta asociado a un profesional. Contacta al administrador del salon.');
          return;
        }

        const response = await apiClient.get<ApiResponse<EmpleadoServicio>>(
          `/empleados/${user.empleado_id}/servicios/`,
          { params: { page_size: 1000 } },
        );

        const data = response.data;
        const serviciosEmpleado: EmpleadoServicio[] = Array.isArray(data)
          ? data
          : Array.isArray(data.results)
            ? data.results
            : [];

        const serviciosData: ServicioReserva[] = serviciosEmpleado
          .map((empleadoServicio) => empleadoServicio.servicio)
          .filter((servicio): servicio is ServicioReserva => Boolean(servicio && servicio.is_active));

        setServicioSeleccionado(serviciosData[0] || null);
        if (serviciosData.length === 0) {
          setError('No hay servicios configurados para este profesional. Configuralos desde el panel de propietario.');
        }
      } catch (e) {
        console.error('Error cargando servicios', e);
        setServicioSeleccionado(null);
        setError('No se pudieron cargar los servicios del profesional. Intenta de nuevo o contacta al administrador.');
      } finally {
        setLoadingServicios(false);
        setProfesionalInicializado(true);
      }
    };

    if (user) void fetchServicios();
  }, [user]);

  const buscarClientePorDni = async (dniLimpio: string) => {
    setCheckingDni(true);
    setError('');
    setDniError('');
    setClienteRegistrado(null);
    setTurnoExistenteCliente(null);

    try {
      const data = await profesionalTurnosApi.buscarClientePorDni(dniLimpio);
      setClienteRegistrado(data.registrado);
      setClienteData(data.cliente);
      setTurnoExistenteCliente(data.turno_existente || null);
      setUltimoDniBuscado(dniLimpio);

      if (data.registrado && data.cliente) {
        const firstName = data.cliente.user?.first_name || '';
        const lastName = data.cliente.user?.last_name || '';
        setClienteNombre(firstName || data.cliente.user?.full_name || '');
        setClienteApellido(lastName);
        setClienteEmail(data.cliente.user?.email || '');
        setClienteTelefono(data.cliente.user?.phone || '');
      } else {
        setClienteData(null);
        setClienteApellido('');
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Error buscando cliente'));
    } finally {
      setCheckingDni(false);
    }
  };

  const handleBuscarPorDni = async () => {
    const dniLimpio = dni.replace(/\D/g, '');
    if (dniLimpio.length !== 8) {
      setDniError('El DNI debe tener 8 digitos numericos');
      return;
    }
    await buscarClientePorDni(dniLimpio);
  };

  useEffect(() => {
    const dniLimpio = dni.replace(/\D/g, '');

    if (!dniLimpio) {
      setDniError('');
      setClienteRegistrado(null);
      setClienteData(null);
      setTurnoExistenteCliente(null);
      setUltimoDniBuscado('');
      setClienteApellido('');
      return;
    }

    if (dniLimpio.length < 8) {
      setDniError('El DNI debe tener 8 digitos numericos');
      setClienteRegistrado(null);
      setClienteData(null);
      setTurnoExistenteCliente(null);
      setClienteApellido('');
      return;
    }

    setDniError('');
    if (ultimoDniBuscado === dniLimpio) return;

    const timer = setTimeout(() => {
      void buscarClientePorDni(dniLimpio);
    }, 350);

    return () => clearTimeout(timer);
  }, [dni, ultimoDniBuscado]);

  useEffect(() => {
    const telefonoLimpio = clienteTelefono.replace(/\D/g, '');
    if (!clienteTelefono) {
      setTelefonoError('');
      return;
    }
    if (telefonoLimpio.length < 8) {
      setTelefonoError('El telefono debe tener al menos 8 digitos');
      return;
    }
    if (telefonoLimpio.length > 15) {
      setTelefonoError('El telefono no puede superar 15 digitos');
      return;
    }
    setTelefonoError('');
  }, [clienteTelefono]);

  useEffect(() => {
    const email = clienteEmail.trim().toLowerCase();
    if (!email || clienteBloqueado) {
      setEmailError('');
      setEmailAsociado(false);
      return;
    }

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValido) {
      setEmailError('Ingresa un email valido');
      setEmailAsociado(false);
      return;
    }

    setEmailError('');
    const timer = setTimeout(async () => {
      try {
        const data = await profesionalTurnosApi.buscarClientePorEmail(email);
        if (data.registrado) {
          setEmailAsociado(true);
          setEmailError('Este mail ya pertenece a un cliente asociado');
        } else {
          setEmailAsociado(false);
        }
      } catch {
        setEmailAsociado(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [clienteEmail, clienteBloqueado]);

  const cargarDisponibilidadFecha = useCallback(async (date: Date | undefined) => {
    if (!date || !servicioSeleccionado || !user?.empleado_id || isPastOrSunday(date)) {
      setHorariosDisponibles([]);
      return;
    }

    setLoadingHorarios(true);
    setError('');

    try {
      const res = await apiClient.get<HorarioDisponible>('/turnos/disponibilidad/', {
        params: {
          servicio: servicioSeleccionado.id,
          empleado: user.empleado_id,
          fecha: format(date, 'yyyy-MM-dd'),
        },
      });

      setHorariosDisponibles(res.data.horarios || []);
    } catch (e) {
      console.error('Error obteniendo disponibilidad', e);
      setHorariosDisponibles([]);
      setError('No se pudo cargar la disponibilidad del profesional para esa fecha');
    } finally {
      setLoadingHorarios(false);
    }
  }, [servicioSeleccionado, user?.empleado_id]);

  const handleFechaChange = (date: Date | undefined) => {
    setFechaSeleccionada(date);
    setHoraSeleccionada('');
    setMinutoSeleccionado('');
    setHorariosDisponibles([]);
    setError('');
  };

  const handleHorarioClick = (horario: string) => {
    const [hora, minuto] = horario.split(':');
    setHoraSeleccionada(hora);
    setMinutoSeleccionado(minuto);
  };

  useEffect(() => {
    if (fechaSeleccionada) void cargarDisponibilidadFecha(fechaSeleccionada);
    setHoraSeleccionada('');
    setMinutoSeleccionado('');
  }, [cargarDisponibilidadFecha, fechaSeleccionada]);

  useEffect(() => {
    if (tipoPago !== 'PAGO_COMPLETO' || metodoPago !== 'efectivo') {
      setMontoRecibido('');
    }
  }, [tipoPago, metodoPago]);

  const fechaHoraIso = () => {
    if (!fechaSeleccionada || !horarioSeleccionado) return '';
    return `${format(fechaSeleccionada, "yyyy-MM-dd'T'")}${horarioSeleccionado}:00`;
  };

  const buildClientePayload = (
    payload: ReservaStaffPayload | PreferenciaStaffPayload,
  ) => {
    if (clienteRegistrado && clienteData) {
      payload.cliente_id = clienteData.id;
      return;
    }

    payload.dni = dni || undefined;
    payload.email = clienteEmail || undefined;
    payload.nombre = `${clienteNombre} ${clienteApellido}`.trim() || undefined;
    payload.telefono = clienteTelefono || undefined;
  };

  const datosClienteCompletos = clienteRegistrado
    ? Boolean(clienteData)
    : Boolean(dni && clienteNombre.trim() && clienteApellido.trim() && clienteTelefono.trim());

  const pagoCompletoValido =
    metodoPago !== 'efectivo' ||
    tipoPago !== 'PAGO_COMPLETO' ||
    montoRecibidoNumerico >= montoACobrar;

  const puedeConfirmar = Boolean(
    profesionalInicializado &&
    !loadingServicios &&
    !loadingHorarios &&
    servicioSeleccionado &&
    fechaSeleccionada &&
    horarioDisponible &&
    datosClienteCompletos &&
    pagoCompletoValido &&
    !dniError &&
    !telefonoError &&
    !emailError &&
    !emailAsociado,
  );

  const submitEfectivo = async () => {
    if (!user?.empleado_id) {
      setError('No se encontro el profesional asociado al usuario logueado');
      return;
    }
    if (!puedeConfirmar || !servicioSeleccionado) {
      setError('Completa los campos requeridos y elegi un horario disponible');
      return;
    }

    const payload: ReservaStaffPayload = {
      servicio: servicioSeleccionado.id,
      empleado: user.empleado_id,
      fecha_hora: fechaHoraIso(),
      notas_cliente: notasCliente,
      metodo_pago: 'efectivo',
      paga_servicio_completo: tipoPago === 'PAGO_COMPLETO',
      tipo_pago: tipoPago,
      monto_senia: montoACobrar,
    };
    buildClientePayload(payload);

    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      await profesionalTurnosApi.reservarStaff(payload);
      setSuccessMessage('Turno reservado correctamente');
      router.push('/dashboard/profesional/agenda');
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Error al reservar turno'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitQr = async () => {
    if (!user?.empleado_id) {
      setError('No se encontro el profesional asociado al usuario logueado');
      return;
    }
    if (!puedeConfirmar || !servicioSeleccionado) {
      setError('Completa los campos requeridos y elegi un horario disponible');
      return;
    }

    const payload: PreferenciaStaffPayload = {
      servicio_id: servicioSeleccionado.id,
      empleado_id: user.empleado_id,
      fecha_hora: fechaHoraIso(),
      notas_cliente: notasCliente,
      usar_sena: tipoPago === 'SENIA',
      tipo_pago: tipoPago,
    };
    buildClientePayload(payload);

    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const pref = await profesionalTurnosApi.crearPreferenciaStaff(payload);
      setPreferenceId(pref.preference_id);
      setIsWaitingPayment(true);
      window.open(pref.init_point, '_blank');

      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/mercadopago/verificar-pago/${pref.preference_id}/`);
          if (res.ok) {
            const body = await res.json();
            if (body.status === 'approved') {
              clearInterval(pollingRef.current!);
              pollingRef.current = null;
              setIsWaitingPayment(false);
              setSuccessMessage('Pago aprobado y turno creado');
              router.push('/dashboard/profesional/agenda');
            }
          }
        } catch {
          // El polling reintenta hasta que Mercado Pago confirme o el usuario salga.
        }
      }, 3000);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Error al iniciar pago por QR'));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reserva Rapida</h1>
            <p className="mt-1 text-gray-600">Genera un turno para tu cliente desde el salon.</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {servicioSeleccionado && (
          <Alert className="border-red-200 bg-red-50 text-red-950">
            <AlertDescription>
              <span className="block text-sm">El turno se reservara para el servicio seleccionado:</span>
              <span className="mt-2 block font-semibold">{servicioSeleccionado.nombre}</span>
            </AlertDescription>
          </Alert>
        )}

        {!loadingServicios && profesionalInicializado && !servicioSeleccionado && !error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              No se encontro un servicio asociado al profesional. Configuralo desde el panel de propietario.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Listo</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-lg border-gray-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserIcon className="h-4 w-4" />
                Datos del cliente
              </CardTitle>
              <CardDescription>Busca por DNI o completa los datos manualmente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dni">DNI</Label>
                <div className="relative">
                  <Input
                    id="dni"
                    placeholder="Ej: 12345678"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={handleBuscarPorDni}
                    disabled={checkingDni || dni.replace(/\D/g, '').length !== 8}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Buscar DNI"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
                {checkingDni && <p className="text-xs text-slate-500">Buscando cliente...</p>}
                {dniError && <p className="text-xs text-red-600">{dniError}</p>}
              </div>

              {clienteRegistrado === true && clienteData && (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Cliente registrado</AlertTitle>
                  <AlertDescription>Los datos se completaron desde la base y quedaron bloqueados.</AlertDescription>
                </Alert>
              )}

              {clienteRegistrado === false && (
                <Alert className="border-orange-200 bg-orange-50 text-orange-900">
                  <AlertCircle className="h-4 w-4 text-orange-700" />
                  <AlertTitle>Cliente no registrado</AlertTitle>
                  <AlertDescription>Los beneficios de lealtad no se aplicaran</AlertDescription>
                </Alert>
              )}

              {turnoExistenteCliente && (
                <Alert variant="destructive">
                  <AlertTitle>Advertencia de reserva duplicada</AlertTitle>
                  <AlertDescription>
                    Este cliente ya tiene un turno reservado para{' '}
                    <span className="font-semibold">
                      {format(new Date(turnoExistenteCliente.fecha_hora), "d 'de' MMMM yyyy HH:mm", { locale: es })}
                    </span>
                    {turnoExistenteCliente.servicio_nombre ? ` (${turnoExistenteCliente.servicio_nombre})` : ''}.
                  </AlertDescription>
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(
                          `/dashboard/profesional/agenda?fecha=${format(new Date(turnoExistenteCliente.fecha_hora), 'yyyy-MM-dd')}`,
                        )
                      }
                    >
                      Ver en agenda
                    </Button>
                  </div>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre y apellido *</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    id="nombre"
                    placeholder="Nombre"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    disabled={clienteBloqueado}
                    className={nombreIncompleto ? 'border-red-300 focus-visible:ring-red-200' : ''}
                  />
                  <Input
                    id="apellido"
                    placeholder="Apellido"
                    value={clienteApellido}
                    onChange={(e) => setClienteApellido(e.target.value)}
                    disabled={clienteBloqueado}
                    className={apellidoIncompleto ? 'border-red-300 focus-visible:ring-red-200' : ''}
                  />
                </div>
                {(nombreIncompleto || apellidoIncompleto) && (
                  <p className="text-xs text-red-600">Campo obligatorio para gestionar el turno</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email opcional</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="cliente@ejemplo.com"
                    value={clienteEmail}
                    onChange={(e) => setClienteEmail(e.target.value)}
                    disabled={clienteBloqueado}
                    className="pl-9"
                  />
                </div>
                {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Telefono *</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="telefono"
                    placeholder="+54 9 11 2345-6789"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value.replace(/[^\d+\s()-]/g, ''))}
                    disabled={clienteBloqueado}
                    className={`pl-9 ${telefonoIncompleto ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                  />
                </div>
                {telefonoIncompleto && <p className="text-xs text-red-600">Obligatorio para avisar en caso de imprevistos</p>}
                {telefonoError && <p className="mt-1 text-xs text-red-600">{telefonoError}</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-gray-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarIcon className="h-4 w-4" />
                Servicio y horario
              </CardTitle>
              <CardDescription>Elige la fecha y horario disponible para el servicio seleccionado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-10 w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaSeleccionada
                        ? format(fechaSeleccionada, 'dd/MM/yyyy')
                        : 'Selecciona una fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fechaSeleccionada}
                      onSelect={handleFechaChange}
                      disabled={isPastOrSunday}
                    />
                  </PopoverContent>
                </Popover>
                {fechaSeleccionada?.getDay() === 0 && (
                  <p className="text-xs text-amber-700">Los domingos el salon permanece cerrado.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Horario</Label>
                <div className="max-h-52 overflow-y-auto pr-2">
                  <div className="grid grid-cols-3 gap-2">
                    {horariosParaMostrar.map((horario) => {
                      const disponible = horariosDisponibles.includes(horario);
                      const seleccionado = horarioSeleccionado === horario;

                      return (
                        <Button
                          key={horario}
                          type="button"
                          variant="outline"
                          disabled={!fechaSeleccionada || loadingHorarios || !disponible}
                          onClick={() => handleHorarioClick(horario)}
                          className={`h-9 rounded-md text-sm font-medium ${
                            seleccionado
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-50'
                              : disponible
                                ? 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                                : 'border-slate-200 bg-slate-100 text-slate-400'
                          }`}
                        >
                          {horario}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {loadingHorarios && (
                  <p className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    Verificando disponibilidad...
                  </p>
                )}
                {horarioDisponible && (
                  <p className="text-xs font-medium text-emerald-700">Disponible</p>
                )}
                {horarioNoDisponible && (
                  <p className="text-xs font-medium text-red-600">No disponible</p>
                )}
                {!!fechaSeleccionada && !loadingHorarios && horariosDisponibles.length === 0 && (
                  <p className="text-xs text-amber-700">No hay horarios disponibles para esa fecha.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notas">Notas para el turno</Label>
                <Textarea
                  id="notas"
                  placeholder="Ej: Prefiere rubio frio, viene con foto de referencia..."
                  value={notasCliente}
                  onChange={(e) => setNotasCliente(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-slate-500">Estas notas seran visibles en la agenda el dia del turno</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-lg border-gray-200 bg-white shadow-sm">
          <CardHeader className="space-y-3 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              Pago en salon
            </CardTitle>
            <CardDescription>Elige como quiere pagar el cliente y el monto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3">
                <Label>Metodo de pago</Label>
                <button
                  type="button"
                  onClick={() => setMetodoPago('efectivo')}
                  className={`flex w-full items-center gap-3 rounded-md border p-4 text-left transition ${
                    metodoPago === 'efectivo'
                      ? 'border-violet-500 bg-violet-50 text-violet-900'
                      : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  <span className="font-medium">Efectivo / Caja</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMetodoPago('mercadopago_qr')}
                  className={`flex w-full items-start gap-3 rounded-md border p-4 text-left transition ${
                    metodoPago === 'mercadopago_qr'
                      ? 'border-violet-500 bg-violet-50 text-violet-900'
                      : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <QrCode className="mt-0.5 h-4 w-4" />
                  <span>
                    <span className="block font-medium">QR Mercado Pago</span>
                    <span className="text-xs text-slate-500">Transferencia o QR</span>
                  </span>
                </button>
              </div>

              <div className="space-y-3">
                <Label>Tipo de pago</Label>
                <div className="rounded-md bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">Precio del servicio</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{formatCurrency(precioServicio)}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setTipoPago('PAGO_COMPLETO')}
                  className={`flex w-full items-center justify-between rounded-md border p-4 text-left transition ${
                    tipoPago === 'PAGO_COMPLETO'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>
                    <span className="block font-medium">Cobrar servicio completo</span>
                    <span className="text-sm text-slate-600">El cliente paga ahora el 100% del servicio</span>
                  </span>
                  <span className={`h-4 w-4 rounded-full border ${tipoPago === 'PAGO_COMPLETO' ? 'border-emerald-500 bg-emerald-500 ring-4 ring-emerald-100' : 'border-slate-300'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setTipoPago('SENIA')}
                  className={`flex w-full items-center justify-between rounded-md border p-4 text-left transition ${
                    tipoPago === 'SENIA'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>
                    <span className="block font-medium">Cobrar sena fija ({porcentajeSena || 50}%)</span>
                    <span className="text-sm text-slate-600">Sena automatica de {formatCurrency(montoSenia)}</span>
                  </span>
                  <span className={`h-4 w-4 rounded-full border ${tipoPago === 'SENIA' ? 'border-emerald-500 bg-emerald-500 ring-4 ring-emerald-100' : 'border-slate-300'}`} />
                </button>

                {metodoPago === 'efectivo' && tipoPago === 'PAGO_COMPLETO' && (
                  <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4">
                    <Label htmlFor="monto-recibido">Monto recibido</Label>
                    <Input
                      id="monto-recibido"
                      inputMode="decimal"
                      placeholder="Cuanto pago el cliente?"
                      value={montoRecibido}
                      onChange={(e) => setMontoRecibido(e.target.value.replace(/[^\d.,]/g, ''))}
                      className="mt-2 border-yellow-300 bg-yellow-50 focus-visible:ring-yellow-200"
                    />
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-slate-600">Vuelto</span>
                      <span className="font-semibold text-slate-950">{formatCurrency(vuelto)}</span>
                    </div>
                    {pagoExacto && (
                      <p className="mt-2 text-sm font-medium text-emerald-700">
                        Pago exacto - Marcar como Pagado Total
                      </p>
                    )}
                    {montoRecibidoNumerico > 0 && montoRecibidoNumerico < montoACobrar && (
                      <p className="mt-2 text-sm text-red-600">El monto recibido no cubre el pago total.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {metodoPago === 'mercadopago_qr' && (
              <Alert>
                <AlertTitle>Pago con QR</AlertTitle>
                <AlertDescription>
                  Se generara un link para que el cliente pague con Mercado Pago. Cuando se apruebe, el turno se crea automaticamente.
                  {preferenceId ? ` Preferencia: ${preferenceId}` : ''}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/profesional/agenda')}
            className="h-11 min-w-28 bg-slate-100"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!puedeConfirmar || isSubmitting || isWaitingPayment}
            onClick={metodoPago === 'efectivo' ? submitEfectivo : submitQr}
            className="h-11"
          >
            {isSubmitting || isWaitingPayment
              ? 'Procesando...'
              : metodoPago === 'efectivo'
                ? 'Reservar y registrar pago'
                : 'Generar QR y reservar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
