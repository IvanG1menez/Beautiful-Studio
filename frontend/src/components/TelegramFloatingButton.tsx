'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { post } from '@/services/api';
import { Bot, Link2, Send, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const BOT_URL = 'https://t.me/beauti0598_bot';

const CTA_MESSAGES = [
  '¿Ya conociste a BeautyBot?',
  '¡No te olvides de ningun turno! 💅',
  'Gestiona tus citas por Telegram en segundos',
  'Recordatorios y cancelaciones sin llamar al local',
];

export default function TelegramFloatingButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % CTA_MESSAGES.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const openBot = () => {
    window.open(BOT_URL, '_blank', 'noopener,noreferrer');
  };

  const handleMainClick = () => {
    if (user?.has_telegram_link) {
      openBot();
      return;
    }
    setOpen(true);
  };

  const handleLinkTelegram = async () => {
    try {
      setIsLinking(true);
      const response = await post<{ telegram_url: string }>('/telegram/link-token/', {});
      toast.success('Abrimos BeautyBot para vincular tu cuenta.');
      setOpen(false);
      window.open(response.telegram_url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      toast.error(error?.message || 'No pudimos generar el enlace de Telegram');
    } finally {
      setIsLinking(false);
    }
  };

  if (!user || user.role !== 'cliente') {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={handleMainClick}
          className="group max-w-[260px] rounded-full border border-cyan-200 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-300 hover:text-cyan-700"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-500" />
            {CTA_MESSAGES[bannerIndex]}
          </span>
        </button>

        <Button
          type="button"
          onClick={handleMainClick}
          className="h-14 w-14 rounded-full bg-cyan-500 text-white shadow-xl transition hover:scale-105 hover:bg-cyan-600"
          aria-label="Abrir BeautyBot en Telegram"
        >
          <Send className="h-6 w-6" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Bot className="h-5 w-5 text-cyan-600" />
              ¿Ya conociste a BeautyBot?
            </DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-relaxed">
              ¡No te olvides de ningun turno! Vincula tu cuenta con BeautyBot y recibe
              recordatorios, cancela o reprograma tus citas directamente desde Telegram.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-800">
            ¿Querés gestionar tus turnos desde WhatsApp o Telegram? 📱
            <br />
            Te vamos a llevar a Telegram con un enlace seguro para que BeautyBot reconozca tu cuenta.
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLinking}
            >
              Mas tarde
            </Button>
            <Button type="button" onClick={handleLinkTelegram} disabled={isLinking}>
              <Link2 className="mr-2 h-4 w-4" />
              {isLinking ? 'Generando enlace...' : 'Vincular con BeautyBot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
