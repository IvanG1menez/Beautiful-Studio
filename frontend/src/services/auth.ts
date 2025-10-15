import { 
  LoginCredentials, 
  LoginResponse, 
  RegisterData, 
  User 
} from '@/types';
import { post, get } from './api';

export const authService = {
  // Iniciar sesión
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await post<LoginResponse>('/users/login/', credentials);
    
    // Guardar token y usuario en localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    
    return response;
  },

  // Registrar nuevo usuario
  register: async (data: RegisterData): Promise<LoginResponse> => {
    return await post<LoginResponse>('/users/register/', data);
  },

  // Cerrar sesión
  logout: async (): Promise<void> => {
    try {
      await post('/users/logout/', {});
    } catch (error) {
      // Continuar incluso si falla la petición al servidor
    } finally {
      // Limpiar datos locales
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }
    }
  },

  // Obtener perfil del usuario actual
  getProfile: async (): Promise<User> => {
    return await get<User>('/users/profile/');
  },

  // Actualizar perfil del usuario
  updateProfile: async (data: Partial<User>): Promise<User> => {
    return await post<User>('/users/profile/', data);
  },

  // Verificar si el usuario está autenticado
  isAuthenticated: (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('auth_token');
  },

  // Obtener token del localStorage
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  },

  // Obtener usuario del localStorage
  getCurrentUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const userString = localStorage.getItem('user');
    return userString ? JSON.parse(userString) : null;
  },
};