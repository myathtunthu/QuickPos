import { useState } from 'react';
import { getAuth, updatePassword } from 'firebase/auth';
import Input from '../UI/Input';
import Button from '../components/UI/Button';
import { useToastStore } from '../../store/toastStore';
import { Key } from 'lucide-react';

export default function PasswordSettings() {
  const addToast = useToastStore(state => state.addToast);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      addToast('Passwords do not match', 'error');
      return;
    }
    if (password.length < 6) {
      addToast('Password must be at least 6 characters', 'error');
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, password);
        addToast('Password updated successfully');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      console.error(error);
      addToast('Failed to update password. You may need to re-login.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpdate} className="space-y-4">
      <Input 
        label="New Password" 
        type="password" 
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Input 
        label="Confirm New Password" 
        type="password" 
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />
      <Button 
        type="submit" 
        loading={loading}
        icon={Key}
        className="w-full mt-4"
      >
        Update Security Key
      </Button>
    </form>
  );
}
