// ========================================
// EJEMPLOS DE USO - UserHeader Component
// ========================================

// ===== EJEMPLO 1: Uso en Layout Principal =====
// app/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';
import UserHeader from '@/components/UserHeader';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <UserHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

// ===== EJEMPLO 2: Uso en Página Individual =====
// app/dashboard/page.tsx
import UserHeader from '@/components/UserHeader';

export default function DashboardPage() {
  return (
    <>
      <UserHeader />
      <div className="container mx-auto p-6">
        <h1>Dashboard</h1>
        {/* Tu contenido aquí */}
      </div>
    </>
  );
}

// ===== EJEMPLO 3: Con Layout Reutilizable =====
// components/MainLayout.tsx
import UserHeader from '@/components/UserHeader';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <UserHeader />
      <main>{children}</main>
    </div>
  );
}

// Uso en página:
// app/mi-pagina/page.tsx
import MainLayout from '@/components/MainLayout';

export default function MiPagina() {
  return (
    <MainLayout>
      <div className="p-6">Contenido de mi página</div>
    </MainLayout>
  );
}

// ===== EJEMPLO 4: Header Sticky (Fijo en el scroll) =====
// app/page.tsx
import UserHeader from '@/components/UserHeader';

export default function HomePage() {
  return (
    <>
      <UserHeader className="sticky top-0 z-50" />
      <div className="container mx-auto p-6">
        <h1>Página principal</h1>
        {/* Contenido largo para ver el efecto sticky */}
      </div>
    </>
  );
}

// ===== EJEMPLO 5: Condicional - Mostrar solo en ciertas páginas =====
// app/layout.tsx
'use client';

import { usePathname } from 'next/navigation';
import UserHeader from '@/components/UserHeader';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // No mostrar header en login y register
  const showHeader = !pathname.startsWith('/login') && !pathname.startsWith('/register');

  return (
    <>
      {showHeader && <UserHeader />}
      {children}
    </>
  );
}

// ===== EJEMPLO 6: Con Sidebar (Layout Completo) =====
// components/DashboardLayout.tsx
import UserHeader from '@/components/UserHeader';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <UserHeader />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// ===== EJEMPLO 7: Personalización con Props Adicionales =====
// Si necesitas extender el componente
// components/CustomHeader.tsx
import UserHeader from '@/components/UserHeader';
import { Button } from '@/components/ui/button';

export default function CustomHeader() {
  return (
    <div className="relative">
      <UserHeader />
      {/* Agregar banner o notificación adicional */}
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-center text-sm text-blue-800">
        🎉 ¡Bienvenido a Beautiful Studio! Reserva tu primer turno con 20% de descuento.
      </div>
    </div>
  );
}

// ===== EJEMPLO 8: Protected Layout (Solo Usuarios Autenticados) =====
// components/ProtectedLayout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import UserHeader from '@/components/UserHeader';
import { Loader2 } from 'lucide-react';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Verificando autenticación...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <UserHeader />
      <main>{children}</main>
    </div>
  );
}

// ===== EJEMPLO 9: Layout por Rol =====
// components/RoleBasedLayout.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import UserHeader from '@/components/UserHeader';
import AdminSidebar from '@/components/AdminSidebar';
import EmpleadoSidebar from '@/components/EmpleadoSidebar';

export default function RoleBasedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const getSidebar = () => {
    switch (user?.role) {
      case 'admin':
      case 'propietario':
        return <AdminSidebar />;
      case 'empleado':
      case 'profesional':
        return <EmpleadoSidebar />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <UserHeader />
      <div className="flex">
        {getSidebar()}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

// ===== EJEMPLO 10: Con Animación de Entrada =====
// components/AnimatedLayout.tsx
'use client';

import { motion } from 'framer-motion';
import UserHeader from '@/components/UserHeader';

export default function AnimatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <UserHeader />
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto p-6"
      >
        {children}
      </motion.main>
    </div>
  );
}

// ========================================
// NOTAS IMPORTANTES
// ========================================

/*
1. DEPENDENCIAS REQUERIDAS:
   - next (App Router)
   - react
   - @/contexts/AuthContext
   - shadcn/ui components (button, dropdown-menu, avatar, badge)
   - lucide-react

2. CONTEXTO REQUERIDO:
   El componente espera un AuthProvider con:
   - user: objeto con { first_name, last_name, email, username, role }
   - isAuthenticated: boolean
   - logout: función async

3. RUTAS QUE DEBEN EXISTIR:
   - /login
   - /register
   - /dashboard
   - /dashboard-admin
   - /dashboard-empleado
   - /dashboard-cliente
   - /configuracion

4. PERSONALIZACIÓN:
   - Modifica colores en las clases Tailwind
   - Ajusta la función getNavigationLinks() para tus rutas
   - Personaliza getRoleBadgeColor() para tus colores de badges

5. RESPONSIVE:
   - Desktop: Navegación horizontal
   - Mobile: Menú hamburguesa
   - Breakpoint: md (768px)
*/