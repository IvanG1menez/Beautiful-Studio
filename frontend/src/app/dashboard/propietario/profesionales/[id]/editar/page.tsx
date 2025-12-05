'use client';

import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ExternalLink, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Servicio {
  id: number;
  nombre: string;
  categoria_nombre: string;
  is_active: boolean;
}

interface Empleado {
  id: number;
  user?: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    dni?: string;
    role: string;
  };
  // Campos legacy por compatibilidad
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  user_dni?: string;
  especialidades: string;
  especialidad_display: string;
  fecha_ingreso: string;
  horario_entrada: string;
  horario_salida: string;
  dias_trabajo: string;
  comision_porcentaje: string;
  is_disponible: boolean;
  biografia?: string;
}

interface RangoHorario {
  hora_inicio: string;
  hora_fin: string;
}

interface DiaConfig {
  activo: boolean;
  rangos: RangoHorario[];
}

interface HorariosConfig {
  [dia: number]: DiaConfig;
}

const DIAS_SEMANA = [
  { value: 0, label: 'Lunes', abbr: 'L' },
  { value: 1, label: 'Martes', abbr: 'M' },
  { value: 2, label: 'Miércoles', abbr: 'X' },
  { value: 3, label: 'Jueves', abbr: 'J' },
  { value: 4, label: 'Viernes', abbr: 'V' },
  { value: 5, label: 'Sábado', abbr: 'S' },
  { value: 6, label: 'Domingo', abbr: 'D' },
];

