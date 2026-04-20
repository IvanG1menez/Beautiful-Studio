import logging

from celery import shared_task
from django.utils import timezone

from .models import TelegramUpdateLog
from .services import TelegramBotService

logger = logging.getLogger(__name__)


@shared_task(name="apps.telegram_bot.process_update")
def process_telegram_update(update_log_id):
    update_log = TelegramUpdateLog.objects.filter(id=update_log_id).first()
    if not update_log:
        logger.warning("Telegram update log inexistente: %s", update_log_id)
        return

    if update_log.processed:
        return

    TelegramBotService().process_update(update_log.payload)
    update_log.processed = True
    update_log.processed_at = timezone.now()
    update_log.save(update_fields=["processed", "processed_at"])
