import { 
  Empleado, 
  EmpleadoFormData,
  EmpleadoServicio,
  ApiResponse 
} from '@/types';
import { get, getWithPagination, post, put, patch, del } from './api';

export const empleadosService = {
  // Listar todos los empleados con paginación
  list: async (params?: {
    page?: number;
    search?: string;
    especialidad?: string;
    is_disponible?: boolean;
  }): Promise<ApiResponse<Empleado>> => {
    return await getWithPagination<Empleado>('/empleados/', params);
  },

  // Obtener empleados disponibles
  listAvailable: async (): Promise<Empleado[]> => {
    const response = await getWithPagination<Empleado>('/empleados/', { is_disponible: true });
    return response.results;
  },

  // Obtener empleados por especialidad
  getBySpecialty: async (especialidad: string): Promise<Empleado[]> => {
    const response = await getWithPagination<Empleado>('/empleados/', { especialidad });
    return response.results;
  },

  // Obtener empleado por ID
  get: async (id: number): Promise<Empleado> => {
    return await get<Empleado>(`/empleados/${id}/`);
  },

  // Crear nuevo empleado
  create: async (data: EmpleadoFormData): Promise<Empleado> => {
    return await post<Empleado>('/empleados/', data);
  },

  // Actualizar empleado completo
  update: async (id: number, data: EmpleadoFormData): Promise<Empleado> => {
    return await put<Empleado>(`/empleados/${id}/`, data);
  },

  // Actualizar empleado parcialmente
  patch: async (id: number, data: Partial<EmpleadoFormData>): Promise<Empleado> => {
    return await patch<Empleado>(`/empleados/${id}/`, data);
  },

  // Eliminar empleado
  delete: async (id: number): Promise<void> => {
    return await del(`/empleados/${id}/`);
  },

  // Cambiar disponibilidad
  toggleAvailability: async (id: number, isDisponible: boolean): Promise<Empleado> => {
    return await patch<Empleado>(`/empleados/${id}/`, { is_disponible: isDisponible });
  },

  // Obtener servicios que puede realizar un empleado
  getServices: async (id: number): Promise<EmpleadoServicio[]> => {
    return await get<EmpleadoServicio[]>(`/empleados/${id}/servicios/`);
  },

  // Asignar servicio a empleado
  assignService: async (empleadoId: number, servicioId: number, nivelExperiencia: number): Promise<EmpleadoServicio> => {
    return await post<EmpleadoServicio>(`/empleados/${empleadoId}/servicios/`, {
      servicio: servicioId,
      nivel_experiencia: nivelExperiencia
    });
  },

  // Remover servicio de empleado
  removeService: async (empleadoId: number, servicioId: number): Promise<void> => {
    return await del(`/empleados/${empleadoId}/servicios/${servicioId}/`);
  },

  // Obtener horarios disponibles de un empleado
  getAvailableSlots: async (empleadoId: number, fecha: string): Promise<string[]> => {
    return await get<string[]>(`/empleados/${empleadoId}/horarios-disponibles/?fecha=${fecha}`);
  },

  // Obtener turnos del empleado por fecha
  getTurnosByDate: async (empleadoId: number, fecha: string): Promise<any[]> => {
    return await get<any[]>(`/empleados/${empleadoId}/turnos/?fecha=${fecha}`);
  },
};