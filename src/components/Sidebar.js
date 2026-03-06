"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    FiHome,
    FiCpu,
    FiActivity,
    FiUsers,
    FiTarget,
    FiCheckSquare,
    FiPieChart,
    FiSettings
} from 'react-icons/fi';

const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: FiHome },
    { name: 'AI Skill Tracker', href: '/skills', icon: FiCpu },
    { name: 'AI Productivity Tracker', href: '/productivity', icon: FiActivity },
    { name: 'AI Coach', href: '/coach', icon: FiUsers },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="w-64 h-screen fixed left-0 top-0 border-r border-surface-border bg-background z-40 hidden md:flex flex-col">
            <div className="p-6">
                <h2 className="text-2xl font-bold text-gradient tracking-tight">Productivity+</h2>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link key={item.name} href={item.href}>
                            <div className={`relative flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'}`}>
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-active"
                                        className="absolute inset-0 bg-brand-600/20 border border-brand-500/30 rounded-xl"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    />
                                )}
                                <Icon className={`w-5 h-5 mr-3 relative z-10 ${isActive ? 'text-brand-400' : 'group-hover:text-brand-400 transition-colors'}`} />
                                <span className="font-medium relative z-10">{item.name}</span>
                            </div>
                        </Link>
                    );
                })}
            </nav>

        </div>
    );
}
