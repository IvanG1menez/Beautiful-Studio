'use client';

import TopBar from '@/components/layout/TopBar';
import TelegramFloatingButton from '@/components/TelegramFloatingButton';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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

  const menuItems = [
    {
      label: 'Inicio',
      icon: Home,
      href: '/dashboard/cliente',
      active: pathname === '/dashboard/cliente',
    },
    {
      label: 'Historial de citas',
      icon: Clock,
      href: '/dashboard/cliente/turnos?filter=pasados',
      active: pathname === '/dashboard/cliente/turnos' && searchParams.get('filter') === 'pasados',
    },
    {
      label: 'Servicios',
      icon: Star,
      href: '/dashboard/cliente/servicios',
      active: pathname?.startsWith('/dashboard/cliente/servicios'),
    },
    {
      label: 'Turnos',
      icon: Calendar,
      href: '/dashboard/cliente/turnos',
      active: pathname?.startsWith('/dashboard/cliente/turnos'),
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
            bg-linear-to-b from-purple-900 to-purple-800 text-white
            flex flex-col
            h-full
          `}
        >
          <div className="p-4 border-b border-purple-700">
            <div className="flex items-center justify-between">
              {sidebarOpen && <h3 className="font-semibold text-lg">Mi Portal</h3>}
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="text-white hover:bg-purple-700 ml-auto"
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
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!sidebarOpen ? item.label : undefined}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-colors duration-200
                    ${sidebarOpen ? '' : 'justify-center'}
                    ${item.active
                      ? 'bg-white text-purple-900 shadow-md'
                      : 'text-purple-100 hover:bg-purple-700 hover:text-white'
                    }
                  `}
                  onClick={() => isMobile && setSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {sidebarOpen && <span className="font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-purple-700">
            {sidebarOpen ? (
              <Link
                href="/dashboard/cliente/perfil?tab=notificaciones"
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${pathname?.startsWith('/dashboard/cliente/perfil')
                  ? 'bg-white text-purple-900'
                  : 'text-purple-100 hover:bg-purple-700 hover:text-white'
                  }`}
              >
                <span className="text-lg">⚙️</span>
                <span>Ajustes</span>
              </Link>
            ) : (
              <Link href="/dashboard/cliente/perfil?tab=notificaciones" className="text-lg" title="Ajustes">
                ⚙️
              </Link>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>

        <TelegramFloatingButton />

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
