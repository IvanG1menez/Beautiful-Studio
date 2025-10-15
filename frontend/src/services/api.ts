import { ApiError, ApiResponse } from '@/types';
import axios, { AxiosResponse } from 'axios';

// Configuración base de Axios
const API_BASE_URL = "http://localhost:8000/api"; // Cambiado a localhost

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token de autenticación
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Token ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas y errores
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    // No redireccionar en endpoints de autenticación
    const isAuthEndpoint = error.config?.url?.includes('/users/login/') ||
      error.config?.url?.includes('/users/register/');

    if (error.response?.status === 401 && !isAuthEndpoint) {
      // Token expirado o inválido (solo para endpoints protegidos)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Función helper para manejar errores de API
export const handleApiError = (error: any): ApiError => {
  if (error.response?.data) {
    // Manejar diferentes formatos de error del backend Django
    let message = 'Error en la solicitud';
    let errors = undefined;

    if (typeof error.response.data === 'string') {
      message = error.response.data;
    } else if (error.response.data.error) {
      // Formato del backend: { error: "mensaje", error_code: "codigo" }
      message = error.response.data.error;
    } else if (error.response.data.message) {
      message = error.response.data.message;
    } else if (error.response.data.detail) {
      message = error.response.data.detail;
    } else if (error.response.data.non_field_errors) {
      message = Array.isArray(error.response.data.non_field_errors)
        ? error.response.data.non_field_errors[0]
        : error.response.data.non_field_errors;
    } else {
      // Si hay errores de campo específicos
      errors = error.response.data;
      const firstError = Object.values(error.response.data)[0];
      if (Array.isArray(firstError)) {
        message = firstError[0];
      } else if (typeof firstError === 'string') {
        message = firstError;
      }
    }

    return {
      message,
      errors,
    };
  }

  // Error de red o timeout
  if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
    return {
      message: 'Error de conexión. Verifica tu conexión a internet.',
    };
  }

  return {
    message: error.message || 'Error inesperado. Intenta nuevamente.',
  };
};

// Función helper para hacer peticiones GET con paginación
export const getWithPagination = async <T>(
  endpoint: string,
  params?: Record<string, any>
): Promise<ApiResponse<T>> => {
  try {
    const response = await apiClient.get<ApiResponse<T>>(endpoint, { params });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Función helper para hacer peticiones GET simples
export const get = async <T>(endpoint: string): Promise<T> => {
  try {
    const response = await apiClient.get<T>(endpoint);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Función helper para hacer peticiones POST
export const post = async <T>(endpoint: string, data: any): Promise<T> => {
  try {
    const response = await apiClient.post<T>(endpoint, data);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Función helper para hacer peticiones PUT
export const put = async <T>(endpoint: string, data: any): Promise<T> => {
  try {
    const response = await apiClient.put<T>(endpoint, data);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Función helper para hacer peticiones PATCH
export const patch = async <T>(endpoint: string, data: any): Promise<T> => {
  try {
    const response = await apiClient.patch<T>(endpoint, data);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

// Función helper para hacer peticiones DELETE
export const del = async (endpoint: string): Promise<void> => {
  try {
    await apiClient.delete(endpoint);
  } catch (error) {
    throw handleApiError(error);
  }
};

export default apiClient;