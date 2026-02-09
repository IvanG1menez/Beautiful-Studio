'use client';

import { authService } from '@/services';
import { LoginCredentials, RegisterData, User } from '@/types';
import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!user;

  // Verificar autenticación al cargar la aplicación
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedUser = authService.getCurrentUser();
        const token = authService.getToken();

        console.log('[AuthContext] initAuth - savedUser:', savedUser);
        console.log('[AuthContext] initAuth - token existe:', !!token);

        if (savedUser && token) {
          // Verificar si el token sigue siendo válido
          try {
            console.log('[AuthContext] Verificando token con getProfile...');
            const currentUser = await authService.getProfile();
            console.log('[AuthContext] Token válido, usuario cargado:', currentUser);
            setUser(currentUser);
            setToken(token);
          } catch (error) {
            // Token inválido, limpiar datos
            console.error('[AuthContext] Token inválido o error en getProfile:', error);
            console.log('[AuthContext] Limpiando sesión...');
            await authService.logout();
            setUser(null);
            setToken(null);
          }
        } else {
          console.log('[AuthContext] No hay usuario guardado o token');
        }
      } catch (error) {
        console.error('Error al inicializar autenticación:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [router]);

  // Detectar cambios en otras pestañas y cerrar sesión si cambia el usuario
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // SOLO actuar si hay un usuario logueado en esta pestaña
      if (!user) return;

      // Si el cambio es en auth_token (logout en otra pestaña)
      if (e.key === 'auth_token' && e.newValue === null) {
        // Se cerró sesión en otra pestaña
        console.log('Sesión cerrada en otra pestaña');
        setUser(null);
        setToken(null);
        // Redirigir usando window.location para evitar error de listener asíncrono
        window.location.href = '/login';
      }
    };

    // Escuchar cambios en localStorage desde otras pestañas
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, router]);

  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      const response = await authService.login(credentials);

      let userData = response.user;

      // Si el usuario es profesional, cargar también su perfil de empleado
      if (userData.role === 'profesional' || userData.role === 'empleado') {
        try {
          const token = localStorage.getItem('auth_token');
          const empleadoResponse = await fetch('http://localhost:8000/api/empleados/me/', {
            headers: {
              'Authorization': `Token ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (empleadoResponse.ok) {
            const empleadoData = await empleadoResponse.json();
            // Agregar el empleado_id al objeto de usuario
            userData = {
              ...userData,
              empleado_id: empleadoData.id
            };
            // Actualizar el localStorage con el empleado_id
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (error) {
          console.error('Error al cargar perfil de empleado:', error);
          // Continuar de todos modos con los datos del usuario
        }
      }

      setUser(userData);
      setToken(authService.getToken());
    } catch (error: any) {
      // Re-lanzar el error con el mensaje procesado
      const errorMessage = error?.message || 'Error al iniciar sesión';
      console.error('Error de login:', errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    try {
      setIsLoading(true);
      const response = await authService.register(data);
      setUser(response.user);
      setToken(authService.getToken());
    } catch (error: any) {
      // Re-lanzar el error con el mensaje procesado
      const errorMessage = error?.message || 'Error al registrar usuario';
      console.error('Error de registro:', errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Aunque falle la petición al servidor, limpiar datos locales
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      // Actualizar también en localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};