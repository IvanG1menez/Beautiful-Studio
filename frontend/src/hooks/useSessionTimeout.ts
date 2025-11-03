'use client';

import { useEffect, useRef, useState } from 'react';

interface UseSessionTimeoutOptions {
  // Tiempo de inactividad antes de mostrar advertencia (en milisegundos)
  idleTime?: number;
  // Tiempo para responder al modal de advertencia (en milisegundos)
  warningTime?: number;
  // Callback cuando se cierra la sesión
  onTimeout: () => void;
  // Callback cuando se muestra la advertencia
  onWarning?: () => void;
  // Si el sistema está habilitado
  enabled?: boolean;
}

interface SessionTimeoutState {
  isWarning: boolean;
  remainingTime: number;
  resetTimer: () => void;
  continueSession: () => void;
}

/**
 * Hook personalizado para gestionar timeout de sesión por inactividad
 * 
 * @param options - Opciones de configuración
 * @returns Estado y funciones para controlar el timeout
 */
export const useSessionTimeout = ({
  idleTime = 15 * 60 * 1000, // 15 minutos por defecto
  warningTime = 60 * 1000, // 1 minuto por defecto
  onTimeout,
  onWarning,
  enabled = true,
}: UseSessionTimeoutOptions): SessionTimeoutState => {
  const [isWarning, setIsWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(warningTime);

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lista de eventos que resetean el timer de inactividad
  const events = [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
  ];

  // Limpiar todos los timers
  const clearAllTimers = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  // Iniciar countdown cuando se muestra la advertencia
  const startCountdown = () => {
    setRemainingTime(warningTime);

    countdownIntervalRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1000) {
          clearAllTimers();
          setIsWarning(false);
          onTimeout();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
  };

  // Mostrar advertencia de inactividad
  const showWarning = () => {
    setIsWarning(true);
    if (onWarning) {
      onWarning();
    }
    startCountdown();

    // Timer para cerrar sesión si no responde
    warningTimerRef.current = setTimeout(() => {
      setIsWarning(false);
      clearAllTimers();
      onTimeout();
    }, warningTime);
  };

  // Resetear el timer de inactividad
  const resetTimer = () => {
    clearAllTimers();
    setIsWarning(false);
    setRemainingTime(warningTime);

    if (enabled) {
      // Iniciar nuevo timer de inactividad
      idleTimerRef.current = setTimeout(() => {
        showWarning();
      }, idleTime);
    }
  };

  // Continuar sesión (usuario respondió al modal)
  const continueSession = () => {
    resetTimer();
  };

  // Manejar eventos de actividad del usuario
  const handleUserActivity = () => {
    if (!isWarning) {
      resetTimer();
    }
  };

  // Configurar listeners de eventos
  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      return;
    }

    // Agregar listeners para cada evento
    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity);
    });

    // Iniciar el timer inicial
    resetTimer();

    // Limpiar listeners al desmontar
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      clearAllTimers();
    };
  }, [enabled, idleTime, warningTime]);

  return {
    isWarning,
    remainingTime,
    resetTimer,
    continueSession,
  };
};
