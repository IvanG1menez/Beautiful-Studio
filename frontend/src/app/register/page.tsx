'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/auth';
import { CheckCircle, Eye, EyeOff, Loader2, Scissors } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    phone: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    // Validar que todos los campos requeridos estén llenos
    if (!formData.first_name.trim()) {
      setError('El nombre es requerido');
      return false;
    }

    if (!formData.last_name.trim()) {
      setError('El apellido es requerido');
      return false;
    }

    if (!formData.username.trim()) {
      setError('El nombre de usuario es requerido');
      return false;
    }

    if (!formData.email.trim()) {
      setError('El correo electrónico es requerido');
      return false;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Por favor, ingresa un correo electrónico válido');
      return false;
    }

    if (!formData.password) {
      setError('La contraseña es requerida');
      return false;
    }

    // Validar longitud mínima de contraseña
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }

    // Validar que las contraseñas coincidan
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Preparar datos para enviar al backend
      const registerData = {
        username: formData.username,
        email: formData.email,
        dni: formData.dni || undefined,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || undefined,
        role: 'cliente' as const
      };

      await authService.register(registerData);

      setSuccess(true);
      toast.success('¡Cuenta creada exitosamente!');

      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (error: any) {
      console.error('Error al registrar:', error);

      // Manejar diferentes tipos de errores
      if (error.errors) {
        // Si hay errores específicos de campos
        const errorMessages = Object.entries(error.errors)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
          .join('; ');
        setError(errorMessages);
      } else if (error.message) {
        setError(error.message);
      } else {
        setError('Error al crear la cuenta. Por favor, intenta nuevamente.');
      }

      toast.error('Error al crear la cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  // Si el registro fue exitoso, mostrar mensaje de éxito
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    ¡Cuenta Creada!
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Tu cuenta en Beautiful Studio ha sido creada exitosamente.
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Serás redirigido al inicio de sesión en unos segundos...
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/login')}
                  className="w-full bg-linear-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
                >
                  Ir al Inicio de Sesión
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo y título */}
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-linear-to-r from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Scissors className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Crear una cuenta
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Únete a <span className="font-semibold text-purple-600">Beautiful Studio</span>
          </p>
        </div>

        {/* Formulario de registro */}
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Registro</CardTitle>
            <CardDescription className="text-center">
              Completa tus datos para crear tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Mensaje de error */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Nombre y Apellido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Nombre *</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    placeholder="Tu nombre"
                    className="focus:ring-purple-500 focus:border-purple-500"
                    disabled={isLoading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Apellido *</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    placeholder="Tu apellido"
                    className="focus:ring-purple-500 focus:border-purple-500"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* DNI y Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dni">DNI / Documento</Label>
                  <Input
                    id="dni"
                    name="dni"
                    type="text"
                    value={formData.dni}
                    onChange={handleInputChange}
                    placeholder="12345678"
                    className="focus:ring-purple-500 focus:border-purple-500"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Tu número de teléfono"
                    className="focus:ring-purple-500 focus:border-purple-500"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Nombre de usuario */}
              <div className="space-y-2">
                <Label htmlFor="username">Nombre de usuario *</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Elige un nombre de usuario"
                  className="focus:ring-purple-500 focus:border-purple-500"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="tu@email.com"
                  className="focus:ring-purple-500 focus:border-purple-500"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Contraseña */}
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Mínimo 6 caracteres"
                    className="focus:ring-purple-500 focus:border-purple-500 pr-10"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirmar contraseña */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Repite tu contraseña"
                    className="focus:ring-purple-500 focus:border-purple-500 pr-10"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Botón de submit */}
              <Button
                type="submit"
                className="w-full bg-linear-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  'Crear cuenta'
                )}
              </Button>
            </form>

            {/* Link al login */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                ¿Ya tienes una cuenta?{' '}
                <Link
                  href="/login"
                  className="font-medium text-purple-600 hover:text-purple-500 transition-colors"
                >
                  Inicia sesión aquí
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}