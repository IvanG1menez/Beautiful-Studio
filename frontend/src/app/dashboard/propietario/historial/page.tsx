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
import apiClient from '@/services/api';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Mail,
  Pencil,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface HistoryUser {
  id: number | null;
  nombre: string;
  email: string;
}

interface HistorialRecord {
  id: number;
  modelo: string;
  objeto_id: number;
  accion: string;
  history_type: string;
  usuario: HistoryUser;
  fecha: string;
  cambio_razon: string;
  datos: Record<string, unknown>;
}

interface FidelizacionRecord {
  id: number;
  fecha: string;
  cliente: {
    id: number | null;
    nombre: string;
    email: string;
  };
  titulo: string;
  mensaje: string;
  tipo_email: string | null;
  servicio: {
    id: number | null;
    nombre: string;
    categoria: string | null;
  };
  profesional: {
    id: number | null;
    nombre: string;
  };
  fecha_ultimo_turno: string | null;
  fecha_sugerida: string | null;
  dias_programados: number | null;
  dias_inactividad: number | null;
  leida: boolean;
}

interface ReacomodamientoRecord {
  id: number;
  fecha: string;
  estado_final: string;
  expira: string | null;
  monto_descuento: string;
  turno_cancelado: {
    id: number | null;
    fecha_hora: string | null;
    estado: string | null;
  };
  turno_ofrecido: {
    id: number | null;
    fecha_hora: string | null;
    estado: string | null;
  };
  cliente_notificado: {
    id: number | null;
    nombre: string;
    email: string | null;
  };
  servicio: {
    id: number | null;
    nombre: string;
  };
  profesional: {
    id: number | null;
    nombre: string;
  };
}

interface HistorialResponse {
  count: number;
  seccion: string;
  resumen: {
    cambios_modelos: number;
    fidelizacion: number;
    reacomodamiento: number;
    total: number;
  };
  modelos: {
    count: number;
    next: boolean;
    previous: boolean;
    total_pages: number;
    current_page: number;
    results: HistorialRecord[];
  };
  automatizaciones: {
    fidelizacion: {
      count: number;
      dias_disponibles: number[];
      filtro_dias: number | null;
      results: FidelizacionRecord[];
    };
    reacomodamiento: {
      count: number;
      results: ReacomodamientoRecord[];
    };
  };
}

const INITIAL_RESPONSE: HistorialResponse = {
  count: 0,
  seccion: 'todas',
  resumen: {
    cambios_modelos: 0,
    fidelizacion: 0,
    reacomodamiento: 0,
    total: 0,
  },
  modelos: {
    count: 0,
    next: false,
    previous: false,
    total_pages: 1,
    current_page: 1,
    results: [],
  },
  automatizaciones: {
    fidelizacion: {
      count: 0,
      dias_disponibles: [],
      filtro_dias: null,
      results: [],
    },
    reacomodamiento: {
      count: 0,
      results: [],
    },
  },
};

