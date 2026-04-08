import apiClient, { handleApiError } from '@/services/api';

export interface TurnoProfesional {
  id: number;
  cliente: number;
  cliente_nombre: string;
  cliente_email: string;
  servicio: number;
  servicio_nombre: string;
  empleado: number;
  empleado_nombre: string;
  fecha_hora: string;
  estado: string;
  estado_display: string;
  precio_final: string;
  senia_pagada: string;
  canal_reserva?: string | null;
  metodo_pago?: string | null;
  es_cliente_registrado?: boolean;
  walkin_nombre?: string | null;
  walkin_dni?: string | null;
  walkin_email?: string | null;
  walkin_telefono?: string | null;
}

export interface PreferenciaStaffResponse {
  status: 'pending';
  preference_id: string;
  init_point: string;
  sandbox_init_point?: string;
  public_key: string;
}

export interface BuscarClientePorDniResponse {
  registrado: boolean;
  cliente: {
    id: number;
    user?: {
      full_name?: string;
      email?: string;
      phone?: string;
      dni?: string;
    };
  } | null;
  turno_existente?: {
    id: number;
    fecha_hora: string;
    estado: string;
    estado_display: string;
    servicio_nombre?: string;
    empleado_nombre?: string;
  } | null;
}

export interface ReservaStaffPayload {
  servicio: number;
  empleado: number;
  fecha_hora: string;
  notas_cliente?: string;
  metodo_pago: 'efectivo';
  paga_servicio_completo: boolean;
  tipo_pago: 'SENIA' | 'PAGO_COMPLETO';
  monto_senia: number;
  cliente_id?: number;
  dni?: string;
  email?: string;
  nombre?: string;
  telefono?: string;
}

export interface PreferenciaStaffPayload {
  servicio_id: number;
  empleado_id: number;
  fecha_hora: string;
  notas_cliente?: string;
  usar_sena: boolean;
  tipo_pago: 'SENIA' | 'PAGO_COMPLETO';
  cliente_id?: number;
  dni?: string;
  email?: string;
  nombre?: string;
  telefono?: string;
}

export const profesionalTurnosApi = {
  buscarClientePorDni: async (dni: string): Promise<BuscarClientePorDniResponse> => {
    try {
      const response = await apiClient.get<BuscarClientePorDniResponse>(
        '/clientes/buscar-por-dni/',
        { params: { dni } },
      );
      return response.data;
    } catch (error: unknown) {
      throw new Error(handleApiError(error).message);
    }
  },

  buscarClientePorEmail: async (email: string): Promise<BuscarClientePorDniResponse> => {
    try {
      const response = await apiClient.get<BuscarClientePorDniResponse>(
        '/clientes/buscar-por-email/',
        { params: { email } },
      );
      return response.data;
    } catch (error: unknown) {
      throw new Error(handleApiError(error).message);
    }
  },

  reservarStaff: async (payload: ReservaStaffPayload): Promise<{ message: string; turno: TurnoProfesional }> => {
    try {
      const response = await apiClient.post<{ message: string; turno: TurnoProfesional }>(
        '/turnos/reservar-staff/',
        payload,
      );
      return response.data;
    } catch (error: unknown) {
      throw new Error(handleApiError(error).message);
    }
  },

  crearPreferenciaStaff: async (payload: PreferenciaStaffPayload): Promise<PreferenciaStaffResponse> => {
    try {
      const response = await apiClient.post<PreferenciaStaffResponse>(
        '/mercadopago/preferencia-staff/',
        payload,
      );
      return response.data;
    } catch (error: unknown) {
      throw new Error(handleApiError(error).message);
    }
  },
};
