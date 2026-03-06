"use client";
import { motion } from 'framer-motion';

export default function StatsCard({ title, value, icon: Icon, trend, trendValue, colorClass = "text-brand-400" }) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="glass-card p-6 flex flex-col justify-between"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-surface-hover ${colorClass} bg-opacity-20`}>
                    <Icon className="w-6 h-6" />
                </div>

                {trend && (
                    <div className={`text-sm font-medium px-2 py-1 rounded-full ${trend === 'up' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                        {trend === 'up' ? '+' : '-'}{trendValue}
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
                <p className="text-3xl font-bold text-white mt-1">{value}</p>
            </div>
        </motion.div>
    );
}
