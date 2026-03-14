'use client';

import { CategoriaOption, ServicioForm, ServicioFormValues } from '@/components/ServicioForm';
import { Button } from '@/components/ui/button';
import { getAuthHeaders } from '@/lib/auth-headers';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
          const categoriasData = await categoriasRes.json();
          const categoriasActivas = (categoriasData.results || categoriasData).filter(
            (cat: any) => cat.is_active
          );
          setCategorias(categoriasActivas);
        }

        if (servicioRes.ok) {
          const servicio: Servicio = await servicioRes.json();
          // Determinar tipo de descuento de fidelización según los valores existentes
          let tipoDescuentoFidelizacion: 'PORCENTAJE' | 'MONTO_FIJO' = 'PORCENTAJE';
          if ((servicio.descuento_fidelizacion_monto ?? 0) > 0) {
            tipoDescuentoFidelizacion = 'MONTO_FIJO';
          } else if ((servicio.descuento_fidelizacion_pct ?? 0) > 0) {
            tipoDescuentoFidelizacion = 'PORCENTAJE';
          }

          setInitialValues({
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
            porcentaje_sena: servicio.porcentaje_sena?.toString?.() || servicio.porcentaje_sena || '25.00',
            frecuencia_recurrencia_dias: servicio.frecuencia_recurrencia_dias?.toString() || '30',
            tipo_descuento_fidelizacion: tipoDescuentoFidelizacion,
            descuento_fidelizacion_pct: servicio.descuento_fidelizacion_pct?.toString?.() || servicio.descuento_fidelizacion_pct?.toString?.() || '0',
            descuento_fidelizacion_monto: servicio.descuento_fidelizacion_monto?.toString?.() || servicio.descuento_fidelizacion_monto?.toString?.() || '0',
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
      const porcentajeSena = values.porcentaje_sena === '' ? 25 : parseFloat(values.porcentaje_sena);

      const valorFidelizacion = values.tipo_descuento_fidelizacion === 'PORCENTAJE'
        ? (values.descuento_fidelizacion_pct === '' ? 0 : parseFloat(values.descuento_fidelizacion_pct))
        : (values.descuento_fidelizacion_monto === '' ? 0 : parseFloat(values.descuento_fidelizacion_monto));

      const descuentoFidelizacionPct = values.tipo_descuento_fidelizacion === 'PORCENTAJE' ? valorFidelizacion : 0;
      const descuentoFidelizacionMonto = values.tipo_descuento_fidelizacion === 'MONTO_FIJO' ? valorFidelizacion : 0;

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
        tiempo_espera_respuesta: tiempoEspera,
        porcentaje_sena: porcentajeSena,
        frecuencia_recurrencia_dias: parseInt(values.frecuencia_recurrencia_dias || '30', 10),
        descuento_fidelizacion_pct: descuentoFidelizacionPct,
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
            Modificar datos de {formData.nombre}
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
