'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Empleado {
  id: number;
  user: string;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  user_dni?: string;
  especialidades: 'corte' | 'color' | 'tratamientos' | 'unas' | 'maquillaje' | 'general';
  especialidad_display: string;
  fecha_ingreso: string;
  horario_entrada: string;
  horario_salida: string;
  dias_trabajo: string;
  comision_porcentaje: string;
  is_disponible: boolean;
  biografia?: string;
  created_at: string;
  updated_at: string;
}

export default function ProfesionalesAdminPage() {
  const router = useRouter();
  
  // Estados para empleados
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoDialogOpen, setEmpleadoDialogOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);
  const [empleadoForm, setEmpleadoForm] = useState({
    username: '',
    email: '',
    dni: '',
    password: '',
    first_name: '',
    last_name: '',
    especialidades: '',
    fecha_ingreso: '',
    horario_entrada: '',
    horario_salida: '',
    dias_trabajo: '',
    comision_porcentaje: '',
    is_disponible: true,
    biografia: ''
  });

  // Estados generales
  const [loading, setLoading] = useState(true);

  // Estados para búsqueda y filtros
  const [searchEmpleado, setSearchEmpleado] = useState('');
  const [filterEspecialidad, setFilterEspecialidad] = useState<string>('todos');
  const [filterDisponibilidad, setFilterDisponibilidad] = useState<string>('todos');
  const [sortEmpleadoBy, setSortEmpleadoBy] = useState<'user' | 'especialidad' | 'fecha_ingreso'>('user');
  const [sortEmpleadoOrder, setSortEmpleadoOrder] = useState<'asc' | 'desc'>('asc');

  // Estados para paginación
  const [currentPageEmpleados, setCurrentPageEmpleados] = useState(1);
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
      const response = await fetch('http://localhost:8000/api/empleados/', { headers });

      if (response.ok) {
        const empleadosData = await response.json();
        setEmpleados(empleadosData.results || empleadosData);
      } else {
        const errorData = await response.json();
        console.error('Error fetching empleados:', errorData);
        showNotification('Error al cargar empleados', 'No se pudieron cargar los empleados. Por favor, intenta nuevamente.', 'error');
      }
    } catch (error) {
      console.error('Error fetching empleados:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor. Verifica tu conexión a internet.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Funciones de filtrado y ordenamiento
  const getFilteredAndSortedEmpleados = () => {
    let filtered = empleados.filter(empleado => {
      const matchesSearch = empleado.user.toLowerCase().includes(searchEmpleado.toLowerCase()) ||
        empleado.especialidad_display.toLowerCase().includes(searchEmpleado.toLowerCase()) ||
        (empleado.user_dni && empleado.user_dni.toLowerCase().includes(searchEmpleado.toLowerCase())) ||
        (empleado.biografia && empleado.biografia.toLowerCase().includes(searchEmpleado.toLowerCase()));

      const matchesEspecialidad = filterEspecialidad === 'todos' || empleado.especialidades === filterEspecialidad;
      const matchesDisponibilidad = filterDisponibilidad === 'todos' ||
        (filterDisponibilidad === 'disponible' && empleado.is_disponible) ||
        (filterDisponibilidad === 'no_disponible' && !empleado.is_disponible);

      return matchesSearch && matchesEspecialidad && matchesDisponibilidad;
    });

    // Ordenamiento
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortEmpleadoBy === 'user') {
        comparison = a.user.localeCompare(b.user);
      } else if (sortEmpleadoBy === 'especialidad') {
        comparison = a.especialidad_display.localeCompare(b.especialidad_display);
      } else if (sortEmpleadoBy === 'fecha_ingreso') {
        comparison = new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime();
      }
      return sortEmpleadoOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  // Funciones de paginación
  const getPaginatedEmpleados = () => {
    const filtered = getFilteredAndSortedEmpleados();
    const startIndex = (currentPageEmpleados - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const getTotalPagesEmpleados = () => {
    return Math.ceil(getFilteredAndSortedEmpleados().length / itemsPerPage);
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

  // Funciones para empleados
  const handleEmpleadoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingEmpleado
      ? `http://localhost:8000/api/empleados/${editingEmpleado.id}/`
      : 'http://localhost:8000/api/empleados/';

    const method = editingEmpleado ? 'PUT' : 'POST';

    // Preparar datos según si es creación o edición
    let dataToSend: any = {
      especialidades: empleadoForm.especialidades,
      fecha_ingreso: empleadoForm.fecha_ingreso,
      horario_entrada: empleadoForm.horario_entrada,
      horario_salida: empleadoForm.horario_salida,
      dias_trabajo: empleadoForm.dias_trabajo,
      comision_porcentaje: parseFloat(empleadoForm.comision_porcentaje),
      is_disponible: empleadoForm.is_disponible,
      biografia: empleadoForm.biografia
    };

    // Solo incluir datos de usuario en creación (POST)
    if (!editingEmpleado) {
      dataToSend = {
        ...dataToSend,
        username: empleadoForm.username,
        email: empleadoForm.email,
        dni: empleadoForm.dni,
        first_name: empleadoForm.first_name,
        last_name: empleadoForm.last_name,
        password: empleadoForm.password || 'empleado123' // Contraseña por defecto
      };
    }

    try {
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        showNotification(
          editingEmpleado ? 'Profesional actualizado' : 'Profesional creado',
          editingEmpleado
            ? 'Los cambios se han guardado correctamente.'
            : 'El nuevo profesional ha sido creado exitosamente.',
          'success'
        );
        setEmpleadoDialogOpen(false);
        setEditingEmpleado(null);
        setEmpleadoForm({
          username: '',
          email: '',
          dni: '',
          password: '',
          first_name: '',
          last_name: '',
          especialidades: '',
          fecha_ingreso: '',
          horario_entrada: '',
          horario_salida: '',
          dias_trabajo: '',
          comision_porcentaje: '',
          is_disponible: true,
          biografia: ''
        });
        fetchData();
      } else {
        const errorData = await response.json();
        console.error('Error del backend:', errorData);
        const errorMessage = errorData.detail
          || errorData.username?.[0]
          || errorData.email?.[0]
          || errorData.first_name?.[0]
          || errorData.last_name?.[0]
          || errorData.especialidades?.[0]
          || errorData.non_field_errors?.[0]
          || JSON.stringify(errorData);
        showNotification('Error al guardar profesional', errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor. Verifica tu conexión a internet.', 'error');
    }
  };

  const handleEditEmpleado = (empleado: Empleado) => {
    setEditingEmpleado(empleado);
    setEmpleadoForm({
      username: empleado.username || '',
      email: empleado.email || '',
      dni: empleado.user_dni || '',
      password: '',
      first_name: empleado.first_name || '',
      last_name: empleado.last_name || '',
      especialidades: empleado.especialidades || '',
      fecha_ingreso: empleado.fecha_ingreso || '',
      horario_entrada: empleado.horario_entrada || '',
      horario_salida: empleado.horario_salida || '',
      dias_trabajo: empleado.dias_trabajo || '',
      comision_porcentaje: empleado.comision_porcentaje || '',
      is_disponible: empleado.is_disponible ?? true,
      biografia: empleado.biografia || ''
    });
    setEmpleadoDialogOpen(true);
  };

  const handleDeleteEmpleado = async (empleadoId: number, nombreEmpleado: string) => {
    showConfirmDialog(
      '¿Eliminar profesional?',
      `Esta acción no se puede deshacer. Se eliminará al profesional "${nombreEmpleado}" y toda su información.`,
      async () => {
        try {
          const response = await fetch(`http://localhost:8000/api/empleados/${empleadoId}/`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });

          if (response.ok || response.status === 204) {
            showNotification(
              'Profesional eliminado',
              `El profesional "${nombreEmpleado}" ha sido eliminado correctamente.`,
              'success'
            );
            fetchData();
          } else {
            const errorData = await response.json();
            console.error('Error al eliminar:', errorData);
            const errorMessage = errorData.detail || errorData.error || 'No se pudo eliminar el profesional';
            showNotification('Error al eliminar', errorMessage, 'error');
          }
        } catch (error) {
          console.error('Error:', error);
          showNotification('Error de conexión', 'No se pudo conectar con el servidor. Verifica tu conexión a internet.', 'error');
        }
      }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Cargando gestión de profesionales...</span>
      </div>
    );
  }

  const paginatedEmpleados = getPaginatedEmpleados();
  const totalPagesEmpleados = getTotalPagesEmpleados();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Profesionales</h1>
        <p className="text-gray-600 mt-1">
          Administra los profesionales de tu salón de belleza
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Profesionales</CardTitle>
              <CardDescription>
                Gestiona todos los profesionales que trabajan en tu salón
              </CardDescription>
            </div>
            <Button onClick={() => router.push('/dashboard-admin/profesionales/nuevo')}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Profesional
            </Button>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingEmpleado ? 'Editar Profesional' : 'Nuevo Profesional'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingEmpleado ? 'Modifica los datos del profesional' : 'Agrega un nuevo profesional a tu equipo'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleEmpleadoSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="empleado-username">Usuario *</Label>
                      <Input
                        id="empleado-username"
                        value={empleadoForm.username}
                        onChange={(e) => setEmpleadoForm({ ...empleadoForm, username: e.target.value })}
                        placeholder="usuario123"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="empleado-email">Email *</Label>
                      <Input
                        id="empleado-email"
                        type="email"
                        value={empleadoForm.email}
                        onChange={(e) => setEmpleadoForm({ ...empleadoForm, email: e.target.value })}
                        placeholder="correo@ejemplo.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="empleado-dni">DNI</Label>
                      <Input
                        id="empleado-dni"
                        value={empleadoForm.dni}
                        onChange={(e) => setEmpleadoForm({ ...empleadoForm, dni: e.target.value })}
                        placeholder="12345678"
                      />
                    </div>
                    <div>
                      <Label htmlFor="empleado-first-name">Nombre *</Label>
                      <Input
                        id="empleado-first-name"
                        value={empleadoForm.first_name}
                        onChange={(e) => setEmpleadoForm({ ...empleadoForm, first_name: e.target.value })}
                        placeholder="María"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="empleado-last-name">Apellido *</Label>
                      <Input
                        id="empleado-last-name"
                        value={empleadoForm.last_name}
                        onChange={(e) => setEmpleadoForm({ ...empleadoForm, last_name: e.target.value })}
                        placeholder="González"
                        required
                      />
                    </div>
                  </div>

                  {/* Campo de contraseña solo visible al crear nuevo empleado */}
                  {!editingEmpleado && (
                    <div>
                      <Label htmlFor="empleado-password">Contraseña (opcional)</Label>
                      <Input
                        id="empleado-password"
                        type="password"
                        value={empleadoForm.password}
                        onChange={(e) => setEmpleadoForm({ ...empleadoForm, password: e.target.value })}
                        placeholder="Dejar vacío para usar 'empleado123'"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Si no especificas una contraseña, se usará "empleado123" por defecto
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="empleado-especialidad">Especialidad *</Label>
                      <Select value={empleadoForm.especialidades} onValueChange={(value) => setEmpleadoForm({ ...empleadoForm, especialidades: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona especialidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="corte">Especialista en Corte</SelectItem>
                          <SelectItem value="color">Colorista</SelectItem>
                          <SelectItem value="tratamientos">Especialista en Tratamientos</SelectItem>
                          <SelectItem value="unas">Manicurista/Pedicurista</SelectItem>
                          <SelectItem value="maquillaje">Maquillador/a</SelectItem>
                          <SelectItem value="general">Generalista</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="empleado-fecha-ingreso">Fecha de ingreso *</Label>
                      <Input
                        id="empleado-fecha-ingreso"
                        type="date"
                        value={empleadoForm.fecha_ingreso}
                        onChange={(e) => setEmpleadoForm({ ...empleadoForm, fecha_ingreso: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="empleado-entrada">Hora entrada *</Label>
                      <Input
                        id="empleado-entrada"
                        type="time"
                        value={empleadoForm.horario_entrada}
                        onChange={(e) => setEmpleadoForm({ ...empleadoForm, horario_entrada: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="empleado-salida">Hora salida *</Label>
                      <Input
                        id="empleado-salida"
                        type="time"
                        value={empleadoForm.horario_salida}
                        onChange={(e) => setEmpleadoForm({ ...empleadoForm, horario_salida: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="empleado-comision">Comisión (%) *</Label>
                      <Input
                        id="empleado-comision"
                        type="number"
                        step="0.01"
                        value={empleadoForm.comision_porcentaje}
                        onChange={(e) => setEmpleadoForm({ ...empleadoForm, comision_porcentaje: e.target.value })}
                        placeholder="10.00"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="empleado-dias">Días de trabajo *</Label>
                    <Input
                      id="empleado-dias"
                      value={empleadoForm.dias_trabajo}
                      onChange={(e) => setEmpleadoForm({ ...empleadoForm, dias_trabajo: e.target.value })}
                      placeholder="L,M,M,J,V"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="empleado-biografia">Biografía profesional</Label>
                    <Textarea
                      id="empleado-biografia"
                      value={empleadoForm.biografia}
                      onChange={(e) => setEmpleadoForm({ ...empleadoForm, biografia: e.target.value })}
                      placeholder="Breve descripción del profesional..."
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="empleado-disponible"
                      checked={empleadoForm.is_disponible || false}
                      onChange={(e) => setEmpleadoForm({ ...empleadoForm, is_disponible: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="empleado-disponible">Disponible para turnos</Label>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setEmpleadoDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingEmpleado ? 'Actualizar' : 'Crear'} Profesional
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Barra de búsqueda y filtros para empleados */}
          <div className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por nombre, DNI, especialidad o biografía..."
                value={searchEmpleado}
                onChange={(e) => {
                  setSearchEmpleado(e.target.value);
                  setCurrentPageEmpleados(1);
                }}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-600">Filtros:</span>

              <Select value={filterEspecialidad} onValueChange={(value) => {
                setFilterEspecialidad(value);
                setCurrentPageEmpleados(1);
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Especialidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas las especialidades</SelectItem>
                  <SelectItem value="corte">Especialista en Corte</SelectItem>
                  <SelectItem value="color">Colorista</SelectItem>
                  <SelectItem value="tratamientos">Especialista en Tratamientos</SelectItem>
                  <SelectItem value="unas">Manicurista/Pedicurista</SelectItem>
                  <SelectItem value="maquillaje">Maquillador/a</SelectItem>
                  <SelectItem value="general">Generalista</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterDisponibilidad} onValueChange={(value) => {
                setFilterDisponibilidad(value);
                setCurrentPageEmpleados(1);
              }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Disponibilidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="disponible">Disponibles</SelectItem>
                  <SelectItem value="no_disponible">No disponibles</SelectItem>
                </SelectContent>
              </Select>

              <span className="text-sm text-gray-600 ml-4">Ordenar por:</span>
              <Select value={sortEmpleadoBy} onValueChange={(value: any) => setSortEmpleadoBy(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Nombre</SelectItem>
                  <SelectItem value="especialidad">Especialidad</SelectItem>
                  <SelectItem value="fecha_ingreso">Fecha ingreso</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortEmpleadoOrder(sortEmpleadoOrder === 'asc' ? 'desc' : 'asc')}
              >
                <ArrowUpDown className="w-4 h-4 mr-2" />
                {sortEmpleadoOrder === 'asc' ? 'Ascendente' : 'Descendente'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paginatedEmpleados.map((empleado) => (
              <div key={empleado.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold">{empleado.user}</h3>
                    {empleado.user_dni && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        DNI: {empleado.user_dni}
                      </Badge>
                    )}
                    <Badge variant="outline">{empleado.especialidad_display}</Badge>
                    <Badge variant={empleado.is_disponible ? "default" : "secondary"}>
                      {empleado.is_disponible ? 'Disponible' : 'No disponible'}
                    </Badge>
                  </div>
                  {empleado.biografia && (
                    <p className="text-sm text-gray-600 mb-2">{empleado.biografia}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>📅 Ingreso: {new Date(empleado.fecha_ingreso).toLocaleDateString()}</span>
                    <span>⏰ {empleado.horario_entrada} - {empleado.horario_salida}</span>
                    <span>💼 {empleado.dias_trabajo}</span>
                    <span>💰 Comisión: {empleado.comision_porcentaje}%</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditEmpleado(empleado)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteEmpleado(empleado.id, empleado.user)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
            {paginatedEmpleados.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                {searchEmpleado || filterEspecialidad !== 'todos' || filterDisponibilidad !== 'todos'
                  ? 'No se encontraron profesionales que coincidan con los filtros.'
                  : 'No hay profesionales registrados. Crea el primer profesional para comenzar.'}
              </p>
            )}
          </div>

          {/* Paginación Empleados */}
          {totalPagesEmpleados > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Mostrando {((currentPageEmpleados - 1) * itemsPerPage) + 1} - {Math.min(currentPageEmpleados * itemsPerPage, getFilteredAndSortedEmpleados().length)} de {getFilteredAndSortedEmpleados().length}
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPageEmpleados(prev => Math.max(1, prev - 1))}
                  disabled={currentPageEmpleados === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <span className="text-sm">
                  Página {currentPageEmpleados} de {totalPagesEmpleados}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPageEmpleados(prev => Math.min(totalPagesEmpleados, prev + 1))}
                  disabled={currentPageEmpleados === totalPagesEmpleados}
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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