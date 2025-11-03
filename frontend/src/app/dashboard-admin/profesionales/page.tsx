'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [filterEspecialidad, setFilterEspecialidad] = useState<string>('all');
  const [filterDisponible, setFilterDisponible] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [empleadoToDelete, setEmpleadoToDelete] = useState<Empleado | null>(null);
  const [deleting, setDeleting] = useState(false);
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
  }, [searchTerm, filterEspecialidad, filterDisponible]);

  const parseDiasTrabajo = (dias: string): string[] => {
    if (!dias) return [];
    return dias.split(',').map(d => d.trim()).filter(d => d);
  };

  // Filtrar empleados localmente
  const filteredEmpleados = empleados.filter((emp) => {
    // Filtro de búsqueda (nombre, email, DNI)
    const matchesSearch = searchTerm === '' ||
      emp.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.user_dni?.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro de especialidad
    const matchesEspecialidad = filterEspecialidad === 'all' ||
      emp.especialidades?.toLowerCase().includes(filterEspecialidad.toLowerCase());

    // Filtro de disponibilidad
    const matchesDisponible = filterDisponible === 'all' ||
      (filterDisponible === 'disponible' && emp.is_disponible) ||
      (filterDisponible === 'no_disponible' && !emp.is_disponible);

    return matchesSearch && matchesEspecialidad && matchesDisponible;
  });

  // Obtener especialidades únicas para el filtro
  const especialidadesUnicas = Array.from(
    new Set(empleados.map(emp => emp.especialidades).filter(Boolean))
  );

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
            <Button onClick={() => router.push('/dashboard-admin/profesionales/nuevo')}>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              {/* Filtro por especialidad */}
              <Select value={filterEspecialidad} onValueChange={setFilterEspecialidad}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las especialidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las especialidades</SelectItem>
                  {especialidadesUnicas.map((esp) => (
                    <SelectItem key={esp} value={esp || ''}>
                      {esp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg">
                          {empleado.first_name + ' ' + empleado.last_name || 'Sin nombre'}
                        </h3>
                        {empleado.user_dni && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            DNI: {empleado.user_dni}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 capitalize">{empleado.especialidades}</p>
                      <p className="text-sm text-gray-500">{empleado.email}</p>
                      {empleado.biografia && (
                        <p className="text-sm text-gray-400 mt-1 line-clamp-2">{empleado.biografia}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {parseDiasTrabajo(empleado.dias_trabajo).map((dia, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {DIAS_MAP[dia] || dia}
                          </span>
                        ))}
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
                        onClick={() => router.push(`/dashboard-admin/profesionales/${empleado.id}/editar`)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(empleado)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No hay profesionales registrados</p>
              <Button onClick={() => router.push('/dashboard-admin/profesionales/nuevo')}>
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
