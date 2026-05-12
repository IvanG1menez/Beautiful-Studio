import {
  ApiResponse,
  HistorialTurno,
  SolicitudReprogramacionFlexible,
  Turno,
  TurnoFormData
} from '@/types';
import { del, get, getWithPagination, patch, post, put } from './api';

export const turnosService = {
  // Listar todos los turnos con paginación
  list: async (params?: {
    page?: number;
    cliente?: number;
    empleado?: number;
    servicio?: number;
    estado?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
  }): Promise<ApiResponse<Turno>> => {
    return await getWithPagination<Turno>('/turnos/', params);
  },

  // Obtener turnos del día actual
  getToday: async (): Promise<Turno[]> => {
    const today = new Date().toISOString().split('T')[0];
    const response = await getWithPagination<Turno>('/turnos/', {
      fecha_desde: today,
      fecha_hasta: today
    });
    return response.results;
  },

  // Obtener turnos por estado
  getByStatus: async (estado: string): Promise<Turno[]> => {
    const response = await getWithPagination<Turno>('/turnos/', { estado });
    return response.results;
  },

  // Obtener turnos pendientes
  getPending: async (): Promise<Turno[]> => {
    return await turnosService.getByStatus('pendiente');
  },

  // Obtener turnos confirmados
  getConfirmed: async (): Promise<Turno[]> => {
    return await turnosService.getByStatus('confirmado');
  },

  // Obtener turno por ID
  get: async (id: number): Promise<Turno> => {
    return await get<Turno>(`/turnos/${id}/`);
  },

  // Crear nuevo turno
  create: async (data: TurnoFormData): Promise<Turno> => {
    return await post<Turno>('/turnos/', data);
  },

  // Actualizar turno completo
  update: async (id: number, data: TurnoFormData): Promise<Turno> => {
    return await put<Turno>(`/turnos/${id}/`, data);
  },

  // Actualizar turno parcialmente
  patch: async (id: number, data: Partial<TurnoFormData>): Promise<Turno> => {
    return await patch<Turno>(`/turnos/${id}/`, data);
  },

  // Eliminar turno
  delete: async (id: number): Promise<void> => {
    return await del(`/turnos/${id}/`);
  },

  // Cambiar estado del turno
  changeStatus: async (id: number, estado: string, observaciones?: string): Promise<Turno> => {
    return await post<Turno>(`/turnos/${id}/cambiar_estado/`, {
      estado,
      observaciones
    });
  },

  // Confirmar turno
  confirm: async (id: number): Promise<Turno> => {
    return await turnosService.changeStatus(id, 'confirmado');
  },

  // Iniciar turno (en proceso)
  start: async (id: number): Promise<Turno> => {
    return await turnosService.changeStatus(id, 'en_proceso');
  },

  // Completar turno
  complete: async (id: number, precioFinal?: number, notasEmpleado?: string): Promise<Turno> => {
    const updateData: any = { estado: 'completado' };
    if (precioFinal) updateData.precio_final = precioFinal.toString();
    if (notasEmpleado) updateData.notas_empleado = notasEmpleado;

    return await patch<Turno>(`/turnos/${id}/`, updateData);
  },

  // Registrar pago manual asociado a un turno (efectivo, transferencia, MP QR, etc.)
  registrarPago: async (
    id: number,
    payload: { monto: number; metodo_pago: string; precio_final?: number }
  ): Promise<Turno> => {
    const body: any = {
      monto: payload.monto,
      metodo_pago: payload.metodo_pago,
    };

    if (typeof payload.precio_final === 'number') {
      body.precio_final = payload.precio_final;
    }

    return await post<Turno>(`/turnos/${id}/registrar-pago/`, body);
  },

  // Cancelar turno
  cancel: async (id: number, motivo?: string): Promise<Turno> => {
    return await turnosService.changeStatus(id, 'cancelado', motivo);
  },

  // Reprogramar turno (solo cambia fecha/hora)
  reprogramar: async (
    id: number,
    payload: {
      nueva_fecha_hora: string;
      motivo?: string;
      nuevo_empleado_id?: number;
      aceptar_penalidad_fuera_rango?: boolean;
    }
  ): Promise<{
    message: string;
    turno: Turno;
    fecha_hora_anterior: string;
    fecha_hora_nueva: string;
    sena_reiniciada?: boolean;
    penalidad_aplicada?: boolean;
    estado_pago_reprogramacion?: 'SENIA_PENDIENTE_LOCAL' | 'SIN_PENALIDAD';
    brecha_horas?: number;
    mensaje_penalidad?: string;
  }> => {
    return await post(`/turnos/${id}/reprogramar/`, payload);
  },

  // Solicitar reprogramación flexible para revisión manual
  solicitarReprogramacionFlexible: async (
    id: number,
    payload: { motivo?: string; preferencia_fecha?: string; preferencia_horario?: string }
  ): Promise<{ message: string; solicitud: SolicitudReprogramacionFlexible }> => {
    return await post<{ message: string; solicitud: SolicitudReprogramacionFlexible }>(`/turnos/${id}/solicitar-reprogramacion-flexible/`, payload);
  },

  // Listar solicitudes flexibles
  listarSolicitudesFlexibles: async (params?: {
    estado?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiResponse<SolicitudReprogramacionFlexible>> => {
    return await getWithPagination<SolicitudReprogramacionFlexible>('/turnos/solicitudes-flexibles/', params);
  },

  // Resumen de solicitudes flexibles
  getSolicitudesFlexiblesResumen: async (): Promise<{
    pendientes: number;
    atendidas: number;
    rechazadas: number;
    en_revision: number;
    vencidas?: number;
    total: number;
  }> => {
    return await get('/turnos/solicitudes-flexibles/resumen/');
  },

  // Registrar explicación para una solicitud flexible vencida
  registrarExplicacionSolicitudFlexible: async (
    id: number,
    payload: { explicacion: string }
  ): Promise<{ message: string; solicitud: SolicitudReprogramacionFlexible }> => {
    return await post(`/turnos/solicitudes-flexibles/${id}/registrar-explicacion/`, payload);
  },

  // Asignar turno manualmente a una solicitud flexible
  asignarSolicitudFlexible: async (
    id: number,
    payload: {
      fecha_hora: string;
      observaciones?: string;
      motivo?: string;
      aceptar_penalidad_fuera_rango?: boolean;
      permitir_sobreturno?: boolean;
    }
  ): Promise<{
    message: string;
    solicitud: SolicitudReprogramacionFlexible;
    turno: Turno;
    fecha_hora_anterior: string;
    fecha_hora_nueva: string;
    sena_reiniciada?: boolean;
    penalidad_aplicada?: boolean;
    estado_pago_reprogramacion?: 'SENIA_PENDIENTE_LOCAL' | 'SIN_PENALIDAD';
    mensaje_penalidad?: string;
  }> => {
    return await post(`/turnos/solicitudes-flexibles/${id}/asignar/`, payload);
  },

  // Rechazar solicitud flexible
  rechazarSolicitudFlexible: async (
    id: number,
    payload?: { observaciones?: string }
  ): Promise<{ message: string; solicitud: SolicitudReprogramacionFlexible }> => {
    return await post(`/turnos/solicitudes-flexibles/${id}/rechazar/`, payload || {});
  },

  // Marcar como no asistió
  markNoShow: async (id: number): Promise<Turno> => {
    return await turnosService.changeStatus(id, 'no_asistio');
  },

  // Obtener historial de cambios del turno
  getHistory: async (id: number): Promise<HistorialTurno[]> => {
    return await get<HistorialTurno[]>(`/turnos/${id}/historial/`);
  },

  // Obtener turnos por rango de fechas
  getByDateRange: async (fechaInicio: string, fechaFin: string): Promise<Turno[]> => {
    const response = await getWithPagination<Turno>('/turnos/', {
      fecha_desde: fechaInicio,
      fecha_hasta: fechaFin
    });
    return response.results;
  },

  // Obtener turnos del cliente
  getByClient: async (clienteId: number): Promise<Turno[]> => {
    const response = await getWithPagination<Turno>('/turnos/', { cliente: clienteId });
    return response.results;
  },

  // Obtener turnos del empleado
  getByEmployee: async (empleadoId: number): Promise<Turno[]> => {
    const response = await getWithPagination<Turno>('/turnos/', { empleado: empleadoId });
    return response.results;
  },

  // Verificar disponibilidad de horario
  checkAvailability: async (empleadoId: number, fechaHora: string): Promise<boolean> => {
    try {
      await get(`/turnos/verificar-disponibilidad/?empleado=${empleadoId}&fecha_hora=${fechaHora}`);
      return true;
    } catch (error) {
      return false;
    }
  },

  // Obtener estadísticas de turnos
  getStats: async (fechaInicio?: string, fechaFin?: string): Promise<any> => {
    const params = fechaInicio && fechaFin ? `?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}` : '';
    return await get(`/turnos/estadisticas/${params}`);
  },
};
