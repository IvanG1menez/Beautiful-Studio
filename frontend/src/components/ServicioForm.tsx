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
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface CategoriaOption {
  id: number;
  nombre: string;
  descripcion: string;
  sala_nombre?: string;
}

export interface ServicioFormValues {
  nombre: string;
  categoria: string;
  precio: string;
  duracion_minutos: string;
  descripcion: string;
  is_active: boolean;
  permite_reacomodamiento: boolean;
  tipo_descuento_adelanto: 'PORCENTAJE' | 'MONTO_FIJO';
  valor_descuento_adelanto: string;
  tiempo_espera_respuesta: string;
  porcentaje_sena: string;
  frecuencia_recurrencia_dias: string;
  tipo_descuento_fidelizacion: 'PORCENTAJE' | 'MONTO_FIJO';
  descuento_fidelizacion_pct: string;
  descuento_fidelizacion_monto: string;
}

interface ServicioFormProps {
  mode: 'create' | 'edit';
  categorias: CategoriaOption[];
  initialValues: ServicioFormValues;
  onSubmit: (values: ServicioFormValues) => Promise<void>;
}

export function ServicioForm({ mode, categorias, initialValues, onSubmit }: ServicioFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<ServicioFormValues>(initialValues);
  const [loading, setLoading] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({
    title: '',
    description: '',
    type: 'success' as 'success' | 'error',
  });

  const showNotification = (title: string, description: string, type: 'success' | 'error') => {
    setNotificationMessage({ title, description, type });
    setNotificationDialogOpen(true);
  };

  const handleInputChange = (field: keyof ServicioFormValues, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const categoriasOptions: ComboboxOption[] = categorias.map(categoria => ({
    value: categoria.id.toString(),
    label: categoria.nombre,
    description: categoria.descripcion,
  }));

  const categoriaSeleccionada = categorias.find(
    categoria => categoria.id.toString() === formData.categoria,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.nombre || !formData.categoria || !formData.precio || !formData.duracion_minutos) {
        showNotification(
          'Campos requeridos',
          'Por favor completa todos los campos obligatorios marcados con *',
          'error',
        );
        setLoading(false);
        return;
      }

      const precio = parseFloat(formData.precio);
      const duracion = parseInt(formData.duracion_minutos, 10);

      if (isNaN(precio) || precio <= 0) {
        showNotification('Precio inválido', 'El precio debe ser un número mayor a 0', 'error');
        setLoading(false);
        return;
      }

      if (isNaN(duracion) || duracion <= 0) {
        showNotification('Duración inválida', 'La duración debe ser un número mayor a 0', 'error');
        setLoading(false);
        return;
      }

      const descuentoValor = formData.valor_descuento_adelanto === ''
        ? 0
        : parseFloat(formData.valor_descuento_adelanto);
      const tiempoEspera = formData.tiempo_espera_respuesta === ''
        ? 15
        : parseInt(formData.tiempo_espera_respuesta, 10);
      const porcentajeSena = formData.porcentaje_sena === ''
        ? 25
        : parseFloat(formData.porcentaje_sena);

      if (formData.permite_reacomodamiento) {
        if (isNaN(descuentoValor) || descuentoValor < 0) {
          showNotification(
            'Descuento inválido',
            'El descuento debe ser un número igual o mayor a 0',
            'error',
          );
          setLoading(false);
          return;
        }

        if (formData.tipo_descuento_adelanto === 'PORCENTAJE' && descuentoValor > 100) {
          showNotification(
            'Descuento inválido',
            'El porcentaje de descuento no puede superar el 100%',
            'error',
          );
          setLoading(false);
          return;
        }

        if (isNaN(tiempoEspera) || tiempoEspera <= 0) {
          showNotification(
            'Tiempo de espera inválido',
            'El tiempo de espera debe ser un número mayor a 0',
            'error',
          );
          setLoading(false);
          return;
        }
      }

      if (isNaN(porcentajeSena) || porcentajeSena < 0 || porcentajeSena > 100) {
        showNotification(
          'Porcentaje de seña inválido',
          'El porcentaje de seña debe estar entre 0 y 100',
          'error',
        );
        setLoading(false);
        return;
      }

      const valorFidelizacion = formData.tipo_descuento_fidelizacion === 'PORCENTAJE'
        ? (formData.descuento_fidelizacion_pct === '' ? 0 : parseFloat(formData.descuento_fidelizacion_pct))
        : (formData.descuento_fidelizacion_monto === '' ? 0 : parseFloat(formData.descuento_fidelizacion_monto));

      if (isNaN(valorFidelizacion) || valorFidelizacion < 0) {
        showNotification(
          'Descuento de fidelización inválido',
          'El descuento de fidelización debe ser un número igual o mayor a 0',
          'error',
        );
        setLoading(false);
        return;
      }

      if (formData.tipo_descuento_fidelizacion === 'PORCENTAJE') {
        if (valorFidelizacion > 100) {
          showNotification(
            'Descuento de fidelización inválido',
            'El porcentaje de fidelización debe estar entre 0 y 100',
            'error',
          );
          setLoading(false);
          return;
        }
        if (!Number.isInteger(valorFidelizacion)) {
          showNotification(
            'Descuento de fidelización inválido',
            'El porcentaje de fidelización debe ser un número entero (sin decimales)',
            'error',
          );
          setLoading(false);
          return;
        }
      }

      await onSubmit(formData);

      showNotification(
        mode === 'create' ? 'Servicio creado' : 'Servicio actualizado',
        mode === 'create'
          ? 'El servicio ha sido creado exitosamente'
          : 'Los datos del servicio han sido actualizados exitosamente',
        'success',
      );

      setTimeout(() => {
        router.push('/dashboard/propietario/servicios');
      }, 1500);
    } catch (error: any) {
      console.error('Error en formulario de servicio:', error);
      const message = error?.message || 'Ocurrió un error al guardar el servicio';
      showNotification('Error', message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información Básica */}
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
            <CardDescription>Datos principales del servicio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del Servicio *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={e => handleInputChange('nombre', e.target.value)}
                placeholder="Ej: Corte de cabello mujer"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría *</Label>
              <Combobox
                options={categoriasOptions}
                value={formData.categoria}
                onValueChange={value => handleInputChange('categoria', value)}
                placeholder="Buscar y seleccionar categoría"
                searchPlaceholder="Buscar categoría..."
                emptyMessage="No se encontraron categorías"
              />

              {categoriaSeleccionada && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  <p>
                    Este servicio se brindará en: {categoriaSeleccionada.sala_nombre || 'Sala sin asignar'}.
                  </p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Los servicios se organizan por categorías para facilitar la navegación
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={e => handleInputChange('descripcion', e.target.value)}
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
              <div className="space-y-2">
                <Label htmlFor="precio">Precio ($) *</Label>
                <Input
                  id="precio"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.precio}
                  onChange={e => handleInputChange('precio', e.target.value)}
                  placeholder="25.00"
                  required
                />
                <p className="text-sm text-muted-foreground">Precio en tu moneda local</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duracion_minutos">Duración (minutos) *</Label>
                <Input
                  id="duracion_minutos"
                  type="number"
                  min="1"
                  value={formData.duracion_minutos}
                  onChange={e => handleInputChange('duracion_minutos', e.target.value)}
                  placeholder="45"
                  required
                />
                <p className="text-sm text-muted-foreground">Tiempo aproximado del servicio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fidelización y Retorno */}
        <Card>
          <CardHeader>
            <CardTitle>Fidelización y Retorno de Clientes</CardTitle>
            <CardDescription>
              Configura la frecuencia de retorno y descuentos promocionales para este servicio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="frecuencia_recurrencia_dias">Frecuencia de retorno sugerida (días)</Label>
              <Input
                id="frecuencia_recurrencia_dias"
                type="number"
                min="0"
                value={formData.frecuencia_recurrencia_dias}
                onChange={e => handleInputChange('frecuencia_recurrencia_dias', e.target.value)}
                placeholder="30"
              />
              <p className="text-sm text-muted-foreground">
                Este servicio se ofrecerá a clientes que no hayan vuelto en los días definidos en su ficha. Si es 0,
                se usará la configuración global.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo_descuento_fidelizacion">Tipo de descuento de fidelización</Label>
                <Select
                  value={formData.tipo_descuento_fidelizacion}
                  onValueChange={value => handleInputChange('tipo_descuento_fidelizacion', value)}
                >
                  <SelectTrigger id="tipo_descuento_fidelizacion">
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PORCENTAJE">%</SelectItem>
                    <SelectItem value="MONTO_FIJO">$</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor_descuento_fidelizacion">Valor del descuento de fidelización</Label>
                <Input
                  id="valor_descuento_fidelizacion"
                  type="number"
                  step={formData.tipo_descuento_fidelizacion === 'PORCENTAJE' ? '1' : '0.01'}
                  min="0"
                  max={formData.tipo_descuento_fidelizacion === 'PORCENTAJE' ? '100' : undefined}
                  value={
                    formData.tipo_descuento_fidelizacion === 'PORCENTAJE'
                      ? formData.descuento_fidelizacion_pct
                      : formData.descuento_fidelizacion_monto
                  }
                  onChange={e => {
                    const value = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      descuento_fidelizacion_pct:
                        prev.tipo_descuento_fidelizacion === 'PORCENTAJE' ? value : '0',
                      descuento_fidelizacion_monto:
                        prev.tipo_descuento_fidelizacion === 'MONTO_FIJO' ? value : '0',
                    }));
                  }}
                  placeholder={formData.tipo_descuento_fidelizacion === 'PORCENTAJE' ? '15' : '500'}
                />
              </div>
            </div>

            <div className="mt-4 rounded-md border border-dashed border-purple-300 bg-purple-50 px-4 py-3 text-sm text-purple-900">
              {(() => {
                const precio = parseFloat(formData.precio || '0') || 0;
                const pct = formData.tipo_descuento_fidelizacion === 'PORCENTAJE'
                  ? parseFloat(formData.descuento_fidelizacion_pct || '0') || 0
                  : 0;
                const monto = formData.tipo_descuento_fidelizacion === 'MONTO_FIJO'
                  ? parseFloat(formData.descuento_fidelizacion_monto || '0') || 0
                  : 0;

                let precioConDescuento = precio;
                if (monto > 0) {
                  precioConDescuento = Math.max(0, precio - monto);
                } else if (pct > 0) {
                  precioConDescuento = precio * (1 - pct / 100);
                }

                if (!precio) {
                  return <span>Ingresá un precio para ver el valor promocional.</span>;
                }

                if (precioConDescuento === precio) {
                  return (
                    <span>
                      Sin descuento de fidelización configurado. El precio se mantiene en{' '}
                      <strong>${precio.toFixed(2)}</strong>.
                    </span>
                  );
                }

                return (
                  <span>
                    Con la configuración actual, el precio de fidelización sería{' '}
                    <strong>${precioConDescuento.toFixed(2)}</strong> (desde ${precio.toFixed(2)}).
                  </span>
                );
              })()}
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
                onCheckedChange={checked => handleInputChange('permite_reacomodamiento', checked)}
              />
            </div>

            {formData.permite_reacomodamiento && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo_descuento_adelanto">Tipo de descuento por adelanto</Label>
                    <Select
                      value={formData.tipo_descuento_adelanto}
                      onValueChange={value => handleInputChange('tipo_descuento_adelanto', value)}
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
                      onChange={e => handleInputChange('valor_descuento_adelanto', e.target.value)}
                      placeholder={formData.tipo_descuento_adelanto === 'PORCENTAJE' ? '10' : '500'}
                    />
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
                      onChange={e => handleInputChange('tiempo_espera_respuesta', e.target.value)}
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
                      onChange={e => handleInputChange('porcentaje_sena', e.target.value)}
                      placeholder="25.00"
                    />
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
                onChange={e => handleInputChange('is_active', e.target.checked)}
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
                {mode === 'create' ? 'Creando...' : 'Guardando...'}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {mode === 'create' ? 'Crear Servicio' : 'Guardar Cambios'}
              </>
            )}
          </Button>
        </div>
      </form>

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
    </>
  );
}
