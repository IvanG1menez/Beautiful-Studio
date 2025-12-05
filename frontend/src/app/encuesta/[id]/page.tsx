'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Send } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface TurnoInfo {
  turno_id: number
  cliente: { nombre: string }
  empleado: { id: number; nombre: string; especialidad: string }
  servicio: { nombre: string; duracion: string }
  fecha_hora: string
  precio: number
}

interface RespuestasEncuesta {
  pregunta1_calidad_servicio: number
  pregunta2_profesionalismo: number
  pregunta3_puntualidad: number
  pregunta4_limpieza: number
  pregunta5_atencion: number
  pregunta6_resultado: number
  pregunta7_precio: number
  pregunta8_comodidad: number
  pregunta9_comunicacion: number
  pregunta10_recomendacion: number
  comentario: string
}

const PREGUNTAS = [
  { key: 'pregunta1_calidad_servicio', texto: '¿Qué tan satisfecho estás con la calidad del servicio?' },
  { key: 'pregunta2_profesionalismo', texto: '¿Cómo calificarías el profesionalismo del especialista?' },
  { key: 'pregunta3_puntualidad', texto: '¿El servicio comenzó a tiempo?' },
  { key: 'pregunta4_limpieza', texto: '¿Cómo calificarías la limpieza e higiene del lugar?' },
  { key: 'pregunta5_atencion', texto: '¿Cómo fue la atención recibida?' },
  { key: 'pregunta6_resultado', texto: '¿Estás satisfecho con el resultado final?' },
  { key: 'pregunta7_precio', texto: '¿Consideras que el precio es justo?' },
  { key: 'pregunta8_comodidad', texto: '¿Te sentiste cómodo durante el servicio?' },
  { key: 'pregunta9_comunicacion', texto: '¿El especialista te explicó claramente el proceso?' },
  { key: 'pregunta10_recomendacion', texto: '¿Qué tan probable es que recomiendes este servicio?' },
]

export default function EncuestaPage() {
  const params = useParams()
  const router = useRouter()
  const turnoId = params.id as string

  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState(false)
  const [turnoInfo, setTurnoInfo] = useState<TurnoInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Estado inicial de respuestas (todas en 5)
  const [respuestas, setRespuestas] = useState<RespuestasEncuesta>({
    pregunta1_calidad_servicio: 5,
    pregunta2_profesionalismo: 5,
    pregunta3_puntualidad: 5,
    pregunta4_limpieza: 5,
    pregunta5_atencion: 5,
    pregunta6_resultado: 5,
    pregunta7_precio: 5,
    pregunta8_comodidad: 5,
    pregunta9_comunicacion: 5,
    pregunta10_recomendacion: 5,
    comentario: '',
  })

  useEffect(() => {
    cargarInfoTurno()
  }, [turnoId])

  const cargarInfoTurno = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/encuestas/turno/${turnoId}/info/`
      )

      const contentType = response.headers.get('content-type')

      // Verificar si la respuesta es HTML (error de Django)
      if (contentType && contentType.includes('text/html')) {
        throw new Error('El servidor Django no está respondiendo correctamente. Verifica que esté corriendo.')
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al cargar información del turno')
      }

      const data = await response.json()
      setTurnoInfo(data)
    } catch (err: any) {
      console.error('Error al cargar turno:', err)
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSliderChange = (pregunta: string, value: number[]) => {
    setRespuestas((prev) => ({
      ...prev,
      [pregunta]: value[0],
    }))
  }

  const handleSubmit = async () => {
    if (!turnoInfo) return

    setEnviando(true)

    try {
      // Convertir respuestas al formato esperado por el backend
      const respuestasArray = Object.entries(respuestas)
        .filter(([key]) => key.startsWith('pregunta'))
        .map(([key, valor], index) => ({
          pregunta_id: index + 1, // IDs del 1 al 10
          valor: valor as number
        }))

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/encuestas/encuestas/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            turno: turnoInfo.turno_id,
            respuestas: respuestasArray,
          }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Error al enviar encuesta')
      }

      setEnviada(true)
      toast.success('¡Gracias por tu feedback! Tu opinión es muy importante.')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const getColorPorPuntaje = (puntaje: number) => {
    if (puntaje >= 8) return 'text-green-600'
    if (puntaje >= 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getEmojiPorPuntaje = (puntaje: number) => {
    if (puntaje >= 9) return '😍'
    if (puntaje >= 7) return '😊'
    if (puntaje >= 5) return '😐'
    if (puntaje >= 3) return '😕'
    return '😞'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Cargando encuesta...</p>
        </div>
      </div>
    )
  }

  if (error || !turnoInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error || 'No se pudo cargar la encuesta'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')} className="w-full">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (enviada) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">¡Gracias por tu feedback!</CardTitle>
            <CardDescription className="text-base mt-2">
              Tu opinión es muy importante para nosotros y nos ayuda a mejorar nuestros servicios.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              ¡Esperamos verte pronto en Beautiful Studio! ✨
            </p>
            <Button onClick={() => router.push('/')} className="w-full">
              Cerrar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
            <CardTitle className="text-2xl">✨ Encuesta de Satisfacción</CardTitle>
            <CardDescription className="text-purple-100">
              Beautiful Studio - Tu opinión es importante
            </CardDescription>
          </CardHeader>

          <CardContent className="mt-6 space-y-6">
            {/* Información del servicio */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Servicio recibido</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Cliente:</span>{' '}
                  <span className="font-medium">{turnoInfo.cliente.nombre}</span>
                </div>
                <div>
                  <span className="text-gray-600">Profesional:</span>{' '}
                  <span className="font-medium">{turnoInfo.empleado.nombre}</span>
                </div>
                <div>
                  <span className="text-gray-600">Servicio:</span>{' '}
                  <span className="font-medium">{turnoInfo.servicio.nombre}</span>
                </div>
                <div>
                  <span className="text-gray-600">Precio:</span>{' '}
                  <span className="font-medium">${turnoInfo.precio}</span>
                </div>
              </div>
            </div>

            {/* 10 Preguntas con sliders */}
            <div className="space-y-6">
              <h3 className="font-semibold text-lg">Por favor, califica tu experiencia (0-10)</h3>

              {PREGUNTAS.map((pregunta, index) => {
                const valor = respuestas[pregunta.key as keyof RespuestasEncuesta] as number
                return (
                  <div key={pregunta.key} className="space-y-2">
                    <div className="flex items-start justify-between">
                      <label className="text-sm font-medium text-gray-700 flex-1">
                        {index + 1}. {pregunta.texto}
                      </label>
                      <div className={`text-2xl ml-4 ${getColorPorPuntaje(valor)} font-bold flex items-center gap-2`}>
                        <span>{getEmojiPorPuntaje(valor)}</span>
                        <span>{valor}</span>
                      </div>
                    </div>
                    <Slider
                      value={[valor]}
                      onValueChange={(value) => handleSliderChange(pregunta.key, value)}
                      min={0}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0 - Muy insatisfecho</span>
                      <span>10 - Muy satisfecho</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Comentario opcional */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Comentarios adicionales (opcional)
              </label>
              <Textarea
                value={respuestas.comentario}
                onChange={(e) =>
                  setRespuestas((prev) => ({ ...prev, comentario: e.target.value }))
                }
                placeholder="Cuéntanos más sobre tu experiencia..."
                rows={4}
                className="w-full"
              />
            </div>

            {/* Botón de envío */}
            <Button
              onClick={handleSubmit}
              disabled={enviando}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              size="lg"
            >
              {enviando ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Encuesta
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
