'use client';

import TopBar from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { turnosService } from '@/services/turnos';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Home,
  Settings,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardProfesionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const loadSolicitudes = async () => {
      if (user?.role?.toLowerCase() !== 'profesional') {
        setSolicitudesPendientes(0);
        return;
      }

      try {
        const resumen = await turnosService.getSolicitudesFlexiblesResumen();
        setSolicitudesPendientes(resumen.pendientes || 0);
      } catch (error) {
        console.error('Error cargando resumen de solicitudes:', error);
      }
    };

    loadSolicitudes();
    const interval = setInterval(loadSolicitudes, 30000);
    return () => clearInterval(interval);
  }, [user?.role]);

  const menuItems = [
    {
      label: 'Inicio',
      icon: Home,
      href: '/dashboard/profesional',
      active: pathname === '/dashboard/profesional',
    },
    {
      label: 'Solicitudes Pendientes',
      icon: ClipboardList,
      href: '/dashboard/profesional#solicitudes-pendientes',
      active: pathname === '/dashboard/profesional' && typeof window !== 'undefined' && window.location.hash === '#solicitudes-pendientes',
    },
    {
      label: 'Mis Clientes',
      icon: Users,
      href: '/dashboard/profesional/clientes',
      active: pathname?.startsWith('/dashboard/profesional/clientes'),
    },
    {
      label: 'Configuración',
      icon: Settings,
      href: '/dashboard/profesional/perfil?tab=notificaciones',
      active: pathname?.startsWith('/dashboard/profesional/perfil'),
    },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        isMobileMenuOpen={sidebarOpen}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`
            ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
            ${isMobile ? 'absolute z-40' : 'relative'}
            ${sidebarOpen ? 'w-64' : 'w-20'}
            transition-all duration-300 ease-in-out
            bg-linear-to-b from-blue-900 to-blue-800 text-white
            flex flex-col
            h-full
          `}
        >
          <div className="p-4 border-b border-blue-700">
            <div className="flex items-center justify-between">
              {sidebarOpen && <h3 className="font-semibold text-lg">Panel Profesional</h3>}
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="text-white hover:bg-blue-700 ml-auto"
                  title={sidebarOpen ? 'Contraer menú' : 'Expandir menú'}
                >
                  {sidebarOpen ? (
                    <ChevronLeft className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const showBadge = item.label === 'Solicitudes Pendientes' && solicitudesPendientes > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!sidebarOpen ? item.label : undefined}
                  className={`
                    relative flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-colors duration-200
                    ${sidebarOpen ? '' : 'justify-center'}
                    ${item.active
                      ? 'bg-white text-blue-900 shadow-md'
                      : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                    }
                  `}
                  onClick={() => isMobile && setSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <span className="flex items-center gap-2 font-medium">
                      {item.label}
                      {showBadge && (
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-semibold text-white">
                          {solicitudesPendientes > 9 ? '9+' : solicitudesPendientes}
                        </span>
                      )}
                    </span>
                  )}
                  {!sidebarOpen && showBadge && (
                    <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </Link>
              );
            })}
          </nav>

          {sidebarOpen && (
            <div className="p-4 border-t border-blue-700 flex flex-col gap-3">
              <ThemeToggle />
              <div className="text-xs text-blue-200">
                <p>Beautiful Studio</p>
                <p className="mt-1">Profesionales de la belleza</p>
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>

        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
