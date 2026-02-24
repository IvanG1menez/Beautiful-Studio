// Tipos principales basados en los modelos del backend Django

export interface User {
  id: number;
  username: string;
  email: string;
  dni?: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'admin' | 'empleado' | 'cliente' | 'profesional' | 'propietario' | 'superusuario';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  full_name: string;
  empleado_id?: number; // ID del perfil de empleado si el usuario es profesional
}

export interface Cliente {
  id: number;
  user: User;
  fecha_nacimiento?: string;
  direccion?: string;
  preferencias?: string;
  fecha_primera_visita?: string;
  is_vip: boolean;
  created_at: string;
  updated_at: string;
  nombre_completo: string;
  email: string;
  telefono?: string;
}

export interface CategoriaServicio {
  id: number;
  nombre: string;
  descripcion?: string;
  sala?: number | null;
  sala_nombre?: string;
  sala_capacidad?: number;
  is_active: boolean;
  created_at: string;
}

export interface Sala {
  id: number;
  nombre: string;
  capacidad_simultanea: number;
  categorias: { id: number; nombre: string }[];
}

export interface Servicio {
  id: number;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaServicio;
  precio: string; // DecimalField viene como string
  duracion_minutos: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  duracion_horas: string;
}

export interface Empleado {
  id: number;
  user: User;
  especialidades: 'corte' | 'color' | 'tratamientos' | 'unas' | 'maquillaje' | 'general';
  servicios?: {
    id: number;
    nombre: string;
    categoria_nombre: string;
  }[];
  horarios_detallados?: {
    id: number;
    dia_semana: number;
    dia_semana_display: string;
    hora_inicio: string;
    hora_fin: string;
  }[];
  fecha_ingreso: string;
  horario_entrada: string;
  horario_salida: string;
  dias_trabajo: string;
  comision_porcentaje: string;
  is_disponible: boolean;
  biografia?: string;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  email: string;
  user_dni: string;
}

export interface EmpleadoServicio {
  id: number;
  empleado: Empleado;
  servicio: Servicio;
  nivel_experiencia: 1 | 2 | 3 | 4;
  created_at: string;
}

export interface Turno {
  id: number;
  cliente: Cliente;
  empleado: Empleado;
  servicio: Servicio;
  fecha_hora: string;
  estado: 'pendiente' | 'confirmado' | 'en_proceso' | 'completado' | 'cancelado' | 'no_asistio';
  notas_cliente?: string;
  notas_empleado?: string;
  precio_final?: string;
  created_at: string;
  updated_at: string;
  fecha_hora_fin?: string;
  duracion?: string;
}

export interface HistorialTurno {
  id: number;
  turno: Turno;
  usuario: User;
  accion: string;
  estado_anterior?: string;
  estado_nuevo?: string;
  observaciones?: string;
  created_at: string;
}

// Tipos para autenticación
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterData {
  username: string;
  email: string;
  dni?: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'cliente' | 'empleado' | 'profesional' | 'propietario' | 'admin' | 'superusuario';
}

// Tipos para formularios
export interface ServicioFormData {
  nombre: string;
  descripcion?: string;
  categoria: number;
  precio: number;
  duracion_minutos: number;
  is_active: boolean;
}

export interface TurnoFormData {
  cliente: number;
  empleado: number;
  servicio: number;
  fecha_hora: string;
  notas_cliente?: string;
}

export interface ClienteFormData {
  user: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  fecha_nacimiento?: string;
  direccion?: string;
  preferencias?: string;
  is_vip: boolean;
}

export interface EmpleadoFormData {
  user: {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  especialidades: string;
  fecha_ingreso: string;
  horario_entrada: string;
  horario_salida: string;
  dias_trabajo: string;
  comision_porcentaje: number;
  is_disponible: boolean;
  biografia?: string;
}

// Tipos para API responses
export interface ApiResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}