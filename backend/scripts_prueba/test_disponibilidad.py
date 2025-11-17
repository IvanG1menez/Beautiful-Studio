import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from datetime import datetime, timedelta
from django.utils import timezone
from apps.empleados.models import Empleado, HorarioEmpleado
from apps.servicios.models import Servicio
from apps.turnos.models import Turno

# Datos de prueba
empleado_id = 9  # Ana Herrera
servicio_id = 22  # Afeitado Tradicional (30 min)
fecha = "2025-10-25"

print("=" * 70)
print("PRUEBA DE DISPONIBILIDAD DE HORARIOS")
print("=" * 70)

try:
    empleado = Empleado.objects.get(id=empleado_id)
    print(f"\n✓ Empleado: {empleado.nombre_completo} (ID: {empleado.id})")

    servicio = Servicio.objects.get(id=servicio_id)
    print(f"✓ Servicio: {servicio.nombre} (Duración: {servicio.duracion_minutos} min)")

    fecha_obj = datetime.strptime(fecha, "%Y-%m-%d").date()
    dia_semana = fecha_obj.weekday()
    dias_nombres = [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo",
    ]

    print(f"✓ Fecha: {fecha} ({dias_nombres[dia_semana]})")
    print(f"✓ Día de la semana (número): {dia_semana}")

    # Obtener horarios del empleado
    horarios_dia = HorarioEmpleado.objects.filter(
        empleado=empleado, dia_semana=dia_semana, is_active=True
    ).order_by("hora_inicio")

    print(f"\n📅 Horarios configurados para {dias_nombres[dia_semana]}:")
    if horarios_dia.exists():
        for h in horarios_dia:
            print(f"   • {h.hora_inicio} - {h.hora_fin}")
    else:
        print(f"   ⚠️  No hay horarios configurados para {dias_nombres[dia_semana]}")
        print("\n🔍 Horarios disponibles del empleado:")
        todos_horarios = HorarioEmpleado.objects.filter(
            empleado=empleado, is_active=True
        )
        for h in todos_horarios:
            print(
                f"   • Día {h.dia_semana} ({h.get_dia_semana_display()}): {h.hora_inicio} - {h.hora_fin}"
            )

    # Generar horarios disponibles
    if horarios_dia.exists():
        print(f"\n⏰ Generando slots disponibles...")
        horarios_disponibles = []
        incremento = timedelta(minutes=30)

        for horario_rango in horarios_dia:
            # Crear datetime aware (con zona horaria)
            hora_actual = timezone.make_aware(
                datetime.combine(fecha_obj, horario_rango.hora_inicio)
            )
            hora_fin = timezone.make_aware(
                datetime.combine(fecha_obj, horario_rango.hora_fin)
            )

            print(f"\n   Rango: {horario_rango.hora_inicio} - {horario_rango.hora_fin}")

            while (
                hora_actual + timedelta(minutes=servicio.duracion_minutos) <= hora_fin
            ):
                hora_fin_turno = hora_actual + timedelta(
                    minutes=servicio.duracion_minutos
                )

                # Verificar conflictos
                conflicto = Turno.objects.filter(
                    empleado=empleado,
                    fecha_hora__lt=hora_fin_turno,
                    fecha_hora__gte=hora_actual,
                    estado__in=["pendiente", "confirmado", "en_proceso"],
                ).exists()

                # Verificar que sea futuro
                es_futuro = hora_actual > timezone.now()

                hora_str = hora_actual.strftime("%H:%M")

                if not conflicto and es_futuro:
                    if hora_str not in horarios_disponibles:
                        horarios_disponibles.append(hora_str)
                        print(f"   ✓ {hora_str} - Disponible")
                else:
                    razon = (
                        "Conflicto con turno existente" if conflicto else "En el pasado"
                    )
                    print(f"   ✗ {hora_str} - No disponible ({razon})")

                hora_actual += incremento

        print(f"\n" + "=" * 70)
        print(f"RESULTADO: {len(horarios_disponibles)} horarios disponibles")
        print("=" * 70)
        if horarios_disponibles:
            print("Horarios:", ", ".join(sorted(horarios_disponibles)))
        else:
            print("⚠️  No hay horarios disponibles para esta fecha")

except Empleado.DoesNotExist:
    print("❌ Empleado no encontrado")
except Servicio.DoesNotExist:
    print("❌ Servicio no encontrado")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback

    traceback.print_exc()
