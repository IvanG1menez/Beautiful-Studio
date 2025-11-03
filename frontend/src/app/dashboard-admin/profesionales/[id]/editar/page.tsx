'use client';

import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Empleado {
  id: number;
  user: string;
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

export default function EditarProfesionalPage() {
  const router = useRouter();
  const params = useParams();
  const empleadoId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
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

  // Cargar datos del empleado
  useEffect(() => {
    const fetchEmpleado = async () => {
      setLoadingData(true);
      try {
        const response = await fetch(`http://localhost:8000/api/empleados/${empleadoId}/`, {
          headers: getAuthHeaders()
        });

        if (response.ok) {
          const empleado: Empleado = await response.json();
          setFormData({
            username: empleado.username || '',
            email: empleado.email || '',
            dni: empleado.user_dni || '',
            first_name: empleado.first_name || '',
            last_name: empleado.last_name || '',
            especialidades: empleado.especialidades || '',
            fecha_ingreso: empleado.fecha_ingreso || '',
            horario_entrada: empleado.horario_entrada || '',
            horario_salida: empleado.horario_salida || '',
            dias_trabajo: empleado.dias_trabajo || '',
            comision_porcentaje: empleado.comision_porcentaje || '',
            is_disponible: empleado.is_disponible ?? true,
            biografia: empleado.biografia || ''
          });
        } else {
          showNotification(
            'Error al cargar profesional',
            'No se pudo cargar la información del profesional',
            'error'
          );
          setTimeout(() => {
            router.push('/dashboard-admin/profesionales');
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

      // Preparar datos para enviar (solo datos de empleado, no de usuario)
      const dataToSend = {
        especialidades: formData.especialidades,
        fecha_ingreso: formData.fecha_ingreso,
        horario_entrada: formData.horario_entrada,
        horario_salida: formData.horario_salida,
        dias_trabajo: formData.dias_trabajo,
        comision_porcentaje: formData.comision_porcentaje,
        is_disponible: formData.is_disponible,
        biografia: formData.biografia
      };

      const response = await fetch(`http://localhost:8000/api/empleados/${empleadoId}/`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        showNotification(
          'Profesional actualizado',
          'Los datos del profesional han sido actualizados exitosamente',
          'success'
        );

        // Redirigir después de 1.5 segundos
        setTimeout(() => {
          router.push('/dashboard-admin/profesionales');
        }, 1500);
      } else {
        const errorData = await response.json();
        const errorMessage = Object.entries(errorData)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        showNotification(
          'Error al actualizar profesional',
          errorMessage || 'No se pudo actualizar el profesional. Por favor, verifica los datos e intenta nuevamente.',
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
          onClick={() => router.push('/dashboard-admin/profesionales')}
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
              Información de acceso (solo lectura - contacta al administrador para modificar)
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

            <p className="text-sm text-muted-foreground">
              ℹ️ Los datos de usuario no pueden modificarse desde aquí por seguridad.
            </p>
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
                <Label htmlFor="especialidades">Especialidad *</Label>
                <Select
                  value={formData.especialidades}
                  onValueChange={(value) => handleInputChange('especialidades', value)}
                >
                  <SelectTrigger id="especialidades">
                    <SelectValue placeholder="Seleccionar especialidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corte">Corte</SelectItem>
                    <SelectItem value="color">Colorista</SelectItem>
                    <SelectItem value="tratamientos">Especialista en Tratamientos</SelectItem>
                    <SelectItem value="unas">Manicurista/Pedicurista</SelectItem>
                    <SelectItem value="maquillaje">Maquillador/a</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
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

            {/* Horarios */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="horario_entrada">Hora de Entrada *</Label>
                <Input
                  id="horario_entrada"
                  type="time"
                  value={formData.horario_entrada}
                  onChange={(e) => handleInputChange('horario_entrada', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horario_salida">Hora de Salida *</Label>
                <Input
                  id="horario_salida"
                  type="time"
                  value={formData.horario_salida}
                  onChange={(e) => handleInputChange('horario_salida', e.target.value)}
                  required
                />
              </div>
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
                />
              </div>
            </div>

            {/* Días de Trabajo */}
            <div className="space-y-2">
              <Label htmlFor="dias_trabajo">Días de Trabajo *</Label>
              <Input
                id="dias_trabajo"
                value={formData.dias_trabajo}
                onChange={(e) => handleInputChange('dias_trabajo', e.target.value)}
                placeholder="L,M,M,J,V (Lunes, Martes, Miércoles, Jueves, Viernes)"
                required
              />
              <p className="text-sm text-muted-foreground">
                Formato: L,M,M,J,V,S,D (separados por comas)
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
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_disponible"
                checked={formData.is_disponible}
                onChange={(e) => handleInputChange('is_disponible', e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="is_disponible" className="cursor-pointer">
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
            onClick={() => router.push('/dashboard-admin/profesionales')}
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
