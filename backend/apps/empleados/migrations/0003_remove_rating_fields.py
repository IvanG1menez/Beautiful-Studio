from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("empleados", "0002_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="empleado",
            name="promedio_calificacion",
        ),
        migrations.RemoveField(
            model_name="empleado",
            name="total_encuestas",
        ),
    ]
