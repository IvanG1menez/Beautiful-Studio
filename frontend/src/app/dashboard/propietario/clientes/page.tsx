'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAuthHeaders } from '@/lib/auth-headers';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, ArrowUpDown, CheckCircle, ChevronLeft, ChevronRight, Filter, Loader2, Pencil, Plus, Search, User, UserCheck, UserX, Users, Wallet, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Cliente {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  user_dni: string;
  is_active: boolean;
  fecha_nacimiento?: string;
  direccion?: string;
  preferencias?: string;
  fecha_primera_visita?: string;
  nombre_completo: string;
  edad?: number;
  tiempo_como_cliente?: number;
  saldo_billetera?: number;
  tiene_billetera?: boolean;
  created_at: string;
  updated_at: string;
}

interface DeactivationCheckItem {
  key: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  message: string;
  count?: number;
  amount?: number;
}

interface DeactivationCheckResult {
  ok: boolean;
  checks: DeactivationCheckItem[];
  blockers: DeactivationCheckItem[];
  warnings: { key: string; label: string; count?: number; message: string }[];
}

export default function ClientesAdminPage() {
  const router = useRouter();

  // Estados
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para filtros
  const [filterActivo, setFilterActivo] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'nombre' | 'fecha' | 'edad'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Estados para modales de confirmación y notificación
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState({ title: '', description: '' });
  const [confirmActionLabel, setConfirmActionLabel] = useState('Confirmar');
  const [confirmActionStyle, setConfirmActionStyle] = useState('bg-red-600 hover:bg-red-700');
  const [expandedClienteId, setExpandedClienteId] = useState<number | null>(null);

  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({
    title: '',
    description: '',
    type: 'success' as 'success' | 'error'
  });
  const [deactivationDialogOpen, setDeactivationDialogOpen] = useState(false);
  const [deactivationLoading, setDeactivationLoading] = useState(false);
  const [deactivationSubmitting, setDeactivationSubmitting] = useState(false);
  const [deactivationCheck, setDeactivationCheck] = useState<DeactivationCheckResult | null>(null);
  const [clienteToDeactivate, setClienteToDeactivate] = useState<Cliente | null>(null);

  // Cargar TODOS los clientes (sin paginación del backend)
  const fetchClientes = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      // Usar page_size=1000 para obtener todos los clientes de una vez
      const response = await fetch('/api/clientes/?page_size=1000', { headers });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Datos recibidos del backend:', data);
        const clientesData = data.results || data;
        console.log('👥 Total de clientes cargados:', clientesData.length);
        setClientes(Array.isArray(clientesData) ? clientesData : []);
      } else {
        showNotification(
          'Error al cargar clientes',
          'No se pudieron cargar los clientes',
          'error'
        );
      }
    } catch (error) {
      console.error('Error fetching clientes:', error);
      showNotification(
        'Error de conexión',
        'No se pudo conectar con el servidor',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  // Debug: mostrar información en consola
  useEffect(() => {
    if (clientes.length > 0) {
      console.log('📊 Estado actual:');
      console.log('  - Total clientes en state:', clientes.length);
      console.log('  - Clientes filtrados:', getFilteredAndSortedClientes().length);
      console.log('  - Página actual:', currentPage);
      console.log('  - Total páginas:', getTotalPages());
    }
  }, [clientes.length, searchQuery, filterActivo, sortBy, sortOrder, currentPage]);

  // Funciones de filtrado y ordenamiento
  const getFilteredAndSortedClientes = () => {
    // Primero filtrar
    const filtered = clientes.filter(cliente => {
      const matchesSearch =
        cliente.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cliente.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cliente.phone && cliente.phone.includes(searchQuery)) ||
        (cliente.user_dni && cliente.user_dni.includes(searchQuery)) ||
        (cliente.username && cliente.username.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesActivo = filterActivo === 'todos' ||
        (filterActivo === 'activo' && cliente.is_active) ||
        (filterActivo === 'inactivo' && !cliente.is_active);

      return matchesSearch && matchesActivo;
    });

    // Luego ordenar
    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'nombre') {
        comparison = a.nombre_completo.localeCompare(b.nombre_completo);
      } else if (sortBy === 'fecha') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'edad') {
        const edadA = a.edad || 0;
        const edadB = b.edad || 0;
        comparison = edadA - edadB;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  // Limpiar filtros
  const clearFilters = () => {
    setSearchQuery('');
    setFilterActivo('todos');
    setSortBy('fecha');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  // Verificar si hay filtros activos
  const hasActiveFilters = () => {
    return searchQuery !== '' || filterActivo !== 'todos' ||
      sortBy !== 'fecha' || sortOrder !== 'desc';
  };

  // Paginación
  const getPaginatedClientes = () => {
    const filtered = getFilteredAndSortedClientes();
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const getTotalPages = () => {
    return Math.ceil(getFilteredAndSortedClientes().length / itemsPerPage);
  };

  // Función para mostrar confirmación modal
  const showConfirmDialog = (
    title: string,
    description: string,
    action: () => void,
    actionLabel = 'Confirmar',
    actionStyle = 'bg-red-600 hover:bg-red-700'
  ) => {
    setConfirmMessage({ title, description });
    setConfirmAction(() => action);
    setConfirmActionLabel(actionLabel);
    setConfirmActionStyle(actionStyle);
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

  const formatCheckValue = (check: DeactivationCheckItem) => {
    if (typeof check.amount === 'number') return formatCurrency(check.amount);
    if (typeof check.count === 'number') return check.count.toString();
    return check.ok ? 'OK' : 'Revisar';
  };

  const openClienteDeactivationCheck = async (cliente: Cliente) => {
    setClienteToDeactivate(cliente);
    setDeactivationCheck(null);
    setDeactivationDialogOpen(true);
    setDeactivationLoading(true);

    try {
      const response = await fetch(`/api/clientes/${cliente.id}/deactivation-check/`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        setDeactivationCheck(await response.json());
      } else {
        const errorData = await response.json().catch(() => ({}));
        showNotification('Error al verificar cliente', errorData.error || errorData.detail || 'No se pudo verificar si el cliente puede desactivarse.', 'error');
        setDeactivationDialogOpen(false);
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor', 'error');
      setDeactivationDialogOpen(false);
    } finally {
      setDeactivationLoading(false);
    }
  };

  const confirmClienteDeactivation = async () => {
    if (!clienteToDeactivate || !deactivationCheck?.ok) return;

    setDeactivationSubmitting(true);
    try {
      const response = await fetch(`/api/clientes/${clienteToDeactivate.id}/toggle_active/`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        showNotification(
          'Cliente desactivado',
          `El cliente "${clienteToDeactivate.nombre_completo}" fue desactivado correctamente.`,
          'success'
        );
        setDeactivationDialogOpen(false);
        setClienteToDeactivate(null);
        fetchClientes();
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.detail || 'No se pudo desactivar el cliente';
        if (errorData.check) setDeactivationCheck(errorData.check);
        showNotification('No se puede desactivar', errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor', 'error');
    } finally {
      setDeactivationSubmitting(false);
    }
  };

  // Activar/desactivar cliente sin eliminar su historial asociado.
  const handleToggleActiveCliente = async (
    clienteId: number,
    nombreCliente: string,
    isActive: boolean
  ) => {
    const nextAction = isActive ? 'desactivar' : 'reactivar';

    if (isActive) {
      const cliente = clientes.find(item => item.id === clienteId);
      if (cliente) {
        openClienteDeactivationCheck(cliente);
        return;
      }
    }

    showConfirmDialog(
      isActive ? '¿Desactivar cliente?' : '¿Reactivar cliente?',
      isActive
        ? `El cliente "${nombreCliente}" quedará inactivo y no podrá operar, pero se conservará su historial.`
        : `El cliente "${nombreCliente}" volverá a estar activo y disponible para operar.`,
      async () => {
        try {
          const response = await fetch(`/api/clientes/${clienteId}/toggle_active/`, {
            method: 'POST',
            headers: getAuthHeaders()
          });

          if (response.ok) {
            showNotification(
              isActive ? 'Cliente desactivado' : 'Cliente reactivado',
              `El cliente "${nombreCliente}" fue ${isActive ? 'desactivado' : 'reactivado'} correctamente.`,
              'success'
            );
            fetchClientes();
          } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage =
              errorData.detail || errorData.error || `No se pudo ${nextAction} el cliente`;
            showNotification(`Error al ${nextAction}`, errorMessage, 'error');
          }
        } catch (error) {
          console.error('Error:', error);
          showNotification(
            'Error de conexión',
            'No se pudo conectar con el servidor',
            'error'
          );
        }
      },
      isActive ? 'Desactivar' : 'Reactivar',
      isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
    );
  };

  // Calcular edad legible
  const formatEdad = (edad?: number) => {
    if (!edad) return '-';
    return `${edad} años`;
  };

  // Formatear tiempo como cliente
  const formatTiempoCliente = (dias?: number) => {
    if (!dias) return '-';
    if (dias < 30) return `${dias} días`;
    if (dias < 365) return `${Math.floor(dias / 30)} meses`;
    return `${Math.floor(dias / 365)} años`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Cargando clientes...</span>
      </div>
    );
  }

  const paginatedClientes = getPaginatedClientes();
  const totalPages = getTotalPages();

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-8 h-8" />
          Gestión de Clientes
        </h1>
        <p className="text-gray-600 mt-1">
          Administra la información de tus clientes
        </p>
      </div>

      {/* Card principal */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Clientes Registrados</CardTitle>
              <CardDescription>
                Total de {clientes.length} cliente{clientes.length !== 1 ? 's' : ''}
                {hasActiveFilters() && ` • Mostrando ${getFilteredAndSortedClientes().length} filtrado${getFilteredAndSortedClientes().length !== 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <Button onClick={() => router.push('/dashboard/propietario/clientes/nuevo')}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </Button>
          </div>

          {/* Barra de búsqueda y botón de filtros */}
          <div className="flex gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por nombre, email, teléfono, DNI..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {hasActiveFilters() && (
                <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-xs">
                  {[searchQuery !== '', filterActivo !== 'todos'].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Panel de filtros */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Filtros Avanzados</h3>
                {hasActiveFilters() && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-1" />
                    Limpiar filtros
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Filtro por estado activo */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select value={filterActivo} onValueChange={(value) => {
                    setFilterActivo(value);
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="activo">Activos</SelectItem>
                      <SelectItem value="inactivo">Inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Ordenar por */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ordenar por</label>
                  <Select value={sortBy} onValueChange={(value: 'nombre' | 'fecha' | 'edad') => {
                    setSortBy(value);
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nombre">Nombre</SelectItem>
                      <SelectItem value="fecha">Fecha de registro</SelectItem>
                      <SelectItem value="edad">Edad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Orden */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Orden</label>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
                    <ArrowUpDown className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Lista de clientes */}
          <div className="space-y-4">
            {paginatedClientes.map((cliente) => (
              <div
                key={cliente.id}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div
                  className="flex items-start justify-between cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setExpandedClienteId(
                      expandedClienteId === cliente.id ? null : cliente.id
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setExpandedClienteId(
                        expandedClienteId === cliente.id ? null : cliente.id
                      );
                    }
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <User className="w-4 h-4 text-gray-500" />
                      <h3 className="font-semibold text-lg">{cliente.nombre_completo}</h3>
                      <Badge variant={cliente.is_active ? "default" : "secondary"}>
                        {cliente.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                      {cliente.saldo_billetera !== undefined && cliente.saldo_billetera > 0 && (
                        <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                          <Wallet className="w-3 h-3 mr-1" />
                          {formatCurrency(cliente.saldo_billetera)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{cliente.email}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/propietario/clientes/${cliente.id}/editar`);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActiveCliente(
                          cliente.id,
                          cliente.nombre_completo,
                          cliente.is_active
                        );
                      }}
                      title={cliente.is_active ? 'Desactivar cliente' : 'Reactivar cliente'}
                    >
                      {cliente.is_active ? (
                        <UserX className="w-4 h-4 text-red-500" />
                      ) : (
                        <UserCheck className="w-4 h-4 text-green-600" />
                      )}
                    </Button>
                  </div>
                </div>

                {expandedClienteId === cliente.id && (
                  <div className="mt-4 border-t pt-4 text-sm text-gray-600">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                      {cliente.phone && (
                        <div>
                          <span className="font-medium">Teléfono:</span> {cliente.phone}
                        </div>
                      )}
                      {cliente.user_dni && (
                        <div>
                          <span className="font-medium">DNI:</span> {cliente.user_dni}
                        </div>
                      )}
                      {cliente.edad && (
                        <div>
                          <span className="font-medium">Edad:</span> {formatEdad(cliente.edad)}
                        </div>
                      )}
                      {cliente.tiempo_como_cliente && (
                        <div>
                          <span className="font-medium">Cliente desde:</span> {formatTiempoCliente(cliente.tiempo_como_cliente)}
                        </div>
                      )}
                    </div>
                    {/* Información de Billetera */}
                    {cliente.saldo_billetera !== undefined && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-900">Saldo en Billetera:</span>
                          <span className="text-lg font-bold text-green-700">
                            {formatCurrency(cliente.saldo_billetera)}
                          </span>
                        </div>
                        {cliente.saldo_billetera > 0 && (
                          <p className="text-xs text-green-600 mt-1">
                            💡 El cliente tiene crédito disponible para usar en futuras reservas
                          </p>
                        )}
                      </div>
                    )}
                    {cliente.preferencias && (
                      <div className="mt-2 text-sm text-gray-500">
                        <span className="font-medium">Notas:</span> {cliente.preferencias}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {paginatedClientes.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                {searchQuery
                  ? 'No se encontraron clientes que coincidan con la búsqueda.'
                  : 'No hay clientes registrados. Crea el primer cliente para comenzar.'}
              </p>
            )}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, getFilteredAndSortedClientes().length)} de {getFilteredAndSortedClientes().length}
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <span className="text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de confirmación */}
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
            <AlertDialogAction onClick={handleConfirmAction} className={confirmActionStyle}>
              {confirmActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de verificación de baja */}
      <AlertDialog open={deactivationDialogOpen} onOpenChange={setDeactivationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verificar baja de cliente</AlertDialogTitle>
            <AlertDialogDescription>
              {clienteToDeactivate
                ? `Revisando si "${clienteToDeactivate.nombre_completo}" puede ser desactivado sin dejar procesos abiertos.`
                : 'Revisando dependencias del cliente.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deactivationLoading ? (
            <div className="flex items-center gap-3 rounded-lg border bg-gray-50 p-4 text-sm text-gray-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando datos y verificando reglas de baja...
            </div>
          ) : deactivationCheck ? (
            <div className="space-y-3">
              {deactivationCheck.checks.map((check) => (
                <div
                  key={check.key}
                  className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${check.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                >
                  <div className="flex items-start gap-2">
                    {check.ok ? (
                      <CheckCircle className="mt-0.5 h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{check.label}</p>
                      {!check.ok && <p className="text-xs text-gray-600">{check.message}</p>}
                    </div>
                  </div>
                  <Badge variant={check.ok ? 'outline' : 'destructive'}>{formatCheckValue(check)}</Badge>
                </div>
              ))}
              <div className={`rounded-lg border p-3 text-sm ${deactivationCheck.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                {deactivationCheck.ok
                  ? 'Todo está OK. Podés confirmar la desactivación del cliente.'
                  : 'No se puede desactivar todavía. Resolvé los bloqueos indicados primero.'}
              </div>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivationSubmitting}>Cerrar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClienteDeactivation}
              disabled={deactivationLoading || deactivationSubmitting || !deactivationCheck?.ok}
              className="bg-red-600 hover:bg-red-700"
            >
              {deactivationSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desactivando...
                </>
              ) : (
                'Confirmar desactivación'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de notificación */}
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
