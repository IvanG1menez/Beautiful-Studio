"""Limpia los datos creados por los scripts de reprogramacion.

Tambien resetea el limite mensual de reprogramacion del cliente/servicio demo,
eliminando los historiales del mes que activan el bloqueo de "ya reprogramaste".
"""

from reprogramacion_test_utils import bootstrap_django, cleanup_previous_reprogramming_tests


def run():
    deleted = cleanup_previous_reprogramming_tests(reset_monthly_limit=True)
    print("\n=== Limpieza de datos: Reprogramacion ===")
    print(f"- Turnos eliminados: {deleted['turnos']}")
    print(f"- Historial eliminado: {deleted['historial']}")
    print(f"- Historial limite mensual eliminado: {deleted['historial_limite_mensual']}")
    print(f"- Logs de reasignacion eliminados: {deleted['logs_reasignacion']}")
    print(f"- Pagos Mercado Pago eliminados: {deleted['pagos_mercadopago']}")
    print(f"- Solicitudes flexibles eliminadas: {deleted['solicitudes_flexibles']}")
    print("- Limite mensual demo reseteado para volver a reprogramar")
    print("=== Limpieza Reprogramacion completada ===\n")


if __name__ == "__main__":
    bootstrap_django()
    run()
