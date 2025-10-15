'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, Scissors } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const router = useRouter();

  // Helper para debugging
  const logDebugInfo = (errorData: any) => {
    console.group('🔍 Debug Info - Login Error');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Email:', email.trim());
    console.log('API Base URL:', process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api');
    console.log('Error Object:', errorData);
    if (errorData.response) {
      console.log('Status:', errorData.response.status);
      console.log('Status Text:', errorData.response.statusText);
      console.log('Response Data:', errorData.response.data);
    }
    console.groupEnd();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validaciones del lado del cliente
    if (!email.trim()) {
      setError('El email es requerido');
      setIsLoading(false);
      return;
    }

    if (!password.trim()) {
      setError('La contraseña es requerida');
      setIsLoading(false);
      return;
    }

    try {
      await login({ email: email.trim(), password });

      // 🎯 LÓGICA DE REDIRECCIÓN POR ROL
      // Obtener el usuario desde localStorage después del login exitoso
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        const userRole = userData.role;

        console.log('🔍 Login exitoso - Rol del usuario:', userRole);

        // Redireccionar según el rol del usuario
        switch (userRole) {
          case 'cliente':
            console.log('📱 Redirigiendo a dashboard de cliente');
            router.push('/dashboard-cliente');
            break;
          case 'empleado':
          case 'profesional':
            console.log('👨‍💼 Redirigiendo a dashboard de empleado');
            router.push('/dashboard-empleado');
            break;
          case 'propietario':
          case 'superusuario':
          case 'admin':
            console.log('👑 Redirigiendo a dashboard de administrador');
            router.push('/dashboard-admin');
            break;
          default:
            console.log('🔄 Rol no reconocido, redirigiendo a dashboard general');
            router.push('/dashboard');
        }

        toast.success(`¡Bienvenido de vuelta, ${userData.first_name || 'Usuario'}!`);
      } else {
        // Fallback si no se encuentra el usuario en localStorage
        router.push('/dashboard');
        toast.success('¡Bienvenido de vuelta!');
      }
    } catch (error: any) {
      // Log completo para debugging
      logDebugInfo(error);

      // Extraer el mensaje de error más específico
      let errorMessage = 'Error al iniciar sesión';

      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      setError(errorMessage);
      toast.error(errorMessage);

    } finally {
      setIsLoading(false);
    }
  }; return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo y título */}
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Scissors className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Beautiful Studio
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Ingresa a tu cuenta para continuar
          </p>
        </div>

        {/* Formulario de login */}
        <Card>
          <CardHeader>
            <CardTitle>Iniciar Sesión</CardTitle>
            <CardDescription>
              Ingresa tus credenciales para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                ¿No tienes cuenta?{' '}
                <Link
                  href="/register"
                  className="font-medium text-purple-600 hover:text-purple-500"
                >
                  Regístrate aquí
                </Link>
              </p>
            </div>

            {/* Credenciales de prueba */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-900 mb-2">Credenciales de prueba:</p>
              <div className="space-y-1 text-xs text-gray-600">
                <p><strong>Admin:</strong> admin@test.com / password1.2.3</p>
                <p><strong>Profesional:</strong> profesional@test.com / password1.2.3</p>
                <p><strong>Cliente:</strong> cliente@test.com / password1.2.3</p>
              </div>

              {/* Debug info */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-1">Debug Mode:</p>
                  <p className="text-xs text-gray-500">
                    Revisa la consola del navegador para información detallada de errores
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}