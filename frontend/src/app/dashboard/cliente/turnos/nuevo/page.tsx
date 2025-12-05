'use client';

import { AlertCircle, ArrowLeft, Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, Clock, Loader2, Search, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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
  precio: string;
  duracion_minutos: number;
  duracion_horas: string;
  is_active: boolean;
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

  // Estados para búsqueda y paginación de profesionales
  const [searchEmpleado, setSearchEmpleado] = useState('');
  const [filterEspecialidad, setFilterEspecialidad] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const empleadosPorPagina = 5;

  // Función para obtener headers con autenticación
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Token ${token}` : ''
    };
  };

  // Base URL de la API
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

  // Cargar categorías al montar
  useEffect(() => {
    fetchCategorias();
  }, []);

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
      setEmpleadoSeleccionado(null); // Reset empleado cuando cambia el servicio
      setFechaSeleccionada(''); // Reset fecha
      setHorarioSeleccionado(''); // Reset horario
      fetchEmpleados();
    }
  }, [servicioSeleccionado]);

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
      setHorarioSeleccionado(''); // Reset horario cuando cambia fecha
      fetchHorariosDisponibles();
    }
  }, [empleadoSeleccionado, fechaSeleccionada]);

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
      return;
    }

    // Prevenir doble submit
    if (loading) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Obtener el perfil del cliente actual
      const profileResponse = await fetch(`${API_BASE_URL}/clientes/me/`, {
        headers: getAuthHeaders()
      });

      if (!profileResponse.ok) {
        throw new Error('No se pudo obtener el perfil del cliente');
      }

      const clienteData = await profileResponse.json();

      // Crear el turno
      const fechaHora = `${fechaSeleccionada}T${horarioSeleccionado}:00`;

      const turnoData: any = {
        cliente: clienteData.id,
        empleado: empleadoSeleccionado.id,
        servicio: servicioSeleccionado.id,
        fecha_hora: fechaHora,
      };

      // Agregar notas solo si hay contenido
      if (notasCliente.trim()) {
        turnoData.notas_cliente = notasCliente.trim();
      }

      console.log('=== DATOS DEL TURNO ===');
      console.log('Cliente ID:', clienteData.id);
      console.log('Empleado ID:', empleadoSeleccionado.id);
      console.log('Servicio ID:', servicioSeleccionado.id);
      console.log('Fecha seleccionada:', fechaSeleccionada);
      console.log('Horario seleccionado:', horarioSeleccionado);
      console.log('Fecha/Hora completa:', fechaHora);
      console.log('Notas:', notasCliente);
      console.log('Objeto completo:', turnoData);
      console.log('JSON a enviar:', JSON.stringify(turnoData, null, 2));

      const response = await fetch(`${API_BASE_URL}/turnos/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(turnoData)
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard/cliente/turnos');
        }, 2000);
      } else {
        const responseText = await response.text();
        console.error('Error response text:', responseText);

        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText };
        }

        console.error('Error del servidor:', errorData);

        // Manejar errores de validación
        if (errorData.non_field_errors) {
          // Errores de validación de conjunto único
          const mensajeError = Array.isArray(errorData.non_field_errors)
            ? errorData.non_field_errors[0]
            : errorData.non_field_errors;
          setError(mensajeError);
        } else if (errorData.fecha_hora) {
          // Puede ser un array o un string
          const mensajeError = Array.isArray(errorData.fecha_hora)
            ? errorData.fecha_hora[0]
            : errorData.fecha_hora;
          setError(mensajeError);
        } else if (errorData.detail) {
          setError(errorData.detail);
        } else if (errorData.error) {
          setError(errorData.error);
        } else if (errorData.notas_cliente) {
          const mensajeError = Array.isArray(errorData.notas_cliente)
            ? errorData.notas_cliente[0]
            : errorData.notas_cliente;
          setError(mensajeError);
        } else {
          setError('Error al crear el turno. Por favor verifica los datos.');
        }
      }
    } catch (error: any) {
      console.error('Error creating turno:', error);
      setError(error.message || 'Error al crear el turno. Por favor intenta nuevamente.');
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
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-primary">
                      ${servicioSeleccionado?.precio}
                    </span>
                    <span className="text-sm text-gray-600">ARS</span>
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
                onClick={handleSubmit}
                disabled={loading}
                size="lg"
                className="min-w-[150px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Confirmar Turno
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
