'use client';

import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight, Loader2, Save } from 'lucide-react';
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
  bono_reacomodamiento_senia: string;
  bono_reacomodamiento_pago_completo: string;
  tiempo_espera_respuesta: string;
  porcentaje_sena: string;
  monto_sena_fijo: string;
  horas_minimas_credito_cancelacion: string;
  porcentaje_devolucion_sena: string;
  porcentaje_devolucion_servicio_completo: string;
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

  const [showFidelizacion, setShowFidelizacion] = useState(true);
  const [showReacomodamiento, setShowReacomodamiento] = useState(true);
  const [showPoliticaCobro, setShowPoliticaCobro] = useState(false);

  const showNotification = (title: string, description: string, type: 'success' | 'error') => {
    setNotificationMessage({ title, description, type });
    setNotificationDialogOpen(true);
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialValues);

  const formatWithThousands = (value: string) => {
    const digits = (value || '').replace(/\D/g, '');
    if (!digits) return '';
    const chars = digits.split('').reverse();
    const groups: string[] = [];
    for (let i = 0; i < chars.length; i += 3) {
      groups.push(chars.slice(i, i + 3).join(''));
    }
    return groups
      .map(group => group.split('').reverse().join(''))
      .reverse()
      .join('.');
  };

  const handleCurrencyChange = (field: keyof ServicioFormValues, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '');
    setFormData(prev => ({
      ...prev,
      [field]: digits,
    }));
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

      const precio = parseFloat(formData.precio || '0');
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
      const montoSenaFijo = precio > 0 ? precio / 2 : 0;
      const horasMinimasCredito = formData.horas_minimas_credito_cancelacion === ''
        ? 24
        : parseInt(formData.horas_minimas_credito_cancelacion, 10);

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

      if (isNaN(horasMinimasCredito) || horasMinimasCredito < 24) {
        showNotification(
          'Tiempo mínimo inválido',
          'La devolución de crédito no puede configurarse con menos de 24 horas.',
          'error',
        );
        setLoading(false);
        return;
      }

      const valorFidelizacion = formData.descuento_fidelizacion_monto === ''
        ? 0
        : parseFloat(formData.descuento_fidelizacion_monto);
      const bonoSenia = formData.bono_reacomodamiento_senia === ''
        ? 0
        : parseFloat(formData.bono_reacomodamiento_senia);
      const bonoPagoCompleto = formData.bono_reacomodamiento_pago_completo === ''
        ? 0
        : parseFloat(formData.bono_reacomodamiento_pago_completo);

      if (isNaN(valorFidelizacion) || valorFidelizacion < 0) {
        showNotification(
          'Descuento de fidelización inválido',
          'El descuento de fidelización debe ser un número igual o mayor a 0',
          'error',
        );
        setLoading(false);
        return;
      }

      if (isNaN(bonoSenia) || bonoSenia < 0 || isNaN(bonoPagoCompleto) || bonoPagoCompleto < 0) {
        showNotification(
          'Bonos de reacomodamiento inválidos',
          'Los bonos por tipo de pago deben ser números iguales o mayores a 0.',
          'error',
        );
        setLoading(false);
        return;
      }

      let porcentajeSena = 0;
      if (precio > 0 && montoSena > 0) {
        porcentajeSena = (montoSena / precio) * 100;
        if (porcentajeSena > 100) {
          showNotification(
            'Monto de seña inválido',
            'El monto de seña no puede ser mayor que el precio del servicio',
            'error',
          );
          setLoading(false);
          return;
        }
      }

      const payload: ServicioFormValues = {
        ...formData,
        // Para ambos procesos usamos monto fijo como configuración principal
        tipo_descuento_adelanto: 'MONTO_FIJO',
        tipo_descuento_fidelizacion: 'MONTO_FIJO',
        porcentaje_sena: precio > 0 ? '50.00' : '0.00',
        monto_sena_fijo: montoSenaFijo.toFixed(2),
        horas_minimas_credito_cancelacion: horasMinimasCredito.toString(),
        porcentaje_devolucion_sena: '100',
        porcentaje_devolucion_servicio_completo: '100',
      };

      await onSubmit(payload);

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
    } catch (error: unknown) {
      console.error('Error en formulario de servicio:', error);
      const message = error instanceof Error
        ? error.message
        : 'Ocurrió un error al guardar el servicio';
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
                  type="text"
                  inputMode="numeric"
                  value={formatWithThousands(formData.precio)}
                  onChange={e => handleCurrencyChange('precio', e.target.value)}
                  placeholder="10.000"
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

            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="horas_minimas_credito_cancelacion">Vigencia mínima para devolver crédito (hs) *</Label>
                <Input
                  id="horas_minimas_credito_cancelacion"
                  type="number"
                  min="24"
                  step="1"
                  value={formData.horas_minimas_credito_cancelacion}
                  onChange={e => handleInputChange('horas_minimas_credito_cancelacion', e.target.value)}
                  placeholder="24"
                  required
                />
                <p className="text-sm text-muted-foreground">No puede ser menor a 24 horas.</p>
              </div>
            </div>

            <div className="mt-2 rounded-md border border-dashed border-emerald-300 bg-emerald-50 text-sm text-emerald-900 overflow-hidden">
              {(() => {
                const precio = parseFloat(formData.precio || '0') || 0;
                const montoSena = precio > 0 ? precio / 2 : 0;
                const horasMinimasCredito = parseInt(formData.horas_minimas_credito_cancelacion || '24', 10) || 24;

                return (
                  <>
                    <button
                      type="button"
                      className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left hover:bg-emerald-100/60 transition-colors"
                      onClick={() => setShowPoliticaCobro(prev => !prev)}
                    >
                      <div>
                        <p className="font-medium">Política comercial del servicio</p>
                        <p className="text-xs text-emerald-800">
                          Seña fija del 50% y devolución del 100% dentro del plazo permitido. Hacé clic para ver el desglose.
                        </p>
                      </div>
                      {showPoliticaCobro ? (
                        <ChevronDown className="h-4 w-4 mt-0.5" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mt-0.5" />
                      )}
                    </button>

                    {showPoliticaCobro && (
                      <div className="px-4 pb-3 border-t border-emerald-200 space-y-1">
                        {precio <= 0 ? (
                          <>
                            <p className="pt-2">
                              Regla aplicada automáticamente: <strong>seña del 50%</strong> y <strong>devolución del 100%</strong>
                              {' '}si la cancelación ocurre dentro del rango permitido.
                            </p>
                            <p>
                              Ejemplo guía: si el servicio cuesta <strong>$100.000</strong>, la seña será <strong>$50.000</strong>.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="pt-2">
                              La seña se define automáticamente en el <strong>50%</strong> del servicio: <strong>${montoSena.toFixed(2)}</strong> sobre{' '}
                              <strong>${precio.toFixed(2)}</strong>.
                            </p>
                            <p>
                              Si el cliente cancela dentro del rango permitido, la devolución es del <strong>100%</strong>.
                            </p>
                            <p>
                              Esto aplica tanto para la seña como para el pago completo del servicio.
                            </p>
                            <p>
                              El crédito se acredita si la cancelación ocurre con al menos <strong>{Math.max(24, horasMinimasCredito)} horas</strong> de anticipación.
                            </p>
                            <p className="pt-1 border-t border-emerald-200">
                              Ejemplo rápido para explicar al cliente: si el servicio vale <strong>$100.000</strong>, se cobra{' '}
                              <strong>$50.000</strong> de seña; si cancela en término, se devuelve el <strong>100%</strong> de lo pagado.
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
        {/* Configuración de Automatización (Fidelización + Reacomodamiento) */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de Automatización</CardTitle>
            <CardDescription>Definí fidelización y reacomodamiento automático para este servicio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sección Fidelización y Retorno de Clientes */}
            <div className="border rounded-md">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/60 hover:bg-muted transition-colors"
                onClick={() => setShowFidelizacion(prev => !prev)}
              >
                <div>
                  <p className="text-sm font-medium">Fidelización y retorno de clientes</p>
                  <p className="text-xs text-muted-foreground">
                    Configurá la frecuencia de retorno y el premio fijo por fidelización
                  </p>
                </div>
                {showFidelizacion ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {showFidelizacion && (
                <div className="space-y-4 px-4 py-4">
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
                      <Label htmlFor="descuento_fidelizacion_monto">Monto fijo de premio ($)</Label>
                      <Input
                        id="descuento_fidelizacion_monto"
                        type="text"
                        inputMode="numeric"
                        value={formatWithThousands(formData.descuento_fidelizacion_monto)}
                        onChange={e => handleCurrencyChange('descuento_fidelizacion_monto', e.target.value)}
                        placeholder="500"
                      />
                      <p className="text-sm text-muted-foreground">
                        Definí un monto fijo de premio por fidelización para este servicio.
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 rounded-md border border-dashed border-purple-300 bg-purple-50 px-4 py-3 text-sm text-purple-900">
                    {(() => {
                      const precio = parseFloat(formData.precio || '0') || 0;
                      const montoPremio = parseFloat(formData.descuento_fidelizacion_monto || '0') || 0;
                      const precioConDescuento = Math.max(0, precio - montoPremio);

                      if (!precio) {
                        return <span>Ingresá un precio para ver el valor promocional.</span>;
                      }

                      if (!montoPremio) {
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
                          <strong>${precioConDescuento.toFixed(2)}</strong> (desde ${precio.toFixed(2)}), aplicando un premio fijo de ${montoPremio.toFixed(2)}.
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Sección Reacomodamiento de Turnos */}
            <div className="border rounded-md">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/60 hover:bg-muted transition-colors"
                onClick={() => setShowReacomodamiento(prev => !prev)}
              >
                <div>
                  <p className="text-sm font-medium">Reacomodamiento de turnos</p>
                  <p className="text-xs text-muted-foreground">
                    Configurá el descuento por adelanto y el tiempo de espera de respuesta
                  </p>
                </div>
                {showReacomodamiento ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {showReacomodamiento && (
                <div className="space-y-4 px-4 py-4">
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
                          <Label htmlFor="bono_reacomodamiento_senia">Bono para cliente con seña ($)</Label>
                          <Input
                            id="bono_reacomodamiento_senia"
                            type="text"
                            inputMode="numeric"
                            value={formatWithThousands(formData.bono_reacomodamiento_senia)}
                            onChange={e => handleCurrencyChange('bono_reacomodamiento_senia', e.target.value)}
                            placeholder="1000"
                          />
                          <p className="text-sm text-muted-foreground">
                            Se aplica cuando el cliente ofertado originalmente pagó seña.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="bono_reacomodamiento_pago_completo">Bono para cliente con pago completo ($)</Label>
                          <Input
                            id="bono_reacomodamiento_pago_completo"
                            type="text"
                            inputMode="numeric"
                            value={formatWithThousands(formData.bono_reacomodamiento_pago_completo)}
                            onChange={e => handleCurrencyChange('bono_reacomodamiento_pago_completo', e.target.value)}
                            placeholder="2000"
                          />
                          <p className="text-sm text-muted-foreground">
                            Se aplica cuando el cliente ofertado pagó el servicio completo.
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
                            onChange={e => handleInputChange('tiempo_espera_respuesta', e.target.value)}
                            placeholder="15"
                          />
                          <p className="text-sm text-muted-foreground">
                            Tiempo antes de pasar la propuesta al siguiente cliente
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 rounded-md border border-dashed border-purple-300 bg-purple-50 px-4 py-3 text-sm text-purple-900">
                        {(() => {
                          const precio = parseFloat(formData.precio || '0') || 0;
                          const bonoSenia = parseFloat(formData.bono_reacomodamiento_senia || '0') || 0;
                          const bonoCompleto = parseFloat(formData.bono_reacomodamiento_pago_completo || '0') || 0;

                          if (!precio) {
                            return <span>Ingresá un precio y un monto de descuento para ver el valor con reacomodamiento.</span>;
                          }

                          if (!bonoSenia && !bonoCompleto) {
                            return (
                              <span>
                                Sin bonos por reacomodamiento configurados. El precio se mantiene en{' '}
                                <strong>${precio.toFixed(2)}</strong>.
                              </span>
                            );
                          }

                          return (
                            <div className="space-y-1">
                              <p>
                                Cliente con seña: <strong>${Math.max(0, precio - bonoSenia).toFixed(2)}</strong>{' '}
                                (bono ${bonoSenia.toFixed(2)}).
                              </p>
                              <p>
                                Cliente con pago completo: <strong>${Math.max(0, precio - bonoCompleto).toFixed(2)}</strong>{' '}
                                (bono ${bonoCompleto.toFixed(2)}).
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
            onClick={() => {
              if (hasChanges) {
                const confirmDiscard = window.confirm('¿Descartar cambios?');
                if (!confirmDiscard) return;
              }
              router.push('/dashboard/propietario/servicios');
            }}
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
