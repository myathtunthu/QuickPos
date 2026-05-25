import { Outlet } from 'react-router-dom';
import BottomNav from '../BottomNav';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#080c14]">
      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-3 pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
