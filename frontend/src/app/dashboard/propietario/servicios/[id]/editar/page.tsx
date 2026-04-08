'use client';

import { CategoriaOption, ServicioForm, ServicioFormValues } from '@/components/ServicioForm';
import { Button } from '@/components/ui/button';
import { getAuthHeaders } from '@/lib/auth-headers';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface CategoriaApiItem {
  id: number;
  nombre: string;
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
  permite_reacomodamiento: boolean;
  tipo_descuento_adelanto: 'PORCENTAJE' | 'MONTO_FIJO';
  valor_descuento_adelanto: string;
  monto_sena_fijo?: string | number;
  bono_reacomodamiento_senia?: string | number;
  bono_reacomodamiento_pago_completo?: string | number;
  tiempo_espera_respuesta: number;
  porcentaje_sena: string;
  horas_minimas_credito_cancelacion?: number;
  porcentaje_devolucion_sena?: string | number;
  porcentaje_devolucion_servicio_completo?: string | number;
  frecuencia_recurrencia_dias: number;
  descuento_fidelizacion_pct: number;
  descuento_fidelizacion_monto: number;
}

export default function EditarServicioPage() {
  const router = useRouter();
  const params = useParams();
  const servicioId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [categorias, setCategorias] = useState<CategoriaOption[]>([]);
  const [initialValues, setInitialValues] = useState<ServicioFormValues | null>(null);

  // Cargar categorías y datos del servicio
  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const headers = getAuthHeaders();

        // Cargar categorías y servicio en paralelo
        const [categoriasRes, servicioRes] = await Promise.all([
          fetch('/api/servicios/categorias/', { headers }),
          fetch(`/api/servicios/${servicioId}/`, { headers })
        ]);

        if (categoriasRes.ok) {
          const categoriasData = await categoriasRes.json() as { results?: CategoriaApiItem[] } | CategoriaApiItem[];
          const categoriasArray = Array.isArray(categoriasData)
            ? categoriasData
            : (categoriasData.results || []);
          const categoriasActivas = categoriasArray.filter((cat) => cat.is_active);
          setCategorias(categoriasActivas);
        }

        if (servicioRes.ok) {
          const servicio: Servicio = await servicioRes.json();
          const precioNumero = parseFloat(servicio.precio || '0') || 0;

          // Determinar monto de fidelización según los valores existentes
          let descuentoFidelizacionMonto = 0;
          if ((servicio.descuento_fidelizacion_monto ?? 0) > 0) {
            descuentoFidelizacionMonto = Number(servicio.descuento_fidelizacion_monto);
          } else if ((servicio.descuento_fidelizacion_pct ?? 0) > 0 && precioNumero > 0) {
            descuentoFidelizacionMonto = (servicio.descuento_fidelizacion_pct / 100) * precioNumero;
          }

          // Determinar monto de descuento por adelanto según configuración existente
          let descuentoAdelantoMonto = 0;
          if (servicio.valor_descuento_adelanto != null) {
            const valor = Number(servicio.valor_descuento_adelanto) || 0;
            if (servicio.tipo_descuento_adelanto === 'MONTO_FIJO') {
              descuentoAdelantoMonto = valor;
            } else if (servicio.tipo_descuento_adelanto === 'PORCENTAJE' && precioNumero > 0) {
              descuentoAdelantoMonto = (valor / 100) * precioNumero;
            }
          }

          // Calcular monto estimado de seña a partir del porcentaje guardado
          let montoSena = 0;
          if ((servicio.porcentaje_sena ?? 0) > 0 && precioNumero > 0) {
            montoSena = (Number(servicio.porcentaje_sena) / 100) * precioNumero;
          }

          setInitialValues({
            nombre: servicio.nombre,
            categoria: servicio.categoria.toString(),
            precio: servicio.precio,
            duracion_minutos: servicio.duracion_minutos.toString(),
            descripcion: servicio.descripcion || '',
            is_active: servicio.is_active,
            permite_reacomodamiento: servicio.permite_reacomodamiento ?? false,
            tipo_descuento_adelanto: 'MONTO_FIJO',
            valor_descuento_adelanto: descuentoAdelantoMonto.toString(),
            bono_reacomodamiento_senia: (servicio.bono_reacomodamiento_senia ?? 1000).toString(),
            bono_reacomodamiento_pago_completo: (servicio.bono_reacomodamiento_pago_completo ?? 2000).toString(),
            tiempo_espera_respuesta: servicio.tiempo_espera_respuesta?.toString?.() || servicio.tiempo_espera_respuesta?.toString() || '15',
            porcentaje_sena: montoSena ? montoSena.toFixed(2) : '',
            monto_sena_fijo: (servicio.monto_sena_fijo ?? montoSena).toString(),
            horas_minimas_credito_cancelacion: (servicio.horas_minimas_credito_cancelacion ?? 24).toString(),
            porcentaje_devolucion_sena: (servicio.porcentaje_devolucion_sena ?? 100).toString(),
            porcentaje_devolucion_servicio_completo: (servicio.porcentaje_devolucion_servicio_completo ?? 100).toString(),
            frecuencia_recurrencia_dias: servicio.frecuencia_recurrencia_dias?.toString() || '30',
            tipo_descuento_fidelizacion: 'MONTO_FIJO',
            descuento_fidelizacion_pct: '0',
            descuento_fidelizacion_monto: descuentoFidelizacionMonto ? descuentoFidelizacionMonto.toFixed(2) : '0',
          });
        } else {
          console.error('Error al cargar servicio');
          setTimeout(() => {
            router.push('/dashboard/propietario/servicios');
          }, 2000);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        console.error('Error de conexión al cargar servicio:', error);
      } finally {
        setLoadingData(false);
      }
    };

    if (servicioId) {
      fetchData();
    }
  }, [servicioId]);

  const handleSubmit = async (values: ServicioFormValues) => {
    setLoading(true);

    try {
      const precio = parseFloat(values.precio);
      const duracion = parseInt(values.duracion_minutos, 10);
      const descuentoValor = values.valor_descuento_adelanto === '' ? 0 : parseFloat(values.valor_descuento_adelanto);
      const tiempoEspera = values.tiempo_espera_respuesta === '' ? 15 : parseInt(values.tiempo_espera_respuesta, 10);
      const porcentajeSena = 50;
      const montoSenaFijo = values.monto_sena_fijo === '' ? 0 : parseFloat(values.monto_sena_fijo);
      const horasMinimasCredito = values.horas_minimas_credito_cancelacion === ''
        ? 24
        : parseInt(values.horas_minimas_credito_cancelacion, 10);
      const porcentajeDevolucionSena = 100;
      const porcentajeDevolucionServicioCompleto = 100;

      const descuentoFidelizacionMonto = values.descuento_fidelizacion_monto === ''
        ? 0
        : parseFloat(values.descuento_fidelizacion_monto);
      const bonoReacomodamientoSenia = values.bono_reacomodamiento_senia === ''
        ? 0
        : parseFloat(values.bono_reacomodamiento_senia);
      const bonoReacomodamientoPagoCompleto = values.bono_reacomodamiento_pago_completo === ''
        ? 0
        : parseFloat(values.bono_reacomodamiento_pago_completo);

      const dataToSend = {
        nombre: values.nombre,
        categoria: parseInt(values.categoria, 10),
        precio,
        duracion_minutos: duracion,
        descripcion: values.descripcion,
        is_active: values.is_active,
        permite_reacomodamiento: values.permite_reacomodamiento,
        tipo_descuento_adelanto: values.tipo_descuento_adelanto,
        valor_descuento_adelanto: descuentoValor,
        monto_sena_fijo: montoSenaFijo,
        tiempo_espera_respuesta: tiempoEspera,
        porcentaje_sena: porcentajeSena,
        horas_minimas_credito_cancelacion: horasMinimasCredito,
        porcentaje_devolucion_sena: porcentajeDevolucionSena,
        porcentaje_devolucion_servicio_completo: porcentajeDevolucionServicioCompleto,
        bono_reacomodamiento_senia: bonoReacomodamientoSenia,
        bono_reacomodamiento_pago_completo: bonoReacomodamientoPagoCompleto,
        frecuencia_recurrencia_dias: parseInt(values.frecuencia_recurrencia_dias || '30', 10),
        descuento_fidelizacion_pct: 0,
        descuento_fidelizacion_monto: descuentoFidelizacionMonto,
      };

      const response = await fetch(`/api/servicios/${servicioId}/`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = Object.entries(errorData)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
        throw new Error(errorMessage || 'No se pudo actualizar el servicio. Por favor, verifica los datos e intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
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
            Modificar datos de {initialValues?.nombre ?? 'el servicio'}
          </p>
        </div>
      </div>

      {initialValues && (
        <ServicioForm
          mode="edit"
          categorias={categorias}
          initialValues={initialValues}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
