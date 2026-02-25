import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un número como moneda en pesos argentinos
 * @param amount - Monto a formatear
 * @returns String formateado como moneda (ej: "$1.234,56")
 */
export function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return '$0,00';
  
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

/**
 * Parsea un string de moneda a número
 * @param currency - String de moneda (ej: "$1.234,56" o "1234.56")
 * @returns Número parseado
 */
export function parseCurrency(currency: string): number {
  if (!currency) return 0;
  
  // Remover símbolos de moneda y espacios
  const cleaned = currency.replace(/[$\s]/g, '');
  
  // Detectar si usa punto o coma como separador decimal
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  
  let normalized = cleaned;
  
  if (hasComma && hasDot) {
    // Formato europeo: 1.234,56 -> 1234.56
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // Solo coma: 1234,56 -> 1234.56
    normalized = cleaned.replace(',', '.');
  }
  
  return parseFloat(normalized) || 0;
}

