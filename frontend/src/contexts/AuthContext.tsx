'use client';

import { authService } from '@/services';
import { LoginCredentials, RegisterData, User } from '@/types';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: User | null;
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
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Verificar autenticación al cargar la aplicación
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedUser = authService.getCurrentUser();
        const token = authService.getToken();

        if (savedUser && token) {
          // Verificar si el token sigue siendo válido
          try {
            const currentUser = await authService.getProfile();
            setUser(currentUser);
          } catch (error) {
            // Token inválido, limpiar datos
            await authService.logout();
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Error al inicializar autenticación:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      const response = await authService.login(credentials);
      setUser(response.user);
    } catch (error: any) {
      // Re-lanzar el error con el mensaje procesado
      const errorMessage = error.message || 'Error al iniciar sesión';
      console.error('Error de login:', error);
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
    } catch (error: any) {
      // Re-lanzar el error con el mensaje procesado
      const errorMessage = error.message || 'Error al registrar usuario';
      console.error('Error de registro:', error);
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
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Aunque falle la petición al servidor, limpiar datos locales
      setUser(null);
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