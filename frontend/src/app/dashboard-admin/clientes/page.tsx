'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, Star, Trash2, User, Users } from 'lucide-react';
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
  is_vip: boolean;
  nombre_completo: string;
  edad?: number;
  tiempo_como_cliente?: number;
  created_at: string;
  updated_at: string;
}

export default function ClientesAdminPage() {
  const router = useRouter();

  // Estados
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Estados para modales de confirmación y notificación
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState({ title: '', description: '' });

  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({
    title: '',
    description: '',
    type: 'success' as 'success' | 'error'
  });

  // Función para obtener token y headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Token ${token}` : ''
    };
  };

  // Cargar clientes
  const fetchClientes = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await fetch('http://localhost:8000/api/clientes/', { headers });

      if (response.ok) {
        const data = await response.json();
        setClientes(data.results || data);
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

  // Funciones de filtrado
  const getFilteredClientes = () => {
    return clientes.filter(cliente =>
      cliente.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cliente.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cliente.phone && cliente.phone.includes(searchQuery)) ||
      (cliente.user_dni && cliente.user_dni.includes(searchQuery)) ||
      (cliente.username && cliente.username.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  // Paginación
  const getPaginatedClientes = () => {
    const filtered = getFilteredClientes();
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const getTotalPages = () => {
    return Math.ceil(getFilteredClientes().length / itemsPerPage);
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

  // Eliminar cliente
  const handleDeleteCliente = async (clienteId: number, nombreCliente: string) => {
    showConfirmDialog(
      '¿Eliminar cliente?',
      `Esta acción no se puede deshacer. Se eliminará el cliente "${nombreCliente}" y su usuario asociado.`,
      async () => {
        try {
          const response = await fetch(`http://localhost:8000/api/clientes/${clienteId}/`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });

          if (response.ok || response.status === 204) {
            showNotification(
              'Cliente eliminado',
              `El cliente "${nombreCliente}" ha sido eliminado correctamente.`,
              'success'
            );
            fetchClientes();
          } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || errorData.error || 'No se pudo eliminar el cliente';
            showNotification('Error al eliminar', errorMessage, 'error');
          }
        } catch (error) {
          console.error('Error:', error);
          showNotification(
            'Error de conexión',
            'No se pudo conectar con el servidor',
            'error'
          );
        }
      }
    );
  };

  // Toggle VIP
  const handleToggleVIP = async (clienteId: number, nombreCliente: string, currentVipStatus: boolean) => {
    try {
      const response = await fetch(`http://localhost:8000/api/clientes/${clienteId}/toggle_vip/`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        showNotification(
          'Estado VIP actualizado',
          `${nombreCliente} ${!currentVipStatus ? 'ahora es cliente VIP' : 'ya no es cliente VIP'}`,
          'success'
        );
        fetchClientes();
      } else {
        showNotification('Error', 'No se pudo actualizar el estado VIP', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor', 'error');
    }
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
                Total de {getFilteredClientes().length} cliente{getFilteredClientes().length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button onClick={() => router.push('/dashboard-admin/clientes/nuevo')}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </Button>
          </div>

          {/* Barra de búsqueda */}
          <div className="relative mt-4">
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
        </CardHeader>

        <CardContent>
          {/* Lista de clientes */}
          <div className="space-y-4">
            {paginatedClientes.map((cliente) => (
              <div
                key={cliente.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  {/* Nombre y badges */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <User className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-lg">{cliente.nombre_completo}</h3>
                    {cliente.is_vip && (
                      <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                        <Star className="w-3 h-3 mr-1" />
                        VIP
                      </Badge>
                    )}
                    <Badge variant={cliente.is_active ? "default" : "secondary"}>
                      {cliente.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>

                  {/* Información de contacto */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Email:</span> {cliente.email}
                    </div>
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
                  </div>

                  {/* Información adicional */}
                  {(cliente.tiempo_como_cliente || cliente.preferencias) && (
                    <div className="mt-2 text-sm text-gray-500 space-y-1">
                      {cliente.tiempo_como_cliente && (
                        <div>
                          <span className="font-medium">Cliente desde:</span> {formatTiempoCliente(cliente.tiempo_como_cliente)}
                        </div>
                      )}
                      {cliente.preferencias && (
                        <div>
                          <span className="font-medium">Notas:</span> {cliente.preferencias.substring(0, 100)}{cliente.preferencias.length > 100 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex flex-col sm:flex-row gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleVIP(cliente.id, cliente.nombre_completo, cliente.is_vip)}
                    title={cliente.is_vip ? 'Quitar VIP' : 'Marcar como VIP'}
                  >
                    <Star className={`w-4 h-4 ${cliente.is_vip ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard-admin/clientes/${cliente.id}/editar`)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteCliente(cliente.id, cliente.nombre_completo)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
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
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, getFilteredClientes().length)} de {getFilteredClientes().length}
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
            <AlertDialogAction onClick={handleConfirmAction} className="bg-red-600 hover:bg-red-700">
              Eliminar
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
