import { 
  Cliente, 
  ClienteFormData,
  ApiResponse 
} from '@/types';
import { get, getWithPagination, post, put, patch, del } from './api';

export const clientesService = {
  // Listar todos los clientes con paginación
  list: async (params?: {
    page?: number;
    search?: string;
    is_vip?: boolean;
  }): Promise<ApiResponse<Cliente>> => {
    return await getWithPagination<Cliente>('/clientes/', params);
  },

  // Obtener cliente por ID
  get: async (id: number): Promise<Cliente> => {
    return await get<Cliente>(`/clientes/${id}/`);
  },

  // Crear nuevo cliente
  create: async (data: ClienteFormData): Promise<Cliente> => {
    return await post<Cliente>('/clientes/', data);
  },

  // Actualizar cliente completo
  update: async (id: number, data: ClienteFormData): Promise<Cliente> => {
    return await put<Cliente>(`/clientes/${id}/`, data);
  },

  // Actualizar cliente parcialmente
  patch: async (id: number, data: Partial<ClienteFormData>): Promise<Cliente> => {
    return await patch<Cliente>(`/clientes/${id}/`, data);
  },

  // Eliminar cliente
  delete: async (id: number): Promise<void> => {
    return await del(`/clientes/${id}/`);
  },

  // Obtener historial de turnos del cliente
  getHistorialTurnos: async (id: number): Promise<any[]> => {
    return await get<any[]>(`/clientes/${id}/historial-turnos/`);
  },

  // Marcar como VIP
  toggleVip: async (id: number, isVip: boolean): Promise<Cliente> => {
    return await patch<Cliente>(`/clientes/${id}/`, { is_vip: isVip });
  },

  // Buscar clientes por nombre o email
  search: async (query: string): Promise<Cliente[]> => {
    const response = await getWithPagination<Cliente>('/clientes/', { search: query });
    return response.results;
  },

  // Obtener clientes VIP
  getVipClients: async (): Promise<Cliente[]> => {
    const response = await getWithPagination<Cliente>('/clientes/', { is_vip: true });
    return response.results;
  },
};