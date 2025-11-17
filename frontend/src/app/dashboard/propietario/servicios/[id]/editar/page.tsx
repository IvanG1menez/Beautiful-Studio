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

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string;
  is_active: boolean;
}

interface Servicio {
  id: number;
  nombre: string;
  categoria: number;
  categoria_nombre: string;
  precio: string;
  duracion_minutos: number;
  descripcion: string;
  is_active: boolean;
}

export default function EditarServicioPage() {
  const router = useRouter();
  const params = useParams();
  const servicioId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({
    title: '',
    description: '',
    type: 'success' as 'success' | 'error'
  });

  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    precio: '',
    duracion_minutos: '',
    descripcion: '',
    is_active: true
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

  // Cargar categorías y datos del servicio
  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const headers = getAuthHeaders();

        // Cargar categorías y servicio en paralelo
        const [categoriasRes, servicioRes] = await Promise.all([
          fetch('http://localhost:8000/api/servicios/categorias/', { headers }),
          fetch(`http://localhost:8000/api/servicios/${servicioId}/`, { headers })
        ]);

        if (categoriasRes.ok) {
          const categoriasData = await categoriasRes.json();
          const categoriasActivas = (categoriasData.results || categoriasData).filter(
            (cat: Categoria) => cat.is_active
          );
          setCategorias(categoriasActivas);
        }

        if (servicioRes.ok) {
          const servicio: Servicio = await servicioRes.json();
          setFormData({
            nombre: servicio.nombre,
            categoria: servicio.categoria.toString(),
            precio: servicio.precio,
            duracion_minutos: servicio.duracion_minutos.toString(),
            descripcion: servicio.descripcion || '',
            is_active: servicio.is_active
          });
        } else {
          showNotification(
            'Error al cargar servicio',
            'No se pudo cargar la información del servicio',
            'error'
          );
          setTimeout(() => {
            router.push('/dashboard/propietario/servicios');
          }, 2000);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        showNotification(
          'Error de conexión',
          'No se pudo conectar con el servidor',
          'error'
        );
      } finally {
        setLoadingData(false);
      }
    };

    if (servicioId) {
      fetchData();
    }
  }, [servicioId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validaciones básicas
      if (!formData.nombre || !formData.categoria || !formData.precio || !formData.duracion_minutos) {
        showNotification(
          'Campos requeridos',
          'Por favor completa todos los campos obligatorios',
          'error'
        );
        setLoading(false);
        return;
      }

      // Validar precio y duración
      const precio = parseFloat(formData.precio);
      const duracion = parseInt(formData.duracion_minutos);

      if (isNaN(precio) || precio <= 0) {
        showNotification(
          'Precio inválido',
          'El precio debe ser un número mayor a 0',
          'error'
        );
        setLoading(false);
        return;
      }

      if (isNaN(duracion) || duracion <= 0) {
        showNotification(
          'Duración inválida',
          'La duración debe ser un número mayor a 0',
          'error'
        );
        setLoading(false);
        return;
      }

      // Preparar datos para enviar
      const dataToSend = {
        nombre: formData.nombre,
        categoria: parseInt(formData.categoria),
        precio: precio,
        duracion_minutos: duracion,
        descripcion: formData.descripcion,
        is_active: formData.is_active
      };

      const response = await fetch(`http://localhost:8000/api/servicios/${servicioId}/`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        showNotification(
          'Servicio actualizado',
          'Los datos del servicio han sido actualizados exitosamente',
          'success'
        );

        // Redirigir después de 1.5 segundos
        setTimeout(() => {
          router.push('/dashboard/propietario/servicios');
        }, 1500);
      } else {
        const errorData = await response.json();
        const errorMessage = Object.entries(errorData)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        showNotification(
          'Error al actualizar servicio',
          errorMessage || 'No se pudo actualizar el servicio. Por favor, verifica los datos e intenta nuevamente.',
          'error'
        );
      }
    } catch (error) {
      console.error('Error updating servicio:', error);
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
          <span className="ml-2">Cargando datos del servicio...</span>
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
          onClick={() => router.push('/dashboard/propietario/servicios')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Servicio</h1>
          <p className="text-muted-foreground">
            Modificar datos de {formData.nombre}
          </p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información Básica */}
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
            <CardDescription>Datos principales del servicio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nombre del Servicio */}
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Servicio *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => handleInputChange('nombre', e.target.value)}
                placeholder="Ej: Corte de cabello mujer"
                required
              />
            </div>

            {/* Categoría */}
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría *</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => handleInputChange('categoria', value)}
              >
                <SelectTrigger id="categoria">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id.toString()}>
                      {categoria.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Los servicios se organizan por categorías para facilitar la navegación
              </p>
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => handleInputChange('descripcion', e.target.value)}
                placeholder="Describe el servicio, qué incluye, para quién es, etc."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Precio y Duración */}
        <Card>
          <CardHeader>
            <CardTitle>Precio y Duración</CardTitle>
            <CardDescription>Información comercial del servicio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Precio */}
              <div className="space-y-2">
                <Label htmlFor="precio">Precio ($) *</Label>
                <Input
                  id="precio"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.precio}
                  onChange={(e) => handleInputChange('precio', e.target.value)}
                  placeholder="25.00"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Precio en tu moneda local
                </p>
              </div>

              {/* Duración */}
              <div className="space-y-2">
                <Label htmlFor="duracion_minutos">Duración (minutos) *</Label>
                <Input
                  id="duracion_minutos"
                  type="number"
                  min="1"
                  value={formData.duracion_minutos}
                  onChange={(e) => handleInputChange('duracion_minutos', e.target.value)}
                  placeholder="45"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Tiempo aproximado del servicio
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disponibilidad */}
        <Card>
          <CardHeader>
            <CardTitle>Disponibilidad</CardTitle>
            <CardDescription>Controla la visibilidad del servicio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => handleInputChange('is_active', e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Servicio activo y disponible para reservar
              </Label>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Si está desactivado, los clientes no podrán reservar este servicio
            </p>
          </CardContent>
        </Card>

        {/* Botones de Acción */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/propietario/servicios')}
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
