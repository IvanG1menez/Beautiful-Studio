'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Settings,
  User,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface TopBarProps {
  className?: string;
  onMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

export default function TopBar({ className = '', onMenuToggle, isMobileMenuOpen }: TopBarProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Obtener iniciales del usuario
  const getUserInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
    }
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Obtener nombre completo del usuario
  const getUserFullName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user?.username || 'Usuario';
  };

  // Obtener badge de rol
  const getRoleBadge = () => {
    const roleMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'admin': { label: 'Administrador', variant: 'destructive' },
      'propietario': { label: 'Propietario', variant: 'destructive' },
      'empleado': { label: 'Empleado', variant: 'default' },
      'profesional': { label: 'Profesional', variant: 'default' },
      'cliente': { label: 'Cliente', variant: 'outline' },
    };

    const roleInfo = roleMap[user?.role || ''] || { label: user?.role || 'Usuario', variant: 'outline' as const };

    return (
      <Badge variant={roleInfo.variant} className="text-xs">
        {roleInfo.label}
      </Badge>
    );
  };

  // Obtener ruta de perfil según el rol
  const getProfileRoute = () => {
    const role = user?.role?.toLowerCase();

    if (role === 'admin' || role === 'propietario' || role === 'superusuario') {
      return '/dashboard-admin/perfil';
    }

    if (role === 'empleado' || role === 'profesional') {
      return '/dashboard-empleado/perfil';
    }

    if (role === 'cliente') {
      return '/dashboard-cliente/perfil';
    }

    return '/perfil'; // Fallback
  };

  // Manejar logout con confirmación
  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleConfirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setIsLoggingOut(false);
      setLogoutDialogOpen(false);
    }
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <>
      <div className={`bg-white border-b border-gray-200 px-4 py-3 ${className}`}>
        <div className="flex items-center justify-between">
          {/* Lado izquierdo - Botón menú móvil (opcional) */}
          <div className="flex items-center gap-4">
            {onMenuToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMenuToggle}
                className="md:hidden"
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            )}

            {/* Logo o Título */}
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-800">
                Beautiful Studio
              </h2>
            </div>
          </div>

          {/* Lado derecho - Usuario y acciones */}
          <div className="flex items-center gap-3">
            {/* Notificaciones (opcional) */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              {/* Badge de notificaciones no leídas */}
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </Button>

            {/* Separador */}
            <div className="h-6 w-px bg-gray-300"></div>

            {/* Menú de usuario */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 hover:bg-gray-100">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium text-gray-900">
                      {getUserFullName()}
                    </span>
                    <div className="flex items-center gap-1">
                      {getRoleBadge()}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {getUserFullName()}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => router.push(getProfileRoute())}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Mi Perfil</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => router.push('/configuracion')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configuración</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleLogoutClick}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Modal de confirmación de logout */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas cerrar tu sesión? Tendrás que iniciar sesión nuevamente para acceder a tu cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLogout}
              disabled={isLoggingOut}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoggingOut ? 'Cerrando sesión...' : 'Cerrar Sesión'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
