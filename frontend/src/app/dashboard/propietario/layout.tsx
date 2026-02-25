'use client';

import TopBar from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  History,
  LayoutDashboard,
  MessageSquare,
  PieChart,
  Scissors,
  Target,
  TrendingUp,
  User,
  Users,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardPropietarioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  // Detectar tamaño de pantalla
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
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/dashboard/propietario',
      active: pathname === '/dashboard/propietario',
    },
    {
      label: 'Clientes',
      icon: Users,
      href: '/dashboard/propietario/clientes',
      active: pathname?.startsWith('/dashboard/propietario/clientes'),
    },
    {
      label: 'Profesionales',
      icon: Scissors,
      href: '/dashboard/propietario/profesionales',
      active: pathname?.startsWith('/dashboard/propietario/profesionales'),
    },
    {
      label: 'Servicios',
      icon: Scissors,
      href: '/dashboard/propietario/servicios',
      active: pathname?.startsWith('/dashboard/propietario/servicios'),
    },
    {
      label: 'Reportes',
      icon: PieChart,
      active: pathname?.startsWith('/dashboard/propietario/reportes'),
      submenu: [
        {
          label: 'Resumen Financiero',
          icon: TrendingUp,
          href: '/dashboard/propietario/reportes/finanzas',
          active: pathname === '/dashboard/propietario/reportes/finanzas',
        },
        {
          label: 'Rendimiento de Servicios',
          icon: FileText,
          href: '/dashboard/propietario/reportes/servicios',
          active: pathname === '/dashboard/propietario/reportes/servicios',
        },
        {
          label: 'Auditoría de Billetera',
          icon: Wallet,
          href: '/dashboard/propietario/reportes/billetera',
          active: pathname === '/dashboard/propietario/reportes/billetera',
        },
      ],
    },
    {
      label: 'Encuestas',
      icon: MessageSquare,
      href: '/dashboard/propietario/encuestas',
      active: pathname?.startsWith('/dashboard/propietario/encuestas'),
    },
    {
      label: 'Oportunidades',
      icon: Target,
      href: '/dashboard/propietario/oportunidades',
      active: pathname?.startsWith('/dashboard/propietario/oportunidades'),
    },
    {
      label: 'Historial',
      icon: History,
      href: '/dashboard/propietario/historial',
      active: pathname?.startsWith('/dashboard/propietario/historial'),
    },
    {
      label: 'Notificaciones',
      icon: Bell,
      href: '/dashboard/propietario/notificaciones',
      active: pathname?.startsWith('/dashboard/propietario/notificaciones'),
    },
    {
      label: 'Mi Perfil',
      icon: User,
      href: '/dashboard/propietario/perfil',
      active: pathname?.startsWith('/dashboard/propietario/perfil'),
    },
  ];

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Bar */}
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
            w-64 bg-gray-900 text-white
            flex flex-col
            h-full
          `}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Panel Propietario</h3>
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="text-white hover:bg-gray-800"
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

          {/* Menu Items */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const hasSubmenu = item.submenu && item.submenu.length > 0;
              const isExpanded = expandedMenus.includes(item.label);

              return (
                <div key={item.label}>
                  {hasSubmenu ? (
                    <>
                      {/* Item con submenú */}
                      <button
                        onClick={() => toggleMenu(item.label)}
                        className={`
                          w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg
                          transition-colors duration-200
                          ${item.active
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5" />
                          <span className="font-medium">{item.label}</span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      {/* Submenú */}
                      {isExpanded && (
                        <div className="ml-4 mt-1 space-y-1">
                          {item.submenu.map((subItem) => {
                            const SubIcon = subItem.icon;
                            return (
                              <Link
                                key={subItem.href}
                                href={subItem.href}
                                className={`
                                  flex items-center gap-3 px-4 py-2 rounded-lg text-sm
                                  transition-colors duration-200
                                  ${subItem.active
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                  }
                                `}
                                onClick={() => isMobile && setSidebarOpen(false)}
                              >
                                <SubIcon className="h-4 w-4" />
                                <span>{subItem.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Item sin submenú */
                    <Link
                      href={item.href || '#'}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg
                        transition-colors duration-200
                        ${item.active
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                        }
                      `}
                      onClick={() => isMobile && setSidebarOpen(false)}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs text-gray-400">
              <p>Beautiful Studio v1.0</p>
              <p className="mt-1">© 2025 Todos los derechos reservados</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>

        {/* Overlay para móvil */}
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
