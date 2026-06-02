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
import { getAuthHeaders, getJsonAuthHeaders } from '@/lib/auth-headers';
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, DoorClosed, Loader2, Pencil, Plus, Power, PowerOff, Scissors, Search, Tag, Trash2 } from 'lucide-react';
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
  sala_is_active?: boolean | null;
  servicios_count?: number;
  servicios_activos_count?: number;
}

interface Sala {
  id: number;
  nombre: string;
  capacidad_simultanea: number;
  is_active: boolean;
  categorias: { id: number; nombre: string }[];
  categorias_count?: number;
  categorias_activas_count?: number;
  turnos_count?: number;
  turnos_futuros_activos_count?: number;
}

interface Servicio {
  id: number;
  nombre: string;
  categoria: number;
  categoria_nombre: string;
  categoria_is_active?: boolean;
  sala_nombre?: string | null;
  sala_is_active?: boolean | null;
  precio: string;
  descuento_reasignacion?: string;
  bono_reacomodamiento_senia?: string;
  bono_reacomodamiento_pago_completo?: string;
  tipo_descuento_adelanto?: 'PORCENTAJE' | 'MONTO_FIJO';
  valor_descuento_adelanto?: string;
  tiempo_espera_respuesta?: number;
  porcentaje_sena?: string;
  duracion_minutos: number;
  duracion_horas?: string;
  descripcion: string;
  is_active: boolean;
  turnos_count?: number;
  turnos_futuros_activos_count?: number;
  profesionales_asociados_count?: number;
}

type VerificationEntity = Categoria | Servicio | Sala;
type VerificationKind = 'categoria' | 'servicio' | 'sala';
type VerificationAction = 'deactivate' | 'delete';

interface VerificationCheckItem {
  key: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  message: string;
  count?: number;
}