export default function EditarProfesionalPage() {
  const router = useRouter();
  const params = useParams();
  const empleadoId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingServicios, setLoadingServicios] = useState(true);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({
    title: '',
    description: '',
    type: 'success' as 'success' | 'error'
  });

  const [formData, setFormData] = useState({
    // Datos de usuario (solo para mostrar, no se envían en PUT)
    username: '',
    email: '',
    dni: '',
    first_name: '',
    last_name: '',

    // Datos de empleado (se envían en PUT)
    especialidades: '',
    fecha_ingreso: '',
    horario_entrada: '',
    horario_salida: '',
    dias_trabajo: '',
    comision_porcentaje: '',
    is_disponible: true,
    biografia: ''
  });

  // Estado de horarios detallados
  const [horarios, setHorarios] = useState<HorariosConfig>(() => {
    const initial: HorariosConfig = {};
    DIAS_SEMANA.forEach(dia => {
      initial[dia.value] = {
        activo: false,
        rangos: []
      };
    });
    return initial;
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Token ${token}` : ''
    };
  };

  const showNotification = (title: string, description: string, type: 'success' | 'error') => {
    setNotificationMessage({ title, description, type });
    setNotificationDialogOpen(true);
  };

  // Cargar servicios activos
  useEffect(() => {
    const fetchServicios = async () => {
      setLoadingServicios(true);
      try {
        const response = await fetch('http://localhost:8000/api/servicios/', {
          headers: getAuthHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          const serviciosActivos = (data.results || data).filter((serv: Servicio) => serv.is_active);
          setServicios(serviciosActivos);
        }
      } catch (error) {
        console.error('Error fetching servicios:', error);
      } finally {
        setLoadingServicios(false);
      }
    };

    fetchServicios();
  }, []);

  // Preparar opciones para el Combobox
  const serviciosOptions: ComboboxOption[] = servicios.map(servicio => ({
    value: servicio.id.toString(),
    label: servicio.nombre,
    description: servicio.categoria_nombre
  }));

  // Funciones para manejar horarios
  const toggleDia = (dia: number) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        activo: !prev[dia].activo,
        rangos: !prev[dia].activo && prev[dia].rangos.length === 0
          ? [{ hora_inicio: '09:00', hora_fin: '17:00' }]
          : prev[dia].rangos
      }
    }));
  };

  const agregarRango = (dia: number) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        rangos: [...prev[dia].rangos, { hora_inicio: '09:00', hora_fin: '17:00' }]
      }
    }));
  };

  const eliminarRango = (dia: number, index: number) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        rangos: prev[dia].rangos.filter((_, i) => i !== index)
      }
    }));
  };

  const actualizarRango = (dia: number, index: number, field: 'hora_inicio' | 'hora_fin', value: string) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        rangos: prev[dia].rangos.map((r, i) =>
          i === index ? { ...r, [field]: value } : r
        )
      }
    }));
  };

  // Cargar datos del empleado y horarios
  useEffect(() => {
    const fetchEmpleado = async () => {
      setLoadingData(true);
      try {
        // Cargar datos del empleado
        const response = await fetch(`http://localhost:8000/api/empleados/${empleadoId}/`, {
          headers: getAuthHeaders()
        });

        if (response.ok) {
          const empleado: Empleado = await response.json();
          setFormData({
            username: empleado.user?.username || empleado.username || '',
            email: empleado.user?.email || empleado.email || '',
            dni: empleado.user?.dni || empleado.user_dni || '',
            first_name: empleado.user?.first_name || empleado.first_name || '',
            last_name: empleado.user?.last_name || empleado.last_name || '',
            especialidades: empleado.especialidades || '',
            fecha_ingreso: empleado.fecha_ingreso || '',
            horario_entrada: empleado.horario_entrada || '',
            horario_salida: empleado.horario_salida || '',
            dias_trabajo: empleado.dias_trabajo || '',
            comision_porcentaje: empleado.comision_porcentaje || '',
            is_disponible: empleado.is_disponible ?? true,
            biografia: empleado.biografia || ''
          });

          // Cargar horarios detallados
          const horariosResponse = await fetch(
            `http://localhost:8000/api/empleados/horarios/?empleado=${empleadoId}&page_size=1000`,
            { headers: getAuthHeaders() }
          );

          if (horariosResponse.ok) {
            const horariosData = await horariosResponse.json();
            const horariosExistentes = horariosData.results || horariosData;

            // Resetear horarios
            const nuevosHorarios: HorariosConfig = {};
            DIAS_SEMANA.forEach(dia => {
              nuevosHorarios[dia.value] = {
                activo: false,
                rangos: []
              };
            });

            // Agrupar horarios por día
            horariosExistentes.forEach((h: any) => {
              if (!nuevosHorarios[h.dia_semana].activo) {
                nuevosHorarios[h.dia_semana].activo = true;
              }
              nuevosHorarios[h.dia_semana].rangos.push({
                hora_inicio: h.hora_inicio.slice(0, 5),
                hora_fin: h.hora_fin.slice(0, 5)
              });
            });

            setHorarios(nuevosHorarios);
          }
        } else {
          showNotification(
            'Error al cargar profesional',
            'No se pudo cargar la información del profesional',
            'error'
          );
          setTimeout(() => {
            router.push('/dashboard/propietario/profesionales');
          }, 2000);
        }
      } catch (error) {
        console.error('Error fetching empleado:', error);
        showNotification(
          'Error de conexión',
          'No se pudo conectar con el servidor',
          'error'
        );
      } finally {
        setLoadingData(false);
      }
    };

    if (empleadoId) {
      fetchEmpleado();
    }
  }, [empleadoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validaciones básicas
      if (!formData.especialidades) {
        showNotification(
          'Especialidad requerida',
          'Por favor selecciona al menos una especialidad',
          'error'
        );
        setLoading(false);
        return;
      }

      // Generar dias_trabajo basado en horarios activos
      const diasActivos = DIAS_SEMANA
        .filter(dia => horarios[dia.value].activo)
        .map(dia => dia.abbr)
        .join(',');

      // Obtener primer y último horario para horario_entrada/salida
      let horarioEntrada = '09:00';
      let horarioSalida = '17:00';

      const todosLosRangos: Array<{ hora_inicio: string; hora_fin: string }> = [];
      Object.values(horarios).forEach(dia => {
        if (dia.activo) {
          todosLosRangos.push(...dia.rangos);
        }
      });

      if (todosLosRangos.length > 0) {
        horarioEntrada = todosLosRangos
          .map(r => r.hora_inicio)
          .sort()[0];
        horarioSalida = todosLosRangos
          .map(r => r.hora_fin)
          .sort()
          .reverse()[0];
      }

      // Preparar datos para enviar (solo datos de empleado, no de usuario)
      const dataToSend = {
        especialidades: formData.especialidades,
        fecha_ingreso: formData.fecha_ingreso,
        horario_entrada: horarioEntrada,
        horario_salida: horarioSalida,
        dias_trabajo: diasActivos || formData.dias_trabajo,
        comision_porcentaje: formData.comision_porcentaje,
        is_disponible: formData.is_disponible,
        biografia: formData.biografia
      };

      const response = await fetch(`http://localhost:8000/api/empleados/${empleadoId}/`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(dataToSend)
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = Object.entries(errorData)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        showNotification(
          'Error al actualizar profesional',
          errorMessage || 'No se pudo actualizar el profesional. Por favor, verifica los datos e intenta nuevamente.',
          'error'
        );
        setLoading(false);
        return;
      }

      // Guardar horarios detallados
      const horariosArray: any[] = [];
      Object.entries(horarios).forEach(([dia, config]) => {
        if (config.activo && config.rangos.length > 0) {
          config.rangos.forEach((rango: RangoHorario) => {
            if (rango.hora_inicio && rango.hora_fin) {
              horariosArray.push({
                dia_semana: parseInt(dia),
                hora_inicio: rango.hora_inicio,
                hora_fin: rango.hora_fin,
                is_active: true
              });
            }
          });
        }
      });

      const horariosResponse = await fetch(
        `http://localhost:8000/api/empleados/${empleadoId}/horarios/bulk/`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ horarios: horariosArray })
        }
      );

      if (horariosResponse.ok) {
        showNotification(
          'Profesional actualizado',
          'Los datos y horarios del profesional han sido actualizados exitosamente',
          'success'
        );

        // Redirigir después de 1.5 segundos
        setTimeout(() => {
          router.push('/dashboard/propietario/profesionales');
        }, 1500);
      } else {
        showNotification(
          'Advertencia',
          'Los datos se actualizaron pero hubo un problema al guardar los horarios',
          'error'
        );
      }
    } catch (error) {
      console.error('Error updating empleado:', error);
      showNotification(
        'Error de conexión',
        'No se pudo conectar con el servidor. Por favor, intenta nuevamente.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loadingData) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando datos del profesional...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/dashboard/propietario/profesionales')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Profesional</h1>
          <p className="text-muted-foreground">
            Modificar datos de {formData.first_name} {formData.last_name}
          </p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos de Usuario (Solo lectura) */}
        <Card>
          <CardHeader>
            <CardTitle>Datos de Usuario</CardTitle>
            <CardDescription>
              Información de acceso (solo lectura)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Username y Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  value={formData.username}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            {/* DNI, Nombre y Apellido */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dni">DNI / Documento</Label>
                <Input
                  id="dni"
                  value={formData.dni}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Datos Profesionales */}
        <Card>
          <CardHeader>
            <CardTitle>Datos Profesionales</CardTitle>
            <CardDescription>Especialidad y horarios de trabajo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Especialidad y Fecha de Ingreso */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="especialidades">Servicio/Especialidad *</Label>

                <Combobox
                  options={serviciosOptions}
                  value={formData.especialidades}
                  onValueChange={(value) => handleInputChange('especialidades', value)}
                  placeholder={loadingServicios ? "Cargando servicios..." : "Buscar y seleccionar servicio"}
                  searchPlaceholder="Buscar servicio o categoría..."
                  emptyMessage="No se encontraron servicios"
                  disabled={loadingServicios}
                />

                {/* Enlace para crear servicio */}
                <Link
                  href="/dashboard/propietario/servicios/nuevo"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline mt-1"
                  target="_blank"
                >
                  <ExternalLink className="w-3 h-3" />
                  ¿No encuentra el servicio? Añada uno
                </Link>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_ingreso">Fecha de Ingreso *</Label>
                <Input
                  id="fecha_ingreso"
                  type="date"
                  value={formData.fecha_ingreso}
                  onChange={(e) => handleInputChange('fecha_ingreso', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Comisión */}
            <div className="space-y-2">
              <Label htmlFor="comision_porcentaje">Comisión (%)</Label>
              <Input
                id="comision_porcentaje"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.comision_porcentaje}
                onChange={(e) => handleInputChange('comision_porcentaje', e.target.value)}
                className="w-48"
              />
            </div>

            {/* Horarios por Día */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Horarios de Trabajo *</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecciona los días y horarios en que el profesional estará disponible
                </p>
              </div>

              {DIAS_SEMANA.map((dia) => (
                <div
                  key={dia.value}
                  className={`border rounded-lg p-4 transition-all ${horarios[dia.value].activo
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200'
                    }`}
                >
                  {/* Switch del día */}
                  <div className="flex items-center gap-3 mb-4">
                    <Switch
                      id={`dia-${dia.value}`}
                      checked={horarios[dia.value].activo}
                      onCheckedChange={() => toggleDia(dia.value)}
                    />
                    <label
                      htmlFor={`dia-${dia.value}`}
                      className="text-base font-semibold text-gray-900 cursor-pointer select-none"
                    >
                      {dia.label}
                    </label>
                  </div>

                  {/* Rangos horarios */}
                  {horarios[dia.value].activo && (
                    <div className="space-y-3 ml-8">
                      {horarios[dia.value].rangos.map((rango, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={rango.hora_inicio}
                            onChange={(e) => actualizarRango(dia.value, index, 'hora_inicio', e.target.value)}
                            className="w-32"
                          />
                          <span className="text-gray-500">-</span>
                          <Input
                            type="time"
                            value={rango.hora_fin}
                            onChange={(e) => actualizarRango(dia.value, index, 'hora_fin', e.target.value)}
                            className="w-32"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => eliminarRango(dia.value, index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}

                      {/* Botón agregar horario */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => agregarRango(dia.value)}
                        className="text-sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Agregar otro horario
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Biografía */}
            <div className="space-y-2">
              <Label htmlFor="biografia">Biografía Profesional</Label>
              <Textarea
                id="biografia"
                value={formData.biografia}
                onChange={(e) => handleInputChange('biografia', e.target.value)}
                placeholder="Breve descripción del profesional, experiencia, especialidades, etc."
                rows={4}
              />
            </div>

            {/* Disponibilidad */}
            <div className="flex items-center space-x-3">
              <Switch
                id="is_disponible"
                checked={formData.is_disponible}
                onCheckedChange={(checked) => handleInputChange('is_disponible', checked)}
              />
              <Label htmlFor="is_disponible" className="cursor-pointer font-medium">
                Disponible para turnos
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Botones de Acción */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/propietario/profesionales')}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Cambios
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Modal de Notificación */}
      <AlertDialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{notificationMessage.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {notificationMessage.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
