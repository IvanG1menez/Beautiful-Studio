'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertCircle, Clock } from 'lucide-react';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  remainingTime: number;
  onContinue: () => void;
  onLogout: () => void;
}

/**
 * Modal que advierte al usuario sobre la inactividad
 * y le da la opción de continuar o cerrar sesión
 */
export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  isOpen,
  remainingTime,
  onContinue,
  onLogout,
}) => {
  // Formatear tiempo restante en minutos y segundos
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${seconds} segundos`;
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <AlertDialogTitle className="text-xl">
              Sesión por Expirar
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base space-y-3">
            <p>
              Has estado inactivo durante un tiempo. Por seguridad, tu sesión se cerrará automáticamente.
            </p>
            <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 rounded-lg">
              <Clock className="w-5 h-5 text-gray-600" />
              <span className="text-2xl font-bold text-gray-900">
                {formatTime(remainingTime)}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              ¿Deseas continuar trabajando?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            onClick={onLogout}
            className="bg-gray-100 hover:bg-gray-200"
          >
            Cerrar Sesión
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onContinue}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            Continuar Trabajando
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
