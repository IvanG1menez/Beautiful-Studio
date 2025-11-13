'use client';

import { authService } from '@/services';
import { LoginCredentials, RegisterData, User } from '@/types';
import { useRouter } from 'next/navigation';
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
  const [sessionId] = useState(() => {
    // Generar un ID único para esta pestaña/sesión
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });
  const router = useRouter();

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

            // Guardar el sessionId al inicializar (para refrescos de página)
            sessionStorage.setItem('currentSessionId', sessionId);

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
  }, [sessionId, router]);

  // Detectar cambios en otras pestañas y cerrar sesión si cambia el usuario
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // SOLO actuar si hay un usuario logueado en esta pestaña
      if (!user) return;

      // Si el cambio es en lastLoginSessionId
      if (e.key === 'lastLoginSessionId') {
        const newSessionId = e.newValue;
        const currentSessionIdInTab = sessionStorage.getItem('currentSessionId');

        // Si el nuevo login NO es de esta pestaña y el sessionId es diferente
        if (newSessionId && currentSessionIdInTab && newSessionId !== currentSessionIdInTab) {
          // Verificar que realmente sea un usuario diferente
          const newUser = authService.getCurrentUser();
          if (newUser && newUser.id !== user.id) {
            // Otro usuario se logueó en otra pestaña
            alert('Se ha detectado un inicio de sesión con otra cuenta en otra pestaña. Esta sesión se cerrará.');
            authService.logout();
            setUser(null);
            router.push('/login');
          }
        }
      }

      // Si el cambio es en auth_token (logout en otra pestaña)
      if (e.key === 'auth_token' && e.newValue === null) {
        // Se cerró sesión en otra pestaña
        setUser(null);
        router.push('/login');
      }
    };

    // Escuchar cambios en localStorage desde otras pestañas
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, router, sessionId]);

  // Verificación periódica para detectar cambios de usuario (más conservadora)
  useEffect(() => {
    if (!user) return;

    const verificarUsuario = () => {
      const currentUser = authService.getCurrentUser();
      const currentToken = authService.getToken();

      // Solo cerrar sesión si NO hay token (logout en otra pestaña)
      // o si el usuario cambió Y hay un sessionId diferente guardado
      if (!currentToken) {
        // Se cerró sesión, limpiar
        setUser(null);
        router.push('/login');
        return;
      }

      if (currentUser && currentUser.id !== user.id) {
        const lastSessionId = localStorage.getItem('lastLoginSessionId');
        const currentSessionIdInTab = sessionStorage.getItem('currentSessionId');

        // Solo cerrar si el sessionId indica que fue un login desde otra pestaña
        if (lastSessionId && currentSessionIdInTab && lastSessionId !== currentSessionIdInTab) {
          console.log('Cambio de usuario detectado desde otra pestaña');
          alert('Se ha detectado un cambio de usuario. Esta sesión se cerrará.');
          setUser(null);
          router.push('/login');
        }
      }
    };

    // Verificar cada 5 segundos (menos agresivo)
    const intervalo = setInterval(verificarUsuario, 5000);

    return () => clearInterval(intervalo);
  }, [user, router]);

  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      const response = await authService.login(credentials);

      // Guardar el sessionId en sessionStorage para esta pestaña
      sessionStorage.setItem('currentSessionId', sessionId);
      localStorage.setItem('lastLoginSessionId', sessionId);

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