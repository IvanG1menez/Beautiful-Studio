'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, Loader2, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
  fallbackComponent?: React.ReactNode;
}

export default function ProtectedRoute({
  children,
  allowedRoles = [],
  redirectTo = '/login',
  fallbackComponent
}: ProtectedRouteProps) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  // Verificar que estamos en el cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Efecto para manejar redirecciones
  useEffect(() => {
    if (!isClient || authLoading) return;

    // Si no hay usuario autenticado, redirigir al login
    if (!user) {
      const token = localStorage.getItem('auth_token');
      const savedUser = localStorage.getItem('user');

      if (!token || !savedUser) {
        router.push(redirectTo);
        return;
      }

      // Si hay datos en localStorage pero no en el contexto, intentar cargarlos
      try {
        const userData = JSON.parse(savedUser);
        // El contexto se encargará de validar el token
      } catch (error) {
        console.error('Error parsing user data:', error);
        router.push(redirectTo);
        return;
      }
    }

    // Si hay roles específicos permitidos, verificar el rol del usuario
    if (user && allowedRoles.length > 0) {
      if (!allowedRoles.includes(user.role)) {
        // Si el usuario no tiene el rol permitido, redirigir según su rol
        switch (user.role) {
          case 'cliente':
            router.push('/dashboard/cliente');
            break;
          case 'profesional':
            router.push('/dashboard/profesional');
            break;
          case 'propietario':
          case 'superusuario':
            router.push('/dashboard/propietario');
            break;
          default:
            router.push('/dashboard');
        }
        return;
      }
    }
  }, [user, authLoading, isClient, allowedRoles, router, redirectTo]);

  // Mostrar loading durante la verificación de autenticación
  if (!isClient || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado, mostrar loading (la redirección se maneja en useEffect)
  if (!user) {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Redirigiendo al login...</p>
          </div>
        </div>
      );
    }

    // Si hay token pero no user en contexto, mostrar loading
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Cargando datos del usuario...</p>
        </div>
      </div>
    );
  }

  // Verificar roles si están especificados
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Si se proporciona un componente fallback, usarlo
    if (fallbackComponent) {
      return <>{fallbackComponent}</>;
    }

    // Componente por defecto para acceso no autorizado
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-xl font-bold text-gray-900">
              Acceso No Autorizado
            </CardTitle>
            <CardDescription>
              No tienes permisos para acceder a esta página
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-gray-600">
              Tu rol actual: <span className="font-medium">{user.role}</span>
            </p>
            <p className="text-sm text-gray-600">
              Roles permitidos: <span className="font-medium">{allowedRoles.join(', ')}</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => {
                  // Redirigir al dashboard apropiado según el rol
                  switch (user.role) {
                    case 'cliente':
                      router.push('/dashboard/cliente');
                      break;
                    case 'profesional':
                      router.push('/dashboard/profesional');
                      break;
                    case 'propietario':
                    case 'superusuario':
                      router.push('/dashboard/propietario');
                      break;
                    default:
                      router.push('/dashboard');
                  }
                }}
                className="flex-1"
              >
                <Shield className="w-4 h-4 mr-2" />
                Ir a Mi Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/')}
                className="flex-1"
              >
                Ir al Inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si todo está bien, renderizar el contenido protegido
  return <>{children}</>;
}

// Hook personalizado para verificar roles específicos
export const useRoleCheck = (requiredRoles: string[]) => {
  const { user } = useAuth();

  const hasRole = (role: string) => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: string[]) => {
    return user ? roles.includes(user.role) : false;
  };

  const isAuthorized = hasAnyRole(requiredRoles);

  return {
    user,
    hasRole,
    hasAnyRole,
    isAuthorized,
    userRole: user?.role
  };
};