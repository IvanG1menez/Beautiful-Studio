'use client';

import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string;
  is_active: boolean;
  sala?: number | null;
  sala_nombre?: string;
  sala_capacidad?: number;
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
  permite_reacomodamiento: boolean;
  tipo_descuento_adelanto: 'PORCENTAJE' | 'MONTO_FIJO';
  valor_descuento_adelanto: string;
  tiempo_espera_respuesta: number;
  porcentaje_sena: string;
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
    is_active: true,
    permite_reacomodamiento: false,
    tipo_descuento_adelanto: 'PORCENTAJE' as 'PORCENTAJE' | 'MONTO_FIJO',
    valor_descuento_adelanto: '',
    tiempo_espera_respuesta: '15',
    porcentaje_sena: '25.00'
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
            is_active: servicio.is_active,
            permite_reacomodamiento: servicio.permite_reacomodamiento ?? false,
            tipo_descuento_adelanto: servicio.tipo_descuento_adelanto || 'PORCENTAJE',
            valor_descuento_adelanto: servicio.valor_descuento_adelanto?.toString?.() || servicio.valor_descuento_adelanto || '',
            tiempo_espera_respuesta: servicio.tiempo_espera_respuesta?.toString?.() || servicio.tiempo_espera_respuesta?.toString() || '15',
            porcentaje_sena: servicio.porcentaje_sena?.toString?.() || servicio.porcentaje_sena || '25.00'
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

      const descuentoValor = formData.valor_descuento_adelanto === ''
        ? 0
        : parseFloat(formData.valor_descuento_adelanto);
      const tiempoEspera = formData.tiempo_espera_respuesta === ''
        ? 15
        : parseInt(formData.tiempo_espera_respuesta);
      const porcentajeSena = formData.porcentaje_sena === ''
        ? 25
        : parseFloat(formData.porcentaje_sena);

      if (formData.permite_reacomodamiento) {
        if (isNaN(descuentoValor) || descuentoValor < 0) {
          showNotification(
            'Descuento inválido',
            'El descuento debe ser un número igual o mayor a 0',
            'error'
          );
          setLoading(false);
          return;
        }

        if (formData.tipo_descuento_adelanto === 'PORCENTAJE' && descuentoValor > 100) {
          showNotification(
            'Descuento inválido',
            'El porcentaje de descuento no puede superar el 100%',
            'error'
          );
          setLoading(false);
          return;
        }

        if (isNaN(tiempoEspera) || tiempoEspera <= 0) {
          showNotification(
            'Tiempo de espera inválido',
            'El tiempo de espera debe ser un número mayor a 0',
            'error'
          );
          setLoading(false);
          return;
        }
      }

      if (isNaN(porcentajeSena) || porcentajeSena < 0 || porcentajeSena > 100) {
        showNotification(
          'Porcentaje de seña inválido',
          'El porcentaje de seña debe estar entre 0 y 100',
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
        is_active: formData.is_active,
        permite_reacomodamiento: formData.permite_reacomodamiento,
        tipo_descuento_adelanto: formData.tipo_descuento_adelanto,
        valor_descuento_adelanto: descuentoValor,
        tiempo_espera_respuesta: tiempoEspera,
        porcentaje_sena: porcentajeSena
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

  // Preparar opciones para el Combobox
  const categoriasOptions: ComboboxOption[] = categorias.map(categoria => ({
    value: categoria.id.toString(),
    label: categoria.nombre,
    description: categoria.descripcion
  }));

  const categoriaSeleccionada = categorias.find(
    (categoria) => categoria.id.toString() === formData.categoria
  );

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

              <Combobox
                options={categoriasOptions}
                value={formData.categoria}
                onValueChange={(value) => handleInputChange('categoria', value)}
                placeholder="Buscar y seleccionar categoría"
                searchPlaceholder="Buscar categoría..."
                emptyMessage="No se encontraron categorías"
              />

              {categoriaSeleccionada && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  <p>
                    Este servicio se brindará en: {categoriaSeleccionada.sala_nombre || 'Sala sin asignar'}.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/propietario/servicios?tab=categorias')}
                    className="mt-2 text-blue-700 underline"
                  >
                    Cambiar sala de la categoría
                  </button>
                </div>
              )}

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

        {/* Configuración de Automatización */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de Automatización</CardTitle>
            <CardDescription>Configura el reacomodamiento automático de turnos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="permite_reacomodamiento" className="text-base font-medium">
                  Permitir reacomodamiento de turnos
                </Label>
                <p className="text-sm text-muted-foreground">
                  Habilita la lógica de rellenar huecos para este servicio
                </p>
              </div>
              <Switch
                id="permite_reacomodamiento"
                checked={formData.permite_reacomodamiento}
                onCheckedChange={(checked) => handleInputChange('permite_reacomodamiento', checked)}
              />
            </div>

            {formData.permite_reacomodamiento && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo_descuento_adelanto">
                      Tipo de descuento por adelanto
                    </Label>
                    <Select
                      value={formData.tipo_descuento_adelanto}
                      onValueChange={(value) => handleInputChange('tipo_descuento_adelanto', value)}
                    >
                      <SelectTrigger id="tipo_descuento_adelanto">
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PORCENTAJE">%</SelectItem>
                        <SelectItem value="MONTO_FIJO">$</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valor_descuento_adelanto">
                      Valor del descuento (aplica sobre el precio total)
                    </Label>
                    <Input
                      id="valor_descuento_adelanto"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.valor_descuento_adelanto}
                      onChange={(e) => handleInputChange('valor_descuento_adelanto', e.target.value)}
                      placeholder={formData.tipo_descuento_adelanto === 'PORCENTAJE' ? '10' : '500'}
                    />
                    <p className="text-sm text-muted-foreground">
                      El descuento se aplica sobre el precio total del servicio para mayor transparencia con el cliente.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tiempo_espera_respuesta">Minutos de espera de respuesta</Label>
                    <Input
                      id="tiempo_espera_respuesta"
                      type="number"
                      min="1"
                      value={formData.tiempo_espera_respuesta}
                      onChange={(e) => handleInputChange('tiempo_espera_respuesta', e.target.value)}
                      placeholder="15"
                    />
                    <p className="text-sm text-muted-foreground">
                      Tiempo antes de pasar la propuesta al siguiente cliente
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="porcentaje_sena">Porcentaje de Seña (0 a 100)</Label>
                    <Input
                      id="porcentaje_sena"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.porcentaje_sena}
                      onChange={(e) => handleInputChange('porcentaje_sena', e.target.value)}
                      placeholder="25.00"
                    />
                    <p className="text-sm text-muted-foreground">
                      Porcentaje que se cobrará por Mercado Pago
                    </p>
                  </div>
                </div>
              </div>
            )}
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
