'use client';

import { AlertCircle, Calendar as CalendarIcon, Clock, CreditCard, DollarSign, Search, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface HorarioDisponible {
  disponible: boolean;
  horarios: string[];
  mensaje?: string;
}

interface ClienteLookupData {
  id: number;
  user?: {
    full_name?: string;
    email?: string;
    phone?: string;
    dni?: string;
  };
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export default function ReservarTurnoProfesionalPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Paso 1: Datos del cliente
  const [dni, setDni] = useState('');
  const [clienteRegistrado, setClienteRegistrado] = useState<boolean | null>(null);
  const [clienteData, setClienteData] = useState<ClienteLookupData | null>(null);
  const [clienteNombre, setClienteNombre] = useState('');
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

  // Paso 2: Servicio y horario
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<Servicio | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | undefined>(undefined);
  const [horariosDisponibles, setHorariosDisponibles] = useState<string[]>([]);
  const [horarioSeleccionado, setHorarioSeleccionado] = useState<string>('');
  const [horaSeleccionada, setHoraSeleccionada] = useState<string>('');
  const [minutoSeleccionado, setMinutoSeleccionado] = useState<string>('');
  const [loadingServicios, setLoadingServicios] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [profesionalInicializado, setProfesionalInicializado] = useState(false);
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>([]);

  // Paso 3: Pago
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'mercadopago_qr'>('efectivo');
  const [cobraSeniaFija, setCobraSeniaFija] = useState(true);
  const [pagarServicioCompleto, setPagarServicioCompleto] = useState(false);
  const [notasCliente, setNotasCliente] = useState('');

  // Estados de feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Pago con MP QR
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [preferenceId, setPreferenceId] = useState<string>('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const API_BASE_URL = '/api';

  useEffect(() => {
    const fetchServicios = async () => {
      setLoadingServicios(true);
      try {
        if (!user?.empleado_id) {
          setServicios([]);
          setServicioSeleccionado(null);
          setError('Tu usuario no está asociado a un profesional. Contactá al administrador del salón.');
          return;
        }

        const response = await apiClient.get<ApiResponse<EmpleadoServicio>>(
          `/empleados/${user.empleado_id}/servicios/`,
          {
            params: { page_size: 1000 },
          },
        );

        const data = response.data;
        const serviciosEmpleado: EmpleadoServicio[] = Array.isArray(data)
          ? data
          : Array.isArray(data.results)
            ? data.results
            : [];

        const serviciosData: Servicio[] = serviciosEmpleado
          .map((es) => es.servicio)
          .filter((s) => s && s.is_active);

        setServicios(serviciosData);
        if (serviciosData.length > 0) {
          setServicioSeleccionado(serviciosData[0]);
        } else {
          setServicioSeleccionado(null);
          setError('No hay servicios configurados para este profesional. Configuralos desde el panel de propietario.');
        }
      } catch (e) {
        console.error('Error cargando servicios', e);
        setServicios([]);
        setServicioSeleccionado(null);
        setError('No se pudieron cargar los servicios del profesional. Intentá de nuevo o contactá al administrador.');
      } finally {
        setLoadingServicios(false);
        setProfesionalInicializado(true);
      }
    };
    if (user) {
      fetchServicios();
    }
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
        setClienteNombre(data.cliente.user?.full_name || '');
        setClienteEmail(data.cliente.user?.email || '');
        setClienteTelefono(data.cliente.user?.phone || '');
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Error buscando cliente'));
    } finally {
      setCheckingDni(false);
    }
  };

  const handleBuscarPorDni = async () => {
    const dniLimpio = (dni || '').replace(/\D/g, '');
    if (dniLimpio.length !== 8) {
      setDniError('El DNI debe tener 8 dígitos numéricos');
      return;
    }
    await buscarClientePorDni(dniLimpio);
  };

  useEffect(() => {
    const dniLimpio = (dni || '').replace(/\D/g, '');

    if (!dniLimpio) {
      setDniError('');
      setClienteRegistrado(null);
      setClienteData(null);
      setTurnoExistenteCliente(null);
      setUltimoDniBuscado('');
      return;
    }

    if (!/^\d+$/.test(dniLimpio)) {
      setDniError('El DNI solo admite números');
      return;
    }

    if (dniLimpio.length > 8) {
      setDniError('El DNI debe tener 8 dígitos');
      return;
    }

    if (dniLimpio.length < 8) {
      setDniError('El DNI debe tener 8 dígitos numéricos');
      setClienteRegistrado(null);
      setClienteData(null);
      setTurnoExistenteCliente(null);
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
    const telefonoLimpio = (clienteTelefono || '').replace(/\D/g, '');
    if (!clienteTelefono) {
      setTelefonoError('');
      return;
    }

    if (telefonoLimpio.length < 8) {
      setTelefonoError('El teléfono debe tener al menos 8 dígitos');
      return;
    }

    if (telefonoLimpio.length > 15) {
      setTelefonoError('El teléfono no puede superar 15 dígitos');
      return;
    }

    setTelefonoError('');
  }, [clienteTelefono]);

  useEffect(() => {
    const email = (clienteEmail || '').trim().toLowerCase();

    if (!email) {
      setEmailError('');
      setEmailAsociado(false);
      return;
    }

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValido) {
      setEmailError('Ingresá un email válido');
      setEmailAsociado(false);
      return;
    }

    setEmailError('');
    const timer = setTimeout(async () => {
      try {
        const data = await profesionalTurnosApi.buscarClientePorEmail(email);
        if (data.registrado) {
          setEmailAsociado(true);
          setEmailError('este mail ya pertenece a un cliente asociado');
        } else {
          setEmailAsociado(false);
        }
      } catch {
        setEmailAsociado(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [clienteEmail]);

  const cargarDisponibilidadFecha = async (date: Date | undefined) => {
    if (!date || !servicioSeleccionado || !user?.empleado_id) {
      setHorariosDisponibles([]);
      setHorasDisponibles([]);
      return;
    }

    setLoadingHorarios(true);
    setError('');

    try {
      const fechaStr = format(date, 'yyyy-MM-dd');
      const res = await apiClient.get<HorarioDisponible>('/turnos/disponibilidad/', {
        params: {
          servicio: servicioSeleccionado.id,
          empleado: user.empleado_id,
          fecha: fechaStr,
        },
      });

      const disponibles = res.data.horarios || [];
      setHorariosDisponibles(disponibles);

      const horas = Array.from(new Set(disponibles.map((h) => h.split(':')[0])));
      setHorasDisponibles(horas);
    } catch (e) {
      console.error('Error obteniendo disponibilidad', e);
      setHorariosDisponibles([]);
      setHorasDisponibles([]);
      setError('No se pudo cargar la disponibilidad del profesional para esa fecha');
    } finally {
      setLoadingHorarios(false);
    }
  };

  const handleFechaChange = (date: Date | undefined) => {
    setFechaSeleccionada(date);
    setHorarioSeleccionado('');
    setHorariosDisponibles([]);
    setHorasDisponibles([]);
    setHoraSeleccionada('');
    setMinutoSeleccionado('');
    setError('');
    void cargarDisponibilidadFecha(date);
  };

  const handleConfirmarFechaHora = async () => {
    if (!profesionalInicializado || loadingServicios) {
      setError('Todavía se están cargando los datos del profesional. Esperá un momento.');
      return;
    }
    if (!fechaSeleccionada) {
      setError('Seleccioná una fecha para el turno');
      return;
    }
    if (!servicioSeleccionado) {
      setError('No se encontró el servicio asociado al profesional');
      return;
    }
    if (!horaSeleccionada || !minutoSeleccionado) {
      setError('Seleccioná una hora y minutos');
      return;
    }

    const horaStr = `${horaSeleccionada.padStart(2, '0')}:${minutoSeleccionado.padStart(2, '0')}`;

    if (!horariosDisponibles.includes(horaStr)) {
      setHorarioSeleccionado('');
      setError('Ese horario no está disponible. Elegí uno libre en la agenda del profesional.');
      return;
    }

    setHorarioSeleccionado(horaStr);
    setError('');
  };

  const precioServicio = servicioSeleccionado ? parseFloat(servicioSeleccionado.precio) || 0 : 0;
  const porcentajeSena = servicioSeleccionado ? parseFloat(servicioSeleccionado.porcentaje_sena) || 0 : 0;
  const montoSeniaFijo = !servicioSeleccionado
    ? 0
    : (precioServicio * porcentajeSena) / 100;

  const submitEfectivo = async () => {
    if (!user?.empleado_id) {
      setError('No se encontró el profesional asociado al usuario logueado');
      return;
    }
    if (dniError || telefonoError || emailError || emailAsociado) {
      setError('Revisá los datos del cliente antes de confirmar la reserva');
      return;
    }
    if (!servicioSeleccionado || !fechaSeleccionada || !horarioSeleccionado) {
      setError('Completa servicio, fecha y horario');
      return;
    }

    const fechaStr = format(fechaSeleccionada, "yyyy-MM-dd'T'") + horarioSeleccionado + ':00';

    const payload: ReservaStaffPayload = {
      servicio: servicioSeleccionado.id,
      empleado: user.empleado_id,
      fecha_hora: fechaStr,
      notas_cliente: notasCliente,
      metodo_pago: 'efectivo',
      paga_servicio_completo: pagarServicioCompleto,
      tipo_pago: pagarServicioCompleto ? 'PAGO_COMPLETO' : 'SENIA',
      monto_senia: pagarServicioCompleto ? precioServicio : Number(montoSeniaFijo || 0),
    };

    if (clienteRegistrado && clienteData) {
      payload.cliente_id = clienteData.id;
    } else {
      payload.dni = dni || undefined;
      payload.email = clienteEmail || undefined;
      payload.nombre = clienteNombre || undefined;
      payload.telefono = clienteTelefono || undefined;
    }

    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const data = await profesionalTurnosApi.reservarStaff(payload);
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
      setError('No se encontró el profesional asociado al usuario logueado');
      return;
    }
    if (dniError || telefonoError || emailError || emailAsociado) {
      setError('Revisá los datos del cliente antes de confirmar la reserva');
      return;
    }
    if (!servicioSeleccionado || !fechaSeleccionada || !horarioSeleccionado) {
      setError('Completa servicio, fecha y horario');
      return;
    }

    const fechaStr = format(fechaSeleccionada, "yyyy-MM-dd'T'") + horarioSeleccionado + ':00';

    const payload: PreferenciaStaffPayload = {
      servicio_id: servicioSeleccionado.id,
      empleado_id: user.empleado_id,
      fecha_hora: fechaStr,
      notas_cliente: notasCliente,
      usar_sena: cobraSeniaFija,
      tipo_pago: cobraSeniaFija ? 'SENIA' : 'PAGO_COMPLETO',
    };

    if (clienteRegistrado && clienteData) {
      payload.cliente_id = clienteData.id;
      payload.dni = clienteData.user?.dni;
      payload.email = clienteData.user?.email;
      payload.nombre = clienteData.user?.full_name;
      payload.telefono = clienteData.user?.phone;
    } else {
      payload.dni = dni || undefined;
      payload.email = clienteEmail || undefined;
      payload.nombre = clienteNombre || undefined;
      payload.telefono = clienteTelefono || undefined;
    }

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
          const res = await fetch(
            `${API_BASE_URL}/mercadopago/verificar-pago/${pref.preference_id}/`,
          );
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
          // ignorar en polling
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

  const puedeConfirmar = Boolean(
    servicioSeleccionado &&
    fechaSeleccionada &&
    horarioSeleccionado &&
    !dniError &&
    !telefonoError &&
    !emailError &&
    !emailAsociado &&
    (clienteRegistrado || clienteNombre || clienteEmail || clienteTelefono || dni),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reservar turno</h1>
            <p className="text-gray-600 mt-1">
              Generá un turno para tu cliente desde el salón.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {servicioSeleccionado && (
          <Alert>
            <AlertDescription>
              El turno se reservará para tu servicio asociado:{' '}
              <span className="font-semibold">{servicioSeleccionado.nombre}</span>.
            </AlertDescription>
          </Alert>
        )}
        {!loadingServicios && profesionalInicializado && !servicioSeleccionado && !error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              No se encontró un servicio asociado al profesional. Configuralo desde el panel de propietario.
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
            <AlertTitle>Listo</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                Datos del cliente
              </CardTitle>
              <CardDescription>
                Buscá por DNI o completá los datos básicos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="dni">DNI</Label>
                  <Input
                    id="dni"
                    placeholder="Ej: 12345678"
                    value={dni}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setDni(val);
                    }}
                  />
                  {dniError && <p className="text-xs text-red-600 mt-1">{dniError}</p>}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBuscarPorDni}
                  disabled={checkingDni || (dni || '').replace(/\D/g, '').length !== 8}
                  className="flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  {checkingDni ? 'Buscando...' : 'Buscar'}
                </Button>
              </div>

              {clienteRegistrado === true && clienteData && (
                <Alert>
                  <AlertTitle>Cliente registrado</AlertTitle>
                  <AlertDescription>
                    Se encontró un cliente con este DNI. Podés continuar o editar los datos si hace falta.
                  </AlertDescription>
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
                    {turnoExistenteCliente.servicio_nombre
                      ? ` (${turnoExistenteCliente.servicio_nombre})`
                      : ''}
                    .
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

              {clienteRegistrado === false && (
                <Alert>
                  <AlertTitle>Cliente no encontrado</AlertTitle>
                  <AlertDescription>
                    Podés continuar como nuevo cliente (walk-in) completando los datos.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre y apellido</Label>
                <Input
                  id="nombre"
                  placeholder="Ej: Ana Pérez"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="cliente@ejemplo.com"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                />
                {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  placeholder="Ej: 11 2345 6789"
                  value={clienteTelefono}
                  onChange={(e) => {
                    const normalizado = e.target.value.replace(/[^\d+\s()-]/g, '');
                    setClienteTelefono(normalizado);
                  }}
                />
                {telefonoError && <p className="text-xs text-red-600 mt-1">{telefonoError}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Servicio y horario
              </CardTitle>
              <CardDescription>
                Elegí la fecha y un horario disponible para tu servicio asociado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaSeleccionada
                        ? format(fechaSeleccionada, "d 'de' MMMM yyyy", { locale: es })
                        : 'Seleccioná una fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fechaSeleccionada}
                      onSelect={handleFechaChange}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Horario</Label>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="space-y-1">
                    <span className="text-xs text-gray-500">Hora</span>
                    <Select
                      value={horaSeleccionada}
                      onValueChange={(value) => {
                        setHoraSeleccionada(value);
                        setMinutoSeleccionado('');
                        setHorarioSeleccionado('');
                      }}
                      disabled={!fechaSeleccionada || loadingHorarios}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="HH" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }).map((_, idx) => {
                          const h = idx.toString().padStart(2, '0');
                          const horaHabilitada = horasDisponibles.includes(h);
                          return (
                            <SelectItem key={h} value={h} disabled={!horaHabilitada}>
                              {h}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-gray-500">Minutos</span>
                    <Select
                      value={minutoSeleccionado}
                      onValueChange={(value) => {
                        setMinutoSeleccionado(value);
                        setHorarioSeleccionado('');
                      }}
                      disabled={!horaSeleccionada || loadingHorarios}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent>
                        {['00', '15', '30', '45'].map((m) => (
                          <SelectItem
                            key={m}
                            value={m}
                            disabled={!horariosDisponibles.includes(`${horaSeleccionada || '00'}:${m}`)}
                          >
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleConfirmarFechaHora}
                      disabled={loadingHorarios}
                      className="w-full flex items-center gap-2"
                    >
                      <Clock className="w-3 h-3" />
                      {loadingHorarios ? 'Verificando...' : 'Confirmar fecha y hora'}
                    </Button>
                  </div>
                </div>
                {horarioSeleccionado && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Horario confirmado: {horarioSeleccionado} hs
                  </p>
                )}
                {!!fechaSeleccionada && !loadingHorarios && horariosDisponibles.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    No hay horarios disponibles para esa fecha con este servicio.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notas para el turno</Label>
                <Textarea
                  placeholder="Ej: Prefiere rubio frío, viene con foto de referencia..."
                  value={notasCliente}
                  onChange={(e) => setNotasCliente(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Pago en salón
            </CardTitle>
            <CardDescription>
              Elegí si cobrás seña o el servicio completo y cómo se paga.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Cobrar seña fija
                </Label>
                <p className="text-sm text-gray-500">
                  Usa automáticamente el porcentaje de seña del servicio.
                </p>
              </div>
              <Switch
                checked={cobraSeniaFija}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setCobraSeniaFija(true);
                    setPagarServicioCompleto(false);
                  } else {
                    setCobraSeniaFija(false);
                    setPagarServicioCompleto(true);
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Cobrar servicio completo
                </Label>
                <p className="text-sm text-gray-500">
                  Si lo activás, se registra que el cliente paga ahora el 100% del servicio.
                </p>
              </div>
              <Switch
                checked={pagarServicioCompleto}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setPagarServicioCompleto(true);
                    setCobraSeniaFija(false);
                  } else {
                    setPagarServicioCompleto(false);
                    setCobraSeniaFija(true);
                  }
                }}
              />
            </div>

            {cobraSeniaFija && (
              <div className="space-y-2">
                <Label>Monto de seña (fijo)</Label>
                <Input value={formatCurrency(montoSeniaFijo)} readOnly disabled />
              </div>
            )}

            {pagarServicioCompleto && (
              <div className="space-y-2">
                <Label>Monto total del servicio</Label>
                <Input value={formatCurrency(precioServicio)} readOnly disabled />
              </div>
            )}

            <div className="space-y-2">
              <Label>Método de pago</Label>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant={metodoPago === 'efectivo' ? 'default' : 'outline'}
                  onClick={() => setMetodoPago('efectivo')}
                >
                  Efectivo / Caja
                </Button>
                <Button
                  type="button"
                  variant={metodoPago === 'mercadopago_qr' ? 'default' : 'outline'}
                  onClick={() => setMetodoPago('mercadopago_qr')}
                >
                  QR Mercado Pago
                </Button>
              </div>
            </div>

            {metodoPago === 'mercadopago_qr' && (
              <Alert>
                <AlertTitle>Pago con QR</AlertTitle>
                <AlertDescription>
                  Se generará un link/QR para que el cliente lo escanee con la app de Mercado Pago. Cuando el pago se apruebe, el turno se crea automáticamente.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard/profesional/agenda')}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!puedeConfirmar || isSubmitting || isWaitingPayment}
                onClick={metodoPago === 'efectivo' ? submitEfectivo : submitQr}
              >
                {isSubmitting || isWaitingPayment
                  ? 'Procesando...'
                  : metodoPago === 'efectivo'
                    ? 'Reservar y registrar pago'
                    : 'Generar QR y reservar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
