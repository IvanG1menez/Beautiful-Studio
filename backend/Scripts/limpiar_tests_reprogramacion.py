"""Limpia los datos creados por los scripts de reprogramacion."""

from reprogramacion_test_utils import bootstrap_django, cleanup_previous_reprogramming_tests


def run():
    deleted = cleanup_previous_reprogramming_tests()
    print("\n=== Limpieza de datos: Reprogramacion ===")
    print(f"- Turnos eliminados: {deleted['turnos']}")
    print(f"- Historial eliminado: {deleted['historial']}")
    print(f"- Logs de reasignacion eliminados: {deleted['logs_reasignacion']}")
    print(f"- Solicitudes flexibles eliminadas: {deleted['solicitudes_flexibles']}")
    print("=== Limpieza Reprogramacion completada ===\n")


if __name__ == "__main__":
    bootstrap_django()
    run()
