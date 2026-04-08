'use client';

import { NotificationBell } from '@/components/NotificationBell';
import { BeautifulSpinner } from '@/components/ui/BeautifulSpinner';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/auth-headers';
import { formatCurrency } from '@/lib/utils';
import type { Billetera, MovimientoBilletera } from '@/types';
import {
  ChevronDown,
  LogOut,
  Menu,
  Settings,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
      'propietario': { label: 'Propietario', variant: 'destructive' },
      'superusuario': { label: 'Superusuario', variant: 'destructive' },
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

    if (role === 'propietario' || role === 'superusuario') {
      return '/dashboard/propietario/perfil';
    }

    if (role === 'profesional') {
      return '/dashboard/profesional/perfil';
    }

    if (role === 'cliente') {
      return '/dashboard/cliente/perfil';
    }

    return '/perfil'; // Fallback
  };

  // Obtener ruta de configuración según el rol
  const getSettingsRoute = () => {
    const role = user?.role?.toLowerCase();

    if (role === 'propietario' || role === 'superusuario') {
      // Configuración global del estudio
      return '/dashboard/propietario/configuracion';
    }

    if (role === 'profesional') {
      // Pestaña de notificaciones dentro del perfil del profesional
      return '/dashboard/profesional/perfil?tab=notificaciones';
    }

    if (role === 'cliente') {
      // Pestaña de notificaciones dentro del perfil del cliente
      return '/dashboard/cliente/perfil?tab=notificaciones';
    }

    // Fallback a configuración general si existiera
    return '/configuracion';
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
      <div className={`bg-card/80 backdrop-blur border-b border-border px-4 py-3 ${className}`}>
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
              <h2 className="text-lg font-semibold text-foreground">
                Beautiful Studio
              </h2>
            </div>
          </div>

          {/* Lado derecho - Usuario y acciones */}
          <div className="flex items-center gap-3">
            {/* Notificaciones */}
            <NotificationBell />

            {/* Billetera cliente */}
            {user.role?.toLowerCase() === 'cliente' && (
              <ClientWalletQuickAccess />
            )}

            {/* Separador */}
            <div className="h-6 w-px bg-border"></div>

            {/* Menú de usuario */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 hover:bg-accent">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium text-foreground">
                      {getUserFullName()}
                    </span>
                    <div className="flex items-center gap-1">
                      {getRoleBadge()}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
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

                <DropdownMenuItem onClick={() => router.push(getSettingsRoute())}>
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

function ClientWalletQuickAccess() {
  const { user } = useAuth();
  const [billetera, setBilletera] = useState<Billetera | null>(null);
  const [loadingBilletera, setLoadingBilletera] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoBilletera[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);

  const role = user?.role?.toLowerCase();

  const loadBilletera = async () => {
    try {
      setLoadingBilletera(true);
      const response = await fetch('/api/clientes/me/billetera/', {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setBilletera(data);
      }
    } catch (error) {
      console.error('Error loading billetera:', error);
    } finally {
      setLoadingBilletera(false);
    }
  };

  const loadMovimientos = async () => {
    try {
      setLoadingMovimientos(true);
      const response = await fetch('/api/clientes/me/billetera/movimientos/', {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setMovimientos(data);
      }
    } catch (error) {
      console.error('Error loading movimientos:', error);
    } finally {
      setLoadingMovimientos(false);
    }
  };

  // Cargar billetera al montar para clientes
  useEffect(() => {
    if (role === 'cliente') {
      loadBilletera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (role !== 'cliente') return;

    const handleWalletUpdated = () => {
      loadBilletera();
    };

    window.addEventListener('wallet-updated', handleWalletUpdated);
    return () => {
      window.removeEventListener('wallet-updated', handleWalletUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (role !== 'cliente') {
    return null;
  }

  const saldoNumber = billetera ? parseFloat(billetera.saldo) : 0;
  const fechaVencimientoTexto = billetera?.fecha_vencimiento
    ? new Date(billetera.fecha_vencimiento).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    : null;

  const handleOpen = async () => {
    setDialogOpen(true);
    await loadMovimientos();
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
        onClick={handleOpen}
        disabled={loadingBilletera}
        title="Tu billetera"
      >
        <Wallet className="h-5 w-5" />
        <span className="font-semibold">
          {loadingBilletera ? '...' : formatCurrency(saldoNumber)}
        </span>
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tu Billetera</DialogTitle>
            <DialogDescription>
              Auditoría de movimientos y crédito disponible para tus próximas reservas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-700/60 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-green-800 font-medium">Saldo disponible</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(saldoNumber)}
                  </p>
                  {fechaVencimientoTexto && (
                    <p className="text-xs text-green-800 mt-1">
                      Credito vigente hasta el {fechaVencimientoTexto}
                      {billetera?.esta_por_vencer && (
                        <span className="ml-1 font-semibold text-amber-600">(próximo a vencer)</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm text-green-800 max-w-xs text-right">
                Cancela turnos con anticipación para acumular crédito y usarlo en tus próximas reservas.
              </p>
            </div>

            {loadingMovimientos ? (
              <div className="flex items-center justify-center py-8">
                <BeautifulSpinner label="Cargando movimientos de tu billetera..." />
              </div>
            ) : movimientos.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <p>No hay movimientos registrados aún.</p>
                <p className="mt-2 text-green-700">
                  Cancela turnos con anticipación para empezar a acumular crédito.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {movimientos.map((mov) => (
                  <div
                    key={mov.id}
                    className="border rounded-lg p-4 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {mov.tipo === 'credito' ? (
                            <div className="p-1.5 bg-green-100 rounded-full">
                              <TrendingUp className="w-4 h-4 text-green-600" />
                            </div>
                          ) : (
                            <div className="p-1.5 bg-red-100 rounded-full">
                              <TrendingDown className="w-4 h-4 text-red-600" />
                            </div>
                          )}
                          <span className="font-semibold">{mov.tipo_display}</span>
                          <span
                            className={`text-sm font-semibold px-2 py-0.5 rounded-full ${mov.tipo === 'credito'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                              }`}
                          >
                            {mov.tipo === 'credito' ? '+' : '-'}
                            {formatCurrency(parseFloat(mov.monto))}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          {mov.descripcion || 'Sin descripción'}
                        </p>

                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            Saldo anterior: {formatCurrency(parseFloat(mov.saldo_anterior))}
                          </span>
                          <span>→</span>
                          <span className="font-semibold">
                            Saldo nuevo: {formatCurrency(parseFloat(mov.saldo_nuevo))}
                          </span>
                        </div>
                      </div>

                      <div className="text-right text-xs text-muted-foreground ml-4">
                        <p>{new Date(mov.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}</p>
                        <p>{new Date(mov.created_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
