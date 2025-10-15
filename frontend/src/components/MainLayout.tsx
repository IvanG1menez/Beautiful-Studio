'use client';

import UserHeader from '@/components/UserHeader';
import { ReactNode } from 'react';

interface MainLayoutProps {
  children: ReactNode;
}

/**
 * Layout principal con header de usuario
 * Úsalo en páginas que requieran navegación y autenticación
 * 
 * @example
 * ```tsx
 * import MainLayout from '@/components/MainLayout';
 * 
 * export default function MyPage() {
 *   return (
 *     <MainLayout>
 *       <div>Contenido de tu página</div>
 *     </MainLayout>
 *   );
 * }
 * ```
 */
export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <UserHeader />
      <main className="pb-8">
        {children}
      </main>

      {/* Footer opcional */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>© 2025 Beautiful Studio. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}