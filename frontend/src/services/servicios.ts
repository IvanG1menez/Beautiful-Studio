import { 
  CategoriaServicio, 
  Servicio, 
  ServicioFormData,
  Sala,
  ApiResponse 
} from '@/types';
import { get, getWithPagination, post, put, patch, del } from './api';

export const serviciosService = {
  // Categorías de servicios
  categorias: {
    // Listar todas las categorías activas
    list: async (): Promise<CategoriaServicio[]> => {
      const response = await getWithPagination<CategoriaServicio>('/servicios/categorias/');
      return response.results;
    },

    // Obtener categoría por ID
    get: async (id: number): Promise<CategoriaServicio> => {
      return await get<CategoriaServicio>(`/servicios/categorias/${id}/`);
    },

    // Crear nueva categoría
    create: async (data: Omit<CategoriaServicio, 'id' | 'created_at'>): Promise<CategoriaServicio> => {
      return await post<CategoriaServicio>('/servicios/categorias/', data);
    },

    // Actualizar categoría
    update: async (id: number, data: Partial<CategoriaServicio>): Promise<CategoriaServicio> => {
      return await patch<CategoriaServicio>(`/servicios/categorias/${id}/`, data);
    },

    // Eliminar categoría
    delete: async (id: number): Promise<void> => {
      return await del(`/servicios/categorias/${id}/`);
    },
  },

  // Servicios
  servicios: {
    // Listar todos los servicios con paginación
    list: async (params?: {
      page?: number;
      search?: string;
      categoria?: number;
    }): Promise<ApiResponse<Servicio>> => {
      return await getWithPagination<Servicio>('/servicios/', params);
    },

    // Obtener servicios activos
    listActive: async (): Promise<Servicio[]> => {
      const response = await getWithPagination<Servicio>('/servicios/', { is_active: true });
      return response.results;
    },

    // Obtener servicios por categoría
    getByCategory: async (categoriaId: number): Promise<Servicio[]> => {
      const response = await getWithPagination<Servicio>(`/servicios/categoria/${categoriaId}/`);
      return response.results;
    },

    // Obtener servicio por ID
    get: async (id: number): Promise<Servicio> => {
      return await get<Servicio>(`/servicios/${id}/`);
    },

    // Crear nuevo servicio
    create: async (data: ServicioFormData): Promise<Servicio> => {
      return await post<Servicio>('/servicios/', data);
    },

    // Actualizar servicio completo
    update: async (id: number, data: ServicioFormData): Promise<Servicio> => {
      return await put<Servicio>(`/servicios/${id}/`, data);
    },

    // Actualizar servicio parcialmente
    patch: async (id: number, data: Partial<ServicioFormData>): Promise<Servicio> => {
      return await patch<Servicio>(`/servicios/${id}/`, data);
    },

    // Eliminar servicio
    delete: async (id: number): Promise<void> => {
      return await del(`/servicios/${id}/`);
    },

    // Activar/desactivar servicio
    toggleActive: async (id: number, isActive: boolean): Promise<Servicio> => {
      return await patch<Servicio>(`/servicios/${id}/`, { is_active: isActive });
    },
  },

  // Salas
  salas: {
    list: async (): Promise<Sala[]> => {
      const response = await getWithPagination<Sala>('/servicios/salas/');
      return response.results;
    },

    get: async (id: number): Promise<Sala> => {
      return await get<Sala>(`/servicios/salas/${id}/`);
    },

    create: async (data: Omit<Sala, 'id' | 'categorias'>): Promise<Sala> => {
      return await post<Sala>('/servicios/salas/', data);
    },

    update: async (id: number, data: Partial<Sala>): Promise<Sala> => {
      return await patch<Sala>(`/servicios/salas/${id}/`, data);
    },

    delete: async (id: number): Promise<void> => {
      return await del(`/servicios/salas/${id}/`);
    },
  },
};