'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthHeaders } from '@/lib/auth-headers';
import { formatCurrency } from '@/lib/utils';
import type { CategoriaServicio, Empleado, Servicio } from '@/types';
import { Clock, Info, Scissors, User, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ServicioConCategoria extends Servicio {
  categoria: CategoriaServicio;
}

export default function ServiciosClientePage() {
  const [categorias, setCategorias] = useState<CategoriaServicio[]>([]);
  const [servicios, setServicios] = useState<Record<number, ServicioConCategoria[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profesionalesPorServicio, setProfesionalesPorServicio] = useState<
    Record<number, { loading: boolean; data: Empleado[] | null }>
  >({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Cargar categorías activas
        const categoriasRes = await fetch('/api/servicios/categorias/?page_size=100', {
          headers: getAuthHeaders(),
        });

        if (!categoriasRes.ok) {
          throw new Error('No se pudieron cargar las categorías de servicios');
        }

        const categoriasData = await categoriasRes.json();
        const categoriasList: CategoriaServicio[] = categoriasData.results || categoriasData;
        setCategorias(categoriasList);

        // Cargar servicios por categoría
        const serviciosPorCategoria: Record<number, ServicioConCategoria[]> = {};

        for (const categoria of categoriasList) {
          const serviciosRes = await fetch(
            `/api/servicios/?categoria=${categoria.id}&page_size=100`,
            { headers: getAuthHeaders() },
          );

          if (serviciosRes.ok) {
            const serviciosData = await serviciosRes.json();
            const listaServicios: ServicioConCategoria[] = serviciosData.results || serviciosData;
            serviciosPorCategoria[categoria.id] = listaServicios.filter((s) => s.is_active);
          }
        }

        setServicios(serviciosPorCategoria);
      } catch (e) {
        console.error(e);
        setError('Ocurrió un error al cargar los servicios del estudio');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleVerProfesionales = async (servicio: Servicio) => {
    const current = profesionalesPorServicio[servicio.id];
    if (current?.data || current?.loading) return;

    setProfesionalesPorServicio((prev) => ({
      ...prev,
      [servicio.id]: { loading: true, data: null },
    }));

    try {
      const res = await fetch(
        `/api/empleados/?servicio=${servicio.id}&disponible=true&page_size=50`,
        { headers: getAuthHeaders() },
      );

      if (res.ok) {
        const data = await res.json();
        const lista: Empleado[] = data.results || data;
        setProfesionalesPorServicio((prev) => ({
          ...prev,
          [servicio.id]: { loading: false, data: lista },
        }));
      } else {
        setProfesionalesPorServicio((prev) => ({
          ...prev,
          [servicio.id]: { loading: false, data: [] },
        }));
      }
    } catch (e) {
      console.error(e);
      setProfesionalesPorServicio((prev) => ({
        ...prev,
        [servicio.id]: { loading: false, data: [] },
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Servicios que ofrece tu estudio
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Mirá el catálogo completo de servicios, con precios, duración aproximada y los profesionales
            que los realizan.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-500">
            Cargando servicios del estudio...
          </div>
        )}

        {error && !loading && (
          <div className="max-w-xl mx-auto bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && categorias.length === 0 && (
          <div className="text-center py-16 text-gray-500 text-sm">
            Todavía no hay servicios configurados en este estudio.
          </div>
        )}

        {!loading && !error && categorias.length > 0 && (
          <div className="space-y-8">
            {categorias.map((categoria) => {
              const listaServicios = servicios[categoria.id] || [];
              if (listaServicios.length === 0) return null;

              return (
                <section key={categoria.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <Scissors className="w-5 h-5 text-purple-600" />
                        {categoria.nombre}
                      </h2>
                      {categoria.descripcion && (
                        <p className="text-sm text-gray-600 mt-1">{categoria.descripcion}</p>
                      )}
                    </div>
                    {categoria.sala_nombre && (
                      <Badge variant="outline" className="text-xs">
                        Sala: {categoria.sala_nombre} ({categoria.sala_capacidad} personas)
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {listaServicios.map((servicio) => {
                      const profesionalesInfo = profesionalesPorServicio[servicio.id];
                      const profesionales = profesionalesInfo?.data || [];

                      return (
                        <Card key={servicio.id} className="h-full flex flex-col">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <CardTitle className="text-base">{servicio.nombre}</CardTitle>
                                {servicio.descripcion && (
                                  <CardDescription className="text-xs mt-1 line-clamp-3">
                                    {servicio.descripcion}
                                  </CardDescription>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-gray-500">Desde</p>
                                <p className="text-lg font-semibold text-gray-900">
                                  {formatCurrency(parseFloat(servicio.precio))}
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="flex-1 flex flex-col justify-between gap-3">
                            <div className="space-y-2 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-500" />
                                <span>Duración aproximada: {servicio.duracion_minutos} minutos</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-500" />
                                <span>
                                  Profesionales que lo realizan:
                                  {profesionalesInfo?.loading && ' cargando...'}
                                  {!profesionalesInfo && ' tocá para ver quiénes lo realizan'}
                                  {profesionalesInfo && !profesionalesInfo.loading && profesionales.length === 0 &&
                                    ' aún sin profesionales asignados'}
                                  {profesionales.length > 0 && (
                                    <> {profesionales.length} profesional(es) disponible(s)</>
                                  )}
                                </span>
                              </div>
                              {profesionales.length > 0 && (
                                <div className="flex items-start gap-2 text-xs text-gray-500">
                                  <Users className="w-4 h-4 mt-0.5" />
                                  <p>
                                    {profesionales
                                      .slice(0, 3)
                                      .map((p) => `${p.first_name} ${p.last_name}`)
                                      .join(', ')}
                                    {profesionales.length > 3 && ' y más...'}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="pt-2 flex items-center justify-between">
                              <p className="text-xs text-gray-500 max-w-[70%]">
                                Cuando reserves un turno vas a poder elegir el profesional y el horario exacto.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleVerProfesionales(servicio)}
                              >
                                Ver profesionales
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
