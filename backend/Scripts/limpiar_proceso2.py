"""Limpia datos de testing del Proceso 2 (reacomodamiento).

Elimina:
- Turnos creados por Scripts/test_proceso2.py (marcados con TEST_PROCESO2_)
- Historial asociado de esos turnos
- Logs de reasignacion donde esos turnos participaron
- Movimientos de billetera asociados a esos turnos

Ademas, restablece los saldos base de los 3 clientes demo para pruebas repetibles:
- cliente1: 1000.00
- cliente2: 500.00
- cliente3: 0.00

Ejecucion:
- Con django-extensions: python manage.py runscript limpiar_proceso2
- Como script directo:   python Scripts/limpiar_proceso2.py
"""

from decimal import Decimal


SCENARIO_TAG = "TEST_PROCESO2_"
BASE_WALLET_BALANCES = {
    "cliente1@beautifulstudio.com": Decimal("1000.00"),
    "cliente2@beautifulstudio.com": Decimal("500.00"),
    "cliente3@beautifulstudio.com": Decimal("0.00"),
}


def _get_cliente(user_model, email):
    user = (
        user_model.objects.filter(email=email).select_related("cliente_profile").first()
    )
    if not user or not hasattr(user, "cliente_profile"):
        return None
    return user.cliente_profile


def run():
    from django.contrib.auth import get_user_model
    from django.db.models import Q

    from apps.clientes.models import Billetera, MovimientoBilletera
    from apps.turnos.models import Turno, HistorialTurno, LogReasignacion

    User = get_user_model()

    print("\n=== Limpieza de datos: Proceso 2 ===")

    clientes = []
    for email in BASE_WALLET_BALANCES.keys():
        cliente = _get_cliente(User, email)
        if cliente:
            clientes.append(cliente)

    turnos_qs = Turno.objects.filter(
        Q(notas_cliente__startswith=SCENARIO_TAG)
        | Q(
            cliente__in=clientes,
            notas_cliente__in=[
                "TEST_PROCESO2_CERCANO_CANCELABLE",
                "TEST_PROCESO2_CANDIDATO_1",
                "TEST_PROCESO2_CANDIDATO_2",
            ],
        )
    )

    turno_ids = list(turnos_qs.values_list("id", flat=True))

    deleted_logs = 0
    deleted_hist = 0
    deleted_movs = 0
    deleted_turnos = 0

    if turno_ids:
        deleted_logs += LogReasignacion.objects.filter(
            turno_cancelado_id__in=turno_ids
        ).count()
        LogReasignacion.objects.filter(turno_cancelado_id__in=turno_ids).delete()

        deleted_logs += LogReasignacion.objects.filter(
            turno_ofrecido_id__in=turno_ids
        ).count()
        LogReasignacion.objects.filter(turno_ofrecido_id__in=turno_ids).delete()

        deleted_hist = HistorialTurno.objects.filter(turno_id__in=turno_ids).count()
        HistorialTurno.objects.filter(turno_id__in=turno_ids).delete()

        deleted_movs = MovimientoBilletera.objects.filter(
            turno_id__in=turno_ids
        ).count()
        MovimientoBilletera.objects.filter(turno_id__in=turno_ids).delete()

        deleted_turnos = turnos_qs.count()
        turnos_qs.delete()

    print(f"- Turnos eliminados: {deleted_turnos}")
    print(f"- Historial eliminado: {deleted_hist}")
    print(f"- Logs de reasignacion eliminados: {deleted_logs}")
    print(f"- Movimientos de billetera asociados eliminados: {deleted_movs}")

    # Restaurar saldos base para pruebas repetibles
    for email, saldo_objetivo in BASE_WALLET_BALANCES.items():
        cliente = _get_cliente(User, email)
        if not cliente:
            print(f"- Aviso: no se encontro cliente base {email}")
            continue

        billetera, _ = Billetera.objects.get_or_create(cliente=cliente)
        saldo_anterior = billetera.saldo
        billetera.saldo = saldo_objetivo
        billetera.save(update_fields=["saldo"])
        print(f"- Saldo restaurado {email}: ${saldo_anterior} -> ${saldo_objetivo}")

    print("=== Limpieza Proceso 2 completada ===\n")


if __name__ == "__main__":
    import os
    import sys
    import django

    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if BASE_DIR not in sys.path:
        sys.path.insert(0, BASE_DIR)

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    django.setup()
    run()
