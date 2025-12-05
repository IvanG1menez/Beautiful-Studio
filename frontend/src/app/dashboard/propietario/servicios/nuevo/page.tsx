'use client';

import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Save, Scissors } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string;
  is_active: boolean;
}

export default function NuevoServicioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingCategorias, setLoadingCategorias] = useState(true);
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

  // Cargar categorías activas
  useEffect(() => {
    const fetchCategorias = async () => {
      setLoadingCategorias(true);
      try {
        const response = await fetch('http://localhost:8000/api/servicios/categorias/', {
          headers: getAuthHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          const categoriasActivas = (data.results || data).filter((cat: Categoria) => cat.is_active);
          setCategorias(categoriasActivas);
        } else {
          showNotification(
            'Error al cargar categorías',
            'No se pudieron cargar las categorías. Por favor, intenta nuevamente.',
            'error'
          );
        }
      } catch (error) {
        console.error('Error fetching categorias:', error);
        showNotification(
          'Error de conexión',
          'No se pudo conectar con el servidor',
          'error'
        );
      } finally {
        setLoadingCategorias(false);
      }
    };

    fetchCategorias();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validaciones básicas
      if (!formData.nombre || !formData.categoria || !formData.precio || !formData.duracion_minutos) {
        showNotification(
          'Campos requeridos',
          'Por favor completa todos los campos obligatorios marcados con *',
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

      const response = await fetch('http://localhost:8000/api/servicios/', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        showNotification(
          'Servicio creado',
          'El servicio ha sido creado exitosamente',
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
          'Error al crear servicio',
          errorMessage || 'No se pudo crear el servicio. Por favor, verifica los datos e intenta nuevamente.',
          'error'
        );
      }
    } catch (error) {
      console.error('Error creating servicio:', error);
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

  // Preparar opciones para el Combobox
  const categoriasOptions: ComboboxOption[] = categorias.map(categoria => ({
    value: categoria.id.toString(),
    label: categoria.nombre,
    description: categoria.descripcion
  }));

  if (loadingCategorias) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando categorías...</span>
        </div>
      </div>
    );
  }

  if (categorias.length === 0) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/dashboard/propietario/servicios')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Nuevo Servicio</h1>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-12">
              <Scissors className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay categorías activas</h3>
              <p className="text-muted-foreground mb-4">
                Necesitas crear al menos una categoría activa antes de crear servicios.
              </p>
              <Button onClick={() => router.push('/dashboard/propietario/servicios?tab=categorias')}>
                Ir a Categorías
              </Button>
            </div>
          </CardContent>
        </Card>
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
          <h1 className="text-3xl font-bold">Nuevo Servicio</h1>
          <p className="text-muted-foreground">Completa los datos para crear un nuevo servicio</p>
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

              <Combobox
                options={categoriasOptions}
                value={formData.categoria}
                onValueChange={(value) => handleInputChange('categoria', value)}
                placeholder="Buscar y seleccionar categoría"
                searchPlaceholder="Buscar categoría..."
                emptyMessage="No se encontraron categorías"
              />

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
                Creando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Crear Servicio
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
