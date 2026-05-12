'use client';

import TopBar from '@/components/layout/TopBar';
import TelegramFloatingButton from '@/components/TelegramFloatingButton';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  Moon,
  Star,
  Sun,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
              <div className="flex items-center justify-between gap-3">
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

                <button
                  type="button"
                  role="switch"
                  aria-checked={theme === 'dark'}
                  onClick={toggleTheme}
                  className="inline-flex items-center gap-2 rounded-full border border-purple-400/60 bg-purple-700/40 px-3 py-2 text-sm text-white"
                  aria-label="Cambiar modo claro u oscuro"
                  title={theme === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado'}
                >
                  <Sun className={`h-4 w-4 transition-opacity ${theme === 'dark' ? 'opacity-40' : 'opacity-100'} text-amber-300`} />
                  <span
                    className={`relative h-7 w-14 rounded-full border border-white/20 transition-colors ${theme === 'dark' ? 'bg-slate-900' : 'bg-amber-500'
                      }`}
                  >
                    <span
                      className={`absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-7' : 'translate-x-0.5'
                        }`}
                    >
                      {theme === 'dark' ? (
                        <Moon className="h-3.5 w-3.5 text-indigo-500" />
                      ) : (
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </span>
                  </span>
                  <Moon className={`h-4 w-4 transition-opacity ${theme === 'dark' ? 'opacity-100' : 'opacity-40'} text-indigo-200`} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Link href="/dashboard/cliente/perfil?tab=notificaciones" className="text-lg" title="Ajustes">
                  ⚙️
                </Link>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-purple-400/60 bg-purple-700/40"
                  aria-label="Cambiar tema"
                  title="Tema claro/oscuro"
                >
                  {theme === 'dark' ? <Moon className="h-4 w-4 text-indigo-200" /> : <Sun className="h-4 w-4 text-amber-300" />}
                </button>
              </div>
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
