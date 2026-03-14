'use client';

import { getAuthHeaders } from '@/lib/auth-headers';
import { AlertCircle, ArrowLeft, Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, Search, User, Wallet } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils';
import type { Billetera } from '@/types';

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string;
}

interface Servicio {
  id: number;
  nombre: string;
  descripcion: string;
  categoria: number;
  categoria_nombre: string;
  sala_nombre?: string;
  precio: string;
  porcentaje_sena: string;
  duracion_minutos: number;
  duracion_horas: string;
  is_active: boolean;
  // Descuentos de fidelización configurados en el servicio
  descuento_fidelizacion_pct?: string;
  descuento_fidelizacion_monto?: string;
}

interface HorarioDetallado {
  id: number;
  empleado: number;
  dia_semana: number;
  dia_semana_display: string;
  hora_inicio: string;
  hora_fin: string;
  is_active: boolean;
}

interface Empleado {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  especialidades: string;
  especialidad_display: string;
  is_disponible: boolean;
  horario_entrada: string;
  horario_salida: string;
  dias_trabajo: string;
  biografia: string;
  nivel_experiencia?: {
    nivel: number;
    nivel_display: string;
  };
  horarios_detallados?: HorarioDetallado[];
}

interface HorarioDisponible {
  disponible: boolean;
  empleado: string;
  servicio: string;
  fecha: string;
  horarios: string[];
  mensaje?: string;
}

