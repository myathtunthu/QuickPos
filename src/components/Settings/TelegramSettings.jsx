import { useState } from 'react';
import Input from '../UI/Input';
import Button from '../components/UI/Button';
import { useToastStore } from '../../store/toastStore';
import { Send } from 'lucide-react';

export default function TelegramSettings() {
  const addToast = useToastStore(state => state.addToast);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTestConnection = async () => {
    if (!botToken || !chatId) {
      addToast('Please enter both Bot Token and Chat ID', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ CyberPOS: Telegram integration test successful!'
        })
      });
      if (response.ok) {
        addToast('Test message sent successfully!');
      } else {
        addToast('Failed to send test message. Check credentials.', 'error');
      }
    } catch (error) {
      addToast('Network error during Telegram test', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Input 
        label="Telegram Bot Token" 
        placeholder="123456789:ABCdefGHIjklMNO..."
        value={botToken}
        onChange={(e) => setBotToken(e.target.value)}
        type="password"
      />
      <Input 
        label="Target Chat ID" 
        placeholder="-1001234567890"
        value={chatId}
        onChange={(e) => setChatId(e.target.value)}
      />
      <p className="text-xs text-gray-500 font-mono">
        Daily sales summaries and backups will be sent to this Telegram chat.
      </p>
      <Button 
        type="button" 
        variant="ghost" 
        onClick={handleTestConnection} 
        loading={loading}
        icon={Send}
        className="w-full border border-gray-700"
      >
        Test Connection
      </Button>
    </div>
  );
}