export default function HistorialPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [historial, setHistorial] = useState<HistorialResponse>(INITIAL_RESPONSE);
  const [filtroSeccion, setFiltroSeccion] = useState('todas');
  const [filtroModelo, setFiltroModelo] = useState('todos');
  const [filtroObjetoId, setFiltroObjetoId] = useState('');
  const [filtroDiasFidelizacion, setFiltroDiasFidelizacion] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({
    title: '',
    description: '',
  });

  const modelos = historial.modelos.results;
  const fidelizacion = historial.automatizaciones.fidelizacion.results;
  const reacomodamiento = historial.automatizaciones.reacomodamiento.results;
  const diasDisponibles = historial.automatizaciones.fidelizacion.dias_disponibles;

  const shouldShowModelos = filtroSeccion === 'todas' || filtroSeccion === 'modelos';
  const shouldShowFidelizacion = filtroSeccion === 'todas' || filtroSeccion === 'fidelizacion';
  const shouldShowReacomodamiento =
    filtroSeccion === 'todas' || filtroSeccion === 'reacomodamiento';

  const showNotification = (title: string, description: string) => {
    setNotificationMessage({ title, description });
    setNotificationDialogOpen(true);
  };

  const getErrorMessage = (error: unknown) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'data' in error.response
    ) {
      const responseData = error.response.data;

      if (
        typeof responseData === 'object' &&
        responseData !== null &&
        'error' in responseData &&
        typeof responseData.error === 'string'
      ) {
        return responseData.error;
      }

      if (
        typeof responseData === 'object' &&
        responseData !== null &&
        'detail' in responseData &&
        typeof responseData.detail === 'string'
      ) {
        return responseData.detail;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'No se pudo cargar la auditoría';
  };

  const cargarHistorial = async () => {
    if (!user) {
      return;
    }

    setLoading(true);

    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        page_size: 20,
      };

      if (filtroSeccion !== 'todas') {
        params.seccion = filtroSeccion;
      }

      if (filtroModelo !== 'todos' && shouldShowModelos) {
        params.modelo = filtroModelo;
      }

      if (filtroObjetoId.trim()) {
        params.objeto_id = filtroObjetoId.trim();
      }

      if (filtroDiasFidelizacion !== 'todos' && shouldShowFidelizacion) {
        params.dias_fidelizacion = filtroDiasFidelizacion;
      }

      const response = await apiClient.get<HistorialResponse>('/turnos/historial/listar/', {
        params,
      });

      setHistorial(response.data);
    } catch (error) {
      console.error('Error cargando historial:', error);
      showNotification('Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'propietario' && user.role !== 'superusuario') {
      router.push('/dashboard');
      return;
    }

    void cargarHistorial();
  }, [
    authLoading,
    user,
    router,
    currentPage,
    filtroSeccion,
    filtroModelo,
    filtroObjetoId,
    filtroDiasFidelizacion,
  ]);

  const getAccionBadge = (historyType: string) => {
    if (historyType === '+') {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Creado
        </Badge>
      );
    }

    if (historyType === '~') {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-600">
          <Pencil className="mr-1 h-3 w-3" />
          Modificado
        </Badge>
      );
    }

    if (historyType === '-') {
      return (
        <Badge className="bg-red-600 hover:bg-red-600">
          <Trash2 className="mr-1 h-3 w-3" />
          Eliminado
        </Badge>
      );
    }

    return <Badge variant="outline">{historyType}</Badge>;
  };

  const getEstadoAutomatizadoBadge = (estado: string) => {
    const normalized = estado.toLowerCase();

    if (['aceptada', 'enviada', 'leída', 'leida'].includes(normalized)) {
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">{estado}</Badge>;
    }

    if (['pendiente', 'oferta_enviada'].includes(normalized)) {
      return <Badge className="bg-amber-500 hover:bg-amber-500">{estado}</Badge>;
    }

    if (['rechazada', 'expirada', 'cancelada'].includes(normalized)) {
      return <Badge className="bg-red-600 hover:bg-red-600">{estado}</Badge>;
    }

    return <Badge variant="outline">{estado}</Badge>;
  };

  const formatearFecha = (fecha: string | null) => {
    if (!fecha) {
      return '-';
    }

    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) {
      return fecha;
    }

    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!user || (user.role !== 'propietario' && user.role !== 'superusuario')) {
    return null;
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Auditoría de Cambios
          </CardTitle>
          <CardDescription>
            Vista consolidada de cambios manuales y procesos automáticos del sistema. Total de
            registros: {historial.resumen.total}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Cambios de datos</p>
                <p className="text-2xl font-semibold">{historial.resumen.cambios_modelos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Fidelización</p>
                <p className="text-2xl font-semibold">{historial.resumen.fidelizacion}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Reacomodamiento</p>
                <p className="text-2xl font-semibold">{historial.resumen.reacomodamiento}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Registros totales</p>
                <p className="text-2xl font-semibold">{historial.resumen.total}</p>
              </CardContent>
            </Card>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <Select
                value={filtroSeccion}
                onValueChange={(value) => {
                  setFiltroSeccion(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por sección" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las secciones</SelectItem>
                  <SelectItem value="modelos">Cambios de datos</SelectItem>
                  <SelectItem value="fidelizacion">Fidelización</SelectItem>
                  <SelectItem value="reacomodamiento">Reacomodamiento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(filtroSeccion === 'todas' || filtroSeccion === 'modelos') && (
              <div>
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
            )}

            {(filtroSeccion === 'todas' || filtroSeccion === 'fidelizacion') && (
              <div>
                <Select
                  value={filtroDiasFidelizacion}
                  onValueChange={(value) => {
                    setFiltroDiasFidelizacion(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Días para mail promocional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los días</SelectItem>
                    {diasDisponibles.map((dias) => (
                      <SelectItem key={dias} value={String(dias)}>
                        {dias} días
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID relacionado..."
                value={filtroObjetoId}
                onChange={(event) => {
                  setFiltroObjetoId(event.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8"
              />
            </div>
          </div>

          <div className="mb-6 flex justify-end">
            <Button onClick={() => void cargarHistorial()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>

          {shouldShowModelos && (
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Cambios de datos</h3>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Razón del cambio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center">
                          <AlertCircle className="mx-auto mb-2 h-12 w-12 text-gray-400" />
                          <p className="text-gray-500">No se encontraron cambios manuales</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      modelos.map((record) => (
                        <TableRow key={`${record.modelo}-${record.id}`}>
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
                                <p className="text-sm font-medium">{record.usuario.nombre}</p>
                                <p className="text-xs text-gray-500">{record.usuario.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {record.cambio_razon ? (
                              <span className="text-sm">{record.cambio_razon}</span>
                            ) : (
                              <span className="text-sm italic text-gray-400">Sin descripción</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {historial.modelos.total_pages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Página {currentPage} de {historial.modelos.total_pages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((page) => Math.min(historial.modelos.total_pages, page + 1))
                      }
                      disabled={currentPage === historial.modelos.total_pages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {shouldShowFidelizacion && (
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Proceso automático de fidelización</h3>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha de envío</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Profesional</TableHead>
                      <TableHead>Configuración</TableHead>
                      <TableHead>Beneficio</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fidelizacion.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center">
                          <AlertCircle className="mx-auto mb-2 h-12 w-12 text-gray-400" />
                          <p className="text-gray-500">No hay envíos de fidelización para los filtros actuales</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      fidelizacion.map((registro) => (
                        <TableRow key={`fidelizacion-${registro.id}`}>
                          <TableCell className="font-mono text-sm">
                            {formatearFecha(registro.fecha)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{registro.cliente.nombre}</p>
                              <p className="text-xs text-gray-500">{registro.cliente.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{registro.servicio.nombre}</p>
                              <p className="text-xs text-gray-500">{registro.servicio.categoria ?? 'Sin categoría'}</p>
                            </div>
                          </TableCell>
                          <TableCell>{registro.profesional.nombre}</TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              <p>{registro.dias_programados ?? '-'} días para campaña</p>
                              <p className="text-gray-500">Inactividad: {registro.dias_inactividad ?? '-'} días</p>
                              <p className="text-gray-500">
                                Sugerido: {registro.fecha_sugerida ? formatearFecha(registro.fecha_sugerida) : 'Sin horario'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {registro.tipo_email === 'con_saldo' ? 'Saldo en billetera' : 'Descuento promocional'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getEstadoAutomatizadoBadge(registro.leida ? 'Leída' : 'Enviada')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {shouldShowReacomodamiento && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Proceso automático de reacomodamiento</h3>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente notificado</TableHead>
                      <TableHead>Servicio y profesional</TableHead>
                      <TableHead>Turnos involucrados</TableHead>
                      <TableHead>Descuento</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reacomodamiento.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center">
                          <AlertCircle className="mx-auto mb-2 h-12 w-12 text-gray-400" />
                          <p className="text-gray-500">No hay eventos de reacomodamiento para los filtros actuales</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      reacomodamiento.map((registro) => (
                        <TableRow key={`reacomodamiento-${registro.id}`}>
                          <TableCell className="font-mono text-sm">
                            {formatearFecha(registro.fecha)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{registro.cliente_notificado.nombre}</p>
                              <p className="text-xs text-gray-500">{registro.cliente_notificado.email ?? 'Sin email'}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{registro.servicio.nombre}</p>
                              <p className="text-xs text-gray-500">{registro.profesional.nombre}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              <p>
                                Cancelado: #{registro.turno_cancelado.id ?? '-'}{' '}
                                {registro.turno_cancelado.fecha_hora
                                  ? `· ${formatearFecha(registro.turno_cancelado.fecha_hora)}`
                                  : ''}
                              </p>
                              <p className="text-gray-500">
                                Ofrecido: #{registro.turno_ofrecido.id ?? '-'}{' '}
                                {registro.turno_ofrecido.fecha_hora
                                  ? `· ${formatearFecha(registro.turno_ofrecido.fecha_hora)}`
                                  : '· Sin turno ofrecido'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>${registro.monto_descuento}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {getEstadoAutomatizadoBadge(registro.estado_final)}
                              <p className="text-xs text-gray-500">
                                Vence: {registro.expira ? formatearFecha(registro.expira) : 'Sin vencimiento'}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>

        <AlertDialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{notificationMessage.title}</AlertDialogTitle>
              <AlertDialogDescription>{notificationMessage.description}</AlertDialogDescription>
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