export default function NuevoTurnoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estados del formulario
  const [step, setStep] = useState(1); // 1: Servicio, 2: Profesional, 3: Fecha/Hora, 4: Confirmación
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [horariosDisponibles, setHorariosDisponibles] = useState<string[]>([]);
  const [diasTrabajoEmpleado, setDiasTrabajoEmpleado] = useState<number[]>([]);

  // Selecciones
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number | null>(null);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<Servicio | null>(null);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<Empleado | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [horarioSeleccionado, setHorarioSeleccionado] = useState<string>('');
  const [notasCliente, setNotasCliente] = useState<string>('');

  // Estados de carga
  const [loading, setLoading] = useState(false);
  const [loadingServicios, setLoadingServicios] = useState(false);
  const [loadingEmpleados, setLoadingEmpleados] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Estados para billetera
  const [billetera, setBilletera] = useState<Billetera | null>(null);
  const [usarSaldo, setUsarSaldo] = useState(false);
  const [loadingBilletera, setLoadingBilletera] = useState(false);

  // Estados para dialog de confirmación
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [usarSaldoEnSena, setUsarSaldoEnSena] = useState(false);

  // Estados para el flujo de pago con Mercado Pago
  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [preferenceId, setPreferenceId] = useState<string>('');
  const [mpTabClosed, setMpTabClosed] = useState(false);
  // Ref para el intervalo de polling: persiste entre re-renders y evita duplicación
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref a la ventana de Mercado Pago para detectar si fue cerrada
  const mpWindowRef = useRef<Window | null>(null);
  const mpTabCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Estados para búsqueda y paginación de profesionales
  const [searchEmpleado, setSearchEmpleado] = useState('');
  const [filterEspecialidad, setFilterEspecialidad] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const empleadosPorPagina = 5;

  // Parámetros y estado provenientes de enlaces de fidelización
  const [isFromFidelizacion, setIsFromFidelizacion] = useState(false);
  const [servicioIdFromQuery, setServicioIdFromQuery] = useState<number | null>(null);
  const [empleadoIdFromQuery, setEmpleadoIdFromQuery] = useState<number | null>(null);
  const [horaFromQuery, setHoraFromQuery] = useState<string | null>(null);
  const [beneficioFromQuery, setBeneficioFromQuery] = useState<string | null>(null);

  // Base URL de la API
  const API_BASE_URL = '/api';

  // Detectar si venimos desde un enlace de fidelización y leer parámetros
  useEffect(() => {
    if (!searchParams) return;

    const fromFidelizacion = searchParams.get('fromFidelizacion');
    if (fromFidelizacion === '1') {
      setIsFromFidelizacion(true);

      const servicioIdParam = searchParams.get('servicio');
      const empleadoIdParam = searchParams.get('empleado');
      const fechaParam = searchParams.get('fecha');
      const horaParam = searchParams.get('hora');
      const beneficioParam = searchParams.get('beneficio');

      if (servicioIdParam) {
        const id = parseInt(servicioIdParam, 10);
        if (!Number.isNaN(id)) {
          setServicioIdFromQuery(id);
        }
      }

      if (empleadoIdParam) {
        const id = parseInt(empleadoIdParam, 10);
        if (!Number.isNaN(id)) {
          setEmpleadoIdFromQuery(id);
        }
      }

      if (fechaParam) {
        setFechaSeleccionada(fechaParam);
      }

      if (horaParam) {
        setHoraFromQuery(horaParam);
      }

      if (beneficioParam) {
        setBeneficioFromQuery(beneficioParam);
      }
    }
  }, [searchParams]);

  // Cargar categorías al montar
  useEffect(() => {
    fetchCategorias();
    loadBilleteraData();
  }, []);

  // Si venimos desde fidelización y tenemos un servicio en la URL, cargarlo directamente
  useEffect(() => {
    const loadServicioFromQuery = async () => {
      if (!isFromFidelizacion || !servicioIdFromQuery || servicioSeleccionado) return;

      try {
        const response = await fetch(`${API_BASE_URL}/servicios/${servicioIdFromQuery}/`, {
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const data: Servicio = await response.json();
          setServicioSeleccionado(data);
          setCategoriaSeleccionada(data.categoria);
        }
      } catch (error) {
        console.error('Error cargando servicio desde fidelización:', error);
      }
    };

    loadServicioFromQuery();
  }, [isFromFidelizacion, servicioIdFromQuery, servicioSeleccionado]);

  // Polling: verificar si el pago de MP fue aprobado (cada 3 segundos).
  // Se usa useRef para el intervalo: evita que el re-render destruya y re-cree
  // el setInterval (el bug del bucle infinito en React StrictMode).
  useEffect(() => {
    // Arrancar el polling solo si no hay uno ya corriendo
    if (isWaitingPayment && preferenceId) {
      if (pollingIntervalRef.current !== null) return;          // ya existe, no duplicar

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `${API_BASE_URL}/mercadopago/verificar-pago/${preferenceId}/`,
            { headers: getAuthHeaders() },
          );
          if (res.ok) {
            const payload = await res.json();
            if (payload.status === 'approved') {
              // Detener el polling y pasar al estado de éxito
              clearInterval(pollingIntervalRef.current!);
              pollingIntervalRef.current = null;
              setIsWaitingPayment(false);
              setSuccess(true);
            }
          }
        } catch {
          // Silenciar errores de red durante el polling
        }
      }, 3000);
    }

    // Si isWaitingPayment pasa a false (cancelación manual u otras rutas)
    // limpiamos cualquier intervalo activo
    if (!isWaitingPayment && pollingIntervalRef.current !== null) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (!isWaitingPayment && mpTabCheckRef.current !== null) {
      clearInterval(mpTabCheckRef.current);
      mpTabCheckRef.current = null;
    }

    // Cleanup al desmontar o al cambiar las deps
    return () => {
      if (pollingIntervalRef.current !== null) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (mpTabCheckRef.current !== null) {
        clearInterval(mpTabCheckRef.current);
        mpTabCheckRef.current = null;
      }
    };
  }, [isWaitingPayment, preferenceId]);

  // Cargar billetera del cliente
  const loadBilleteraData = async () => {
    try {
      setLoadingBilletera(true);
      const response = await fetch(`${API_BASE_URL}/clientes/me/billetera/`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setBilletera(data);
      }
    } catch (error) {
      console.error('Error loading billetera:', error);
    } finally {
      setLoadingBilletera(false);
    }
  };

  // Si venimos desde fidelización y el cliente tiene saldo, proponer usarlo en la seña
  useEffect(() => {
    if (isFromFidelizacion && billetera && parseFloat(billetera.saldo) > 0) {
      setUsarSaldoEnSena(true);
    }
  }, [isFromFidelizacion, billetera]);

  // Precio base del servicio considerando descuento de fidelización (si aplica)
  const getPrecioServicioConFidelizacion = () => {
    if (!servicioSeleccionado) return 0;

    let precioServicio = parseFloat(servicioSeleccionado.precio || '0') || 0;

    // Solo aplicar descuento cuando el turno viene desde un enlace
    // de fidelización y el beneficio es por descuento.
    if (isFromFidelizacion && beneficioFromQuery === 'descuento') {
      const monto = parseFloat(servicioSeleccionado.descuento_fidelizacion_monto || '0') || 0;
      const pct = parseFloat(servicioSeleccionado.descuento_fidelizacion_pct || '0') || 0;

      if (monto > 0) {
        precioServicio = Math.max(0, precioServicio - monto);
      } else if (pct > 0) {
        precioServicio = precioServicio * (1 - pct / 100);
      }
      // Si ambos son 0, no se aplica descuento (o se usa el global en backend).
    }

    return precioServicio;
  };

  // Calcular precio final con descuento de saldo
  const calcularPrecioFinal = () => {
    if (!servicioSeleccionado) return 0;

    let precioServicio = getPrecioServicioConFidelizacion();

    if (usarSaldo && billetera) {
      const saldoDisponible = parseFloat(billetera.saldo);
      const descuento = Math.min(precioServicio, saldoDisponible);
      return Math.max(0, precioServicio - descuento);
    }

    return precioServicio;
  };

  const getSaldoUtilizado = () => {
    if (!servicioSeleccionado || !billetera || !usarSaldo) return 0;

    const precioServicio = getPrecioServicioConFidelizacion();
    const saldoDisponible = parseFloat(billetera.saldo);

    return Math.min(precioServicio, saldoDisponible);
  };

  // Calcular monto de seña
  const calcularMontoSena = () => {
    if (!servicioSeleccionado) return 0;
    const precioServicio = getPrecioServicioConFidelizacion();
    const porcentajeSena = parseFloat(servicioSeleccionado.porcentaje_sena || '0');
    return (precioServicio * porcentajeSena) / 100;
  };

  // Calcular monto final de seña con descuento de billetera
  const calcularSenaFinal = () => {
    const montoSena = calcularMontoSena();

    if (usarSaldoEnSena && billetera) {
      const saldoDisponible = parseFloat(billetera.saldo);
      const descuento = Math.min(montoSena, saldoDisponible);
      return Math.max(0, montoSena - descuento);
    }

    return montoSena;
  };

  // Calcular saldo utilizado en seña
  const getSaldoUtilizadoEnSena = () => {
    if (!servicioSeleccionado || !billetera || !usarSaldoEnSena) return 0;
    const montoSena = calcularMontoSena();
    const saldoDisponible = parseFloat(billetera.saldo);
    return Math.min(montoSena, saldoDisponible);
  };

  // Cargar servicios cuando se selecciona categoría
  useEffect(() => {
    if (categoriaSeleccionada) {
      fetchServicios();
    }
  }, [categoriaSeleccionada]);

  // Auto-avanzar cuando se selecciona un servicio
  useEffect(() => {
    if (servicioSeleccionado && step === 1) {
      setStep(2);
    }
  }, [servicioSeleccionado]);

  // Cargar empleados cuando se selecciona servicio
  useEffect(() => {
    if (servicioSeleccionado) {
      // Si venimos desde fidelización, preservamos la fecha sugerida del enlace
      // y solo reseteamos el resto. En flujo normal, reseteamos todo.
      if (!isFromFidelizacion) {
        setFechaSeleccionada('');
      }
      setEmpleadoSeleccionado(null);
      setHorarioSeleccionado('');
      fetchEmpleados();
    }
  }, [servicioSeleccionado, isFromFidelizacion]);

  // Si venimos desde fidelización, seleccionar automáticamente el profesional sugerido
  useEffect(() => {
    if (!isFromFidelizacion || !empleadoIdFromQuery || empleadoSeleccionado) return;
    if (empleados.length === 0) return;

    const encontrado = empleados.find((e) => e.id === empleadoIdFromQuery);
    if (encontrado) {
      setEmpleadoSeleccionado(encontrado);
    }
  }, [isFromFidelizacion, empleadoIdFromQuery, empleados, empleadoSeleccionado]);

  // Cargar días de trabajo cuando se selecciona empleado
  useEffect(() => {
    if (empleadoSeleccionado) {
      fetchDiasTrabajoEmpleado();
    }
  }, [empleadoSeleccionado]);

  // Auto-avanzar cuando se selecciona un empleado
  useEffect(() => {
    if (empleadoSeleccionado && step === 2) {
      setStep(3);
    }
  }, [empleadoSeleccionado]);

  // Cargar horarios disponibles cuando se selecciona empleado y fecha
  useEffect(() => {
    if (empleadoSeleccionado && fechaSeleccionada && servicioSeleccionado) {
      // En flujo de fidelización, si tenemos una hora sugerida desde el enlace,
      // no reseteamos manualmente la selección para permitir el auto-match.
      if (!isFromFidelizacion) {
        setHorarioSeleccionado('');
      }
      fetchHorariosDisponibles();
    }
  }, [empleadoSeleccionado, fechaSeleccionada, servicioSeleccionado, isFromFidelizacion]);

  // Si venimos desde fidelización, seleccionar automáticamente el horario sugerido
  useEffect(() => {
    if (!isFromFidelizacion || !horaFromQuery) return;
    if (horariosDisponibles.length === 0) return;

    if (horariosDisponibles.includes(horaFromQuery)) {
      setHorarioSeleccionado(horaFromQuery);
    }
  }, [isFromFidelizacion, horaFromQuery, horariosDisponibles, horarioSeleccionado]);

  // Cuando todo está seleccionado desde fidelización, saltar directo al paso de confirmación/pago
  useEffect(() => {
    if (
      isFromFidelizacion &&
      servicioSeleccionado &&
      empleadoSeleccionado &&
      fechaSeleccionada &&
      horarioSeleccionado &&
      step < 4
    ) {
      setStep(4);
    }
  }, [isFromFidelizacion, servicioSeleccionado, empleadoSeleccionado, fechaSeleccionada, horarioSeleccionado, step]);

  const fetchCategorias = async () => {
    try {
      console.log('Fetching categorias from:', `${API_BASE_URL}/servicios/categorias/?page_size=100`);
      const response = await fetch(`${API_BASE_URL}/servicios/categorias/?page_size=100`, {
        headers: getAuthHeaders()
      });
      console.log('Categorias response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Categorias data:', data);
        setCategorias(data.results || data);
      } else {
        console.error('Error response:', response.status, response.statusText);
        const errorData = await response.text();
        console.error('Error data:', errorData);
      }
    } catch (error) {
      console.error('Error fetching categorias:', error);
    }
  };

  const fetchServicios = async () => {
    setLoadingServicios(true);
    try {
      const response = await fetch(`${API_BASE_URL}/servicios/?categoria=${categoriaSeleccionada}&page_size=100`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setServicios(data.results || data);
      }
    } catch (error) {
      console.error('Error fetching servicios:', error);
      setError('Error al cargar los servicios');
    } finally {
      setLoadingServicios(false);
    }
  };

  const fetchEmpleados = async () => {
    if (!servicioSeleccionado) return;

    setLoadingEmpleados(true);
    setError('');

    try {
      console.log('Fetching empleados for servicio:', servicioSeleccionado.id);
      // Filtrar empleados por el servicio seleccionado
      const response = await fetch(
        `${API_BASE_URL}/empleados/?servicio=${servicioSeleccionado.id}&disponible=true&page_size=100`,
        {
          headers: getAuthHeaders()
        }
      );
      console.log('Empleados response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        const empleadosDisponibles = data.results || data;
        console.log('Empleados disponibles:', empleadosDisponibles.length);

        // Cargar horarios detallados para cada empleado
        const empleadosConHorarios = await Promise.all(
          empleadosDisponibles.map(async (empleado: Empleado) => {
            try {
              const horariosResponse = await fetch(
                `${API_BASE_URL}/empleados/horarios/?empleado=${empleado.id}`,
                { headers: getAuthHeaders() }
              );
              if (horariosResponse.ok) {
                const horariosData = await horariosResponse.json();
                return {
                  ...empleado,
                  horarios_detallados: horariosData.results || horariosData
                };
              }
            } catch (error) {
              console.error(`Error cargando horarios para empleado ${empleado.id}:`, error);
            }
            return empleado;
          })
        );

        setEmpleados(empleadosConHorarios);

        if (empleadosConHorarios.length === 0) {
          setError(`No hay profesionales disponibles para el servicio "${servicioSeleccionado.nombre}". Por favor, intenta con otro servicio o contacta al salón.`);
        }
      } else {
        console.error('Error response:', response.status, response.statusText);
        const errorData = await response.text();
        console.error('Error data:', errorData);
        setError('Error al cargar los profesionales');
      }
    } catch (error) {
      console.error('Error fetching empleados:', error);
      setError('Error al cargar los profesionales. Por favor, intenta nuevamente.');
    } finally {
      setLoadingEmpleados(false);
    }
  };

  const fetchDiasTrabajoEmpleado = async () => {
    if (!empleadoSeleccionado) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/empleados/${empleadoSeleccionado.id}/dias-trabajo/`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setDiasTrabajoEmpleado(data.dias_trabajo || []);
      }
    } catch (error) {
      console.error('Error fetching días de trabajo:', error);
    }
  };

  const fetchHorariosDisponibles = async () => {
    if (!empleadoSeleccionado || !fechaSeleccionada || !servicioSeleccionado) return;

    setLoadingHorarios(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/turnos/disponibilidad/?empleado=${empleadoSeleccionado.id}&servicio=${servicioSeleccionado.id}&fecha=${fechaSeleccionada}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data: HorarioDisponible = await response.json();
        if (data.disponible) {
          setHorariosDisponibles(data.horarios);
          setError('');
        } else {
          setHorariosDisponibles([]);
          setError(data.mensaje || 'No hay horarios disponibles para esta fecha');
        }
      }
    } catch (error) {
      console.error('Error fetching horarios:', error);
      setError('Error al cargar horarios disponibles');
    } finally {
      setLoadingHorarios(false);
    }
  };

  const handleSubmit = async () => {
    if (!servicioSeleccionado || !empleadoSeleccionado || !fechaSeleccionada || !horarioSeleccionado) {
      setError('Por favor completa todos los campos requeridos');
      setShowConfirmDialog(false);
      return;
    }

    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const fechaHora = `${fechaSeleccionada}T${horarioSeleccionado}:00`;

      // Créditos de billetera a aplicar sobre la seña
      const creditosAplicar = usarSaldoEnSena ? getSaldoUtilizadoEnSena() : 0;

      const response = await fetch(`${API_BASE_URL}/mercadopago/preferencia-sin-turno/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          servicio_id: servicioSeleccionado.id,
          empleado_id: empleadoSeleccionado.id,
          fecha_hora: fechaHora,
          notas_cliente: notasCliente.trim() || '',
          usar_sena: true,
          creditos_a_aplicar: creditosAplicar,
          // Indicar al backend que aplique el descuento de fidelización
          aplicar_descuento_fidelizacion: isFromFidelizacion && beneficioFromQuery === 'descuento',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setShowConfirmDialog(false);

        // Caso gratuito: créditos cubren el 100% de la seña → turno ya creado
        if (result.status === 'free') {
          setSuccess(true);
          setLoading(false);
          return;
        }

        // Caso normal: abrir Mercado Pago en pestaña nueva y esperar webhook
        const mpWin = window.open(result.init_point, '_blank');
        mpWindowRef.current = mpWin;
        setMpTabClosed(false);
        setPreferenceId(result.preference_id);
        setIsWaitingPayment(true);

        // Detectar si el usuario cierra la pestaña de MP
        if (mpWin) {
          mpTabCheckRef.current = setInterval(() => {
            if (mpWin.closed) {
              clearInterval(mpTabCheckRef.current!);
              mpTabCheckRef.current = null;
              mpWindowRef.current = null;
              // También detener el polling de pago
              if (pollingIntervalRef.current !== null) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              setMpTabClosed(true);
            }
          }, 1000);
        }
      } else {
        const responseText = await response.text();
        let errorData: any;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText };
        }
        setShowConfirmDialog(false);
        setError(
          errorData?.detail ||
          errorData?.error ||
          'Error al iniciar el pago. Por favor intenta nuevamente.'
        );
      }
    } catch (error: any) {
      console.error('Error iniciando pago MP:', error);
      setShowConfirmDialog(false);
      setError(error.message || 'Error al iniciar el pago. Por favor intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };


  // Manejar salida con confirmación
  const handleExit = (destination: string) => {
    // Si ya completó el turno o no ha avanzado, puede salir directo
    if (success || step === 1) {
      router.push(destination);
      return;
    }

    // Si está en proceso de reserva, pedir confirmación
    setShowExitConfirm(true);
  };

  const confirmExit = (destination: string) => {
    setShowExitConfirm(false);
    // Resetear todo el estado
    setStep(1);
    setCategoriaSeleccionada(null);
    setServicioSeleccionado(null);
    setEmpleadoSeleccionado(null);
    setFechaSeleccionada('');
    setHorarioSeleccionado('');
    setNotasCliente('');
    setError('');
    router.push(destination);
  };

  // Obtener fecha mínima (hoy) y máxima (30 días)
  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().split('T')[0];
  };

  // Validar si una fecha es día de trabajo del empleado
  const isValidWorkDay = (dateString: string): boolean => {
    if (diasTrabajoEmpleado.length === 0) return true; // Si no hay datos, permitir
    const date = new Date(dateString + 'T12:00:00');
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    // Convertir de domingo=0 a lunes=0: (dayOfWeek + 6) % 7
    const adjustedDay = (dayOfWeek + 6) % 7;
    return diasTrabajoEmpleado.includes(adjustedDay);
  };

  // Formatear días de trabajo
  const formatDiasTrabajo = (dias: string) => {
    const diasMap: { [key: string]: string } = {
      'L': 'Lun',
      'M': 'Mar',
      'X': 'Mié',
      'J': 'Jue',
      'V': 'Vie',
      'S': 'Sáb',
      'D': 'Dom'
    };
    return dias.split(',').map(d => diasMap[d.trim()] || d).join(', ');
  };

  // Obtener horarios del empleado para un día específico
  const getHorariosPorDia = (empleado: Empleado, diaSemana: number): HorarioDetallado[] => {
    if (!empleado.horarios_detallados || empleado.horarios_detallados.length === 0) {
      return [];
    }
    return empleado.horarios_detallados
      .filter(h => h.dia_semana === diaSemana && h.is_active)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  };

  // Formatear rangos horarios para mostrar
  const formatearRangosHorarios = (horarios: HorarioDetallado[]): string => {
    if (!horarios || horarios.length === 0) {
      return 'Sin horarios';
    }
    return horarios
      .map(h => `${h.hora_inicio.slice(0, 5)} - ${h.hora_fin.slice(0, 5)}`)
      .join(', ');
  };

  // Obtener todos los horarios agrupados por día para mostrar en resumen
  const getHorariosAgrupados = (empleado: Empleado): { [key: string]: HorarioDetallado[] } => {
    if (!empleado.horarios_detallados || empleado.horarios_detallados.length === 0) {
      return {};
    }

    const agrupados: { [key: string]: HorarioDetallado[] } = {};
    empleado.horarios_detallados.forEach(horario => {
      if (horario.is_active) {
        const dia = horario.dia_semana_display;
        if (!agrupados[dia]) {
          agrupados[dia] = [];
        }
        agrupados[dia].push(horario);
      }
    });

    // Ordenar horarios dentro de cada día
    Object.keys(agrupados).forEach(dia => {
      agrupados[dia].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    });

    return agrupados;
  };

  // Filtrar empleados por búsqueda y especialidad
  const empleadosFiltrados = empleados.filter((emp) => {
    const matchesSearch = searchEmpleado === '' ||
      emp.first_name?.toLowerCase().includes(searchEmpleado.toLowerCase()) ||
      emp.last_name?.toLowerCase().includes(searchEmpleado.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchEmpleado.toLowerCase()) ||
      emp.biografia?.toLowerCase().includes(searchEmpleado.toLowerCase());

    const matchesEspecialidad = filterEspecialidad === 'all' ||
      emp.especialidades?.toLowerCase().includes(filterEspecialidad.toLowerCase());

    return matchesSearch && matchesEspecialidad;
  });

  // Obtener especialidades únicas de los empleados
  const especialidadesUnicas = [...new Set(empleados.map(e => e.especialidad_display).filter(Boolean))];

  // Paginación
  const totalPaginas = Math.ceil(empleadosFiltrados.length / empleadosPorPagina);
  const indiceInicio = (currentPage - 1) * empleadosPorPagina;
  const indiceFin = indiceInicio + empleadosPorPagina;
  const empleadosPaginados = empleadosFiltrados.slice(indiceInicio, indiceFin);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchEmpleado, filterEspecialidad]);

  // Obtener color del badge de experiencia
  const getExperienciaColor = (nivel: number) => {
    switch (nivel) {
      case 4: return 'bg-purple-100 text-purple-700 border-purple-300';
      case 3: return 'bg-blue-100 text-blue-700 border-blue-300';
      case 2: return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  // Obtener icono de experiencia
  const getExperienciaIcon = (nivel: number) => {
    return '⭐'.repeat(nivel);
  };

  const serviciosFiltrados = servicios.filter(s =>
    categoriaSeleccionada ? s.categoria === categoriaSeleccionada : true
  );

  // ── Pantalla de espera mientras se confirma el pago en Mercado Pago ──
  if (isWaitingPayment) {
    const handleCancelPayment = () => {
      // Cerrar la pestaña de MP si sigue abierta
      if (mpWindowRef.current && !mpWindowRef.current.closed) {
        mpWindowRef.current.close();
      }
      mpWindowRef.current = null;
      if (mpTabCheckRef.current !== null) {
        clearInterval(mpTabCheckRef.current);
        mpTabCheckRef.current = null;
      }
      setIsWaitingPayment(false);
      setMpTabClosed(false);
      setPreferenceId('');
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 text-center">
          <CardContent className="pt-12 pb-10 px-8 flex flex-col items-center gap-6">

            {mpTabClosed ? (
              // ── Pestaña de MP cerrada antes de completar el pago ──
              <>
                <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    Cerraste la ventana de pago
                  </h2>
                  <p className="text-gray-500 text-sm">
                    El pago no fue completado. El turno <strong>no fue reservado</strong>.
                    Podés iniciar el proceso nuevamente.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={handleCancelPayment}
                >
                  Volver al formulario
                </Button>
              </>
            ) : (
              // ── Esperando confirmación ──
              <>
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
                  <Wallet className="absolute inset-0 m-auto w-8 h-8 text-indigo-400" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Esperando confirmación de pago...
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Completá el pago en la pestaña de Mercado Pago que se abrió.
                    Esta pantalla se actualizará automáticamente.
                  </p>
                </div>

                <div className="w-full rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-700 text-left space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium">Servicio:</span>
                    <span>{servicioSeleccionado?.nombre}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Profesional:</span>
                    <span>{empleadoSeleccionado?.first_name} {empleadoSeleccionado?.last_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Fecha:</span>
                    <span>{fechaSeleccionada} · {horarioSeleccionado}hs</span>
                  </div>
                </div>

                <p className="text-xs text-gray-400">
                  Verificando cada 3 segundos · No cerrés esta pestaña
                </p>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-600"
                  onClick={handleCancelPayment}
                >
                  Cancelar y volver al formulario
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-8 text-center">
            <div className="relative">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <Check className="w-10 h-10 text-green-600" />
              </div>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              ¡Turno agendado con éxito!
            </h2>

            <p className="text-gray-600 mb-2">
              Tu turno ha sido registrado correctamente
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-6 text-left max-w-md mx-auto">
              <h3 className="font-semibold text-blue-900 mb-3">Detalles de tu turno:</h3>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span><strong>Profesional:</strong> {empleadoSeleccionado?.first_name} {empleadoSeleccionado?.last_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  <span><strong>Fecha:</strong> {fechaSeleccionada && new Date(fechaSeleccionada + 'T12:00:00').toLocaleDateString('es-AR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span><strong>Hora:</strong> {horarioSeleccionado}</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-800">
                <strong>Estado:</strong> Pendiente de confirmación<br />
                Recibirás una notificación cuando el turno sea confirmado por el salón.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => router.push('/dashboard/cliente/turnos')}
                size="lg"
              >
                Ver mis turnos
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/cliente')}
                size="lg"
              >
                Ir al inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Diálogo de confirmación para salir */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle>¿Cancelar reserva?</CardTitle>
              <CardDescription>
                Si sales ahora, perderás el progreso de tu reserva actual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowExitConfirm(false)}
                >
                  Continuar reserva
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => confirmExit('/dashboard/cliente')}
                >
                  Sí, cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => step > 1 ? setStep(step - 1) : handleExit('/dashboard/cliente')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarIcon className="w-8 h-8" />
          Agendar Nuevo Turno
        </h1>
        <p className="text-gray-600 mt-1">
          Completa los siguientes pasos para reservar tu cita
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-center gap-4">
        {[1, 2, 3, 4].map((stepNum) => (
          <div key={stepNum} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= stepNum ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
              }`}>
              {stepNum}
            </div>
            {stepNum < 4 && (
              <div className={`w-12 h-1 ${step > stepNum ? 'bg-primary' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Step 1: Seleccionar Servicio */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Paso 1: Selecciona el servicio</CardTitle>
            <CardDescription>Elige el servicio que deseas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selector de categoría */}
            <div>
              <Label htmlFor="categoria">Categoría</Label>
              <Select
                value={categoriaSeleccionada?.toString() || ''}
                onValueChange={(value) => {
                  setCategoriaSeleccionada(parseInt(value));
                  setServicioSeleccionado(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lista de servicios */}
            {categoriaSeleccionada && (
              <div className="space-y-2">
                <Label>Servicio</Label>
                {loadingServicios ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span className="text-gray-600">Cargando servicios...</span>
                  </div>
                ) : serviciosFiltrados.length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-8">
                    No hay servicios disponibles en esta categoría
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {serviciosFiltrados.map((servicio) => (
                      <div
                        key={servicio.id}
                        onClick={() => setServicioSeleccionado(servicio)}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${servicioSeleccionado?.id === servicio.id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                          }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-gray-900">{servicio.nombre}</h3>
                          {servicioSeleccionado?.id === servicio.id && (
                            <Check className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 mb-3">{servicio.descripcion}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-primary font-semibold text-lg">${servicio.precio}</span>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {servicio.duracion_horas}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Seleccionar Profesional */}
      {step === 2 && servicioSeleccionado && (
        <Card>
          <CardHeader>
            <CardTitle>Paso 2: Selecciona el profesional</CardTitle>
            <CardDescription>
              Servicio: {servicioSeleccionado.nombre} - ${servicioSeleccionado.precio}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingEmpleados ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mr-3 text-primary" />
                <div>
                  <p className="font-medium text-gray-900">Buscando profesionales...</p>
                  <p className="text-sm text-gray-600">Esto solo tomará un momento</p>
                </div>
              </div>
            ) : empleados.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No hay profesionales disponibles
                </h3>
                <p className="text-gray-600 mb-4 max-w-md mx-auto">
                  Actualmente no tenemos profesionales disponibles para el servicio "{servicioSeleccionado.nombre}".
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Puedes intentar:
                </p>
                <ul className="text-sm text-gray-600 space-y-1 mb-6">
                  <li>• Seleccionar otro servicio similar</li>
                  <li>• Contactar directamente al salón</li>
                  <li>• Intentar en otro horario</li>
                </ul>
              </div>
            ) : (
              <>
                {/* Barra de búsqueda y filtros */}
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Búsqueda por nombre */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Buscar por nombre, email o biografía..."
                        value={searchEmpleado}
                        onChange={(e) => setSearchEmpleado(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Filtro por especialidad */}
                    {especialidadesUnicas.length > 1 && (
                      <Select value={filterEspecialidad} onValueChange={setFilterEspecialidad}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas las especialidades" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas las especialidades</SelectItem>
                          {especialidadesUnicas.map((esp) => (
                            <SelectItem key={esp} value={esp.toLowerCase()}>
                              {esp}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Contador de resultados */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      {empleadosFiltrados.length === empleados.length ? (
                        <>
                          <strong>{empleados.length}</strong> {empleados.length === 1 ? 'profesional disponible' : 'profesionales disponibles'} para este servicio
                        </>
                      ) : (
                        <>
                          Mostrando <strong>{empleadosFiltrados.length}</strong> de <strong>{empleados.length}</strong> profesionales
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Lista de profesionales paginada */}
                {empleadosFiltrados.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600">
                      No se encontraron profesionales con los criterios de búsqueda
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchEmpleado('');
                        setFilterEspecialidad('all');
                      }}
                      className="mt-4"
                    >
                      Limpiar filtros
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {empleadosPaginados.map((empleado) => (
                        <div
                          key={empleado.id}
                          onClick={() => setEmpleadoSeleccionado(empleado)}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${empleadoSeleccionado?.id === empleado.id
                            ? 'border-primary bg-primary/5 shadow-md'
                            : 'border-gray-200 hover:border-primary/50 hover:shadow-sm'
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-14 h-14 bg-linear-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center shrink-0">
                              <User className="w-7 h-7 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-1">
                                <h3 className="font-semibold text-gray-900">
                                  {empleado.first_name} {empleado.last_name}
                                </h3>
                                {empleadoSeleccionado?.id === empleado.id && (
                                  <Check className="w-5 h-5 text-primary shrink-0" />
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  {empleado.especialidad_display}
                                </Badge>
                                {empleado.nivel_experiencia && (
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getExperienciaColor(empleado.nivel_experiencia.nivel)}`}
                                  >
                                    {getExperienciaIcon(empleado.nivel_experiencia.nivel)} {empleado.nivel_experiencia.nivel_display}
                                  </Badge>
                                )}
                              </div>

                              {empleado.biografia && (
                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                  {empleado.biografia}
                                </p>
                              )}

                              <div className="text-xs text-gray-500 space-y-1">
                                {empleado.horarios_detallados && empleado.horarios_detallados.length > 0 ? (
                                  <>
                                    <div className="flex items-start gap-1">
                                      <Clock className="w-3 h-3 mt-0.5 shrink-0" />
                                      <div className="space-y-0.5">
                                        {Object.entries(getHorariosAgrupados(empleado)).map(([dia, horarios]) => (
                                          <div key={dia} className="text-xs">
                                            <span className="font-medium">{dia}:</span>{' '}
                                            {formatearRangosHorarios(horarios)}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>
                                      {empleado.horario_entrada.slice(0, 5)} - {empleado.horario_salida.slice(0, 5)}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <CalendarIcon className="w-3 h-3" />
                                  <span>{formatDiasTrabajo(empleado.dias_trabajo)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Controles de paginación */}
                    {totalPaginas > 1 && (
                      <div className="flex items-center justify-between border-t pt-4">
                        <div className="text-sm text-gray-600">
                          Página {currentPage} de {totalPaginas} • Mostrando {indiceInicio + 1}-{Math.min(indiceFin, empleadosFiltrados.length)} de {empleadosFiltrados.length}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Anterior
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPaginas, p + 1))}
                            disabled={currentPage === totalPaginas}
                          >
                            Siguiente
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <div className="flex justify-start mt-6">
              <Button variant="outline" onClick={() => setStep(1)}>
                Atrás
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Seleccionar Fecha y Hora */}
      {step === 3 && empleadoSeleccionado && (
        <Card>
          <CardHeader>
            <CardTitle>Paso 3: Selecciona fecha y hora</CardTitle>
            <CardDescription>
              Con {empleadoSeleccionado.first_name} {empleadoSeleccionado.last_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Información del profesional */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-linear-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {empleadoSeleccionado.first_name} {empleadoSeleccionado.last_name}
                  </p>
                  <p className="text-sm text-gray-600">{empleadoSeleccionado.especialidad_display}</p>
                </div>
              </div>
              {empleadoSeleccionado.horarios_detallados && empleadoSeleccionado.horarios_detallados.length > 0 ? (
                <div className="space-y-1 text-sm text-gray-700">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      {Object.entries(getHorariosAgrupados(empleadoSeleccionado)).map(([dia, horarios]) => (
                        <div key={dia}>
                          <span className="font-medium">{dia}:</span>{' '}
                          {formatearRangosHorarios(horarios)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span>
                      {empleadoSeleccionado.horario_entrada.slice(0, 5)} - {empleadoSeleccionado.horario_salida.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <CalendarIcon className="w-4 h-4 text-gray-500" />
                    <span>{formatDiasTrabajo(empleadoSeleccionado.dias_trabajo)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Selector de fecha */}
            <div>
              <Label htmlFor="fecha">Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal mt-1"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaSeleccionada ? (
                      new Date(fechaSeleccionada + 'T12:00:00').toLocaleDateString('es-AR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })
                    ) : (
                      <span className="text-muted-foreground">Selecciona una fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaSeleccionada ? new Date(fechaSeleccionada + 'T12:00:00') : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const dateString = date.toISOString().split('T')[0];
                        if (isValidWorkDay(dateString)) {
                          setFechaSeleccionada(dateString);
                          setHorarioSeleccionado('');
                          setError('');
                        } else {
                          setError(`${empleadoSeleccionado.first_name} no trabaja ese día. Por favor selecciona un día de trabajo: ${formatDiasTrabajo(empleadoSeleccionado.dias_trabajo)}`);
                        }
                      }
                    }}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const maxDate = new Date();
                      maxDate.setDate(maxDate.getDate() + 30);
                      maxDate.setHours(23, 59, 59, 999);

                      // Deshabilitar fechas fuera del rango
                      if (date < today || date > maxDate) return true;

                      // Deshabilitar días que no son de trabajo
                      const dateString = date.toISOString().split('T')[0];
                      return !isValidWorkDay(dateString);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-500 mt-1">
                Días laborables: {formatDiasTrabajo(empleadoSeleccionado.dias_trabajo)} | Hasta 30 días en adelante
              </p>
            </div>

            {/* Horarios disponibles */}
            {fechaSeleccionada && (
              <div>
                <Label className="mb-2 block">Horarios disponibles</Label>
                {loadingHorarios ? (
                  <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="font-medium text-gray-900">Consultando disponibilidad...</p>
                    <p className="text-sm text-gray-600">
                      Verificando horarios para {new Date(fechaSeleccionada + 'T12:00:00').toLocaleDateString('es-AR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                      })}
                    </p>
                  </div>
                ) : horariosDisponibles.length > 0 ? (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                      <p className="text-sm text-green-900">
                        ✓ {horariosDisponibles.length} horarios disponibles para esta fecha
                      </p>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                      {horariosDisponibles.map((horario) => (
                        <Button
                          key={horario}
                          variant={horarioSeleccionado === horario ? 'default' : 'outline'}
                          onClick={() => setHorarioSeleccionado(horario)}
                          className={`w-full ${horarioSeleccionado === horario
                            ? 'shadow-md'
                            : 'hover:border-primary hover:bg-primary/5'
                            }`}
                        >
                          {horario}
                        </Button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="w-12 h-12 mx-auto text-amber-600 mb-3" />
                    <h3 className="font-semibold text-amber-900 mb-2">
                      No hay horarios disponibles
                    </h3>
                    <p className="text-sm text-amber-800 mb-3">
                      {empleadoSeleccionado.first_name} no tiene horarios disponibles para la fecha seleccionada.
                    </p>
                    <p className="text-xs text-amber-700">
                      Por favor, intenta con otra fecha o selecciona otro profesional.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep(2)}>
                Atrás
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!horarioSeleccionado}
              >
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirmar */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Paso 4: Confirmar turno</CardTitle>
            <CardDescription>Revisa los detalles antes de confirmar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Resumen detallado */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Header del resumen */}
              <div className="bg-primary/5 border-b border-gray-200 px-4 py-3">
                <h3 className="font-semibold text-gray-900">Resumen de tu turno</h3>
              </div>

              {/* Detalles */}
              <div className="p-4 space-y-4">
                {/* Servicio */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Servicio</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{servicioSeleccionado?.nombre}</p>
                      <p className="text-sm text-gray-600">{servicioSeleccionado?.categoria_nombre}</p>
                    </div>
                    <Badge variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      {servicioSeleccionado?.duracion_horas}
                    </Badge>
                  </div>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* Sala */}
                {servicioSeleccionado?.sala_nombre && (
                  <>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Sala</p>
                      <div className="flex items-center gap-2 text-gray-900">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="font-medium">{servicioSeleccionado.sala_nombre}</span>
                      </div>
                    </div>
                    <div className="border-t border-gray-100"></div>
                  </>
                )}

                {/* Profesional */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Profesional</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-linear-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {empleadoSeleccionado?.first_name} {empleadoSeleccionado?.last_name}
                      </p>
                      <p className="text-sm text-gray-600">{empleadoSeleccionado?.especialidad_display}</p>
                    </div>
                  </div>
                  {empleadoSeleccionado?.nivel_experiencia && (
                    <Badge
                      variant="outline"
                      className={`mt-2 text-xs ${getExperienciaColor(empleadoSeleccionado.nivel_experiencia.nivel)}`}
                    >
                      {getExperienciaIcon(empleadoSeleccionado.nivel_experiencia.nivel)} {empleadoSeleccionado.nivel_experiencia.nivel_display}
                    </Badge>
                  )}
                </div>

                <div className="border-t border-gray-100"></div>

                {/* Fecha y Hora */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Fecha y Hora</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-900">
                      <CalendarIcon className="w-4 h-4 text-primary" />
                      <span className="font-medium">
                        {new Date(fechaSeleccionada + 'T12:00:00').toLocaleDateString('es-AR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-900">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="font-medium">{horarioSeleccionado}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* Precio */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Precio</p>

                  {isFromFidelizacion && !billetera && (
                    <div className="mb-3 rounded-md bg-purple-50 border border-purple-200 px-3 py-2 text-sm text-purple-800">
                      Estás aprovechando una <strong>promoción de fidelización</strong>. Este turno fue sugerido
                      automáticamente según tu historial para que puedas ir directo al pago.
                    </div>
                  )}

                  {/* Precio original */}
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold ${usarSaldo && billetera ? 'text-gray-400 line-through' : 'text-primary'}`}>
                      ${servicioSeleccionado?.precio}
                    </span>
                    <span className="text-sm text-gray-600">ARS</span>
                  </div>

                  {/* Selector de usar saldo */}
                  {billetera && parseFloat(billetera.saldo) > 0 && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="font-semibold text-green-900">Usar saldo disponible</p>
                            <p className="text-sm text-green-700">
                              Tienes {formatCurrency(parseFloat(billetera.saldo))} disponible
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={usarSaldo}
                          onCheckedChange={setUsarSaldo}
                          className="data-[state=checked]:bg-green-600"
                        />
                      </div>

                      {usarSaldo && (
                        <div className="pt-3 border-t border-green-200">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-green-700">Precio original:</span>
                            <span className="font-medium">{formatCurrency(parseFloat(servicioSeleccionado?.precio || '0'))}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-green-700">Saldo utilizado:</span>
                            <span className="font-medium text-green-600">-{formatCurrency(getSaldoUtilizado())}</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold pt-2 border-t border-green-200">
                            <span className="text-green-900">Total a pagar:</span>
                            <span className={calcularPrecioFinal() === 0 ? 'text-green-600' : 'text-green-900'}>
                              {formatCurrency(calcularPrecioFinal())}
                            </span>
                          </div>
                          {calcularPrecioFinal() === 0 && (
                            <p className="text-xs text-green-600 mt-2 text-center">
                              🎉 ¡Tu saldo cubre el 100% del servicio!
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Precio final cuando se usa saldo */}
                  {usarSaldo && billetera && parseFloat(billetera.saldo) > 0 && calcularPrecioFinal() !== 0 && (
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-sm text-gray-600">Total a pagar:</span>
                      <span className="text-3xl font-bold text-primary">
                        {formatCurrency(calcularPrecioFinal())}
                      </span>
                      <span className="text-sm text-gray-600">ARS</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notas opcionales */}
            <div>
              <Label htmlFor="notas" className="text-base font-semibold">
                Notas adicionales (opcional)
              </Label>
              <p className="text-sm text-gray-600 mb-2">
                ¿Tienes alguna preferencia o comentario para el profesional?
              </p>
              <Textarea
                id="notas"
                placeholder="Ej: Prefiero corte con tijera, tengo alergia a ciertos productos, etc."
                value={notasCliente}
                onChange={(e) => setNotasCliente(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Información importante */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Información importante
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Tu turno quedará como <strong>pendiente</strong> hasta ser confirmado</li>
                <li>• Recibirás una notificación cuando sea confirmado</li>
                <li>• Por favor, llega 5 minutos antes de tu horario</li>
                <li>• Puedes cancelar hasta 24 horas antes sin cargo</li>
              </ul>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep(3)}>
                Atrás
              </Button>
              <Button
                onClick={() => setShowConfirmDialog(true)}
                disabled={loading}
                size="lg"
              >
                <Check className="w-4 h-4 mr-2" />
                Confirmar Turno
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmación con cálculo de seña */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar Reserva</DialogTitle>
            <DialogDescription>
              Revisa el detalle del pago antes de confirmar tu turno
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Información del servicio */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Resumen del servicio</h4>
              <p className="text-sm text-gray-600">{servicioSeleccionado?.nombre}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-600">Precio total:</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(parseFloat(servicioSeleccionado?.precio || '0'))}</span>
              </div>
            </div>

            {/* Cálculo de seña */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">Monto de Seña Requerido</h4>
                  <p className="text-sm text-blue-700">
                    Para reservar tu turno debes abonar el <strong>{servicioSeleccionado?.porcentaje_sena}%</strong> del precio total como seña
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-blue-200">
                <span className="font-medium text-blue-900">Monto de seña:</span>
                <span className="text-xl font-bold text-blue-900">{formatCurrency(calcularMontoSena())}</span>
              </div>
            </div>

            {/* Selector de usar saldo en seña */}
            {billetera && parseFloat(billetera.saldo) > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-900">Usar saldo de billetera</p>
                      <p className="text-sm text-green-700">
                        Saldo disponible: {formatCurrency(parseFloat(billetera.saldo))}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={usarSaldoEnSena}
                    onCheckedChange={setUsarSaldoEnSena}
                    className="data-[state=checked]:bg-green-600"
                  />
                </div>

                {usarSaldoEnSena && (
                  <div className="pt-3 border-t border-green-200 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-700">Seña requerida:</span>
                      <span className="font-medium">{formatCurrency(calcularMontoSena())}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-700">Saldo aplicado:</span>
                      <span className="font-medium text-green-600">-{formatCurrency(getSaldoUtilizadoEnSena())}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-green-200">
                      <span className="text-green-900">Total a pagar ahora:</span>
                      <span className={calcularSenaFinal() === 0 ? 'text-green-600' : 'text-green-900'}>
                        {formatCurrency(calcularSenaFinal())}
                      </span>
                    </div>
                    {calcularSenaFinal() === 0 && (
                      <p className="text-xs text-green-600 mt-2 text-center">
                        🎉 ¡Tu saldo cubre el 100% de la seña!
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Monto final destacado */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Pagarás ahora:</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(usarSaldoEnSena ? calcularSenaFinal() : calcularMontoSena())}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                El resto se abona al finalizar el servicio
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false);
                setUsarSaldoEnSena(false);
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className={usarSaldoEnSena && calcularSenaFinal() === 0 ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar y Pagar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
