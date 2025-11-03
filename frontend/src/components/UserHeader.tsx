'use client';

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
  Calendar,
  Home,
  LogOut,
  Menu,
  Scissors,
  Settings,
  User,
  Users,
  X
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface UserHeaderProps {
  className?: string;
}

export default function UserHeader({ className = '' }: UserHeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Obtener iniciales del usuario
  const getUserInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
    }
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return 'US';
  };

  // Obtener nombre completo del usuario
  const getUserFullName = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user?.username) {
      return user.username;
    }
    return 'Usuario';
  };

  // Obtener el color del badge según el rol
  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
      case 'propietario':
      case 'superusuario':
        return 'bg-purple-100 text-purple-800';
      case 'empleado':
      case 'profesional':
        return 'bg-blue-100 text-blue-800';
      case 'cliente':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Obtener texto del rol en español
  const getRoleLabel = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'Administrador';
      case 'propietario':
        return 'Propietario';
      case 'superusuario':
        return 'Superusuario';
      case 'empleado':
        return 'Empleado';
      case 'profesional':
        return 'Profesional';
      case 'cliente':
        return 'Cliente';
      default:
        return role;
    }
  };

  // Manejar cierre de sesión
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Navegar al perfil según el rol
  const handleProfileClick = () => {
    switch (user?.role?.toLowerCase()) {
      case 'admin':
      case 'propietario':
      case 'superusuario':
        router.push('/dashboard-admin/perfil');
        break;
      case 'empleado':
      case 'profesional':
        router.push('/dashboard-empleado/perfil');
        break;
      case 'cliente':
        router.push('/dashboard-cliente/perfil');
        break;
      default:
        router.push('/perfil');
    }
  };

  // Obtener enlaces de navegación según el rol
  const getNavigationLinks = () => {
    if (!user) return [];

    const role = user.role?.toLowerCase();

    if (role === 'admin' || role === 'propietario' || role === 'superusuario') {
      return [
        { label: 'Dashboard', href: '/dashboard-admin', icon: Home },
        { label: 'Turnos', href: '/dashboard-admin/turnos', icon: Calendar },
        { label: 'Profesionales', href: '/dashboard-admin/profesionales', icon: Users },
        { label: 'Clientes', href: '/dashboard-admin/clientes', icon: User },
        { label: 'Servicios', href: '/dashboard-admin/servicios', icon: Scissors },
      ];
    }

    if (role === 'empleado' || role === 'profesional') {
      return [
        { label: 'Mi Dashboard', href: '/dashboard-empleado', icon: Home },
        { label: 'Mi Agenda', href: '/dashboard-empleado/agenda', icon: Calendar },
        { label: 'Turnos del Día', href: '/dashboard-empleado/turnos-hoy', icon: Calendar },
      ];
    }

    if (role === 'cliente') {
      return [
        { label: 'Mi Dashboard', href: '/dashboard-cliente', icon: Home },
        { label: 'Reservar Turno', href: '/dashboard-cliente/turnos/nuevo', icon: Calendar },
        { label: 'Mis Turnos', href: '/dashboard-cliente/turnos', icon: Calendar },
      ];
    }

    return [];
  };

  const navigationLinks = getNavigationLinks();

  return (
    <header className={`bg-white shadow-sm border-b ${className}`}>
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo y nombre del sistema */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:shadow-lg transition-shadow">
                <Scissors className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
                Beautiful Studio
              </span>
            </Link>
          </div>

          {/* Enlaces de navegación - Desktop */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center space-x-1">
              {navigationLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors flex items-center space-x-2"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Usuario y menú desplegable - Desktop */}
          {isAuthenticated && user ? (
            <div className="hidden md:flex items-center space-x-4">
              {/* Información del usuario */}
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {getUserFullName()}
                </p>
                <Badge
                  variant="secondary"
                  className={`text-xs ${getRoleBadgeColor(user.role)}`}
                >
                  {getRoleLabel(user.role)}
                </Badge>
              </div>

              {/* Dropdown menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full"
                  >
                    <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all">
                      <AvatarFallback className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
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

                  <DropdownMenuItem
                    onClick={handleProfileClick}
                    className="cursor-pointer"
                  >
                    <User className="mr-2 h-4 w-4" />
                    <span>Mi Perfil</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => router.push('/configuracion')}
                    className="cursor-pointer"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configuración</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="hidden md:flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push('/login')}
              >
                Iniciar Sesión
              </Button>
              <Button
                onClick={() => router.push('/register')}
                className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
              >
                Registrarse
              </Button>
            </div>
          )}

          {/* Botón de menú móvil */}
          {isAuthenticated && (
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Menú móvil */}
        {isAuthenticated && mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            {/* Usuario info móvil */}
            <div className="flex items-center space-x-3 px-4 py-3 mb-2">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {getUserFullName()}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <Badge
                  variant="secondary"
                  className={`text-xs mt-1 ${getRoleBadgeColor(user?.role || '')}`}
                >
                  {getRoleLabel(user?.role || '')}
                </Badge>
              </div>
            </div>

            <div className="space-y-1 px-2">
              {/* Enlaces de navegación móvil */}
              {navigationLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    <Icon className="w-5 h-5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              <div className="border-t my-2"></div>

              {/* Opciones de usuario móvil */}
              <button
                onClick={() => {
                  handleProfileClick();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors w-full"
              >
                <User className="w-5 h-5" />
                <span>Mi Perfil</span>
              </button>

              <button
                onClick={() => {
                  router.push('/configuracion');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors w-full"
              >
                <Settings className="w-5 h-5" />
                <span>Configuración</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors w-full"
              >
                <LogOut className="w-5 h-5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}