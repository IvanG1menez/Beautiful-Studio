'use client';

import TopBar from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Home,
  User,
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
      href: '/dashboard/profesional',
      active: pathname === '/dashboard/profesional',
    },
    {
      label: 'Mi Agenda',
      icon: Calendar,
      href: '/dashboard/profesional/agenda',
      active: pathname?.startsWith('/dashboard/profesional/agenda'),
    },
    {
      label: 'Turnos del Día',
      icon: Clock,
      href: '/dashboard/profesional/turnos-hoy',
      active: pathname?.startsWith('/dashboard/profesional/turnos-hoy'),
    },
    {
      label: 'Completar Turnos',
      icon: CheckSquare,
      href: '/dashboard/profesional/completar-turnos',
      active: pathname?.startsWith('/dashboard/profesional/completar-turnos'),
    },
    {
      label: 'Mis Clientes',
      icon: Users,
      href: '/dashboard/profesional/clientes',
      active: pathname?.startsWith('/dashboard/profesional/clientes'),
    },
    {
      label: 'Comisiones',
      icon: DollarSign,
      href: '/dashboard/profesional/comisiones',
      active: pathname?.startsWith('/dashboard/profesional/comisiones'),
    },
    {
      label: 'Mi Perfil',
      icon: User,
      href: '/dashboard/profesional/perfil',
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
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            ${isMobile ? 'absolute z-40' : 'relative'}
            transition-transform duration-300 ease-in-out
            w-64 bg-linear-to-b from-blue-900 to-blue-800 text-white
            flex flex-col
            h-full
          `}
        >
          <div className="p-4 border-b border-blue-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Panel Profesional</h3>
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="text-white hover:bg-blue-700"
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
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-colors duration-200
                    ${item.active
                      ? 'bg-white text-blue-900 shadow-md'
                      : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                    }
                  `}
                  onClick={() => isMobile && setSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-blue-700">
            <div className="text-xs text-blue-200">
              <p>Beautiful Studio</p>
              <p className="mt-1">Profesionales de la belleza</p>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-gray-50">
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
