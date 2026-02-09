'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  Trash2,
  User
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface HistorialRecord {
  id: number;
  modelo: string;
  objeto_id: number;
  accion: string;
  history_type: string;
  usuario: {
    id: number | null;
    nombre: string;
    email: string;
  };
  fecha: string;
  cambio_razon: string;
  datos: any;
}

interface HistorialResponse {
  count: number;
  next: boolean;
  previous: boolean;
  total_pages: number;
  current_page: number;
  results: HistorialRecord[];
}

export default function HistorialPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [historial, setHistorial] = useState<HistorialRecord[]>([]);
  const [filtroModelo, setFiltroModelo] = useState<string>('todos');
  const [filtroObjetoId, setFiltroObjetoId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Estados para notificaciones
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({
    title: '',
    description: '',
    type: 'success' as 'success' | 'error'
  });

  // Función para mostrar notificación
  const showNotification = (title: string, description: string, type: 'success' | 'error') => {
    setNotificationMessage({ title, description, type });
    setNotificationDialogOpen(true);
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'propietario' && user.role !== 'superusuario') {
      router.push('/dashboard');
      return;
    }

    cargarHistorial();
  }, [user, currentPage, filtroModelo, filtroObjetoId]);

  const cargarHistorial = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: '20',
      });

      if (filtroModelo !== 'todos') {
        params.append('modelo', filtroModelo);
      }

      if (filtroObjetoId) {
        params.append('objeto_id', filtroObjetoId);
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/turnos/historial/listar/?${params}`,
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error al cargar el historial');
      }

      const data: HistorialResponse = await response.json();
      setHistorial(data.results);
      setTotalPages(data.total_pages);
      setTotalRecords(data.count);
    } catch (error) {
      console.error('Error:', error);
      showNotification(
        'Error',
        'No se pudo cargar el historial',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const getAccionBadge = (historyType: string) => {
    switch (historyType) {
      case '+':
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Creado
          </Badge>
        );
      case '~':
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600">
            <RefreshCw className="h-3 w-3 mr-1" />
            Modificado
          </Badge>
        );
      case '-':
        return (
          <Badge className="bg-red-500 hover:bg-red-600">
            <Trash2 className="h-3 w-3 mr-1" />
            Eliminado
          </Badge>
        );
      default:
        return <Badge variant="outline">{historyType}</Badge>;
    }
  };

  const formatearFecha = (fecha: string) => {
    const date = new Date(fecha);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleRestaurar = async (modelo: string, historyId: number) => {
    if (!token) return;

    if (!confirm('¿Estás seguro de que deseas restaurar esta versión?')) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/turnos/historial/${modelo.toLowerCase()}/${historyId}/restaurar/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error al restaurar');
      }

      showNotification(
        'Éxito',
        'Versión restaurada correctamente',
        'success'
      );

      cargarHistorial();
    } catch (error) {
      console.error('Error:', error);
      showNotification(
        'Error',
        'No se pudo restaurar la versión',
        'error'
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Historial de Cambios
          </CardTitle>
          <CardDescription>
            Registro completo de todas las modificaciones realizadas en el
            sistema. Total de registros: {totalRecords}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Select
                value={filtroModelo}
                onValueChange={(value) => {
                  setFiltroModelo(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por modelo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los modelos</SelectItem>
                  <SelectItem value="turno">Turnos</SelectItem>
                  <SelectItem value="servicio">Servicios</SelectItem>
                  <SelectItem value="cliente">Clientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID de objeto..."
                  value={filtroObjetoId}
                  onChange={(e) => {
                    setFiltroObjetoId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8"
                />
              </div>
            </div>
            <Button onClick={cargarHistorial} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </div>

          {/* Tabla */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Razón del cambio</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500">
                        No se encontraron registros en el historial
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  historial.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-sm">
                        {formatearFecha(record.fecha)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.modelo}</Badge>
                      </TableCell>
                      <TableCell>#{record.objeto_id}</TableCell>
                      <TableCell>{getAccionBadge(record.history_type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="font-medium text-sm">
                              {record.usuario.nombre}
                            </p>
                            <p className="text-xs text-gray-500">
                              {record.usuario.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.cambio_razon ? (
                          <span className="text-sm">{record.cambio_razon}</span>
                        ) : (
                          <span className="text-sm text-gray-400 italic">
                            Sin descripción
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.modelo === 'Turno' && record.history_type !== '+' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleRestaurar(record.modelo, record.id)
                            }
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Restaurar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        {/* Diálogo de Notificación */}
        <AlertDialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{notificationMessage.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {notificationMessage.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setNotificationDialogOpen(false)}>
                Aceptar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
}
