import { apiClient } from './api';

export interface Notificacion {
  id: number;
  tipo: 'solicitud_turno' | 'pago_turno' | 'cancelacion_turno' | 'modificacion_turno' |
  'nuevo_empleado' | 'nuevo_cliente' | 'reporte_diario' | 'recordatorio';
  titulo: string;
  mensaje: string;
  leida: boolean;
  data?: Record<string, unknown>;
  created_at: string;
  leida_at?: string;
  tiempo_transcurrido: string;
}

export interface NotificacionConfig {
  id: number;
  notificar_solicitud_turno: boolean;
  notificar_pago_turno: boolean;
  notificar_cancelacion_turno: boolean;
  notificar_modificacion_turno: boolean;
  notificar_nuevo_empleado: boolean;
  notificar_nuevo_cliente: boolean;
  notificar_reporte_diario: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificacionesResponse {
  count: number;
  results: Notificacion[];
}

/**
 * Obtiene todas las notificaciones del usuario autenticado
 */
export async function obtenerNotificaciones(): Promise<Notificacion[]> {
  const response = await apiClient.get('/notificaciones/');
  return response.data.results || response.data;
}

/**
 * Obtiene solo las notificaciones no leídas
 */
export async function obtenerNotificacionesNoLeidas(): Promise<NotificacionesResponse> {
  const response = await apiClient.get('/notificaciones/no_leidas/');
  return response.data;
}

/**
 * Obtiene las últimas 10 notificaciones
 */
export async function obtenerNotificacionesRecientes(): Promise<Notificacion[]> {
  const response = await apiClient.get('/notificaciones/recientes/');
  return response.data;
}

/**
 * Marca una notificación como leída
 */
export async function marcarNotificacionLeida(id: number): Promise<Notificacion> {
  const response = await apiClient.post(`/notificaciones/${id}/marcar_leida/`);
  return response.data;
}

/**
 * Marca todas las notificaciones como leídas
 */
export async function marcarTodasLeidas(): Promise<{ message: string; count: number }> {
  const response = await apiClient.post('/notificaciones/marcar_todas_leidas/');
  return response.data;
}

/**
 * Obtiene la configuración de notificaciones del usuario
 */
export async function obtenerConfigNotificaciones(): Promise<NotificacionConfig> {
  const response = await apiClient.get('/notificaciones-config/');
  return response.data.results?.[0] || response.data;
}

/**
 * Actualiza la configuración de notificaciones
 */
export async function actualizarConfigNotificaciones(
  config: Partial<NotificacionConfig>
): Promise<NotificacionConfig> {
  // Primero obtenemos el ID de la configuración actual
  const currentConfig = await obtenerConfigNotificaciones();

  const response = await apiClient.patch(`/notificaciones-config/${currentConfig.id}/`, config);
  return response.data;
}
