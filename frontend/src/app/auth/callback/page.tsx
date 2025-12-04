'use client';

import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const processCallback = () => {
      try {
        // Obtener token y datos del usuario de la URL
        const token = searchParams.get('token');
        const userJson = searchParams.get('user');

        console.log('[AuthCallback] Token recibido:', !!token);
        console.log('[AuthCallback] User data recibido:', !!userJson);

        if (token && userJson) {
          // Parsear datos del usuario
          const user = JSON.parse(userJson);

          console.log('[AuthCallback] Usuario:', user);

          // Guardar en localStorage
          localStorage.setItem('auth_token', token);
          localStorage.setItem('user', JSON.stringify(user));

          console.log('[AuthCallback] Token y usuario guardados en localStorage');

          // Redirigir según el rol del usuario
          let redirectUrl = '/dashboard/cliente'; // Por defecto

          if (user.role === 'propietario') {
            redirectUrl = '/dashboard/propietario';
          } else if (user.role === 'profesional') {
            redirectUrl = '/dashboard/profesional';
          } else if (user.role === 'cliente') {
            redirectUrl = '/dashboard/cliente';
          }

          console.log('[AuthCallback] Redirigiendo a:', redirectUrl);

          // Redirigir al dashboard correspondiente
          router.push(redirectUrl);
        } else {
          console.error('[AuthCallback] No se recibió token o datos de usuario');
          // Redirigir al login si no hay datos
          router.push('/login?error=no_token');
        }
      } catch (error) {
        console.error('[AuthCallback] Error procesando callback:', error);
        router.push('/login?error=callback_failed');
      }
    };

    processCallback();
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Completando inicio de sesión...
        </h2>
        <p className="text-gray-600">
          Por favor espera un momento
        </p>
      </div>
    </div>
  );
}
