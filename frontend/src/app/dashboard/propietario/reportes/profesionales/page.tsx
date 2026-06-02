import { OperationalReportPage } from '../_components/OperationalReportPage';

export default function ReporteProfesionalesPage() {
  return (
    <OperationalReportPage
      title="Reporte de Profesionales"
      description="Rendimiento por profesional, último turno asignado, último turno ofrecido y métricas de conversión operativa."
      endpoint="profesionales"
      entityLabel="Profesionales con actividad"
      mode="profesionales"
    />
  );
}
