'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, DoorClosed, Loader2, Pencil, Plus, Scissors, Search, Tag, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
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

interface Sala {
  id: number;
  nombre: string;
  capacidad_simultanea: number;
  categorias: { id: number; nombre: string }[];
  categorias_count?: number;
}

interface Servicio {
  id: number;
  nombre: string;
  categoria: number;
  categoria_nombre: string;
  precio: string;
  descuento_reasignacion?: string;
  permite_reacomodamiento?: boolean;
  tipo_descuento_adelanto?: 'PORCENTAJE' | 'MONTO_FIJO';
  valor_descuento_adelanto?: string;
  tiempo_espera_respuesta?: number;
  porcentaje_sena?: string;
  duracion_minutos: number;
  duracion_horas?: string;
  descripcion: string;
  is_active: boolean;
}

export default function ServiciosAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estados para categorías
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [categoriaForm, setCategoriaForm] = useState({
    nombre: '',
    descripcion: '',
    sala: '',
    is_active: true
  });

  // Estados para salas
  const [salaDialogOpen, setSalaDialogOpen] = useState(false);
  const [editingSala, setEditingSala] = useState<Sala | null>(null);
  const [salaForm, setSalaForm] = useState({
    nombre: '',
    capacidad_simultanea: '1'
  });

  // Estados para servicios
  const [servicios, setServicios] = useState<Servicio[]>([]);

  // Estados generales
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('categorias');

  // Estados para búsqueda y filtros
  const [searchCategoria, setSearchCategoria] = useState('');
  const [searchServicio, setSearchServicio] = useState('');
  const [searchSala, setSearchSala] = useState('');
  const [expandedServicioId, setExpandedServicioId] = useState<number | null>(null);

  // Estados para paginación
  const [currentPageCategorias, setCurrentPageCategorias] = useState(1);
  const [currentPageServicios, setCurrentPageServicios] = useState(1);
  const [currentPageSalas, setCurrentPageSalas] = useState(1);
  const itemsPerPage = 5;

  // Estados para modales de confirmación y notificación
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState({ title: '', description: '' });

  // Estados para modal de notificación (éxito/error)
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({ title: '', description: '', type: 'success' as 'success' | 'error' });

  // Función para obtener token y headers correctos
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Token ${token}` : ''
    };
  };

  // Cargar datos iniciales
  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      
      const [categoriasRes, serviciosRes, salasRes] = await Promise.all([
        fetch(`${baseUrl}/servicios/categorias/`, { headers }),
        fetch(`${baseUrl}/servicios/`, { headers }),
        fetch(`${baseUrl}/servicios/salas/`, { headers })
      ]);

      if (categoriasRes.ok) {
        const categoriasData = await categoriasRes.json();
        setCategorias(categoriasData.results || categoriasData);
      }

      if (serviciosRes.ok) {
        const serviciosData = await serviciosRes.json();
        setServicios(serviciosData.results || serviciosData);
      }

      if (salasRes.ok) {
        const salasData = await salasRes.json();
        setSalas(salasData.results || salasData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor. Verifica tu conexión a internet.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['categorias', 'servicios', 'salas'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Funciones de filtrado y ordenamiento
  const getFilteredCategorias = () => {
    return categorias.filter(cat =>
      cat.nombre.toLowerCase().includes(searchCategoria.toLowerCase()) ||
      (cat.descripcion && cat.descripcion.toLowerCase().includes(searchCategoria.toLowerCase()))
    );
  };

  const getFilteredServicios = () => {
    return servicios.filter(serv =>
      serv.nombre.toLowerCase().includes(searchServicio.toLowerCase()) ||
      serv.categoria_nombre.toLowerCase().includes(searchServicio.toLowerCase()) ||
      (serv.descripcion && serv.descripcion.toLowerCase().includes(searchServicio.toLowerCase()))
    );
  };

  const getFilteredSalas = () => {
    return salas.filter(sala =>
      sala.nombre.toLowerCase().includes(searchSala.toLowerCase())
    );
  };

  // Funciones de paginación
  const getPaginatedCategorias = () => {
    const filtered = getFilteredCategorias();
    const startIndex = (currentPageCategorias - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const getPaginatedServicios = () => {
    const filtered = getFilteredServicios();
    const startIndex = (currentPageServicios - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const getPaginatedSalas = () => {
    const filtered = getFilteredSalas();
    const startIndex = (currentPageSalas - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const getTotalPagesCategorias = () => {
    return Math.ceil(getFilteredCategorias().length / itemsPerPage);
  };

  const getTotalPagesServicios = () => {
    return Math.ceil(getFilteredServicios().length / itemsPerPage);
  };

  const getTotalPagesSalas = () => {
    return Math.ceil(getFilteredSalas().length / itemsPerPage);
  };

  // Función para mostrar confirmación modal
  const showConfirmDialog = (title: string, description: string, action: () => void) => {
    setConfirmMessage({ title, description });
    setConfirmAction(() => action);
    setConfirmDialogOpen(true);
  };

  const handleConfirmAction = () => {
    if (confirmAction) {
      confirmAction();
    }
    setConfirmDialogOpen(false);
  };

  // Función para mostrar notificación modal
  const showNotification = (title: string, description: string, type: 'success' | 'error') => {
    setNotificationMessage({ title, description, type });
    setNotificationDialogOpen(true);
  };

  // Funciones para categorías
  const handleCategoriaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const url = editingCategoria
      ? `${baseUrl}/servicios/categorias/${editingCategoria.id}/`
      : `${baseUrl}/servicios/categorias/`;

    const method = editingCategoria ? 'PUT' : 'POST';

    const payload = {
      ...categoriaForm,
      sala: categoriaForm.sala ? parseInt(categoriaForm.sala, 10) : null
    };

    try {
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showNotification(
          editingCategoria ? 'Categoría actualizada' : 'Categoría creada',
          editingCategoria
            ? 'Los cambios se han guardado correctamente.'
            : 'La nueva categoría ha sido creada exitosamente.',
          'success'
        );
        setCategoriaDialogOpen(false);
        setEditingCategoria(null);
        setCategoriaForm({ nombre: '', descripcion: '', sala: '', is_active: true });
        fetchData();
      } else {
        const errorData = await response.json();
        console.error('Error del backend:', errorData);
        const errorMessage = errorData.detail
          || errorData.nombre?.[0]
          || errorData.descripcion?.[0]
          || errorData.non_field_errors?.[0]
          || JSON.stringify(errorData);
        showNotification('Error al guardar categoría', errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor. Verifica tu conexión a internet.', 'error');
    }
  };

  const handleEditCategoria = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setCategoriaForm({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      sala: categoria.sala ? categoria.sala.toString() : '',
      is_active: categoria.is_active
    });
    setCategoriaDialogOpen(true);
  };

  const handleDeleteCategoria = async (categoriaId: number, nombreCategoria: string) => {
    showConfirmDialog(
      '¿Eliminar categoría?',
      `Esta acción no se puede deshacer. Se eliminará la categoría "${nombreCategoria}" y todos los servicios asociados quedarán sin categoría.`,
      async () => {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
          const response = await fetch(`${baseUrl}/servicios/categorias/${categoriaId}/`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });

          if (response.ok || response.status === 204) {
            showNotification(
              'Categoría eliminada',
              `La categoría "${nombreCategoria}" ha sido eliminada correctamente.`,
              'success'
            );
            fetchData();
          } else {
            const errorData = await response.json();
            console.error('Error al eliminar:', errorData);
            const errorMessage = errorData.detail || errorData.error || 'No se pudo eliminar la categoría';
            showNotification('Error al eliminar', errorMessage, 'error');
          }
        } catch (error) {
          console.error('Error:', error);
          showNotification('Error de conexión', 'No se pudo conectar con el servidor. Verifica tu conexión a internet.', 'error');
        }
      }
    );
  };

  // Funciones para servicios
  const handleDeleteServicio = async (servicioId: number, nombreServicio: string) => {
    showConfirmDialog(
      '¿Eliminar servicio?',
      `Esta acción no se puede deshacer. Se eliminará el servicio "${nombreServicio}".`,
      async () => {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
          const response = await fetch(`${baseUrl}/servicios/${servicioId}/`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });

          if (response.ok || response.status === 204) {
            showNotification(
              'Servicio eliminado',
              `El servicio "${nombreServicio}" ha sido eliminado correctamente.`,
              'success'
            );
            fetchData();
          } else {
            const errorData = await response.json();
            console.error('Error al eliminar:', errorData);
            const errorMessage = errorData.detail || errorData.error || 'No se pudo eliminar el servicio';
            showNotification('Error al eliminar', errorMessage, 'error');
          }
        } catch (error) {
          console.error('Error:', error);
          showNotification('Error de conexión', 'No se pudo conectar con el servidor. Verifica tu conexión a internet.', 'error');
        }
      }
    );
  };

  // Funciones para salas
  const handleSalaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const url = editingSala
      ? `${baseUrl}/servicios/salas/${editingSala.id}/`
      : `${baseUrl}/servicios/salas/`;
    const method = editingSala ? 'PUT' : 'POST';

    const capacidad = parseInt(salaForm.capacidad_simultanea, 10);
    if (!salaForm.nombre || isNaN(capacidad) || capacidad < 1) {
      showNotification(
        'Datos inválidos',
        'La sala requiere un nombre y una capacidad simultánea mayor a 0.',
        'error'
      );
      return;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          nombre: salaForm.nombre,
          capacidad_simultanea: capacidad
        })
      });

      if (response.ok) {
        showNotification(
          editingSala ? 'Sala actualizada' : 'Sala creada',
          editingSala
            ? 'Los cambios de la sala se guardaron correctamente.'
            : 'La nueva sala ha sido creada exitosamente.',
          'success'
        );
        setSalaDialogOpen(false);
        setEditingSala(null);
        setSalaForm({ nombre: '', capacidad_simultanea: '1' });
        fetchData();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.detail || errorData.error || 'No se pudo guardar la sala.';
        showNotification('Error al guardar sala', errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
    }
  };

  const handleEditSala = (sala: Sala) => {
    setEditingSala(sala);
    setSalaForm({
      nombre: sala.nombre,
      capacidad_simultanea: sala.capacidad_simultanea.toString()
    });
    setSalaDialogOpen(true);
  };

  const handleDeleteSala = async (salaId: number, nombreSala: string) => {
    showConfirmDialog(
      '¿Eliminar sala? ',
      `Esta acción no se puede deshacer. Se eliminará la sala "${nombreSala}".`,
      async () => {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
          const response = await fetch(`${baseUrl}/servicios/salas/${salaId}/`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });

          if (response.ok || response.status === 204) {
            showNotification(
              'Sala eliminada',
              `La sala "${nombreSala}" ha sido eliminada correctamente.`,
              'success'
            );
            fetchData();
          } else {
            const errorData = await response.json();
            const errorMessage = errorData.detail || errorData.error || 'No se pudo eliminar la sala.';
            showNotification('Error al eliminar', errorMessage, 'error');
          }
        } catch (error) {
          console.error('Error:', error);
          showNotification('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
        }
      }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Cargando gestión de servicios...</span>
      </div>
    );
  }

  const paginatedCategorias = getPaginatedCategorias();
  const paginatedServicios = getPaginatedServicios();
  const paginatedSalas = getPaginatedSalas();
  const totalPagesCategorias = getTotalPagesCategorias();
  const totalPagesServicios = getTotalPagesServicios();
  const totalPagesSalas = getTotalPagesSalas();
  const selectedSala = categoriaForm.sala
    ? salas.find((sala) => sala.id === parseInt(categoriaForm.sala, 10))
    : null;
  const categoriasCompartidas = selectedSala
    ? selectedSala.categorias.filter(
        (cat) => cat.id !== (editingCategoria ? editingCategoria.id : null)
      )
    : [];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Servicios</h1>
        <p className="text-gray-600 mt-1">
          Administra categorías y servicios de tu salón de belleza
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="categorias" className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Categorías ({getFilteredCategorias().length})
          </TabsTrigger>
          <TabsTrigger value="servicios" className="flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Servicios ({getFilteredServicios().length})
          </TabsTrigger>
          <TabsTrigger value="salas" className="flex items-center gap-2">
            <DoorClosed className="w-4 h-4" />
            Salas ({getFilteredSalas().length})
          </TabsTrigger>
        </TabsList>

        {/* TAB CATEGORÍAS */}
        <TabsContent value="categorias" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Categorías de Servicios</CardTitle>
                  <CardDescription>
                    Gestiona las categorías disponibles para clasificar tus servicios
                  </CardDescription>
                </div>
                <Dialog open={categoriaDialogOpen} onOpenChange={setCategoriaDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingCategoria(null);
                      setCategoriaForm({ nombre: '', descripcion: '', sala: '', is_active: true });
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nueva Categoría
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
                      </DialogTitle>
                      <DialogDescription>
                        {editingCategoria ? 'Modifica los datos de la categoría' : 'Crea una nueva categoría para clasificar servicios'}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCategoriaSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="categoria-nombre">Nombre *</Label>
                        <Input
                          id="categoria-nombre"
                          value={categoriaForm.nombre}
                          onChange={(e) => setCategoriaForm({ ...categoriaForm, nombre: e.target.value })}
                          placeholder="Ej: Corte de cabello"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="categoria-descripcion">Descripción</Label>
                        <Textarea
                          id="categoria-descripcion"
                          value={categoriaForm.descripcion}
                          onChange={(e) => setCategoriaForm({ ...categoriaForm, descripcion: e.target.value })}
                          placeholder="Descripción opcional de la categoría"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="categoria-sala">Sala</Label>
                        <select
                          id="categoria-sala"
                          value={categoriaForm.sala}
                          onChange={(e) => setCategoriaForm({ ...categoriaForm, sala: e.target.value })}
                          className="w-full border rounded-md px-3 py-2 text-sm"
                        >
                          <option value="">Sin sala asignada</option>
                          {salas.map((sala) => (
                            <option key={sala.id} value={sala.id}>
                              {sala.nombre} (Capacidad: {sala.capacidad_simultanea})
                            </option>
                          ))}
                        </select>
                        {selectedSala && categoriasCompartidas.length > 0 && (
                          <p className="mt-2 text-sm text-amber-700">
                            Esta sala ya está vinculada a {categoriasCompartidas.map((cat) => cat.nombre).join(', ')}.
                            Compartirán la capacidad de {selectedSala.capacidad_simultanea} puestos.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="categoria-active"
                          checked={categoriaForm.is_active || false}
                          onChange={(e) => setCategoriaForm({ ...categoriaForm, is_active: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="categoria-active">Categoría activa</Label>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setCategoriaDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit">
                          {editingCategoria ? 'Actualizar' : 'Crear'} Categoría
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Barra de búsqueda para categorías */}
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar categorías..."
                  value={searchCategoria}
                  onChange={(e) => {
                    setSearchCategoria(e.target.value);
                    setCurrentPageCategorias(1);
                  }}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paginatedCategorias.map((categoria) => (
                  <div key={categoria.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div>
                      <h3 className="font-semibold">{categoria.nombre}</h3>
                      {categoria.descripcion && (
                        <p className="text-sm text-gray-600">{categoria.descripcion}</p>
                      )}
                      <Badge variant={categoria.is_active ? "default" : "secondary"} className="mt-2">
                        {categoria.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditCategoria(categoria)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCategoria(categoria.id, categoria.nombre)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                {paginatedCategorias.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    {searchCategoria ? 'No se encontraron categorías que coincidan con la búsqueda.' : 'No hay categorías registradas. Crea la primera categoría para comenzar.'}
                  </p>
                )}
              </div>

              {/* Paginación Categorías */}
              {totalPagesCategorias > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Mostrando {((currentPageCategorias - 1) * itemsPerPage) + 1} - {Math.min(currentPageCategorias * itemsPerPage, getFilteredCategorias().length)} de {getFilteredCategorias().length}
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageCategorias(prev => Math.max(1, prev - 1))}
                      disabled={currentPageCategorias === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <span className="text-sm">
                      Página {currentPageCategorias} de {totalPagesCategorias}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageCategorias(prev => Math.min(totalPagesCategorias, prev + 1))}
                      disabled={currentPageCategorias === totalPagesCategorias}
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB SERVICIOS */}
        <TabsContent value="servicios" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Servicios</CardTitle>
                  <CardDescription>
                    Gestiona todos los servicios disponibles en tu salón
                  </CardDescription>
                </div>
                <Button onClick={() => router.push('/dashboard/propietario/servicios/nuevo')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Servicio
                </Button>
              </div>

              {/* Barra de búsqueda para servicios */}
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar servicios..."
                  value={searchServicio}
                  onChange={(e) => {
                    setSearchServicio(e.target.value);
                    setCurrentPageServicios(1);
                  }}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paginatedServicios.map((servicio) => (
                  <div key={servicio.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div
                      className="flex items-start justify-between cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setExpandedServicioId(
                          expandedServicioId === servicio.id ? null : servicio.id
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setExpandedServicioId(
                            expandedServicioId === servicio.id ? null : servicio.id
                          );
                        }
                      }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold">{servicio.nombre}</h3>
                          <Badge variant="outline">{servicio.categoria_nombre}</Badge>
                          <Badge variant={servicio.is_active ? "default" : "secondary"}>
                            {servicio.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>💰 ${servicio.precio}</span>
                          <span>⏱️ {servicio.duracion_minutos} min</span>
                          {servicio.porcentaje_sena && (
                            <span>💳 Seña {servicio.porcentaje_sena}%</span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/propietario/servicios/${servicio.id}/editar`);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteServicio(servicio.id, servicio.nombre);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    {expandedServicioId === servicio.id && (
                      <div className="mt-4 border-t pt-4 text-sm text-gray-600">
                        {servicio.descripcion && (
                          <p className="text-sm text-gray-600 mb-3">{servicio.descripcion}</p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          <div>
                            <span className="font-medium">Precio:</span> ${servicio.precio}
                          </div>
                          <div>
                            <span className="font-medium">Duración:</span> {servicio.duracion_minutos} min
                          </div>
                          {servicio.descuento_reasignacion && (
                            <div>
                              <span className="font-medium">Descuento reasignación:</span> ${servicio.descuento_reasignacion}
                            </div>
                          )}
                          {servicio.tipo_descuento_adelanto && servicio.valor_descuento_adelanto && (
                            <div>
                              <span className="font-medium">Descuento adelanto:</span>{' '}
                              {servicio.tipo_descuento_adelanto === 'PORCENTAJE'
                                ? `${servicio.valor_descuento_adelanto}%`
                                : `$${servicio.valor_descuento_adelanto}`}
                            </div>
                          )}
                          {servicio.tiempo_espera_respuesta !== undefined && (
                            <div>
                              <span className="font-medium">Espera respuesta:</span> {servicio.tiempo_espera_respuesta} min
                            </div>
                          )}
                          {servicio.porcentaje_sena && (
                            <div>
                              <span className="font-medium">Seña:</span> {servicio.porcentaje_sena}%
                            </div>
                          )}
                          {servicio.permite_reacomodamiento !== undefined && (
                            <div>
                              <span className="font-medium">Reacomodamiento:</span>{' '}
                              {servicio.permite_reacomodamiento ? 'Sí' : 'No'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {paginatedServicios.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    {searchServicio ? 'No se encontraron servicios que coincidan con la búsqueda.' : 'No hay servicios registrados. Crea el primer servicio para comenzar.'}
                  </p>
                )}
              </div>

              {/* Paginación Servicios */}
              {totalPagesServicios > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Mostrando {((currentPageServicios - 1) * itemsPerPage) + 1} - {Math.min(currentPageServicios * itemsPerPage, getFilteredServicios().length)} de {getFilteredServicios().length}
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageServicios(prev => Math.max(1, prev - 1))}
                      disabled={currentPageServicios === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <span className="text-sm">
                      Página {currentPageServicios} de {totalPagesServicios}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageServicios(prev => Math.min(totalPagesServicios, prev + 1))}
                      disabled={currentPageServicios === totalPagesServicios}
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB SALAS */}
        <TabsContent value="salas" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Salas</CardTitle>
                  <CardDescription>
                    Gestiona las salas físicas y su capacidad simultánea
                  </CardDescription>
                </div>
                <Dialog open={salaDialogOpen} onOpenChange={setSalaDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingSala(null);
                        setSalaForm({ nombre: '', capacidad_simultanea: '1' });
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Nueva Sala
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingSala ? 'Editar Sala' : 'Nueva Sala'}
                      </DialogTitle>
                      <DialogDescription>
                        {editingSala
                          ? 'Modifica los datos de la sala'
                          : 'Crea una nueva sala física'}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSalaSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="sala-nombre">Nombre *</Label>
                        <Input
                          id="sala-nombre"
                          value={salaForm.nombre}
                          onChange={(e) => setSalaForm({ ...salaForm, nombre: e.target.value })}
                          placeholder="Ej: Sala Principal"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="sala-capacidad">Capacidad simultánea *</Label>
                        <Input
                          id="sala-capacidad"
                          type="number"
                          min="1"
                          value={salaForm.capacidad_simultanea}
                          onChange={(e) => setSalaForm({ ...salaForm, capacidad_simultanea: e.target.value })}
                          placeholder="3"
                          required
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setSalaDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit">
                          {editingSala ? 'Actualizar' : 'Crear'} Sala
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar salas..."
                  value={searchSala}
                  onChange={(e) => {
                    setSearchSala(e.target.value);
                    setCurrentPageSalas(1);
                  }}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="hidden md:grid grid-cols-12 gap-4 text-xs uppercase text-gray-500">
                  <div className="col-span-4">Nombre</div>
                  <div className="col-span-2">Capacidad</div>
                  <div className="col-span-4">Categorías asociadas</div>
                  <div className="col-span-2 text-right">Acciones</div>
                </div>
                {paginatedSalas.map((sala) => (
                  <div
                    key={sala.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 border rounded-lg"
                  >
                    <div className="md:col-span-4">
                      <p className="font-semibold">{sala.nombre}</p>
                    </div>
                    <div className="md:col-span-2 text-sm">
                      {sala.capacidad_simultanea} puestos
                    </div>
                    <div className="md:col-span-4 text-sm">
                      {sala.categorias.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {sala.categorias.map((cat) => (
                            <Badge key={cat.id} variant="outline">
                              {cat.nombre}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">Sin categorías</span>
                      )}
                    </div>
                    <div className="md:col-span-2 flex md:justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSala(sala)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSala(sala.id, sala.nombre)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                {paginatedSalas.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    {searchSala
                      ? 'No se encontraron salas que coincidan con la búsqueda.'
                      : 'No hay salas registradas. Crea la primera sala para comenzar.'}
                  </p>
                )}
              </div>

              {totalPagesSalas > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Mostrando {((currentPageSalas - 1) * itemsPerPage) + 1} - {Math.min(currentPageSalas * itemsPerPage, getFilteredSalas().length)} de {getFilteredSalas().length}
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageSalas(prev => Math.max(1, prev - 1))}
                      disabled={currentPageSalas === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <span className="text-sm">
                      Página {currentPageSalas} de {totalPagesSalas}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageSalas(prev => Math.min(totalPagesSalas, prev + 1))}
                      disabled={currentPageSalas === totalPagesSalas}
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de confirmación centralizado */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmMessage.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMessage.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de notificación centralizado (éxito/error) */}
      <AlertDialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={notificationMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}>
              {notificationMessage.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {notificationMessage.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setNotificationDialogOpen(false)}
              className={notificationMessage.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              Aceptar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
