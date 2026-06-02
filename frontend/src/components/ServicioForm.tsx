'use client';

import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const [creditRefundEnabled, setCreditRefundEnabled] = useState(
    Number(initialValues.porcentaje_devolucion_sena || '100') > 0 ||
    Number(initialValues.porcentaje_devolucion_servicio_completo || '100') > 0,
  );
  const [creditDisableDialogOpen, setCreditDisableDialogOpen] = useState(false);

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

  const handleCreditRefundToggle = (checked: boolean) => {
    if (checked) {
      setCreditRefundEnabled(true);
      setFormData(prev => ({
        ...prev,
        porcentaje_devolucion_sena: '100',
        porcentaje_devolucion_servicio_completo: '100',
      }));
      return;
    }

    if (mode === 'edit' && initialValues.is_active && creditRefundEnabled) {
      setCreditDisableDialogOpen(true);
      return;
    }

    disableCreditRefund();
  };

  const disableCreditRefund = () => {
    setCreditRefundEnabled(false);
    setFormData(prev => ({
      ...prev,
      porcentaje_devolucion_sena: '0',
      porcentaje_devolucion_servicio_completo: '0',
    }));
  };

  const handleReacomodamientoOfferChange = (rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '');
    setFormData(prev => ({
      ...prev,
      bono_reacomodamiento_senia: digits,
      bono_reacomodamiento_pago_completo: digits,
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

      if (creditRefundEnabled && (isNaN(horasMinimasCredito) || horasMinimasCredito < 24)) {
        showNotification(
          'Tiempo mínimo inválido',
          'La devolución de crédito no puede configurarse con menos de 24 horas.',
          'error',
        );
        setLoading(false);
        return;
      }

      const valorClientesInactivos = formData.descuento_fidelizacion_monto === ''
        ? 0
        : parseFloat(formData.descuento_fidelizacion_monto);
      const bonoSenia = formData.bono_reacomodamiento_senia === ''
        ? 0
        : parseFloat(formData.bono_reacomodamiento_senia);
      const bonoPagoCompleto = formData.bono_reacomodamiento_pago_completo === ''
        ? 0
        : parseFloat(formData.bono_reacomodamiento_pago_completo);

      if (isNaN(valorClientesInactivos) || valorClientesInactivos < 0) {
        showNotification(
          'Beneficio para clientes inactivos inválido',
          'El beneficio para clientes inactivos debe ser un número igual o mayor a 0',
          'error',
        );
        setLoading(false);
        return;
      }

      if (isNaN(bonoSenia) || bonoSenia < 0 || isNaN(bonoPagoCompleto) || bonoPagoCompleto < 0) {
        showNotification(
          'Oferta por reacomodamiento inválida',
          'La oferta por reacomodamiento debe ser un número igual o mayor a 0.',
          'error',
        );
        setLoading(false);
        return;
      }

      const payload: ServicioFormValues = {
        ...formData,
        // Para ambos procesos usamos monto fijo como configuración principal
        tipo_descuento_adelanto: 'MONTO_FIJO',
        tipo_descuento_fidelizacion: 'MONTO_FIJO',
        porcentaje_sena: precio > 0 ? '50.00' : '0.00',
        monto_sena_fijo: montoSenaFijo.toFixed(2),
        horas_minimas_credito_cancelacion: horasMinimasCredito.toString(),
        porcentaje_devolucion_sena: creditRefundEnabled ? '100' : '0',
        porcentaje_devolucion_servicio_completo: creditRefundEnabled ? '100' : '0',
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

          </CardContent>
        </Card>

        {/* Configuración general */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración general</CardTitle>
            <CardDescription>Reglas operativas y comerciales asociadas al servicio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tiempo_espera_respuesta">Minutos de espera para reacomodamiento</Label>
                <Input
                  id="tiempo_espera_respuesta"
                  type="number"
                  min="1"
                  value={formData.tiempo_espera_respuesta}
                  onChange={e => handleInputChange('tiempo_espera_respuesta', e.target.value)}
                  placeholder="15"
                />
                <p className="text-sm text-muted-foreground">
                  Tiempo que espera el sistema antes de pasar la propuesta al siguiente cliente.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="frecuencia_recurrencia_dias">Días sin venir para considerar cliente inactivo</Label>
                <Input
                  id="frecuencia_recurrencia_dias"
                  type="number"
                  min="0"
                  value={formData.frecuencia_recurrencia_dias}
                  onChange={e => handleInputChange('frecuencia_recurrencia_dias', e.target.value)}
                  placeholder="30"
                />
                <p className="text-sm text-muted-foreground">
                  Si es 0, se usará la configuración global de clientes inactivos.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="oferta_reacomodamiento">Oferta por reacomodamiento ($)</Label>
                <Input
                  id="oferta_reacomodamiento"
                  type="text"
                  inputMode="numeric"
                  value={formatWithThousands(formData.bono_reacomodamiento_senia)}
                  onChange={e => handleReacomodamientoOfferChange(e.target.value)}
                  placeholder="1000"
                />
                <p className="text-sm text-muted-foreground">
                  Monto que se ofrecerá al cliente para aceptar adelantar su turno. Se usa en mails, avisos y pantalla de confirmación.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descuento_fidelizacion_monto">Beneficio fijo para recuperar cliente ($)</Label>
                <Input
                  id="descuento_fidelizacion_monto"
                  type="text"
                  inputMode="numeric"
                  value={formatWithThousands(formData.descuento_fidelizacion_monto)}
                  onChange={e => handleCurrencyChange('descuento_fidelizacion_monto', e.target.value)}
                  placeholder="500"
                />
                <p className="text-sm text-muted-foreground">
                  Monto fijo para incentivar que un cliente inactivo vuelva a reservar este servicio.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Devolución de crédito */}
        <Card>
          <CardHeader>
            <CardTitle>Devolución de crédito por cancelación</CardTitle>
            <CardDescription>Cuando está activa, devuelve el 100% de lo pagado si el cliente cancela en término</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border bg-muted/40 p-4 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium">Habilitar devolución automática de crédito</p>
                  <p className="text-xs text-muted-foreground">
                    Si está activa, se devuelve el 100% de la seña o del pago completo según corresponda.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={creditRefundEnabled}
                    onChange={e => handleCreditRefundToggle(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{creditRefundEnabled ? 'Activo' : 'Inactivo'}</span>
                </label>
              </div>

              {creditRefundEnabled && (
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="horas_minimas_credito_cancelacion">Horas mínimas para devolver crédito *</Label>
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
                  <p className="text-sm text-muted-foreground">
                    No puede ser menor a 24 horas. Si cancela después de este límite, no se acredita crédito automáticamente.
                  </p>
                </div>
              )}

              {!creditRefundEnabled && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  La devolución automática está desactivada. Las cancelaciones no acreditarán crédito en billetera.
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

      <AlertDialog open={creditDisableDialogOpen} onOpenChange={setCreditDisableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar devolución de crédito?</AlertDialogTitle>
            <AlertDialogDescription>
              A partir del momento en que guardes este cambio, las cancelaciones de este servicio dejarán de devolver crédito automáticamente en la billetera del cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreditDisableDialogOpen(false)}
            >
              Mantener activa
            </Button>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                disableCreditRefund();
                setCreditDisableDialogOpen(false);
              }}
            >
              Desactivar devolución
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
