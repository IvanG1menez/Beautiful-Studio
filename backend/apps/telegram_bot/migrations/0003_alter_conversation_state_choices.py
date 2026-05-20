from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("telegram_bot", "0002_telegramlinktoken"),
    ]

    operations = [
        migrations.AlterField(
            model_name="telegramconversationstate",
            name="state",
            field=models.CharField(
                choices=[
                    ("idle", "Idle"),
                    ("confirm_cancel", "Confirm Cancel"),
                    ("ended", "Ended"),
                ],
                default="idle",
                max_length=32,
            ),
        ),
    ]
