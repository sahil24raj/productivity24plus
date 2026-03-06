"use client";
import { useAuth } from '@/hooks/useAuth';
import { FiLogOut, FiBell, FiMenu } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

export default function Navbar() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <div className="h-16 border-b border-surface-border bg-background/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6 md:ml-64">
            <div className="flex items-center">
                <button className="md:hidden text-gray-400 hover:text-white mr-4">
                    <FiMenu className="w-6 h-6" />
                </button>
                <div className="text-sm text-gray-400">
                    <span className="hidden sm:inline">Welcome back, </span>
                    <span className="font-medium text-white">{user?.email || 'Guest'}</span>
                </div>
            </div>

            <div className="flex items-center space-x-4">
                <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
                    <FiBell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-brand-500 rounded-full"></span>
                </button>

                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-brand-500 to-accent-500 flex items-center justify-center text-sm font-bold shadow-[0_0_10px_rgba(139,92,246,0.5)]">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>

                <button
                    onClick={handleLogout}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors ml-2"
                    title="Logout"
                >
                    <FiLogOut className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
