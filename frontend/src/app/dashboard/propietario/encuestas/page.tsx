'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Calendar,
  Filter,
  MessageSquare,
  Minus,
  Scissors,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  User
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface Encuesta {
  id: number
  turno: number
  cliente: {
    id: number
    nombre: string
    email: string
  }
  empleado: {
    id: number
    nombre: string
    especialidad: string
  }
  servicio: {
    nombre: string
    categoria: string
  }
  puntaje: number
  clasificacion: 'positiva' | 'neutral' | 'negativa'
  comentario: string
  fecha_respuesta: string

  // 10 preguntas
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
}

interface Estadisticas {
  total: number
  positivas: number
  neutrales: number
  negativas: number
  promedio_general: number
}

function ConfiguracionEncuestas() {
  const [config, setConfig] = useState({
    umbral_negativa: 4,
    umbral_neutral_min: 5,
    umbral_neutral_max: 7,
    umbral_notificacion_propietario: 3,
    dias_ventana_alerta: 30,
  })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarConfiguracion()
  }, [])

  const cargarConfiguracion = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/encuestas/config/`, {
        headers: {
          'Authorization': `Token ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data)
      }
    } catch (error) {
      console.error('Error cargando configuración:', error)
      toast.error('Error al cargar la configuración')
    }
  }

  const guardarConfiguracion = async () => {
    try {
      setGuardando(true)
      const token = localStorage.getItem('auth_token')

      // Primero obtenemos la configuración actual para obtener el ID
      const getResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/encuestas/config/`, {
        headers: {
          'Authorization': `Token ${token}`,
        },
      })

      if (!getResponse.ok) throw new Error('Error al obtener configuración')

      const currentConfig = await getResponse.json()

      // Ahora actualizamos con PATCH usando el ID
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/encuestas/config/${currentConfig.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (response.ok) {
        toast.success('Configuración guardada exitosamente')
      } else {
        throw new Error('Error al guardar')
      }
    } catch (error) {
      console.error('Error guardando configuración:', error)
      toast.error('Error al guardar la configuración')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Clasificación de Encuestas</CardTitle>
          <CardDescription>
            Define los umbrales de puntuación para clasificar las encuestas en positivas, neutrales o negativas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Umbral Negativa (≤)</label>
              <Input
                type="number"
                min="0"
                max="10"
                value={config.umbral_negativa}
                onChange={(e) => setConfig({ ...config, umbral_negativa: Number(e.target.value) })}
              />
              <p className="text-xs text-gray-500">
                Puntajes menores o iguales a este valor se clasifican como negativas
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Umbral Neutral (Mín-Máx)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={config.umbral_neutral_min}
                  onChange={(e) => setConfig({ ...config, umbral_neutral_min: Number(e.target.value) })}
                  placeholder="Mín"
                />
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={config.umbral_neutral_max}
                  onChange={(e) => setConfig({ ...config, umbral_neutral_max: Number(e.target.value) })}
                  placeholder="Máx"
                />
              </div>
              <p className="text-xs text-gray-500">
                Puntajes entre {config.umbral_neutral_min} y {config.umbral_neutral_max} son neutrales
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Positiva (&gt;{config.umbral_neutral_max})</label>
              <div className="h-10 bg-green-100 rounded-md flex items-center justify-center text-green-700 font-medium">
                Automático
              </div>
              <p className="text-xs text-gray-500">
                Puntajes mayores a {config.umbral_neutral_max} son positivas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sistema de Alertas</CardTitle>
          <CardDescription>
            Configura cuándo el sistema debe alertarte sobre bajo rendimiento de profesionales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cantidad de encuestas negativas</label>
              <Input
                type="number"
                min="1"
                value={config.umbral_notificacion_propietario}
                onChange={(e) => setConfig({ ...config, umbral_notificacion_propietario: Number(e.target.value) })}
              />
              <p className="text-xs text-gray-500">
                Te alertamos cuando un profesional recibe {config.umbral_notificacion_propietario} o más encuestas negativas
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ventana de tiempo (días)</label>
              <Input
                type="number"
                min="1"
                value={config.dias_ventana_alerta}
                onChange={(e) => setConfig({ ...config, dias_ventana_alerta: Number(e.target.value) })}
              />
              <p className="text-xs text-gray-500">
                Consideramos encuestas de los últimos {config.dias_ventana_alerta} días
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={guardarConfiguracion} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  )
}

export default function EncuestasPropietarioPage() {
  const [vistaActual, setVistaActual] = useState<'encuestas' | 'configuracion'>('encuestas')
  const [encuestas, setEncuestas] = useState<Encuesta[]>([])
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroClasificacion, setFiltroClasificacion] = useState<string>('todas')
  const [encuestaSeleccionada, setEncuestaSeleccionada] = useState<Encuesta | null>(null)

  useEffect(() => {
    cargarEncuestas()
  }, [])

  const cargarEncuestas = async () => {
    try {
      // Obtener token directamente de localStorage
      const token = localStorage.getItem('auth_token')

      console.log('Token:', token ? 'Existe' : 'No existe')
      console.log('API URL:', process.env.NEXT_PUBLIC_API_URL)

      if (!token) {
        throw new Error('No se encontró token de autenticación')
      }

      const url = `${process.env.NEXT_PUBLIC_API_URL}/encuestas/encuestas/`
      console.log('Haciendo petición a:', url)

      const response = await fetch(url, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
      })

      console.log('Respuesta:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error del servidor:', errorData)
        throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Encuestas cargadas:', data)
      setEncuestas(data.results || data)
      calcularEstadisticas(data.results || data)
    } catch (error: any) {
      console.error('Error cargando encuestas:', error)
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const calcularEstadisticas = (data: Encuesta[]) => {
    const total = data.length
    const positivas = data.filter(e => e.clasificacion === 'positiva').length
    const neutrales = data.filter(e => e.clasificacion === 'neutral').length
    const negativas = data.filter(e => e.clasificacion === 'negativa').length
    const promedio_general = total > 0
      ? data.reduce((sum, e) => sum + Number(e.puntaje), 0) / total
      : 0

    setEstadisticas({ total, positivas, neutrales, negativas, promedio_general })
  }

  const encuestasFiltradas = encuestas.filter(encuesta => {
    const matchBusqueda =
      encuesta.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      encuesta.empleado.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      encuesta.servicio.nombre.toLowerCase().includes(busqueda.toLowerCase())

    const matchClasificacion =
      filtroClasificacion === 'todas' ||
      encuesta.clasificacion === filtroClasificacion

    return matchBusqueda && matchClasificacion
  })

  const getClasificacionColor = (clasificacion: string) => {
    switch (clasificacion) {
      case 'positiva': return 'bg-green-100 text-green-800'
      case 'neutral': return 'bg-yellow-100 text-yellow-800'
      case 'negativa': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getClasificacionIcon = (clasificacion: string) => {
    switch (clasificacion) {
      case 'positiva': return <TrendingUp className="w-4 h-4" />
      case 'neutral': return <Minus className="w-4 h-4" />
      case 'negativa': return <TrendingDown className="w-4 h-4" />
    }
  }

  const getPuntajeColor = (puntaje: number) => {
    if (puntaje >= 8) return 'text-green-600'
    if (puntaje >= 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Encuestas de Satisfacción</h1>
        <p className="text-gray-500 mt-2">
          Visualiza y analiza las respuestas de los clientes
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <Button
          variant={vistaActual === 'encuestas' ? 'default' : 'ghost'}
          onClick={() => setVistaActual('encuestas')}
          className="rounded-b-none"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Encuestas
        </Button>
        <Button
          variant={vistaActual === 'configuracion' ? 'default' : 'ghost'}
          onClick={() => setVistaActual('configuracion')}
          className="rounded-b-none"
        >
          <Filter className="w-4 h-4 mr-2" />
          Configuración
        </Button>
      </div>

      {/* Vista de Encuestas */}
      {vistaActual === 'encuestas' && (
        <>
          {/* Estadísticas */}
          {estadisticas && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{estadisticas.total}</div>
                </CardContent>
              </Card>

              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-700">Positivas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{estadisticas.positivas}</div>
                  <p className="text-xs text-green-600 mt-1">
                    {estadisticas.total > 0 ? Math.round((estadisticas.positivas / estadisticas.total) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-yellow-700">Neutrales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{estadisticas.neutrales}</div>
                  <p className="text-xs text-yellow-600 mt-1">
                    {estadisticas.total > 0 ? Math.round((estadisticas.neutrales / estadisticas.total) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-red-700">Negativas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{estadisticas.negativas}</div>
                  <p className="text-xs text-red-600 mt-1">
                    {estadisticas.total > 0 ? Math.round((estadisticas.negativas / estadisticas.total) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-purple-700">Promedio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-purple-600 fill-purple-600" />
                    <span className="text-2xl font-bold text-purple-600">
                      {estadisticas.promedio_general.toFixed(1)}
                    </span>
                    <span className="text-sm text-purple-600">/10</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Buscar por cliente, profesional o servicio..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={filtroClasificacion === 'todas' ? 'default' : 'outline'}
                    onClick={() => setFiltroClasificacion('todas')}
                  >
                    Todas
                  </Button>
                  <Button
                    variant={filtroClasificacion === 'positiva' ? 'default' : 'outline'}
                    onClick={() => setFiltroClasificacion('positiva')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Positivas
                  </Button>
                  <Button
                    variant={filtroClasificacion === 'neutral' ? 'default' : 'outline'}
                    onClick={() => setFiltroClasificacion('neutral')}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    Neutrales
                  </Button>
                  <Button
                    variant={filtroClasificacion === 'negativa' ? 'default' : 'outline'}
                    onClick={() => setFiltroClasificacion('negativa')}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Negativas
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Encuestas */}
          <div className="grid grid-cols-1 gap-4">
            {encuestasFiltradas.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No se encontraron encuestas</p>
                </CardContent>
              </Card>
            ) : (
              encuestasFiltradas.map((encuesta) => (
                <Card
                  key={encuesta.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setEncuestaSeleccionada(encuesta)}
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={`${getClasificacionColor(encuesta.clasificacion)} whitespace-nowrap`}>
                            {getClasificacionIcon(encuesta.clasificacion)}
                            <span className="ml-1 capitalize">{encuesta.clasificacion}</span>
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Star className={`w-5 h-5 fill-current ${getPuntajeColor(Number(encuesta.puntaje))}`} />
                            <span className={`text-lg font-bold ${getPuntajeColor(Number(encuesta.puntaje))}`}>
                              {Number(encuesta.puntaje).toFixed(1)}
                            </span>
                            <span className="text-sm text-gray-500">/10</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">Cliente:</span>
                            <span className="font-medium">{encuesta.cliente.nombre}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Scissors className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">Profesional:</span>
                            <span className="font-medium">{encuesta.empleado.nombre}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">{formatearFecha(encuesta.fecha_respuesta)}</span>
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-700">{encuesta.servicio.nombre}</p>
                          {encuesta.comentario && (
                            <p className="text-sm text-gray-600 mt-2 italic">
                              &quot;{encuesta.comentario}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Detalle de preguntas (expandible) */}
                    {encuestaSeleccionada?.id === encuesta.id && (
                      <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                        <h4 className="font-semibold text-sm text-gray-700 mb-3">Detalle de respuestas:</h4>

                        {[
                          { key: 'pregunta1_calidad_servicio', label: 'Calidad del servicio' },
                          { key: 'pregunta2_profesionalismo', label: 'Profesionalismo' },
                          { key: 'pregunta3_puntualidad', label: 'Puntualidad' },
                          { key: 'pregunta4_limpieza', label: 'Limpieza e higiene' },
                          { key: 'pregunta5_atencion', label: 'Atención recibida' },
                          { key: 'pregunta6_resultado', label: 'Resultado final' },
                          { key: 'pregunta7_precio', label: 'Relación calidad-precio' },
                          { key: 'pregunta8_comodidad', label: 'Comodidad' },
                          { key: 'pregunta9_comunicacion', label: 'Comunicación' },
                          { key: 'pregunta10_recomendacion', label: 'Recomendación' },
                        ].map((pregunta) => {
                          const valor = Number(encuesta[pregunta.key as keyof Encuesta])
                          return (
                            <div key={pregunta.key} className="flex items-center gap-3">
                              <span className="text-sm text-gray-600 flex-1">{pregunta.label}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-48 bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${valor >= 8 ? 'bg-green-500' :
                                        valor >= 5 ? 'bg-yellow-500' :
                                          'bg-red-500'
                                      }`}
                                    style={{ width: `${(valor / 10) * 100}%` }}
                                  />
                                </div>
                                <span className={`text-sm font-bold w-8 text-right ${getPuntajeColor(valor)}`}>
                                  {valor}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}

      {/* Vista de Configuración */}
      {vistaActual === 'configuracion' && (
        <ConfiguracionEncuestas />
      )}
    </div>
  )
}
