'use client';

import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ClienteDetalle {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    dni: string;
    is_active: boolean;
  };
  fecha_nacimiento?: string;
  direccion?: string;
  preferencias?: string;
  fecha_primera_visita?: string;
  is_vip: boolean;
  nombre_completo: string;
  edad?: number;
  tiempo_como_cliente?: number;
}

export default function EditarClientePage() {
  const router = useRouter();
  const params = useParams();
  const clienteId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({
    title: '',
    description: '',
    type: 'success' as 'success' | 'error'
  });

  const [formData, setFormData] = useState({
    // Datos del usuario (algunos serán de solo lectura)
    username: '',
    dni: '',
    // Datos editables
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    // Datos del cliente
    fecha_nacimiento: '',
    direccion: '',
    preferencias: '',
    is_vip: false
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

  // Cargar datos del cliente
  useEffect(() => {
    const fetchCliente = async () => {
      setLoadingData(true);
      try {
        const headers = getAuthHeaders();
        const response = await fetch(`http://localhost:8000/api/clientes/${clienteId}/`, { headers });

        if (response.ok) {
          const cliente: ClienteDetalle = await response.json();
          setFormData({
            username: cliente.user.username,
            dni: cliente.user.dni || '',
            email: cliente.user.email,
            first_name: cliente.user.first_name,
            last_name: cliente.user.last_name,
            phone: cliente.user.phone || '',
            fecha_nacimiento: cliente.fecha_nacimiento || '',
            direccion: cliente.direccion || '',
            preferencias: cliente.preferencias || '',
            is_vip: cliente.is_vip
          });
        } else {
          showNotification(
            'Error al cargar cliente',
            'No se pudo cargar la información del cliente',
            'error'
          );
          setTimeout(() => {
            router.push('/dashboard/propietario/clientes');
          }, 2000);
        }
      } catch (error) {
        console.error('Error fetching cliente:', error);
        showNotification(
          'Error de conexión',
          'No se pudo conectar con el servidor',
          'error'
        );
      } finally {
        setLoadingData(false);
      }
    };

    if (clienteId) {
      fetchCliente();
    }
  }, [clienteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validaciones básicas
      if (!formData.email || !formData.first_name || !formData.last_name) {
        showNotification(
          'Campos requeridos',
          'Por favor completa todos los campos obligatorios: email, nombre y apellido',
          'error'
        );
        setLoading(false);
        return;
      }

      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        showNotification(
          'Email inválido',
          'Por favor ingresa un email válido',
          'error'
        );
        setLoading(false);
        return;
      }

      // Preparar datos para enviar (solo campos editables)
      const dataToSend = {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        fecha_nacimiento: formData.fecha_nacimiento || null,
        direccion: formData.direccion,
        preferencias: formData.preferencias,
        is_vip: formData.is_vip
      };

      const response = await fetch(`http://localhost:8000/api/clientes/${clienteId}/`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        showNotification(
          'Cliente actualizado',
          `Los datos del cliente han sido actualizados exitosamente`,
          'success'
        );

        // Redirigir después de 1.5 segundos
        setTimeout(() => {
          router.push('/dashboard/propietario/clientes');
        }, 1500);
      } else {
        const errorData = await response.json();

        // Manejar errores específicos
        let errorMessage = 'No se pudo actualizar el cliente. Por favor, verifica los datos.';

        if (errorData.email) {
          errorMessage = `Email: ${errorData.email[0]}`;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else {
          errorMessage = Object.entries(errorData)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        }

        showNotification(
          'Error al actualizar cliente',
          errorMessage,
          'error'
        );
      }
    } catch (error) {
      console.error('Error updating cliente:', error);
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
          <span className="ml-2">Cargando datos del cliente...</span>
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
          onClick={() => router.push('/dashboard/propietario/clientes')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Cliente</h1>
          <p className="text-muted-foreground">
            Modificar datos de {formData.first_name} {formData.last_name}
          </p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos de Usuario (Solo Lectura) */}
        <Card>
          <CardHeader>
            <CardTitle>Datos de Usuario</CardTitle>
            <CardDescription>Información de acceso (no editable)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username - Solo lectura */}
              <div className="space-y-2">
                <Label htmlFor="username">Nombre de Usuario</Label>
                <Input
                  id="username"
                  value={formData.username}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-sm text-muted-foreground">
                  El username no se puede modificar
                </p>
              </div>

              {/* DNI - Solo lectura */}
              <div className="space-y-2">
                <Label htmlFor="dni">DNI</Label>
                <Input
                  id="dni"
                  value={formData.dni || 'No registrado'}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-sm text-muted-foreground">
                  El DNI no se puede modificar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Datos Editables del Usuario */}
        <Card>
          <CardHeader>
            <CardTitle>Información de Contacto</CardTitle>
            <CardDescription>Datos que puedes actualizar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="Juan"
                  required
                />
              </div>

              {/* Apellido */}
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="Pérez"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="juan.perez@email.com"
                required
              />
            </div>

            {/* Teléfono */}
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+54 9 11 1234-5678"
              />
            </div>
          </CardContent>
        </Card>

        {/* Datos del Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
            <CardDescription>Datos adicionales y preferencias</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fecha de Nacimiento */}
              <div className="space-y-2">
                <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                <Input
                  id="fecha_nacimiento"
                  type="date"
                  value={formData.fecha_nacimiento}
                  onChange={(e) => handleInputChange('fecha_nacimiento', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
                <p className="text-sm text-muted-foreground">
                  Debe tener al menos 13 años
                </p>
              </div>

              {/* Cliente VIP */}
              <div className="space-y-2 flex items-center pt-8">
                <input
                  type="checkbox"
                  id="is_vip"
                  checked={formData.is_vip}
                  onChange={(e) => handleInputChange('is_vip', e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_vip" className="ml-2 cursor-pointer">
                  Marcar como cliente VIP
                </Label>
              </div>
            </div>

            {/* Dirección */}
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={formData.direccion}
                onChange={(e) => handleInputChange('direccion', e.target.value)}
                placeholder="Calle Falsa 123, Ciudad, Provincia"
              />
            </div>

            {/* Preferencias */}
            <div className="space-y-2">
              <Label htmlFor="preferencias">Preferencias y Notas</Label>
              <Textarea
                id="preferencias"
                value={formData.preferencias}
                onChange={(e) => handleInputChange('preferencias', e.target.value)}
                placeholder="Preferencias de servicios, alergias, notas especiales, etc."
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                Información útil para brindar un mejor servicio
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Botones de Acción */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/propietario/clientes')}
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
