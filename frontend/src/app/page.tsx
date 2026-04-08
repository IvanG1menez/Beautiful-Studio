'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, CheckCircle2, Clock, Mail, Scissors, Smartphone, Sparkles, Users, Wallet } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100">
      {/* Header */}
      <header className="relative overflow-hidden bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-linear-to-r from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Scissors className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Beautiful Studio</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost">Iniciar Sesión</Button>
              </Link>
              <Link href="/register">
                <Button>Registro</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section orientado al cliente final */}
      <section className="relative py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Tu lugar para cuidar
              <span className="block text-transparent bg-clip-text bg-linear-to-r from-pink-500 to-purple-600">
                tu belleza
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Reservá tus turnos de peluquería, color, manos, pies y tratamientos en un solo lugar.
              Sin chats eternos, sin confusiones: vos elegís el momento y nosotros nos encargamos del resto.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Soy nueva/o, crear mi cuenta
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sección de servicios generales del estudio (sin detalle técnico) */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Todo para tu rutina de belleza
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Un mismo espacio donde podés agendar cortes, color, manos, pies, cejas, pestañas,
              depilación y tratamientos faciales para sentirte bien todos los días.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-linear-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Gestión de Turnos</h3>
              <p className="text-gray-600">
                Reservá turnos sin llamar ni escribir. Elegí día, horario y profesional de forma rápida y clara.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-linear-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Profesionales que te conocen</h3>
              <p className="text-gray-600">
                Volvé con tu estilista de confianza y dejá registradas tus preferencias para repetir ese look que te encantó.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-linear-to-r from-green-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Servicios para cada momento</h3>
              <p className="text-gray-600">
                Desde un retoque rápido hasta una sesión completa de cuidado: siempre hay un servicio pensado para vos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Experiencia para quien se atiende */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-6">
              <div className="text-left md:text-left">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Una experiencia pensada para vos
                </h2>
                <p className="text-gray-600 max-w-xl">
                  Pedir un turno debería ser tan simple y agradable como venir al salón: sin enredos, sin dudas y con toda la información a mano.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Reservas online en segundos</p>
                      <p className="text-sm text-gray-600">
                        Elegí servicio, profesional, día y horario sin tener que escribir ni llamar por WhatsApp.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Agenda y auditoría siempre a mano</p>
                      <p className="text-sm text-gray-600">
                        Podés ver tus próximos turnos y todo lo que te hiciste en el estudio, con fecha, horario y profesional.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Recordatorios automáticos</p>
                      <p className="text-sm text-gray-600">
                        Recibís confirmaciones y recordatorios por email para que no se te pase ningún turno.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Smartphone className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Gestión 100% desde el celular</p>
                      <p className="text-sm text-gray-600">
                        Podés cambiar o cancelar turnos desde cualquier dispositivo, en cualquier momento del día.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Wallet className="w-5 h-5 text-emerald-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Billetera virtual y créditos</p>
                      <p className="text-sm text-gray-600">
                        Si cancelás con anticipación, podés acumular crédito en tu billetera para próximas reservas.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-pink-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900">Siempre en sintonía con el salón</p>
                      <p className="text-sm text-gray-600">
                        Lo que ves en tu cuenta está conectado con la agenda real del estudio, para evitar errores de horarios o dobles reservas.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-linear-to-r from-pink-500 to-purple-600 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-semibold mb-1">¿Te gustaría reservar tu próximo turno ahora?</h3>
                <p className="text-sm text-pink-50 mb-4">
                  Creá tu cuenta en segundos y empezá a manejar tus citas desde donde estés.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/register" className="w-full sm:w-auto">
                    <Button className="w-full bg-white text-pink-600 hover:bg-pink-50">
                      Crear mi cuenta de cliente
                    </Button>
                  </Link>
                  <Link href="/login" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full border-white text-white hover:bg-white/10">
                      Iniciar sesión
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-linear-to-r from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Scissors className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">Beautiful Studio</span>
            </div>
            <p className="text-gray-400 text-center md:text-right">
              © 2024 Beautiful Studio. Sistema de gestión para salones de belleza.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
