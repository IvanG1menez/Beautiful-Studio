'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  CalendarDays,
  Users,
  UserCheck,
  Scissors,
  BarChart3,
  Settings,
  Home,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Turnos', href: '/turnos', icon: CalendarDays },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Empleados', href: '/empleados', icon: UserCheck },
  { name: 'Servicios', href: '/servicios', icon: Scissors },
  { name: 'Configuración', href: '/configuracion', icon: Settings },
];

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  // Filtrar navegación basada en el rol del usuario
  const filteredNavigation = navigation.filter(item => {
    if (user?.role === 'cliente') {
      return ['Dashboard', 'Turnos'].includes(item.name);
    }
    if (user?.role === 'empleado') {
      return !['Empleados', 'Configuración'].includes(item.name);
    }
    return true; // Admin ve todo
  });

  return (
    <div className={cn("pb-12 min-h-screen", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 transition-colors',
                    isActive
                      ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'text-gray-700'
                  )}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}