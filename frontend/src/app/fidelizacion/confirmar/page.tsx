'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarClock, Gift, Scissors, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function ConfirmacionFidelizacionInner() {
  const { user, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const clienteId = searchParams.get('cliente');
  const servicioId = searchParams.get('servicio');
  const empleadoId = searchParams.get('empleado');
  const fecha = searchParams.get('fecha');
  const hora = searchParams.get('hora');
  const authToken = searchParams.get('auth_token');
  const beneficio = searchParams.get('beneficio');

  // Si venimos desde un magic link con auth_token, autologuear y redirigir
  useEffect(() => {
    const processMagicLink = async () => {
      if (!authToken) return;

      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', authToken);
        }

        const response = await fetch('/api/users/profile/', {
          headers: {
            Authorization: `Token ${authToken}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
        });

        if (!response.ok) {
          return;
        }

        const profile = await response.json();

        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(profile));
        }

        // Construir parámetros para ir directo al flujo correspondiente
        const params = new URLSearchParams();
        if (clienteId) params.set('cliente', clienteId);
        if (servicioId) params.set('servicio', servicioId);
        if (empleadoId) params.set('empleado', empleadoId);
        if (fecha) params.set('fecha', fecha);
        if (hora) params.set('hora', hora);
        if (beneficio) params.set('beneficio', beneficio);

        let target: string;
        if (beneficio === 'descuento') {
          // Flujo especial simplificado para clientes con descuento de fidelización
          target = `/fidelizacion/pago${params.toString() ? `?${params.toString()}` : ''}`;
        } else {
          // Flujo normal de reserva para casos con saldo en billetera
          params.set('fromFidelizacion', '1');
          target = `/dashboard/cliente/turnos/nuevo${params.toString() ? `?${params.toString()}` : ''
            }`;
        }

        router.replace(target);
      } catch (error) {
        console.error('Error procesando magic link de fidelización:', error);
      }
    };

    processMagicLink();
  }, [authToken, beneficio, clienteId, servicioId, empleadoId, fecha, hora, router]);

  const handleIrALogin = () => {
    router.push('/login');
  };

  const handleIrADashboard = () => {
    if (!user) {
      router.push('/login');
      return;
    }

    switch (user.role) {
      case 'cliente':
        {
          const params = new URLSearchParams();
          if (clienteId) params.set('cliente', clienteId);
          if (servicioId) params.set('servicio', servicioId);
          if (empleadoId) params.set('empleado', empleadoId);
          if (fecha) params.set('fecha', fecha);
          if (hora) params.set('hora', hora);
          if (beneficio) params.set('beneficio', beneficio);
          let target: string;
          if (beneficio === 'descuento') {
            target = `/fidelizacion/pago${params.toString() ? `?${params.toString()}` : ''}`;
          } else {
            params.set('fromFidelizacion', '1');
            target = `/dashboard/cliente/turnos/nuevo${params.toString() ? `?${params.toString()}` : ''
              }`;
          }
          router.push(target);
        }
        break;
      case 'profesional':
      case 'empleado':
        router.push('/dashboard/profesional');
        break;
      case 'propietario':
      case 'superusuario':
        router.push('/dashboard/propietario');
        break;
      default:
        router.push('/');
    }
  };

  const nombreMostrado = user?.first_name || user?.email || 'Cliente';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#f5d0fe,_transparent_35%),linear-gradient(135deg,_#faf5ff,_#fff1f2)] p-4">
      <Card className="w-full max-w-2xl overflow-hidden border-purple-100 shadow-2xl">
        <div className="bg-linear-to-r from-violet-700 to-fuchsia-600 px-6 py-7 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <Gift className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl">Te preparamos una vuelta especial</CardTitle>
          <CardDescription className="mt-2 text-violet-100">
            Este enlace te lleva al último servicio que solicitaste: Color completo + Brushing.
          </CardDescription>
        </div>
        <CardContent className="space-y-4">
          <Alert className="mt-5 border-violet-200 bg-violet-50">
            <ShieldCheck className="h-4 w-4 text-violet-700" />
            <AlertDescription className="text-violet-900">
              Al continuar vas a ver la reserva sugerida para tu servicio habitual. Si recibiste una promo, el descuento se aplica antes de pagar la seña. Si tenés saldo en billetera, vas a poder usarlo desde tu cuenta.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-3 bg-white rounded-xl border border-purple-100 px-4 py-3 shadow-sm">
            <UserIcon className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-sm text-gray-500">Cliente sugerido</p>
              <p className="font-medium text-gray-800">
                {clienteId ? `Cliente #${clienteId}` : 'Cliente de fidelización'}
              </p>
              {isAuthenticated && (
                <p className="text-xs text-gray-500">
                  Estás logueado como: {nombreMostrado}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white rounded-xl border border-purple-100 px-4 py-3 shadow-sm">
            <Scissors className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-sm text-gray-500">Servicio sugerido</p>
              <p className="font-medium text-gray-800">
                {servicioId ? 'Color completo + Brushing' : 'Color completo + Brushing'}
              </p>
              {empleadoId && (
                <p className="text-xs text-gray-500">Profesional recomendado: #{empleadoId}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white rounded-xl border border-purple-100 px-4 py-3 shadow-sm">
            <CalendarClock className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-sm text-gray-500">Horario sugerido</p>
              <p className="font-medium text-gray-800">
                {fecha && hora ? `${fecha} · ${hora} hs` : 'A coordinar'}
              </p>
            </div>
          </div>

          {!isAuthenticated && (
            <Alert>
              <AlertDescription>
                Para continuar, iniciá sesión con tu cuenta de cliente. Podés usar este mismo enlace para loguearte como diferentes clientes de prueba.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          {!isAuthenticated ? (
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleIrALogin}>
              Iniciar sesión
            </Button>
          ) : (
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleIrADashboard}>
              Ir a mi cuenta
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export default function ConfirmacionFidelizacionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-purple-50 to-pink-50">
          <Scissors className="h-8 w-8 animate-pulse text-purple-600" />
        </div>
      }
    >
      <ConfirmacionFidelizacionInner />
    </Suspense>
  );
}
