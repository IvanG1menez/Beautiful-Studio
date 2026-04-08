'use client';

import { CategoriaOption, ServicioForm, ServicioFormValues } from '@/components/ServicioForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getAuthHeaders } from '@/lib/auth-headers';
import { ArrowLeft, Loader2, Scissors } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface CategoriaApiItem {
  id: number;
  nombre: string;
  is_active: boolean;
}

export default function NuevoServicioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingCategorias, setLoadingCategorias] = useState(true);
  const [categorias, setCategorias] = useState<CategoriaOption[]>([]);

  // Cargar categorías activas
  useEffect(() => {
    const fetchCategorias = async () => {
      setLoadingCategorias(true);
      try {
        const response = await fetch('/api/servicios/categorias/', {
          headers: getAuthHeaders()
        });

        if (response.ok) {
          const data = await response.json() as { results?: CategoriaApiItem[] } | CategoriaApiItem[];
          const categoriasData = Array.isArray(data) ? data : (data.results || []);
          const categoriasActivas = categoriasData.filter((cat) => cat.is_active);
          setCategorias(categoriasActivas);
        } else {
          console.error('Error al cargar categorías');
        }
      } catch (error) {
        console.error('Error fetching categorias:', error);
      } finally {
        setLoadingCategorias(false);
      }
    };

    fetchCategorias();
  }, []);
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

      const response = await fetch('/api/servicios/', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = Object.entries(errorData)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
        throw new Error(errorMessage || 'No se pudo crear el servicio. Por favor, verifica los datos e intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

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

      <ServicioForm
        mode="create"
        categorias={categorias}
        initialValues={{
          nombre: '',
          categoria: '',
          precio: '',
          duracion_minutos: '',
          descripcion: '',
          is_active: true,
          permite_reacomodamiento: false,
          tipo_descuento_adelanto: 'MONTO_FIJO',
          valor_descuento_adelanto: '',
          bono_reacomodamiento_senia: '1000',
          bono_reacomodamiento_pago_completo: '2000',
          tiempo_espera_respuesta: '15',
          porcentaje_sena: '',
          monto_sena_fijo: '',
          horas_minimas_credito_cancelacion: '24',
          porcentaje_devolucion_sena: '100',
          porcentaje_devolucion_servicio_completo: '100',
          frecuencia_recurrencia_dias: '30',
          tipo_descuento_fidelizacion: 'MONTO_FIJO',
          descuento_fidelizacion_pct: '0',
          descuento_fidelizacion_monto: '0',
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
