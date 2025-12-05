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
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Servicio {
  id: number;
  nombre: string;
  categoria_nombre: string;
  is_active: boolean;
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

const DIAS_SEMANA: { [key: number]: string } = {
  0: 'Lunes',
  1: 'Martes',
  2: 'Miércoles',
  3: 'Jueves',
  4: 'Viernes',
  5: 'Sábado',
  6: 'Domingo'
};

export default function NuevoProfesionalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingServicios, setLoadingServicios] = useState(true);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({
    title: '',
    description: '',
    type: 'success' as 'success' | 'error'
  });

  const [formData, setFormData] = useState({
    // Datos de usuario
    username: '',
    email: '',
    dni: '',
    password: '',
    first_name: '',
    last_name: '',

    // Datos de empleado
    especialidades: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    comision_porcentaje: '15.00',
    is_disponible: true,
    biografia: ''
  });

  // Estado de horarios detallados
  const [horarios, setHorarios] = useState<HorariosConfig>({
    0: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] },
    1: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] },
    2: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] },
    3: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] },
    4: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] },
    5: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] },
    6: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validaciones básicas
      if (!formData.username || !formData.email || !formData.first_name || !formData.last_name) {
        showNotification(
          'Campos requeridos',
          'Por favor completa todos los campos obligatorios marcados con *',
          'error'
        );
        setLoading(false);
        return;
      }

      if (!formData.especialidades) {
        showNotification(
          'Especialidad requerida',
          'Por favor selecciona al menos una especialidad',
          'error'
        );
        setLoading(false);
        return;
      }

      // Verificar que al menos un día esté activo
      const diasActivos = Object.values(horarios).filter(h => h.activo);
      if (diasActivos.length === 0) {
        showNotification(
          'Horarios requeridos',
          'Por favor configura al menos un día de trabajo con su horario',
          'error'
        );
        setLoading(false);
        return;
      }

      // Calcular horario_entrada y horario_salida basándose en todos los rangos activos
      let horaMinima = '23:59';
      let horaMaxima = '00:00';
      const diasTrabajoArray: string[] = [];

      Object.entries(horarios).forEach(([diaStr, config]) => {
        if (config.activo && config.rangos.length > 0) {
          // Agregar letra del día (L, M, X, J, V, S, D)
          const letrasDias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
          diasTrabajoArray.push(letrasDias[parseInt(diaStr)]);

          config.rangos.forEach((rango: RangoHorario) => {
            if (rango.hora_inicio && rango.hora_fin) {
              if (rango.hora_inicio < horaMinima) horaMinima = rango.hora_inicio;
              if (rango.hora_fin > horaMaxima) horaMaxima = rango.hora_fin;
            }
          });
        }
      });

      // Preparar datos para enviar
      const dataToSend = {
        ...formData,
        password: formData.password || 'empleado123', // Password por defecto si no se especifica
        horario_entrada: horaMinima,
        horario_salida: horaMaxima,
        dias_trabajo: diasTrabajoArray.join(',')
      };

      console.log('Enviando datos del empleado:', dataToSend);

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${baseUrl}/empleados/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        const empleadoData = await response.json();
        const empleadoId = empleadoData.id;

        // Guardar horarios detallados
        const horariosArray: any[] = [];
        Object.entries(horarios).forEach(([diaStr, config]) => {
          const dia = parseInt(diaStr);
          if (config.activo && config.rangos.length > 0) {
            config.rangos.forEach((rango: RangoHorario) => {
              if (rango.hora_inicio && rango.hora_fin) {
                horariosArray.push({
                  dia_semana: dia,
                  hora_inicio: rango.hora_inicio,
                  hora_fin: rango.hora_fin
                });
              }
            });
          }
        });

        // Solo guardar horarios si hay al menos uno configurado
        if (horariosArray.length > 0) {
          const horariosResponse = await fetch(
            `${baseUrl}/empleados/${empleadoId}/horarios/bulk/`,
            {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ horarios: horariosArray })
            }
          );

          if (!horariosResponse.ok) {
            console.error('Error al guardar horarios:', await horariosResponse.json());
            showNotification(
              'Advertencia',
              'El profesional fue creado pero hubo un problema al guardar los horarios. Puedes editarlos posteriormente.',
              'error'
            );

            // Esperar antes de redirigir
            setTimeout(() => {
              router.push('/dashboard/propietario/profesionales');
            }, 2500);
            return;
          }
        }

        showNotification(
          'Profesional creado',
          'El profesional y sus horarios han sido creados exitosamente',
          'success'
        );

        // Redirigir después de 1.5 segundos
        setTimeout(() => {
          router.push('/dashboard/propietario/profesionales');
        }, 1500);
      } else {
        const errorData = await response.json();
        const errorMessage = Object.entries(errorData)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        showNotification(
          'Error al crear profesional',
          errorMessage || 'No se pudo crear el profesional. Por favor, verifica los datos e intenta nuevamente.',
          'error'
        );
      }
    } catch (error) {
      console.error('Error creating empleado:', error);
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
          <h1 className="text-3xl font-bold">Nuevo Profesional</h1>
          <p className="text-muted-foreground">Completa los datos para crear un nuevo profesional</p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos de Usuario */}
        <Card>
          <CardHeader>
            <CardTitle>Datos de Usuario</CardTitle>
            <CardDescription>Información de acceso y contacto del profesional</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Username y Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder="usuario123"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  required
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
                  onChange={(e) => handleInputChange('dni', e.target.value)}
                  placeholder="12345678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="María"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="González"
                  required
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Dejar vacío para usar 'empleado123'"
              />
              <p className="text-sm text-muted-foreground">
                Si no se especifica, se usará la contraseña por defecto: <code>empleado123</code>
              </p>
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

            {/* Horarios por Día */}
            <div className="space-y-4">
              <div>
                <Label>Horarios por Día de la Semana</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Configura los horarios de trabajo para cada día. Puedes agregar múltiples rangos por día.
                </p>
              </div>
              {Object.entries(DIAS_SEMANA).map(([diaStr, nombre]) => {
                const dia = parseInt(diaStr);
                const config = horarios[dia];
                return (
                  <div
                    key={dia}
                    className={`p-4 border rounded-lg transition-all ${config.activo
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 bg-gray-50/50'
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Switch
                        id={`dia-${dia}`}
                        checked={config.activo}
                        onCheckedChange={(checked) => toggleDia(dia)}
                      />
                      <Label
                        htmlFor={`dia-${dia}`}
                        className="font-semibold cursor-pointer"
                      >
                        {nombre}
                      </Label>
                    </div>

                    {config.activo && (
                      <div className="space-y-2 ml-7">
                        {config.rangos.map((rango, index) => (
                          <div key={index} className="flex items-center gap-2 flex-wrap">
                            <Input
                              type="time"
                              value={rango.hora_inicio}
                              onChange={(e) => actualizarRango(dia, index, 'hora_inicio', e.target.value)}
                              className="w-32"
                            />
                            <span className="text-muted-foreground">hasta</span>
                            <Input
                              type="time"
                              value={rango.hora_fin}
                              onChange={(e) => actualizarRango(dia, index, 'hora_fin', e.target.value)}
                              className="w-32"
                            />
                            {config.rangos.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => eliminarRango(dia, index)}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => agregarRango(dia)}
                          className="mt-2"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar otro horario
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
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
                placeholder="15.00"
              />
              <p className="text-sm text-muted-foreground">
                Porcentaje de comisión que recibe el profesional por cada servicio
              </p>
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
                Creando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Crear Profesional
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