interface VerificationState {
  kind: VerificationKind;
  action: VerificationAction;
  entity: VerificationEntity;
  title: string;
  description: string;
  checks: VerificationCheckItem[];
  ok: boolean;
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
    capacidad_simultanea: '1',
    is_active: true
  });

  // Estados para servicios
  const [servicios, setServicios] = useState<Servicio[]>([]);

  // Estados generales
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('servicios');

  // Estados para búsqueda y filtros
  const [searchCategoria, setSearchCategoria] = useState('');
  const [searchServicio, setSearchServicio] = useState('');
  const [searchSala, setSearchSala] = useState('');
  const [filterEstadoCategorias, setFilterEstadoCategorias] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [filterEstadoServicios, setFilterEstadoServicios] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [filterEstadoSalas, setFilterEstadoSalas] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [expandedServicioId, setExpandedServicioId] = useState<number | null>(null);

  // Estados para paginación
  const [currentPageCategorias, setCurrentPageCategorias] = useState(1);
  const [currentPageServicios, setCurrentPageServicios] = useState(1);
  const [currentPageSalas, setCurrentPageSalas] = useState(1);
  const itemsPerPage = 5;

  // Estados para modal de notificación (éxito/error)
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({ title: '', description: '', type: 'success' as 'success' | 'error' });
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [verificationState, setVerificationState] = useState<VerificationState | null>(null);

  // Cargar datos iniciales
  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const baseUrl = '/api';

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
  const matchesEstado = (isActive: boolean, filter: 'todos' | 'activos' | 'inactivos') => {
    return filter === 'todos' || (filter === 'activos' && isActive) || (filter === 'inactivos' && !isActive);
  };

  const isServicioDisponible = (servicio: Servicio) => {
    const categoriaActiva = servicio.categoria_is_active ?? true;
    const salaActiva = servicio.sala_is_active ?? true;
    return servicio.is_active && categoriaActiva && salaActiva;
  };

  const getServicioBloqueo = (servicio: Servicio) => {
    if (!servicio.is_active) return 'Servicio inactivo';
    if (servicio.categoria_is_active === false) return 'Categoría inactiva';
    if (servicio.sala_is_active === false) return 'Sala inactiva';
    return null;
  };

  const getFilteredCategorias = () => {
    return categorias.filter(cat =>
      matchesEstado(cat.is_active, filterEstadoCategorias) && (
        cat.nombre.toLowerCase().includes(searchCategoria.toLowerCase()) ||
        (cat.descripcion && cat.descripcion.toLowerCase().includes(searchCategoria.toLowerCase())) ||
        (cat.sala_nombre && cat.sala_nombre.toLowerCase().includes(searchCategoria.toLowerCase()))
      )
    );
  };

  const getFilteredServicios = () => {
    return servicios.filter(serv =>
      matchesEstado(serv.is_active, filterEstadoServicios) && (
        serv.nombre.toLowerCase().includes(searchServicio.toLowerCase()) ||
        serv.categoria_nombre.toLowerCase().includes(searchServicio.toLowerCase()) ||
        (serv.sala_nombre && serv.sala_nombre.toLowerCase().includes(searchServicio.toLowerCase())) ||
        (serv.descripcion && serv.descripcion.toLowerCase().includes(searchServicio.toLowerCase()))
      )
    );
  };

  const getFilteredSalas = () => {
    return salas.filter(sala =>
      matchesEstado(sala.is_active, filterEstadoSalas) && sala.nombre.toLowerCase().includes(searchSala.toLowerCase())
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

  const EstadoFilter = ({
    value,
    onChange,
  }: {
    value: 'todos' | 'activos' | 'inactivos';
    onChange: (value: 'todos' | 'activos' | 'inactivos') => void;
  }) => (
    <div className="flex rounded-md border bg-white p-1 text-sm">
      {[
        { value: 'todos' as const, label: 'Todos' },
        { value: 'activos' as const, label: 'Activos' },
        { value: 'inactivos' as const, label: 'Inactivos' },
      ].map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? 'default' : 'ghost'}
          className="h-8 px-3"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );

  // Función para mostrar notificación modal
  const showNotification = (title: string, description: string, type: 'success' | 'error') => {
    setNotificationMessage({ title, description, type });
    setNotificationDialogOpen(true);
  };

  const getErrorMessage = async (response: Response, fallback: string) => {
    const errorData = await response.json().catch(() => ({}));
    if (errorData.detail || errorData.error) return errorData.detail || errorData.error;
    const firstValue = Object.values(errorData)[0];
    if (Array.isArray(firstValue)) return String(firstValue[0]);
    if (typeof firstValue === 'string') return firstValue;
    return fallback;
  };

  const getEntityName = (entity: VerificationEntity) => entity.nombre;

  const getVerificationEndpoint = (kind: VerificationKind, id: number) => {
    if (kind === 'categoria') return `/api/servicios/categorias/${id}/`;
    if (kind === 'sala') return `/api/servicios/salas/${id}/`;
    return `/api/servicios/${id}/`;
  };

  const buildVerificationChecks = (
    kind: VerificationKind,
    action: VerificationAction,
    entity: VerificationEntity
  ): VerificationCheckItem[] => {
    if (kind === 'categoria') {
      const categoria = entity as Categoria;
      const serviciosCount = categoria.servicios_count ?? 0;
      const serviciosActivosCount = categoria.servicios_activos_count ?? 0;
      return action === 'deactivate'
        ? [
          {
            key: 'servicios_activos',
            label: 'Servicios activos asociados',
            count: serviciosActivosCount,
            ok: serviciosActivosCount === 0,
            blocking: true,
            message: 'Desactivá o reasigná los servicios activos primero.',
          },
        ]
        : [
          {
            key: 'servicios_asociados',
            label: 'Servicios asociados',
            count: serviciosCount,
            ok: serviciosCount === 0,
            blocking: true,
            message: 'No se puede eliminar una categoría con servicios asociados.',
          },
        ];
    }

    if (kind === 'servicio') {
      const servicio = entity as Servicio;
      const turnosCount = servicio.turnos_count ?? 0;
      const turnosFuturosActivosCount = servicio.turnos_futuros_activos_count ?? 0;
      const profesionalesCount = servicio.profesionales_asociados_count ?? 0;
      return action === 'deactivate'
        ? [
          {
            key: 'turnos_futuros_activos',
            label: 'Turnos futuros activos',
            count: turnosFuturosActivosCount,
            ok: turnosFuturosActivosCount === 0,
            blocking: true,
            message: 'Reprogramá o cancelá los turnos futuros activos primero.',
          },
        ]
        : [
          {
            key: 'turnos_asociados',
            label: 'Turnos asociados',
            count: turnosCount,
            ok: turnosCount === 0,
            blocking: true,
            message: 'No se puede eliminar un servicio con turnos o historial asociado.',
          },
          {
            key: 'profesionales_asociados',
            label: 'Profesionales asignados',
            count: profesionalesCount,
            ok: profesionalesCount === 0,
            blocking: true,
            message: 'Quitá la asociación con profesionales primero.',
          },
        ];
    }

    const sala = entity as Sala;
    const categoriasCount = sala.categorias_count ?? sala.categorias?.length ?? 0;
    const categoriasActivasCount = sala.categorias_activas_count ?? 0;
    const turnosCount = sala.turnos_count ?? 0;
    return action === 'deactivate'
      ? [
        {
          key: 'categorias_activas',
          label: 'Categorías activas asociadas',
          count: categoriasActivasCount,
          ok: categoriasActivasCount === 0,
          blocking: true,
          message: 'Desactivá o reasigná las categorías activas primero.',
        },
      ]
      : [
        {
          key: 'categorias_asociadas',
          label: 'Categorías asociadas',
          count: categoriasCount,
          ok: categoriasCount === 0,
          blocking: true,
          message: 'No se puede eliminar una sala con categorías asociadas.',
        },
        {
          key: 'turnos_asociados',
          label: 'Turnos asociados',
          count: turnosCount,
          ok: turnosCount === 0,
          blocking: true,
          message: 'No se puede eliminar una sala con turnos asociados.',
        },
      ];
  };

  const openVerificationDialog = async (
    kind: VerificationKind,
    action: VerificationAction,
    entity: VerificationEntity
  ) => {
    setVerificationState(null);
    setVerificationDialogOpen(true);
    setVerificationLoading(true);

    try {
      const response = await fetch(getVerificationEndpoint(kind, entity.id), {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response, 'No se pudieron cargar los datos para verificar la baja.');
        showNotification('Error al verificar', errorMessage, 'error');
        setVerificationDialogOpen(false);
        return;
      }

      const freshEntity = await response.json();
      const checks = buildVerificationChecks(kind, action, freshEntity);
      const blockers = checks.filter(check => check.blocking && !check.ok);
      const entityName = getEntityName(freshEntity);
      const actionText = action === 'deactivate' ? 'desactivar' : 'eliminar definitivamente';

      setVerificationState({
        kind,
        action,
        entity: freshEntity,
        title: `Verificar ${action === 'deactivate' ? 'desactivación' : 'eliminación'}`,
        description: `Revisando si "${entityName}" se puede ${actionText} sin romper dependencias.`,
        checks,
        ok: blockers.length === 0,
      });
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
      setVerificationDialogOpen(false);
    } finally {
      setVerificationLoading(false);
    }
  };

  const executeVerifiedAction = async () => {
    if (!verificationState || !verificationState.ok) return;

    const { kind, action, entity } = verificationState;
    const entityName = getEntityName(entity);
    const endpoint = getVerificationEndpoint(kind, entity.id);
    const method = action === 'deactivate' ? 'PATCH' : 'DELETE';

    setVerificationSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: action === 'deactivate' ? getJsonAuthHeaders() : getAuthHeaders(),
        body: action === 'deactivate' ? JSON.stringify({ is_active: false }) : undefined,
      });

      if (response.ok || response.status === 204) {
        const entityLabel = kind === 'categoria' ? 'Categoría' : kind === 'servicio' ? 'Servicio' : 'Sala';
        const doneText = action === 'deactivate'
          ? kind === 'servicio' ? 'desactivado' : 'desactivada'
          : kind === 'servicio' ? 'eliminado' : 'eliminada';
        showNotification(
          action === 'deactivate' ? `${entityLabel} ${doneText}` : `${entityLabel} ${doneText}`,
          `"${entityName}" fue ${doneText} correctamente.`,
          'success'
        );
        setVerificationDialogOpen(false);
        setVerificationState(null);
        fetchData();
      } else {
        const errorMessage = await getErrorMessage(response, `No se pudo ${action === 'deactivate' ? 'desactivar' : 'eliminar'} el registro.`);
        showNotification(action === 'deactivate' ? 'Error al desactivar' : 'No se puede eliminar', errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
    } finally {
      setVerificationSubmitting(false);
    }
  };

  // Funciones para categorías
  const handleCategoriaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const baseUrl = '/api';
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
        headers: getJsonAuthHeaders(),
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

  const handleDeactivateCategoria = async (categoria: Categoria) => {
    openVerificationDialog('categoria', 'deactivate', categoria);
  };

  const handleDeleteCategoria = async (categoria: Categoria) => {
    openVerificationDialog('categoria', 'delete', categoria);
  };

  const handleActivateCategoria = async (categoria: Categoria) => {
    try {
      const response = await fetch(`/api/servicios/categorias/${categoria.id}/`, {
        method: 'PATCH',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({ is_active: true })
      });

      if (response.ok) {
        showNotification('Categoría reactivada', `La categoría "${categoria.nombre}" volvió a estar activa.`, 'success');
        fetchData();
      } else {
        const errorData = await response.json();
        showNotification('Error al reactivar', errorData.detail || errorData.error || 'No se pudo reactivar la categoría.', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
    }
  };

  // Funciones para servicios
  const handleDeactivateServicio = async (servicio: Servicio) => {
    openVerificationDialog('servicio', 'deactivate', servicio);
  };

  const handleDeleteServicio = async (servicio: Servicio) => {
    openVerificationDialog('servicio', 'delete', servicio);
  };

  const handleActivateServicio = async (servicio: Servicio) => {
    try {
      const response = await fetch(`/api/servicios/${servicio.id}/`, {
        method: 'PATCH',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({ is_active: true })
      });

      if (response.ok) {
        showNotification('Servicio reactivado', `El servicio "${servicio.nombre}" volvió a estar disponible.`, 'success');
        fetchData();
      } else {
        const errorData = await response.json();
        showNotification('Error al reactivar', errorData.detail || errorData.error || 'No se pudo reactivar el servicio.', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
    }
  };

  // Funciones para salas
  const handleSalaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const baseUrl = '/api';
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
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({
          nombre: salaForm.nombre,
          capacidad_simultanea: capacidad,
          is_active: salaForm.is_active
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
        setSalaForm({ nombre: '', capacidad_simultanea: '1', is_active: true });
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
      capacidad_simultanea: sala.capacidad_simultanea.toString(),
      is_active: sala.is_active
    });
    setSalaDialogOpen(true);
  };

  const handleDeactivateSala = async (sala: Sala) => {
    openVerificationDialog('sala', 'deactivate', sala);
  };

  const handleDeleteSala = async (sala: Sala) => {
    openVerificationDialog('sala', 'delete', sala);
  };

  const handleActivateSala = async (sala: Sala) => {
    try {
      const response = await fetch(`/api/servicios/salas/${sala.id}/`, {
        method: 'PATCH',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({ is_active: true })
      });

      if (response.ok) {
        showNotification('Sala reactivada', `La sala "${sala.nombre}" volvió a estar activa.`, 'success');
        fetchData();
      } else {
        const errorData = await response.json();
        showNotification('Error al reactivar', errorData.detail || errorData.error || 'No se pudo reactivar la sala.', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
    }
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
          Administrá la trazabilidad Servicio {'->'} Categoría {'->'} Sala sin perder historial.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="servicios" className="flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Servicios ({getFilteredServicios().length})
          </TabsTrigger>
          <TabsTrigger value="categorias" className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Categorías ({getFilteredCategorias().length})
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
                    Agrupan servicios y los vinculan con una sala física. Las inactivas se conservan y pueden reactivarse.
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
                          {salas
                            .filter((sala) => sala.is_active || sala.id.toString() === categoriaForm.sala)
                            .map((sala) => (
                            <option key={sala.id} value={sala.id}>
                              {sala.nombre} (Capacidad: {sala.capacidad_simultanea}){!sala.is_active ? ' - Inactiva' : ''}
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
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por categoría, descripción o sala..."
                    value={searchCategoria}
                    onChange={(e) => {
                      setSearchCategoria(e.target.value);
                      setCurrentPageCategorias(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <EstadoFilter value={filterEstadoCategorias} onChange={(value) => {
                  setFilterEstadoCategorias(value);
                  setCurrentPageCategorias(1);
                }} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paginatedCategorias.map((categoria) => (
                  <div key={categoria.id} className="flex flex-col gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{categoria.nombre}</h3>
                        <Badge variant={categoria.is_active ? "default" : "secondary"}>
                          {categoria.is_active ? 'Activa' : 'Inactiva'}
                        </Badge>
                        <Badge variant="outline">{categoria.sala_nombre || 'Sin sala'}</Badge>
                        {categoria.sala_is_active === false && (
                          <Badge variant="secondary">Sala inactiva</Badge>
                        )}
                      </div>
                      {categoria.descripcion && (
                        <p className="text-sm text-gray-600">{categoria.descripcion}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Trazabilidad: Categoría {'->'} {categoria.sala_nombre || 'Sin sala asignada'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Dependencias: {categoria.servicios_count ?? 0} servicio(s), {categoria.servicios_activos_count ?? 0} activo(s).
                      </p>
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
                        onClick={() => categoria.is_active
                          ? handleDeactivateCategoria(categoria)
                          : handleActivateCategoria(categoria)
                        }
                        title={categoria.is_active ? 'Desactivar categoría' : 'Reactivar categoría'}
                      >
                        {categoria.is_active ? (
                          <PowerOff className="w-4 h-4 text-red-500" />
                        ) : (
                          <Power className="w-4 h-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCategoria(categoria)}
                        title="Eliminar categoría definitivamente"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
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
                    Cada servicio conserva su categoría y sala para saber dónde se presta y por qué está disponible.
                  </CardDescription>
                </div>
                <Button onClick={() => router.push('/dashboard/propietario/servicios/nuevo')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Servicio
                </Button>
              </div>

              {/* Barra de búsqueda para servicios */}
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por servicio, categoría, sala o descripción..."
                    value={searchServicio}
                    onChange={(e) => {
                      setSearchServicio(e.target.value);
                      setCurrentPageServicios(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <EstadoFilter value={filterEstadoServicios} onChange={(value) => {
                  setFilterEstadoServicios(value);
                  setCurrentPageServicios(1);
                }} />
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
                          <Badge variant="secondary">{servicio.sala_nombre || 'Sin sala'}</Badge>
                          <Badge variant={isServicioDisponible(servicio) ? "default" : "secondary"}>
                            {isServicioDisponible(servicio) ? 'Disponible' : 'No disponible'}
                          </Badge>
                          {getServicioBloqueo(servicio) && (
                            <Badge variant="outline">{getServicioBloqueo(servicio)}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>💰 ${servicio.precio}</span>
                          <span>⏱️ {servicio.duracion_minutos} min</span>
                          {servicio.porcentaje_sena && (
                            <span>
                              {(() => {
                                const precio = Number(servicio.precio) || 0;
                                const pct = typeof servicio.porcentaje_sena === 'number'
                                  ? servicio.porcentaje_sena
                                  : Number(servicio.porcentaje_sena) || 0;
                                const montoSena = precio > 0 && pct > 0 ? (precio * pct) / 100 : 0;
                                return montoSena
                                  ? `💳 Seña aprox $${montoSena.toFixed(0)}`
                                  : '💳 Seña sin configurar';
                              })()}
                            </span>
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
                          servicio.is_active
                            ? handleDeactivateServicio(servicio)
                            : handleActivateServicio(servicio);
                        }}
                        title={servicio.is_active ? 'Desactivar servicio' : 'Reactivar servicio'}
                      >
                        {servicio.is_active ? (
                          <PowerOff className="w-4 h-4 text-red-500" />
                        ) : (
                          <Power className="w-4 h-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteServicio(servicio);
                        }}
                        title="Eliminar servicio definitivamente"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                      </div>
                    </div>

                    {expandedServicioId === servicio.id && (
                      <div className="mt-4 border-t pt-4 text-sm text-gray-600">
                        {servicio.descripcion && (
                          <p className="text-sm text-gray-600 mb-3">{servicio.descripcion}</p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          <div className="md:col-span-2 lg:col-span-3 rounded-md border bg-gray-50 px-3 py-2">
                            <span className="font-medium">Trazabilidad:</span>{' '}
                            {servicio.nombre} {'->'} {servicio.categoria_nombre} {'->'} {servicio.sala_nombre || 'Sin sala asignada'}
                          </div>
                          <div>
                            <span className="font-medium">Precio:</span> ${servicio.precio}
                          </div>
                          <div>
                            <span className="font-medium">Duración:</span> {servicio.duracion_minutos} min
                          </div>
                          <div>
                            <span className="font-medium">Turnos históricos:</span> {servicio.turnos_count ?? 0}
                          </div>
                          <div>
                            <span className="font-medium">Turnos futuros activos:</span> {servicio.turnos_futuros_activos_count ?? 0}
                          </div>
                          <div>
                            <span className="font-medium">Profesionales asignados:</span> {servicio.profesionales_asociados_count ?? 0}
                          </div>
                          {servicio.bono_reacomodamiento_senia && (
                            <div>
                              <span className="font-medium">Oferta por reacomodamiento:</span> ${servicio.bono_reacomodamiento_senia}
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
                              <span className="font-medium">Seña:</span>{' '}
                              {(() => {
                                const precio = Number(servicio.precio) || 0;
                                const pct = typeof servicio.porcentaje_sena === 'number'
                                  ? servicio.porcentaje_sena
                                  : Number(servicio.porcentaje_sena) || 0;
                                const montoSena = precio > 0 && pct > 0 ? (precio * pct) / 100 : 0;
                                return montoSena
                                  ? `$${montoSena.toFixed(2)} (${pct.toFixed ? pct.toFixed(2) : pct}%)`
                                  : `${pct}%`;
                              })()}
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
                    Administrá espacios físicos, capacidad y categorías asociadas. Las salas inactivas pueden reactivarse.
                  </CardDescription>
                </div>
                <Dialog open={salaDialogOpen} onOpenChange={setSalaDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingSala(null);
                        setSalaForm({ nombre: '', capacidad_simultanea: '1', is_active: true });
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
                      <div className="flex items-center space-x-2 rounded-md border bg-gray-50 p-3">
                        <input
                          type="checkbox"
                          id="sala-active"
                          checked={salaForm.is_active}
                          onChange={(e) => setSalaForm({ ...salaForm, is_active: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <div>
                          <Label htmlFor="sala-active" className="cursor-pointer">Sala activa</Label>
                          <p className="text-xs text-gray-500">Una sala inactiva no debería usarse para nuevos servicios.</p>
                        </div>
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

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
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
                <EstadoFilter value={filterEstadoSalas} onChange={(value) => {
                  setFilterEstadoSalas(value);
                  setCurrentPageSalas(1);
                }} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="hidden md:grid grid-cols-12 gap-4 text-xs uppercase text-gray-500">
                  <div className="col-span-4">Nombre</div>
                  <div className="col-span-2">Capacidad</div>
                  <div className="col-span-4">Trazabilidad</div>
                  <div className="col-span-2 text-right">Acciones</div>
                </div>
                {paginatedSalas.map((sala) => (
                  <div
                    key={sala.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="md:col-span-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{sala.nombre}</p>
                        <Badge variant={sala.is_active ? 'default' : 'secondary'}>
                          {sala.is_active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </div>
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
                      <p className="mt-2 text-xs text-gray-500">
                        Sala {'->'} Categorías {'->'} Servicios asociados
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Dependencias: {sala.categorias_count ?? sala.categorias.length} categoría(s), {sala.categorias_activas_count ?? 0} activa(s), {sala.turnos_count ?? 0} turno(s).
                      </p>
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
                        onClick={() => sala.is_active ? handleDeactivateSala(sala) : handleActivateSala(sala)}
                        title={sala.is_active ? 'Desactivar sala' : 'Reactivar sala'}
                      >
                        {sala.is_active ? (
                          <PowerOff className="w-4 h-4 text-red-500" />
                        ) : (
                          <Power className="w-4 h-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSala(sala)}
                        title="Eliminar sala definitivamente"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
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

      {/* Modal de verificación de baja/eliminación */}
      <AlertDialog open={verificationDialogOpen} onOpenChange={setVerificationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{verificationState?.title || 'Verificando datos'}</AlertDialogTitle>
            <AlertDialogDescription>
              {verificationState?.description || 'Cargando datos actualizados para validar la acción.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {verificationLoading ? (
            <div className="flex items-center gap-3 rounded-lg border bg-gray-50 p-4 text-sm text-gray-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando datos y verificando reglas de baja...
            </div>
          ) : verificationState ? (
            <div className="space-y-3">
              {verificationState.checks.map((check) => (
                <div
                  key={check.key}
                  className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${check.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
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
                  <Badge variant={check.ok ? 'outline' : 'destructive'}>{check.count ?? (check.ok ? 'OK' : 'Revisar')}</Badge>
                </div>
              ))}
              <div className={`rounded-lg border p-3 text-sm ${verificationState.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                {verificationState.ok
                  ? `Todo está OK. Podés confirmar la ${verificationState.action === 'deactivate' ? 'desactivación' : 'eliminación definitiva'}.`
                  : 'No se puede continuar todavía. Resolvé los bloqueos indicados primero.'}
              </div>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={verificationSubmitting}>Cerrar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeVerifiedAction}
              disabled={verificationLoading || verificationSubmitting || !verificationState?.ok}
              className="bg-red-600 hover:bg-red-700"
            >
              {verificationSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : verificationState?.action === 'delete' ? (
                'Confirmar eliminación'
              ) : (
                'Confirmar desactivación'
              )}
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
