import { OperationalReportPage } from '../_components/OperationalReportPage';

export default function ReporteClientesPage() {
  return (
    <OperationalReportPage
      title="Reporte de Clientes"
      description="Detalle por cliente con último turno reservado, volumen de turnos, cancelaciones e ingresos asociados."
      endpoint="clientes"
      entityLabel="Clientes con actividad"
      mode="clientes"
    />
  );
}
