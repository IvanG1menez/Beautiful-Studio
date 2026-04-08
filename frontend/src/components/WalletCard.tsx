'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, History, TrendingUp, Wallet } from 'lucide-react';

interface WalletCardProps {
  saldo: number;
  fechaVencimiento?: string | null;
  estaPorVencer?: boolean;
  className?: string;
  onVerHistorial?: () => void;
  showActions?: boolean;
}

export default function WalletCard({
  saldo,
  fechaVencimiento,
  estaPorVencer,
  className = '',
  onVerHistorial,
  showActions = true
}: WalletCardProps) {
  const tieneSaldo = saldo > 0;
  const vencimientoTexto = fechaVencimiento
    ? `Credito vigente hasta el ${new Date(fechaVencimiento).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })}`
    : null;

  return (
    <Card className={`border-2 ${tieneSaldo ? 'border-green-200 bg-linear-to-br from-green-50 to-emerald-50' : 'border-gray-200'} ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${tieneSaldo ? 'bg-green-500' : 'bg-gray-400'}`}>
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Tu Billetera</CardTitle>
              <CardDescription className="text-xs">Saldo disponible</CardDescription>
            </div>
          </div>
          {tieneSaldo && (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
              <TrendingUp className="w-3 h-3 mr-1" />
              Disponible
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Saldo Principal */}
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <DollarSign className={`w-6 h-6 ${tieneSaldo ? 'text-green-600' : 'text-gray-500'}`} />
            <span className={`text-4xl font-bold ${tieneSaldo ? 'text-green-600' : 'text-gray-600'}`}>
              {formatCurrency(saldo)}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {tieneSaldo
              ? '¡Podés usar este crédito en tu próxima reserva!'
              : 'Cancelá turnos con anticipación para acumular crédito'}
          </p>
        </div>

        {/* Acciones */}
        {showActions && onVerHistorial && (
          <div className="pt-3 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={onVerHistorial}
            >
              <History className="w-4 h-4 mr-2" />
              Ver Auditoría de Movimientos
            </Button>
          </div>
        )}

        {/* Info adicional */}
        {tieneSaldo && (
          <div className="text-xs text-center text-gray-500 pt-2 border-t">
            {vencimientoTexto ? (
              <>
                {estaPorVencer && <span className="font-semibold text-amber-600 mr-1">⚠ Próximo a vencer.</span>}
                <span>{vencimientoTexto}</span>
              </>
            ) : (
              <>💡 Tip: El crédito se genera automáticamente al cancelar turnos con más de 24hs de anticipación</>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
