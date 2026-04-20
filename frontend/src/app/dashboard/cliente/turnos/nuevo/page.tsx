'use client';

import { BeautifulSpinner } from '@/components/ui/BeautifulSpinner';
import { getAuthHeaders, getJsonAuthHeaders } from '@/lib/auth-headers';
import { AlertCircle, ArrowLeft, Calendar as CalendarIcon, Check, ChevronsUpDown, Clock, Loader2, MapPin, Search, User, Wallet } from 'lucide-react';
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
  const [loadingBilletera, setLoadingBilletera] = useState(false);

  // Estados para dialog de confirmación
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [usarSaldoEnSena, setUsarSaldoEnSena] = useState(false);
  const [pagarServicioCompleto, setPagarServicioCompleto] = useState(false);

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
  const [searchCategoria, setSearchCategoria] = useState('');
  const [openCategoriaSelect, setOpenCategoriaSelect] = useState(false);
  const [catalogoServicios, setCatalogoServicios] = useState<Servicio[]>([]);
  const [loadingCatalogoServicios, setLoadingCatalogoServicios] = useState(false);
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
    fetchCatalogoServicios();
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

  // Calcular monto de seña
  const calcularMontoSena = () => {
    if (!servicioSeleccionado) return 0;
    const precioServicio = getPrecioServicioConFidelizacion();
    return precioServicio * 0.5;
  };

  // Monto base a pagar ahora: seña o servicio completo
  const calcularMontoBasePago = () => {
    if (!servicioSeleccionado) return 0;
    const precioServicio = getPrecioServicioConFidelizacion();
    const montoSena = calcularMontoSena();
    return pagarServicioCompleto ? precioServicio : montoSena;
  };

  // Calcular monto final a pagar ahora con descuento de billetera
  const calcularPagoFinalAhora = () => {
    const montoBase = calcularMontoBasePago();

    if (usarSaldoEnSena && billetera) {
      const saldoDisponible = parseFloat(billetera.saldo);
      const descuento = Math.min(montoBase, saldoDisponible);
      return Math.max(0, montoBase - descuento);
    }

    return montoBase;
  };

  // Calcular saldo utilizado en el pago actual
  const getSaldoUtilizadoEnPago = () => {
    if (!servicioSeleccionado || !billetera || !usarSaldoEnSena) return 0;
    const montoBase = calcularMontoBasePago();
    const saldoDisponible = parseFloat(billetera.saldo);
    return Math.min(montoBase, saldoDisponible);
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

  const fetchCatalogoServicios = async () => {
    setLoadingCatalogoServicios(true);
    try {
      const response = await fetch(`${API_BASE_URL}/servicios/?page_size=300`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        const serviciosData = (data.results || data) as Servicio[];
        setCatalogoServicios(serviciosData.filter((servicio) => servicio.is_active));
      }
    } catch (error) {
      console.error('Error fetching catálogo de servicios:', error);
    } finally {
      setLoadingCatalogoServicios(false);
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
      setError('Por favor completá todos los campos requeridos');
      setShowConfirmDialog(false);
      return;
    }

    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const fechaHora = `${fechaSeleccionada}T${horarioSeleccionado}:00`;

      // Créditos de billetera a aplicar sobre el pago actual (seña o total)
      const creditosAplicar = usarSaldoEnSena ? getSaldoUtilizadoEnPago() : 0;

      const response = await fetch(`${API_BASE_URL}/mercadopago/preferencia-sin-turno/`, {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({
          servicio_id: servicioSeleccionado.id,
          empleado_id: empleadoSeleccionado.id,
          fecha_hora: fechaHora,
          notas_cliente: notasCliente.trim() || '',
          usar_sena: !pagarServicioCompleto,
          tipo_pago: pagarServicioCompleto ? 'PAGO_COMPLETO' : 'SENIA',
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

  const getInicialesProfesional = (empleado: Empleado) => {
    const nombre = (empleado.first_name || '').trim();
    const apellido = (empleado.last_name || '').trim();
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase() || 'PR';
  };

  const serviciosFiltrados = servicios.filter(s =>
    categoriaSeleccionada ? s.categoria === categoriaSeleccionada : true
  );

  const horariosDisponiblesOrdenados = [...horariosDisponibles].sort((a, b) => a.localeCompare(b));

  const proximoHorarioDisponible = (() => {
    if (!fechaSeleccionada || horariosDisponiblesOrdenados.length === 0) return null;

    const fechaElegida = new Date(`${fechaSeleccionada}T00:00:00`);
    const ahora = new Date();
    const esHoy = fechaElegida.toDateString() === ahora.toDateString();

    if (!esHoy) {
      return horariosDisponiblesOrdenados[0];
    }

    const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();
    const siguiente = horariosDisponiblesOrdenados.find((horario) => {
      const [hora, minuto] = horario.split(':').map(Number);
      if (Number.isNaN(hora) || Number.isNaN(minuto)) return false;
      return hora * 60 + minuto >= minutosActuales;
    });

    return siguiente || horariosDisponiblesOrdenados[0] || null;
  })();

  const categoriasOrdenadas = [...categorias].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
  );

  const categoriasFiltradas = categoriasOrdenadas.filter((categoria) =>
    categoria.nombre.toLowerCase().includes(searchCategoria.toLowerCase())
  );

  const categoriaSeleccionadaNombre = categorias.find(
    (categoria) => categoria.id === categoriaSeleccionada
  )?.nombre;

  const getServiciosPorCategoria = (categoriaId: number) => {
    return catalogoServicios
      .filter((servicio) => servicio.categoria === categoriaId)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  };

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
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-50 dark:from-background dark:to-background flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-slate-100/80 py-6">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6">
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
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => step > 1 ? setStep(step - 1) : handleExit('/dashboard/cliente')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>

          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-200">
              <CalendarIcon className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                Agendar Nuevo Turno
              </h1>
              <p className="mt-1 text-lg text-slate-600">
                Completá los siguientes pasos para reservar tu cita
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center gap-2 sm:gap-4">
          {[1, 2, 3, 4].map((stepNum) => (
            <div key={stepNum} className="flex flex-1 items-center">
              <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold ${step > stepNum
                ? 'bg-emerald-500 text-white'
                : step === stepNum
                  ? 'bg-primary text-white'
                  : 'bg-slate-300 text-slate-700'
                }`}>
                {step > stepNum ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              {stepNum < 4 && (
                <div className={`mx-2 h-0.5 flex-1 ${step > stepNum ? 'bg-emerald-500' : 'bg-slate-300'}`} />
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

        {/* Resumen de servicio para pasos avanzados */}
        {step >= 2 && servicioSeleccionado && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            {step >= 3 && empleadoSeleccionado ? (
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-400 font-semibold text-white">
                  {getInicialesProfesional(empleadoSeleccionado)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {empleadoSeleccionado.first_name} {empleadoSeleccionado.last_name}
                  </p>
                  <p className="text-sm text-slate-500">{servicioSeleccionado.nombre}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Servicio:</p>
                  <p className="font-semibold text-slate-900">{servicioSeleccionado.nombre}</p>
                </div>
                <p className="text-xl font-bold text-slate-900">${servicioSeleccionado.precio}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Seleccionar Servicio */}
        {step === 1 && (
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-3xl text-slate-900">Paso 1: Elegí el servicio</CardTitle>
              <CardDescription className="text-lg text-slate-600">Elegí el servicio que querés reservar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selector de categoría */}
              <div>
                <Label htmlFor="categoria" className="text-base font-semibold text-slate-900">Categoría</Label>
                <Popover open={openCategoriaSelect} onOpenChange={setOpenCategoriaSelect}>
                  <PopoverTrigger asChild>
                    <Button
                      id="categoria"
                      variant="outline"
                      className="mt-2 h-12 w-full justify-between rounded-xl border-slate-300 bg-slate-50 text-base font-normal"
                    >
                      <span className={categoriaSeleccionadaNombre ? 'text-foreground' : 'text-muted-foreground'}>
                        {categoriaSeleccionadaNombre || 'Seleccioná una categoría'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <div className="border-b p-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={searchCategoria}
                          onChange={(e) => setSearchCategoria(e.target.value)}
                          placeholder="Buscá categoría..."
                          className="h-9 pl-9"
                        />
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto p-1">
                      {categoriasFiltradas.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          No se encontraron categorías
                        </p>
                      ) : (
                        categoriasFiltradas.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setCategoriaSeleccionada(cat.id);
                              setServicioSeleccionado(null);
                              setOpenCategoriaSelect(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-accent ${categoriaSeleccionada === cat.id ? 'bg-accent' : ''}`}
                          >
                            <span>{cat.nombre}</span>
                            {categoriaSeleccionada === cat.id && <Check className="h-4 w-4 text-primary" />}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const section = document.getElementById('categorias-disponibles');
                      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    ¿Querés conocer las categorías disponibles?
                  </button>
                </div>
              </div>

              <div id="categorias-disponibles" className="rounded-xl border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground">Categorías disponibles y servicios asociados</h3>
                <p className="mb-4 mt-1 text-xs text-muted-foreground">
                  Listado alfabético para consultar rápidamente qué servicios incluye cada categoría.
                </p>

                {loadingCatalogoServicios ? (
                  <div className="py-4">
                    <BeautifulSpinner label="Cargando categorías y servicios..." />
                  </div>
                ) : categoriasOrdenadas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay categorías disponibles en este momento.</p>
                ) : (
                  <div className="space-y-3">
                    {categoriasOrdenadas.map((categoria) => {
                      const serviciosCategoria = getServiciosPorCategoria(categoria.id);
                      return (
                        <div key={categoria.id} className="rounded-lg border bg-background p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-foreground">{categoria.nombre}</p>
                            <Badge variant="outline" className="text-xs">
                              {serviciosCategoria.length} {serviciosCategoria.length === 1 ? 'servicio' : 'servicios'}
                            </Badge>
                          </div>
                          {categoria.descripcion && (
                            <p className="mt-1 text-xs text-muted-foreground">{categoria.descripcion}</p>
                          )}

                          {serviciosCategoria.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {serviciosCategoria.map((servicio) => (
                                <button
                                  key={servicio.id}
                                  type="button"
                                  onClick={() => {
                                    setCategoriaSeleccionada(categoria.id);
                                    setServicioSeleccionado(servicio);
                                    setStep(2);
                                  }}
                                  className="rounded-full border border-transparent bg-secondary px-2.5 py-1 text-xs font-normal text-secondary-foreground transition-colors hover:border-primary/30 hover:bg-primary/10"
                                  aria-label={`Elegir servicio ${servicio.nombre}`}
                                >
                                  {servicio.nombre}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Esta categoría todavía no tiene servicios activos.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Lista de servicios */}
              {categoriaSeleccionada && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-slate-900">Servicio</Label>
                  {loadingServicios ? (
                    <div className="flex items-center justify-center py-8">
                      <BeautifulSpinner label="Cargando servicios disponibles..." />
                    </div>
                  ) : serviciosFiltrados.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-sm text-slate-600">
                      No hay servicios disponibles en esta categoría
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {serviciosFiltrados.map((servicio) => (
                        <div
                          key={servicio.id}
                          onClick={() => {
                            setServicioSeleccionado(servicio);
                            setStep(2);
                          }}
                          className={`group cursor-pointer rounded-2xl border p-4 transition-all ${servicioSeleccionado?.id === servicio.id
                            ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
                            : 'border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm'
                            }`}
                        >
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold leading-tight text-slate-900">{servicio.nombre}</h3>
                              <p className="mt-1 text-xs text-slate-500">{servicio.categoria_nombre}</p>
                            </div>
                            {servicioSeleccionado?.id === servicio.id && (
                              <Badge className="bg-primary text-primary-foreground">Seleccionado</Badge>
                            )}
                          </div>

                          <p className="mb-4 mt-1 line-clamp-2 text-sm text-slate-600">{servicio.descripcion}</p>

                          <div className="flex items-center justify-between">
                            <span className="text-xl font-bold text-primary">${servicio.precio}</span>
                            <Badge variant="outline" className="bg-white text-xs">
                              <Clock className="mr-1.5 h-3 w-3" />
                              {servicio.duracion_horas}
                            </Badge>
                          </div>

                          <div className="mt-3 border-t border-dashed border-slate-200 pt-3">
                            <p className="text-xs font-medium text-primary underline-offset-4 group-hover:underline">
                              Elegir y continuar
                            </p>
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
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-3xl text-slate-900">Paso 2: Elegí el profesional</CardTitle>
              <CardDescription className="text-sm text-slate-500">
                {empleadosFiltrados.length} {empleadosFiltrados.length === 1 ? 'profesional disponible' : 'profesionales disponibles'} para este servicio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingEmpleados ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <BeautifulSpinner label="Buscando profesionales disponibles..." />
                  <p className="text-xs text-muted-foreground">Esto solo tomará un momento.</p>
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
                    En este momento no hay profesionales disponibles para el servicio "{servicioSeleccionado.nombre}".
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Podés intentar:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 mb-6">
                    <li>• Seleccionar otro servicio similar</li>
                    <li>• Contactar directamente al salón</li>
                    <li>• Intentar en otro horario</li>
                  </ul>
                </div>
              ) : (
                <>
                  {/* Barra de búsqueda */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Buscá por nombre, email o biografía..."
                      value={searchEmpleado}
                      onChange={(e) => setSearchEmpleado(e.target.value)}
                      className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10"
                    />
                  </div>

                  {/* Lista de profesionales */}
                  {empleadosFiltrados.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-8 text-center">
                      <p className="text-sm text-slate-600">
                        No se encontraron profesionales con los criterios de búsqueda
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setSearchEmpleado('');
                          setFilterEspecialidad('all');
                        }}
                        className="mt-2"
                      >
                        Limpiar búsqueda
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {empleadosPaginados.map((empleado) => (
                          <button
                            key={empleado.id}
                            type="button"
                            onClick={() => setEmpleadoSeleccionado(empleado)}
                            className={`w-full rounded-2xl border p-4 text-left transition-all ${empleadoSeleccionado?.id === empleado.id
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm'
                              }`}
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-400 text-lg font-bold text-white">
                                {getInicialesProfesional(empleado)}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="mb-1 flex items-start justify-between gap-2">
                                  <h3 className="text-2xl font-semibold leading-tight text-slate-900">
                                    {empleado.first_name} {empleado.last_name}
                                  </h3>
                                  <Badge variant="outline" className="border-yellow-300 bg-yellow-50 text-yellow-700">
                                    ⭐ {empleado.nivel_experiencia?.nivel_display || 'Profesional'}
                                  </Badge>
                                </div>

                                <p className="text-sm font-semibold text-primary">
                                  {servicioSeleccionado.nombre}
                                </p>

                                <p className="mt-2 text-sm text-slate-700">
                                  {empleado.biografia || 'Profesional disponible para este servicio'}
                                </p>

                                <div className="mt-3 rounded-xl bg-slate-100/80 p-3">
                                  <p className="mb-2 text-sm font-semibold text-slate-700">Horarios laborales:</p>
                                  <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-slate-700 sm:grid-cols-2">
                                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((dia) => {
                                      const horariosDia = getHorariosAgrupados(empleado)[dia];
                                      const textoHorario = horariosDia && horariosDia.length > 0
                                        ? formatearRangosHorarios(horariosDia)
                                        : 'Cerrado';
                                      return (
                                        <div key={`${empleado.id}-${dia}`} className="flex items-center justify-between gap-3">
                                          <span className="font-medium text-slate-700">{dia}:</span>
                                          <span className={textoHorario === 'Cerrado' ? 'text-slate-400' : 'text-slate-800'}>
                                            {textoHorario}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                                  <span>{empleado.especialidad_display}</span>
                                  <div className="flex items-center gap-1">
                                    {empleadoSeleccionado?.id === empleado.id && (
                                      <Check className="h-4 w-4 text-primary" />
                                    )}
                                    <span className="text-primary">Elegir</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>

                      {totalPaginas > 1 && currentPage < totalPaginas && (
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.min(totalPaginas, p + 1))}
                          className="pt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                        >
                          Ver más profesionales
                        </button>
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
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[1.7rem] leading-tight text-slate-900 sm:text-3xl">Paso 3: Elegí fecha y hora</CardTitle>
              <CardDescription className="text-sm text-slate-600 sm:text-base">
                Elegí el día y el horario para confirmar tu cita
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-3 flex items-center gap-2.5">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-semibold text-slate-900">Elegí una fecha</h3>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-3">
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
                        if (date < today || date > maxDate) return true;
                        const dateString = date.toISOString().split('T')[0];
                        return !isValidWorkDay(dateString);
                      }}
                      className="mx-auto"
                    />
                  </div>

                  {fechaSeleccionada ? (
                    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium capitalize text-blue-900">
                      {new Date(fechaSeleccionada + 'T12:00:00').toLocaleDateString('es-AR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500 sm:text-sm">
                      Días laborables: {formatDiasTrabajo(empleadoSeleccionado.dias_trabajo)}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-3 flex items-center gap-2.5">
                    <Clock className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-semibold text-slate-900">Elegí un horario</h3>
                  </div>

                  {!fechaSeleccionada ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm text-slate-600">
                      Primero elegí una fecha para ver los horarios disponibles.
                    </div>
                  ) : loadingHorarios ? (
                    <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50">
                      <BeautifulSpinner label="Consultando disponibilidad..." />
                      <p className="text-xs text-muted-foreground text-center px-4">
                        Obteniendo horarios reales disponibles para la fecha seleccionada.
                      </p>
                    </div>
                  ) : horariosDisponiblesOrdenados.length > 0 ? (
                    <>
                      <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Horario más próximo disponible:
                        </p>
                        <p className="text-xl font-bold leading-tight text-emerald-800">
                          {proximoHorarioDisponible || horariosDisponiblesOrdenados[0]}
                        </p>
                      </div>

                      <div className="max-h-64 overflow-y-auto pr-1.5">
                        <div className="grid grid-cols-3 gap-2.5">
                          {horariosDisponiblesOrdenados.map((horario) => (
                            <button
                              key={horario}
                              type="button"
                              onClick={() => setHorarioSeleccionado(horario)}
                              className={`h-10 rounded-xl border text-sm font-semibold transition-all ${horarioSeleccionado === horario
                                ? 'border-transparent bg-linear-to-r from-indigo-500 to-violet-500 text-white shadow-md'
                                : 'border-slate-300 bg-white text-slate-700 hover:border-primary/40 hover:bg-primary/5'
                                }`}
                            >
                              {horario}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full border border-slate-400 bg-white" />
                          <span>Disponible</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                          <span>Seleccionado</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 py-8 text-center">
                      <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-600" />
                      <h3 className="font-semibold text-amber-900">No hay horarios disponibles</h3>
                      <p className="mx-auto mt-2 max-w-xs text-sm text-amber-800">
                        No encontramos horarios libres para esta fecha. Probá otro día o cambiá de profesional.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between border-t border-slate-100 pt-2">
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
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[1.7rem] leading-tight text-slate-900 sm:text-3xl">Paso 4: Confirmar turno</CardTitle>
              <CardDescription className="text-sm text-slate-600 sm:text-base">Revisa los detalles antes de confirmar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resumen detallado */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Header del resumen */}
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                  <h3 className="font-semibold text-slate-900">Resumen del turno</h3>
                </div>

                {/* Detalles */}
                <div className="space-y-4 p-4 sm:p-5">
                  {/* Servicio */}
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Servicio</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{servicioSeleccionado?.nombre}</p>
                        <p className="text-sm text-slate-500">{servicioSeleccionado?.categoria_nombre}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold leading-none text-slate-900">${servicioSeleccionado?.precio}</p>
                        <p className="mt-1 text-xs text-slate-500">{servicioSeleccionado?.duracion_horas}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200" />

                  {/* Profesional */}
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Profesional</p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-400 text-xs font-semibold text-white">
                        {empleadoSeleccionado ? getInicialesProfesional(empleadoSeleccionado) : 'PR'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {empleadoSeleccionado?.first_name} {empleadoSeleccionado?.last_name}
                        </p>
                        {empleadoSeleccionado?.nivel_experiencia ? (
                          <p className="text-xs text-slate-500">
                            ⭐ {empleadoSeleccionado.nivel_experiencia.nivel_display}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500">Profesional asignado</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200" />

                  {/* Fecha y Hora */}
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fecha y Hora</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-900">
                      <div className="flex items-center gap-1.5 text-sm font-medium capitalize">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        <span>
                          {new Date(fechaSeleccionada + 'T12:00:00').toLocaleDateString('es-AR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>{horarioSeleccionado}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200" />

                  {/* Sala */}
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sala</p>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>{servicioSeleccionado?.sala_nombre || 'Sin sala asignada'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notas opcionales */}
              <div>
                <Label htmlFor="notas" className="text-base font-semibold">
                  Notas adicionales (opcional)
                </Label>
                <p className="text-sm text-gray-600 mb-2">
                  ¿Tenés alguna preferencia o comentario para el profesional?
                </p>
                <Textarea
                  id="notas"
                  placeholder="Ej: Prefiero corte con tijera, tengo alergia a ciertos productos, etc."
                  value={notasCliente}
                  onChange={(e) => setNotasCliente(e.target.value)}
                  rows={3}
                  className="resize-none rounded-xl border-slate-300"
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
                  <li>• Por favor, llegá 5 minutos antes de tu horario</li>
                  <li>• Podés cancelar hasta 24 horas antes sin cargo</li>
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
                  Confirmar turno
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialog de confirmación con cálculo de seña */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Confirmar reserva</DialogTitle>
              <DialogDescription>
                Revisá el detalle del pago antes de confirmar tu turno
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Información del servicio */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Resumen del servicio</h4>
                <p className="text-sm text-gray-600">{servicioSeleccionado?.nombre}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-600">Precio total:</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(getPrecioServicioConFidelizacion())}</span>
                </div>
              </div>

              {/* Cálculo de monto a pagar ahora (seña o servicio completo) */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">
                      {pagarServicioCompleto ? 'Pagar servicio completo ahora' : 'Monto de seña requerido'}
                    </h4>
                    <p className="text-sm text-blue-700">
                      {pagarServicioCompleto ? (
                        'Vas a dejar el servicio completamente abonado. El día del turno no vas a tener que pagar la diferencia.'
                      ) : (
                        <>
                          Para reservar tu turno debés abonar el <strong>50%</strong> del precio total como seña.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-blue-200">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-blue-800 uppercase">Modalidad de pago</span>
                    <span className="text-sm text-blue-900">
                      {pagarServicioCompleto ? 'Servicio completo' : 'Solo seña'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-800">Solo seña</span>
                    <Switch
                      checked={pagarServicioCompleto}
                      onCheckedChange={setPagarServicioCompleto}
                      className="data-[state=checked]:bg-blue-600"
                    />
                    <span className="text-xs text-blue-800">Servicio completo</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-medium text-blue-900">
                    {pagarServicioCompleto ? 'Monto a pagar ahora:' : 'Monto de seña:'}
                  </span>
                  <span className="text-xl font-bold text-blue-900">{formatCurrency(calcularMontoBasePago())}</span>
                </div>
              </div>

              {/* Selector de usar saldo en el pago actual */}
              {billetera && parseFloat(billetera.saldo) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-900">Usar saldo de billetera en este pago</p>
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
                        <span className="text-green-700">
                          {pagarServicioCompleto ? 'Monto a pagar:' : 'Seña requerida:'}
                        </span>
                        <span className="font-medium">{formatCurrency(calcularMontoBasePago())}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-700">Saldo aplicado:</span>
                        <span className="font-medium text-green-600">-{formatCurrency(getSaldoUtilizadoEnPago())}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold pt-2 border-t border-green-200">
                        <span className="text-green-900">Total a pagar ahora:</span>
                        <span className={calcularPagoFinalAhora() === 0 ? 'text-green-600' : 'text-green-900'}>
                          {formatCurrency(calcularPagoFinalAhora())}
                        </span>
                      </div>
                      {calcularPagoFinalAhora() === 0 && (
                        <p className="text-xs text-green-600 mt-2 text-center">
                          🎉 ¡Tu saldo cubre el 100% de este pago!
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
                    {formatCurrency(calcularPagoFinalAhora())}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {pagarServicioCompleto
                    ? 'Estarás pagando el servicio completo por adelantado.'
                    : 'El resto se abona al finalizar el servicio.'}
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
                className={usarSaldoEnSena && calcularPagoFinalAhora() === 0 ? 'bg-green-600 hover:bg-green-700' : ''}
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
    </div>
  );
}
