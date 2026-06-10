import { useMemo, useState } from 'react';
import { getAuth, updatePassword } from 'firebase/auth';
import { Eye, EyeOff, Key, ShieldCheck } from 'lucide-react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import { useToastStore } from '../../store/toastStore';

const MIN_PASSWORD_LENGTH = 8;

function getPasswordScore(password) {
  const checks = {
    length: password.length >= MIN_PASSWORD_LENGTH,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score };
}

function getFirebasePasswordMessage(error) {
  const code = error?.code || '';

  if (code === 'auth/requires-recent-login') {
    return 'လုံခြုံရေးအတွက် password ပြောင်းရန် အကောင့်ကို logout/login ပြန်လုပ်ပြီး ထပ်ကြိုးစားပါ။';
  }

  if (code === 'auth/weak-password') {
    return 'Password သည် အားနည်းနေပါသည်။ အနည်းဆုံး စာလုံး ၈ လုံးနှင့် အက္ခရာ/ဂဏန်း/သင်္ကေတများ ထည့်ပါ။';
  }

  return 'Password ပြောင်းလဲမှု မအောင်မြင်ပါ။ ခဏနေပြီး ထပ်ကြိုးစားပါ။';
}

export default function PasswordSettings() {
  const addToast = useToastStore((state) => state.addToast);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordStrength = useMemo(() => getPasswordScore(password), [password]);
  const isStrongEnough = passwordStrength.score >= 4;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleUpdate = async (event) => {
    event.preventDefault();

    const nextPassword = password.trim();
    const nextConfirmPassword = confirmPassword.trim();

    if (!nextPassword || !nextConfirmPassword) {
      addToast('Password နှစ်ခုလုံး ဖြည့်ပါ။', 'error');
      return;
    }

    if (nextPassword !== nextConfirmPassword) {
      addToast('Password နှစ်ခု မတူပါ။', 'error');
      return;
    }

    if (nextPassword.length < MIN_PASSWORD_LENGTH || !isStrongEnough) {
      addToast('Password သည် အားနည်းနေပါသည်။ အနည်းဆုံး ၈ လုံးနှင့် uppercase/lowercase/number/symbol ထည့်ပါ။', 'error');
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        addToast('အရင် Login ဝင်ပါ။', 'error');
        return;
      }

      await updatePassword(user, nextPassword);
      addToast('Password ကို အောင်မြင်စွာ ပြောင်းပြီးပါပြီ။');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    } catch (error) {
      addToast(getFirebasePasswordMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpdate} className="space-y-5" autoComplete="off">
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-gray-300">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-cyan" />
          <div>
            <p className="font-semibold text-white">Security password policy</p>
            <p className="mt-1 text-xs leading-6 text-gray-400">
              Password အသစ်သည် အနည်းဆုံး ၈ လုံး၊ uppercase/lowercase၊ ဂဏန်း၊ သင်္ကေတ ပါရပါမည်။ Firebase security အရ တစ်ခါတစ်ရံ logout/login ပြန်လုပ်ရန် လိုနိုင်ပါသည်။
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Input
          label="New Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        <button
          type="button"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-8 text-gray-400 hover:text-white"
          onClick={() => setShowPassword((value) => !value)}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <Input
        label="Confirm New Password"
        type={showPassword ? 'text' : 'password'}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        required
      />

      <div className="grid gap-2 rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-xs text-gray-400 sm:grid-cols-2">
        <span className={passwordStrength.checks.length ? 'text-emerald-300' : ''}>• အနည်းဆုံး ၈ လုံး</span>
        <span className={passwordStrength.checks.upper && passwordStrength.checks.lower ? 'text-emerald-300' : ''}>• Uppercase/Lowercase</span>
        <span className={passwordStrength.checks.number ? 'text-emerald-300' : ''}>• ဂဏန်း ပါရမည်</span>
        <span className={passwordStrength.checks.symbol ? 'text-emerald-300' : ''}>• သင်္ကေတ ပါရမည်</span>
        <span className={passwordsMatch ? 'text-emerald-300' : ''}>• Confirm password တူရမည်</span>
        <span className={isStrongEnough ? 'text-emerald-300' : ''}>• Strength: {passwordStrength.score}/5</span>
      </div>

      <Button
        type="submit"
        loading={loading}
        icon={Key}
        className="w-full mt-4"
        disabled={loading || !password || !confirmPassword}
      >
        Update Security Key
      </Button>
    </form>
  );
}
