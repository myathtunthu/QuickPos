import { useMemo, useState } from 'react';
import { AlertTriangle, Send, ShieldCheck } from 'lucide-react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import { useToastStore } from '../../store/toastStore';

const BOT_TOKEN_PATTERN = /^\d{6,14}:[A-Za-z0-9_-]{30,}$/;
const CHAT_ID_PATTERN = /^-?\d{5,20}$/;
const TELEGRAM_TEST_ENDPOINT = '/api/telegram/test';

function maskSecret(value) {
  if (!value) return '';
  if (value.length <= 10) return '••••••';
  return `${value.slice(0, 6)}••••••${value.slice(-4)}`;
}

function normaliseInput(value) {
  return String(value || '').trim();
}

export default function TelegramSettings() {
  const addToast = useToastStore((state) => state.addToast);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);

  const cleanBotToken = useMemo(() => normaliseInput(botToken), [botToken]);
  const cleanChatId = useMemo(() => normaliseInput(chatId), [chatId]);
  const isTokenValid = BOT_TOKEN_PATTERN.test(cleanBotToken);
  const isChatIdValid = CHAT_ID_PATTERN.test(cleanChatId);
  const canTest = isTokenValid && isChatIdValid && !loading;

  const handleTestConnection = async () => {
    if (!isTokenValid) {
      addToast('Telegram Bot Token ပုံစံမမှန်ပါ။', 'error');
      return;
    }

    if (!isChatIdValid) {
      addToast('Telegram Chat ID ပုံစံမမှန်ပါ။', 'error');
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(TELEGRAM_TEST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({
          botToken: cleanBotToken,
          chatId: cleanChatId,
          message: '✅ QuickPOS: Telegram integration test successful!',
        }),
      });

      if (response.ok) {
        addToast('Telegram test message ပို့ပြီးပါပြီ။');
        return;
      }

      if (response.status === 404) {
        addToast('Server-side Telegram API မတပ်ဆင်ရသေးပါ။ /api/telegram/test ကို backend မှာထည့်ပါ။', 'error');
        return;
      }

      addToast('Telegram test မအောင်မြင်ပါ။ Token/Chat ID နှင့် server logs ကိုစစ်ပါ။', 'error');
    } catch (error) {
      if (error?.name === 'AbortError') {
        addToast('Telegram test timeout ဖြစ်သွားပါသည်။ Network/backend ကိုစစ်ပါ။', 'error');
      } else {
        addToast('Telegram test လုပ်ရာတွင် network error ဖြစ်ပါသည်။', 'error');
      }
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
          <div>
            <p className="font-semibold text-amber-100">Security notice</p>
            <p className="mt-1 text-xs leading-6 text-amber-100/80">
              Telegram Bot Token ကို browser မှ Telegram API သို့ တိုက်ရိုက်မပို့တော့ပါ။ Production တွင် backend endpoint သို့မဟုတ် Cloud Function ကနေသာ test/send လုပ်ပါ။
            </p>
          </div>
        </div>
      </div>

      <Input
        label="Telegram Bot Token"
        placeholder="123456789:ABCdefGHIjklMNO..."
        value={botToken}
        onChange={(event) => setBotToken(event.target.value)}
        type="password"
        autoComplete="off"
        error={botToken && !isTokenValid ? 'Bot Token ပုံစံမမှန်ပါ။' : ''}
      />

      <Input
        label="Target Chat ID"
        placeholder="-1001234567890"
        value={chatId}
        onChange={(event) => setChatId(event.target.value)}
        inputMode="numeric"
        autoComplete="off"
        error={chatId && !isChatIdValid ? 'Chat ID သည် ဂဏန်းဖြစ်ရပါမည်။' : ''}
      />

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-xs leading-6 text-gray-400">
        <div className="mb-2 flex items-center gap-2 text-gray-300">
          <ShieldCheck size={16} className="text-neon-cyan" />
          <span className="font-semibold">Integration summary</span>
        </div>
        <p>Bot Token: {cleanBotToken ? maskSecret(cleanBotToken) : 'မဖြည့်ရသေးပါ'}</p>
        <p>Chat ID: {cleanChatId || 'မဖြည့်ရသေးပါ'}</p>
        <p className="mt-2 text-gray-500">Daily sales summaries, low-stock alerts, and backup notifications can be sent to this Telegram chat after backend setup.</p>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={handleTestConnection}
        loading={loading}
        icon={Send}
        className="w-full border border-gray-700"
        disabled={!canTest}
      >
        Test Secure Connection
      </Button>
    </div>
  );
}
