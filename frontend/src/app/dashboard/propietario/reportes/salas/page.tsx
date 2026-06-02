import { OperationalReportPage } from '../_components/OperationalReportPage';

export default function ReporteSalasPage() {
  return (
    <OperationalReportPage
      title="Reporte de Salas"
      description="Actividad por sala, último turno agendado, turnos reservados activos, capacidad e ingresos por período."
      endpoint="salas"
      entityLabel="Salas con actividad"
      mode="salas"
    />
  );
}
