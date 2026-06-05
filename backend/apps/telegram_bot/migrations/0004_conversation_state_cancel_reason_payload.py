from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("telegram_bot", "0003_alter_conversation_state_choices"),
    ]

    operations = [
        migrations.AddField(
            model_name="telegramconversationstate",
            name="pending_payload",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name="telegramconversationstate",
            name="state",
            field=models.CharField(
                choices=[
                    ("idle", "Idle"),
                    ("confirm_cancel", "Confirm Cancel"),
                    ("ended", "Ended"),
                    ("waiting_cancel_reason", "Waiting Cancel Reason"),
                ],
                default="idle",
                max_length=32,
            ),
        ),
    ]
