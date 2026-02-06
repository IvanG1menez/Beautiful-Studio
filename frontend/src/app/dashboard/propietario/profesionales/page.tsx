'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { empleadosService } from '@/services/empleados';
import { Empleado } from '@/types';
import { ChevronLeft, ChevronRight, Edit, Filter, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const DIAS_MAP: { [key: string]: string } = {
  'L': 'Lun',
  'M': 'Mar',
  'X': 'Mier',
  'J': 'Jue',
  'V': 'Vie',
  'S': 'Sab',
  'D': 'Dom'
};

export default function ProfesionalesPage() {
  const router = useRouter();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterServicio, setFilterServicio] = useState<string>('');
  const [filterCategoria, setFilterCategoria] = useState<string>('');
  const [filterDisponible, setFilterDisponible] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [empleadoToDelete, setEmpleadoToDelete] = useState<Empleado | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedEmpleadoId, setExpandedEmpleadoId] = useState<number | null>(null);
  const itemsPerPage = 10;

  const loadEmpleados = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      // Cargar TODOS los empleados de una vez (sin paginación del backend)
      const response = await empleadosService.list({ page: 1, page_size: 1000 });
      console.log('Empleados recibidos:', response.results);
      setEmpleados(response.results);
      // La paginación se hará en el frontend
    } catch (err: any) {
      console.error('Error loading empleados:', err);
      setError(err.message || 'Error al cargar los profesionales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmpleados();
  }, []);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterServicio, filterCategoria, filterDisponible]);

  const parseDiasTrabajo = (dias: string): string[] => {
    if (!dias) return [];
    return dias.split(',').map(d => d.trim()).filter(d => d);
  };

  const getHorariosAgrupados = (empleado: Empleado) => {
    const agrupados: { [key: string]: { hora_inicio: string; hora_fin: string }[] } = {};
    (empleado.horarios_detallados || []).forEach((horario) => {
      const dia = horario.dia_semana_display;
      if (!agrupados[dia]) {
        agrupados[dia] = [];
      }
      agrupados[dia].push({
        hora_inicio: horario.hora_inicio,
        hora_fin: horario.hora_fin,
      });
    });

    Object.keys(agrupados).forEach((dia) => {
      agrupados[dia].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    });

    return agrupados;
  };

  const formatRangos = (rangos: { hora_inicio: string; hora_fin: string }[]) => {
    return rangos.map((r) => `${r.hora_inicio} - ${r.hora_fin}`).join(' / ');
  };

  // Filtrar empleados localmente
  const filteredEmpleados = empleados.filter((emp) => {
    // Filtro de búsqueda (nombre, email, DNI)
    const matchesSearch = searchTerm === '' ||
      emp.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.user_dni?.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro de servicio
    const matchesServicio = !filterServicio ||
      (emp.servicios || []).some((servicio) => servicio.id.toString() === filterServicio);

    // Filtro de categoría
    const matchesCategoria = !filterCategoria ||
      (emp.servicios || []).some((servicio) => servicio.categoria_nombre === filterCategoria);

    // Filtro de disponibilidad
    const matchesDisponible = filterDisponible === 'all' ||
      (filterDisponible === 'disponible' && emp.is_disponible) ||
      (filterDisponible === 'no_disponible' && !emp.is_disponible);

    return matchesSearch && matchesServicio && matchesCategoria && matchesDisponible;
  });

  const serviciosOptions: ComboboxOption[] = Array.from(
    new Map(
      empleados
        .flatMap((emp) => emp.servicios || [])
        .map((servicio) => [
          servicio.id,
          {
            value: servicio.id.toString(),
            label: servicio.nombre,
            description: servicio.categoria_nombre,
          },
        ])
    ).values()
  );

  const categoriasOptions: ComboboxOption[] = Array.from(
    new Set(
      empleados
        .flatMap((emp) => emp.servicios || [])
        .map((servicio) => servicio.categoria_nombre)
        .filter(Boolean)
    )
  ).map((categoria) => ({
    value: categoria,
    label: categoria,
  }));

  // Calcular paginación en el frontend
  const totalFilteredItems = filteredEmpleados.length;
  const totalPages = Math.ceil(totalFilteredItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEmpleados = filteredEmpleados.slice(startIndex, endIndex);

  const handleDeleteClick = (empleado: Empleado) => {
    setEmpleadoToDelete(empleado);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!empleadoToDelete) return;

    setDeleting(true);
    try {
      await empleadosService.delete(empleadoToDelete.id);

      // Recargar la lista de empleados
      await loadEmpleados();

      setDeleteDialogOpen(false);
      setEmpleadoToDelete(null);
    } catch (err: any) {
      console.error('Error deleting empleado:', err);
      setError(err.message || 'Error al eliminar el profesional');
    } finally {
      setDeleting(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Cargando profesionales...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Profesionales</h1>
        <p className="text-gray-600 mt-1">
          Administra los profesionales de tu salon de belleza
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Profesionales</CardTitle>
              <CardDescription>
                Gestiona todos los profesionales que trabajan en tu salÃ³n
              </CardDescription>
            </div>
            <Button onClick={() => router.push('/dashboard/propietario/profesionales/nuevo')}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Profesional
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Barra de filtros y búsqueda */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Filter className="w-4 h-4" />
              <span>Filtros de Búsqueda</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Búsqueda por texto */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, email, DNI..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtro por servicio */}
              <Combobox
                options={serviciosOptions}
                value={filterServicio}
                onValueChange={setFilterServicio}
                placeholder="Todos los servicios"
                searchPlaceholder="Buscar servicio..."
                emptyMessage="No se encontraron servicios"
              />

              {/* Filtro por categoría */}
              <Combobox
                options={categoriasOptions}
                value={filterCategoria}
                onValueChange={setFilterCategoria}
                placeholder="Todas las categorías"
                searchPlaceholder="Buscar categoría..."
                emptyMessage="No se encontraron categorías"
              />

              {/* Filtro por disponibilidad */}
              <Select value={filterDisponible} onValueChange={setFilterDisponible}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="disponible">Disponibles</SelectItem>
                  <SelectItem value="no_disponible">No disponibles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contador de resultados */}
            <div className="text-sm text-gray-600">
              Mostrando {startIndex + 1} - {Math.min(endIndex, totalFilteredItems)} de {totalFilteredItems} profesionales
              {totalFilteredItems !== empleados.length && ` (${empleados.length} totales)`}
            </div>
          </div>

          {error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => loadEmpleados()} variant="outline">
                Reintentar
              </Button>
            </div>
          ) : paginatedEmpleados.length > 0 ? (
            <div className="space-y-4">
              {paginatedEmpleados.map((empleado) => (
                <div
                  key={empleado.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="flex justify-between items-start cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedEmpleadoId(
                        expandedEmpleadoId === empleado.id ? null : empleado.id
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setExpandedEmpleadoId(
                          expandedEmpleadoId === empleado.id ? null : empleado.id
                        );
                      }
                    }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg">
                          {empleado.first_name + ' ' + empleado.last_name || 'Sin nombre'}
                        </h3>
                      </div>
                      {empleado.servicios && empleado.servicios.length > 0 ? (
                        <div className="mt-1 text-sm text-gray-700">
                          <span className="font-medium">
                            {empleado.servicios[0].nombre}
                          </span>
                          <span className="text-gray-500">
                            {' '}- {empleado.servicios[0].categoria_nombre}
                          </span>
                          {empleado.servicios.length > 1 && (
                            <span className="text-gray-400">
                              {' '}+{empleado.servicios.length - 1} más
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Sin servicios asignados</p>
                      )}
                      <p className="text-sm text-gray-500">{empleado.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {empleado.is_disponible ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Disponible
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            No disponible
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/propietario/profesionales/${empleado.id}/editar`);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(empleado);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {expandedEmpleadoId === empleado.id && (
                    <div className="mt-4 border-t pt-4 text-sm text-gray-600">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {empleado.user_dni && (
                          <div>
                            <span className="font-medium text-gray-700">DNI:</span>{' '}
                            {empleado.user_dni}
                          </div>
                        )}
                        {empleado.horarios_detallados && empleado.horarios_detallados.length > 0 ? (
                          <div className="md:col-span-2">
                            <span className="font-medium text-gray-700">Horarios por día:</span>
                            <div className="mt-2 space-y-1 text-gray-600">
                              {Object.entries(getHorariosAgrupados(empleado)).map(([dia, rangos]) => (
                                <div key={dia}>
                                  <span className="font-medium">{dia}:</span>{' '}
                                  {formatRangos(rangos)}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium text-gray-700">Horario:</span>{' '}
                            {empleado.horario_entrada?.slice(0, 5)} - {empleado.horario_salida?.slice(0, 5)}
                          </div>
                        )}
                      </div>
                      {empleado.biografia && (
                        <p className="mt-2 text-gray-500">{empleado.biografia}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {parseDiasTrabajo(empleado.dias_trabajo).map((dia, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {DIAS_MAP[dia] || dia}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No hay profesionales registrados</p>
              <Button onClick={() => router.push('/dashboard/propietario/profesionales/nuevo')}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Primer Profesional
              </Button>
            </div>
          )}
        </CardContent>

        {/* Paginación */}
        {!error && !loading && totalPages > 1 && (
          <div className="border-t px-6 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar profesional?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar a <strong>{empleadoToDelete?.first_name} {empleadoToDelete?.last_name}</strong>?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
