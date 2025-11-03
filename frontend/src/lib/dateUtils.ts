/**
 * Utilidades para manejo de fechas y horas en zona horaria de Buenos Aires, Argentina
 */

// Zona horaria de Buenos Aires
const TIMEZONE = 'America/Argentina/Buenos_Aires';
const LOCALE = 'es-AR';

/**
 * Convierte una fecha ISO a objeto Date en zona horaria de Buenos Aires
 */
export const parseDate = (dateString: string): Date => {
  return new Date(dateString);
};

/**
 * Formatea una fecha a formato corto (DD/MM/YYYY)
 * @param date - String ISO o Date
 * @returns Fecha formateada (ej: "02/11/2025")
 */
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIMEZONE
  });
};

/**
 * Formatea una fecha a formato largo (Día, DD de Mes de YYYY)
 * @param date - String ISO o Date
 * @returns Fecha formateada (ej: "Jueves, 02 de Noviembre de 2025")
 */
export const formatDateLong = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE
  });
};

/**
 * Formatea una hora a formato 24 horas (HH:MM)
 * @param date - String ISO o Date
 * @returns Hora formateada (ej: "14:30")
 */
export const formatTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIMEZONE
  });
};

/**
 * Formatea fecha y hora completa (DD/MM/YYYY HH:MM)
 * @param date - String ISO o Date
 * @returns Fecha y hora formateada (ej: "02/11/2025 14:30")
 */
export const formatDateTime = (date: string | Date): string => {
  return `${formatDate(date)} ${formatTime(date)}`;
};

/**
 * Formatea fecha y hora de manera legible (Día DD/MM a las HH:MM)
 * @param date - String ISO o Date
 * @returns Texto formateado (ej: "Jueves 02/11 a las 14:30")
 */
export const formatDateTimeReadable = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dayName = d.toLocaleDateString(LOCALE, {
    weekday: 'long',
    timeZone: TIMEZONE
  });
  const shortDate = d.toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    timeZone: TIMEZONE
  });
  const time = formatTime(d);
  
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${shortDate} a las ${time}`;
};

/**
 * Obtiene la fecha actual en Buenos Aires
 * @returns Date object
 */
export const getCurrentDate = (): Date => {
  return new Date();
};

/**
 * Obtiene la fecha actual en formato ISO para enviar al backend (YYYY-MM-DD)
 * @returns String ISO date (ej: "2025-11-02")
 */
export const getCurrentDateISO = (): string => {
  const now = new Date();
  // Ajustar a zona horaria de Buenos Aires
  const baDate = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  return baDate.toISOString().split('T')[0];
};

/**
 * Obtiene la fecha y hora actual en formato ISO completo
 * @returns String ISO datetime
 */
export const getCurrentDateTimeISO = (): string => {
  return new Date().toISOString();
};

/**
 * Convierte una fecha a formato ISO para el backend (YYYY-MM-DD)
 * @param date - Date object
 * @returns String ISO date
 */
export const toISODate = (date: Date): string => {
  const baDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  return baDate.toISOString().split('T')[0];
};

/**
 * Verifica si una fecha es hoy
 * @param date - String ISO o Date
 * @returns boolean
 */
export const isToday = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = getCurrentDateISO();
  const dateISO = toISODate(d);
  return dateISO === today;
};

/**
 * Verifica si una fecha es pasada
 * @param date - String ISO o Date
 * @returns boolean
 */
export const isPast = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d < getCurrentDate();
};

/**
 * Verifica si una fecha es futura
 * @param date - String ISO o Date
 * @returns boolean
 */
export const isFuture = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d > getCurrentDate();
};

/**
 * Obtiene el nombre del día de la semana
 * @param date - String ISO o Date
 * @returns Nombre del día (ej: "Lunes")
 */
export const getDayName = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dayName = d.toLocaleDateString(LOCALE, {
    weekday: 'long',
    timeZone: TIMEZONE
  });
  return dayName.charAt(0).toUpperCase() + dayName.slice(1);
};

/**
 * Calcula la diferencia en días entre dos fechas
 * @param date1 - Primera fecha
 * @param date2 - Segunda fecha
 * @returns Número de días de diferencia
 */
export const getDaysDifference = (date1: string | Date, date2: string | Date): number => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Formatea una duración en minutos a texto legible
 * @param minutes - Duración en minutos
 * @returns Texto formateado (ej: "1h 30min" o "45min")
 */
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
};
