import { 
  Turno, 
  TurnoFormData,
  HistorialTurno,
  ApiResponse 
} from '@/types';
import { get, getWithPagination, post, put, patch, del } from './api';

export const turnosService = {
  // Listar todos los turnos con paginación
  list: async (params?: {
    page?: number;
    cliente?: number;
    empleado?: number;
    servicio?: number;
    estado?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
  }): Promise<ApiResponse<Turno>> => {
    return await getWithPagination<Turno>('/turnos/', params);
  },

  // Obtener turnos del día actual
  getToday: async (): Promise<Turno[]> => {
    const today = new Date().toISOString().split('T')[0];
    const response = await getWithPagination<Turno>('/turnos/', { 
      fecha_desde: today,
      fecha_hasta: today 
    });
    return response.results;
  },

  // Obtener turnos por estado
  getByStatus: async (estado: string): Promise<Turno[]> => {
    const response = await getWithPagination<Turno>('/turnos/', { estado });
    return response.results;
  },

  // Obtener turnos pendientes
  getPending: async (): Promise<Turno[]> => {
    return await turnosService.getByStatus('pendiente');
  },

  // Obtener turnos confirmados
  getConfirmed: async (): Promise<Turno[]> => {
    return await turnosService.getByStatus('confirmado');
  },

  // Obtener turno por ID
  get: async (id: number): Promise<Turno> => {
    return await get<Turno>(`/turnos/${id}/`);
  },

  // Crear nuevo turno
  create: async (data: TurnoFormData): Promise<Turno> => {
    return await post<Turno>('/turnos/', data);
  },

  // Actualizar turno completo
  update: async (id: number, data: TurnoFormData): Promise<Turno> => {
    return await put<Turno>(`/turnos/${id}/`, data);
  },

  // Actualizar turno parcialmente
  patch: async (id: number, data: Partial<TurnoFormData>): Promise<Turno> => {
    return await patch<Turno>(`/turnos/${id}/`, data);
  },

  // Eliminar turno
  delete: async (id: number): Promise<void> => {
    return await del(`/turnos/${id}/`);
  },

  // Cambiar estado del turno
  changeStatus: async (id: number, estado: string, observaciones?: string): Promise<Turno> => {
    return await patch<Turno>(`/turnos/${id}/estado/`, { 
      estado, 
      observaciones 
    });
  },

  // Confirmar turno
  confirm: async (id: number): Promise<Turno> => {
    return await turnosService.changeStatus(id, 'confirmado');
  },

  // Iniciar turno (en proceso)
  start: async (id: number): Promise<Turno> => {
    return await turnosService.changeStatus(id, 'en_proceso');
  },

  // Completar turno
  complete: async (id: number, precioFinal?: number, notasEmpleado?: string): Promise<Turno> => {
    const updateData: any = { estado: 'completado' };
    if (precioFinal) updateData.precio_final = precioFinal.toString();
    if (notasEmpleado) updateData.notas_empleado = notasEmpleado;
    
    return await patch<Turno>(`/turnos/${id}/`, updateData);
  },

  // Cancelar turno
  cancel: async (id: number, motivo?: string): Promise<Turno> => {
    return await turnosService.changeStatus(id, 'cancelado', motivo);
  },

  // Marcar como no asistió
  markNoShow: async (id: number): Promise<Turno> => {
    return await turnosService.changeStatus(id, 'no_asistio');
  },

  // Obtener historial de cambios del turno
  getHistory: async (id: number): Promise<HistorialTurno[]> => {
    return await get<HistorialTurno[]>(`/turnos/${id}/historial/`);
  },

  // Obtener turnos por rango de fechas
  getByDateRange: async (fechaInicio: string, fechaFin: string): Promise<Turno[]> => {
    const response = await getWithPagination<Turno>('/turnos/', {
      fecha_desde: fechaInicio,
      fecha_hasta: fechaFin
    });
    return response.results;
  },

  // Obtener turnos del cliente
  getByClient: async (clienteId: number): Promise<Turno[]> => {
    const response = await getWithPagination<Turno>('/turnos/', { cliente: clienteId });
    return response.results;
  },

  // Obtener turnos del empleado
  getByEmployee: async (empleadoId: number): Promise<Turno[]> => {
    const response = await getWithPagination<Turno>('/turnos/', { empleado: empleadoId });
    return response.results;
  },

  // Verificar disponibilidad de horario
  checkAvailability: async (empleadoId: number, fechaHora: string): Promise<boolean> => {
    try {
      await get(`/turnos/verificar-disponibilidad/?empleado=${empleadoId}&fecha_hora=${fechaHora}`);
      return true;
    } catch (error) {
      return false;
    }
  },

  // Obtener estadísticas de turnos
  getStats: async (fechaInicio?: string, fechaFin?: string): Promise<any> => {
    const params = fechaInicio && fechaFin ? `?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}` : '';
    return await get(`/turnos/estadisticas/${params}`);
  },
};