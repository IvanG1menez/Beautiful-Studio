import os
import sys
import django
from datetime import datetime, timedelta

# Agregar el directorio backend al path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.turnos.models import Turno
from apps.servicios.models import Servicio
from django.utils import timezone


def diagnosticar_reasignacion():
    """
    Diagnostica por qué no se envió oferta de reasignación
    """
    print("=" * 70)
    print("🔍 DIAGNÓSTICO DE REASIGNACIÓN")
    print("=" * 70)
    print()

    # Buscar turnos recientes (últimos 7 días)
    fecha_limite = timezone.now() - timedelta(days=7)

    turnos_cancelados = (
        Turno.objects.filter(estado="cancelado", updated_at__gte=fecha_limite)
        .select_related("servicio", "empleado__user", "cliente__user")
        .order_by("-updated_at")[:10]
    )

    if not turnos_cancelados.exists():
        print("❌ No se encontraron turnos cancelados en los últimos 7 días")
        print()
        return

    print(f"📋 Turnos cancelados recientes ({turnos_cancelados.count()}):\n")

    for turno in turnos_cancelados:
        print(f"{'='*70}")
        print(f"🎫 Turno ID: {turno.id}")
        print(
            f"   Cliente: {turno.cliente.nombre_completo if turno.cliente else 'Sin cliente'}"
        )
        print(
            f"   Servicio: {turno.servicio.nombre if turno.servicio else 'Sin servicio'}"
        )
        print(
            f"   Empleado: {turno.empleado.user.get_full_name() if turno.empleado else 'Sin empleado'}"
        )
        print(f"   Fecha turno: {turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
        print(f"   Cancelado: {turno.updated_at.strftime('%d/%m/%Y %H:%M:%S')}")
        print()

        if not turno.servicio:
            print("   ❌ PROBLEMA: Turno sin servicio asignado")
            print()
            continue

        # Verificar configuración del servicio
        servicio = turno.servicio
        print(f"   🔧 Configuración del servicio:")
        print(f"      - permite_reacomodamiento: {servicio.permite_reacomodamiento}")

        if servicio.permite_reacomodamiento:
            print(
                f"      - tipo_descuento_adelanto: {servicio.tipo_descuento_adelanto}"
            )
            print(
                f"      - valor_descuento_adelanto: {servicio.valor_descuento_adelanto}"
            )
            print(
                f"      - tiempo_espera_respuesta: {servicio.tiempo_espera_respuesta} min"
            )
            print(f"      → 📌 PROCESO: Reacomodamiento (Proceso 2 - sistema antiguo)")
        else:
            print(f"      → 📌 PROCESO: Reasignación (nuevo sistema con token)")
        print()

        # Verificar si está en el futuro
        if turno.fecha_hora <= timezone.now():
            print(f"   ⏰ PROBLEMA: El turno ya pasó (no se puede reasignar)")
            print()
            continue

        # Buscar candidatos potenciales
        print(f"   🔍 Buscando candidatos...")

        candidatos = (
            Turno.objects.filter(
                servicio=turno.servicio,
                empleado=turno.empleado,
                estado="confirmado",
                fecha_hora__gt=turno.fecha_hora,
            )
            .select_related("cliente__user")
            .order_by("fecha_hora")[:5]
        )

        if not candidatos.exists():
            print(f"   ❌ No se encontraron candidatos:")
            print(f"      - Mismo servicio: {turno.servicio.nombre}")
            print(f"      - Mismo empleado: {turno.empleado.user.get_full_name()}")
            print(f"      - Estado: confirmado")
            print(
                f"      - Fecha posterior a: {turno.fecha_hora.strftime('%d/%m/%Y %H:%M')}"
            )
            print()

            # Mostrar turnos que podrían haber sido candidatos
            turnos_posteriores = (
                Turno.objects.filter(
                    servicio=turno.servicio, fecha_hora__gt=turno.fecha_hora
                )
                .select_related("cliente__user", "empleado__user")
                .order_by("fecha_hora")[:5]
            )

            if turnos_posteriores.exists():
                print(
                    f"   ℹ️  Turnos posteriores encontrados (pero no cumplen todos los requisitos):"
                )
                for t in turnos_posteriores:
                    razon = []
                    if t.empleado_id != turno.empleado_id:
                        razon.append(
                            f"Empleado diferente: {t.empleado.user.get_full_name()}"
                        )
                    if t.estado != "confirmado":
                        razon.append(f"Estado: {t.estado}")

                    print(
                        f"      - ID {t.id}: {t.cliente.nombre_completo if t.cliente else 'Sin cliente'}"
                    )
                    print(f"        Fecha: {t.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
                    print(f"        Razón: {', '.join(razon)}")
            print()
            continue

        print(f"   ✅ Candidatos encontrados: {candidatos.count()}")
        print()
        print(f"   👥 Lista de candidatos:")
        for idx, candidato in enumerate(candidatos, 1):
            dias_adelanto = (candidato.fecha_hora - turno.fecha_hora).days
            print(
                f"      {idx}. ID {candidato.id}: {candidato.cliente.nombre_completo if candidato.cliente else 'Sin cliente'}"
            )
            print(f"         Fecha: {candidato.fecha_hora.strftime('%d/%m/%Y %H:%M')}")
            print(
                f"         Email: {candidato.cliente.user.email if candidato.cliente and candidato.cliente.user else 'Sin email'}"
            )
            print(f"         Adelanto: {dias_adelanto} días")
        print()

        # Verificar si hay LogReasignacion
        from apps.turnos.models import LogReasignacion

        logs = LogReasignacion.objects.filter(turno_cancelado_id=turno.id).order_by(
            "-fecha_envio"
        )

        if logs.exists():
            print(f"   📝 Se encontraron {logs.count()} intentos de reasignación:")
            for log in logs:
                print(f"      - Log ID {log.id}")
                print(f"        Token: {log.token}")
                print(
                    f"        Enviado: {log.fecha_envio.strftime('%d/%m/%Y %H:%M:%S')}"
                )
                print(f"        Estado: {log.estado_final or 'pendiente'}")
                if log.turno_ofrecido:
                    print(
                        f"        Ofrecido a: {log.turno_ofrecido.cliente.nombre_completo if log.turno_ofrecido.cliente else 'Sin cliente'}"
                    )
        else:
            print(f"   ⚠️  NO se encontraron registros de reasignación")
            print(f"      Posibles causas:")
            print(f"      1. ❌ Celery no está corriendo (los tasks no se ejecutan)")
            print(f"      2. ❌ El proceso de reasignación falló silenciosamente")
            print(f"      3. ❌ Redis no está disponible")
        print()

    print("=" * 70)
    print()
    print("💡 RECOMENDACIONES:")
    print()
    print("1. Si Celery no está corriendo:")
    print("   - Los procesos automáticos no funcionarán")
    print("   - Puedes ejecutar manualmente: iniciar_reasignacion_turno(turno_id)")
    print()
    print("2. Si el servicio tiene permite_reacomodamiento=True:")
    print("   - Se usa el proceso 2 (antiguo) que no tiene página de confirmación")
    print("   - Recomendación: cambiar signal para usar nuevo proceso de reasignación")
    print()
    print("3. Para probar manualmente:")
    print("   python Scripts/test_reasignacion_manual.py")
    print()


if __name__ == "__main__":
    try:
        diagnosticar_reasignacion()
    except Exception as e:
        print()
        print(f"❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        print()
