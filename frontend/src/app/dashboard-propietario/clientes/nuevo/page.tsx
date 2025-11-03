'use client';

import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NuevoClientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({
    title: '',
    description: '',
    type: 'success' as 'success' | 'error'
  });

  const [formData, setFormData] = useState({
    // Datos del usuario
    username: '',
    email: '',
    password: 'cliente123', // Password por defecto
    first_name: '',
    last_name: '',
    phone: '',
    dni: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validaciones básicas
      if (!formData.username || !formData.email || !formData.first_name || !formData.last_name) {
        showNotification(
          'Campos requeridos',
          'Por favor completa todos los campos obligatorios: username, email, nombre y apellido',
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

      // Preparar datos para enviar
      const dataToSend = {
        username: formData.username,
        email: formData.email,
        password: formData.password || 'cliente123',
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        dni: formData.dni,
        fecha_nacimiento: formData.fecha_nacimiento || null,
        direccion: formData.direccion,
        preferencias: formData.preferencias,
        is_vip: formData.is_vip
      };

      const response = await fetch('http://localhost:8000/api/clientes/', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        showNotification(
          'Cliente creado exitosamente',
          `El cliente ${formData.first_name} ${formData.last_name} ha sido registrado correctamente`,
          'success'
        );

        // Redirigir después de 1.5 segundos
        setTimeout(() => {
          router.push('/dashboard-propietario/clientes');
        }, 1500);
      } else {
        const errorData = await response.json();

        // Manejar errores específicos
        let errorMessage = 'No se pudo crear el cliente. Por favor, verifica los datos.';

        if (errorData.username) {
          errorMessage = `Username: ${errorData.username[0]}`;
        } else if (errorData.email) {
          errorMessage = `Email: ${errorData.email[0]}`;
        } else if (errorData.dni) {
          errorMessage = `DNI: ${errorData.dni[0]}`;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else {
          errorMessage = Object.entries(errorData)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        }

        showNotification(
          'Error al crear cliente',
          errorMessage,
          'error'
        );
      }
    } catch (error) {
      console.error('Error creating cliente:', error);
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
          onClick={() => router.push('/dashboard-propietario/clientes')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Cliente</h1>
          <p className="text-muted-foreground">
            Registra un nuevo cliente en el sistema
          </p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos de Usuario */}
        <Card>
          <CardHeader>
            <CardTitle>Datos de Usuario</CardTitle>
            <CardDescription>Información de acceso y contacto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Nombre de Usuario *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder="ej: juan.perez"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Debe ser único en el sistema
                </p>
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
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="text"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Contraseña por defecto: cliente123"
              />
              <p className="text-sm text-muted-foreground">
                Si no se especifica, se usará la contraseña por defecto: <code className="bg-gray-100 px-1 rounded">cliente123</code>
              </p>
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* DNI */}
              <div className="space-y-2">
                <Label htmlFor="dni">DNI</Label>
                <Input
                  id="dni"
                  value={formData.dni}
                  onChange={(e) => handleInputChange('dni', e.target.value)}
                  placeholder="12345678"
                />
              </div>
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
            onClick={() => router.push('/dashboard-propietario/clientes')}
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
                Crear Cliente
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
