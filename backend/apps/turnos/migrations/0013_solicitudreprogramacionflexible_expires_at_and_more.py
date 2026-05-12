from datetime import timedelta

from django.db import migrations, models
from django.utils import timezone


def set_existing_expires_at(apps, schema_editor):
    Solicitud = apps.get_model("turnos", "SolicitudReprogramacionFlexible")
    ConfiguracionGlobal = apps.get_model("authentication", "ConfiguracionGlobal")
    config = ConfiguracionGlobal.objects.filter(pk=1).first()
    horas = int(getattr(config, "horas_vencimiento_solicitud_reprogramacion", 48) or 48)

    for solicitud in Solicitud.objects.filter(
        estado__in=["pendiente", "en_revision"],
        expires_at__isnull=True,
    ):
        base = solicitud.created_at or timezone.now()
        solicitud.expires_at = base + timedelta(hours=max(1, horas))
        solicitud.save(update_fields=["expires_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0005_configuracionglobal_horas_vencimiento_reprogramacion"),
        ("turnos", "0012_alter_turno_unique_together"),
    ]

    operations = [
        migrations.AddField(
            model_name="solicitudreprogramacionflexible",
            name="expires_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="Fecha de vencimiento"),
        ),
        migrations.AddField(
            model_name="solicitudreprogramacionflexible",
            name="explicacion_vencimiento",
            field=models.TextField(blank=True, null=True, verbose_name="Explicación por vencimiento"),
        ),
        migrations.RunPython(set_existing_expires_at, migrations.RunPython.noop),
    ]
