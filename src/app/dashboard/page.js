"use client";
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import StatsCard from '@/components/StatsCard';
import { motion, AnimatePresence } from 'framer-motion';
import { FiActivity, FiCpu, FiBookOpen, FiHeart, FiZap, FiTrendingUp, FiX, FiTarget } from 'react-icons/fi';
import { useMemo, useState, useEffect } from 'react';
import { useData } from '@/hooks/useData';
import { useAuth } from '@/hooks/useAuth';
import { setAiCache } from '@/lib/firestore';
import { getAIRecommendation, generateImprovementRoadmap } from '@/lib/gemini';
import {
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Dashboard() {
    const { user } = useAuth();
    const { activities, skillAnalysis, loaded, aiCache, refreshAiCache } = useData();
    const [aiRecLoading, setAiRecLoading] = useState(false);

    // Use cached AI data if available for today
    const aiRec = aiCache?.dashboardInsights || null;
    const roadmap = aiCache?.dashboardRoadmap || null;

    const isLoaded = loaded.activities && loaded.skills && loaded.aiCache;

    const { displayStats, rawStats, activityData, breakdownData } = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayActivities = activities.filter(a => a.date === todayStr);

        const learningMins = todayActivities
            .filter(a => a.category?.toLowerCase() === 'learning')
            .reduce((s, a) => s + (parseInt(a.duration) || 0), 0);
        const healthMins = todayActivities
            .filter(a => a.category?.toLowerCase() === 'health')
            .reduce((s, a) => s + (parseInt(a.duration) || 0), 0);
        const timepassMins = todayActivities
            .filter(a => a.category?.toLowerCase() === 'timepass')
            .reduce((s, a) => s + (parseInt(a.duration) || 0), 0);

        const totalGrowthMins = learningMins + healthMins;
        const totalMins = totalGrowthMins + timepassMins;

        const prodScore = totalMins > 0 ? Math.round((totalGrowthMins / totalMins) * 100) : 0;
        const trendData = DAYS.map((day, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            const dateStr = date.toISOString().split('T')[0];
            const dayActivities = activities.filter(a => a.date === dateStr);
            const totalDayMins = dayActivities.reduce((acc, curr) => acc + (parseInt(curr.duration) || 0), 0);
            return { name: day, score: totalDayMins };
        });

        const stats = {
            productivityScore: Math.min(100, Math.floor((todayActivities.reduce((acc, curr) => acc + (parseInt(curr.duration) || 0), 0) / 480) * 100)),
            aiSkillMatch: skillAnalysis?.score || skillAnalysis?.aiAnalysis?.overallScore || 0,
            learningToday: learningMins,
            healthToday: healthMins,
            timepassToday: timepassMins,
            totalActivities: activities.length,
        };

        const breakdownData = [
            { name: 'Learning', value: learningMins, fill: '#8b5cf6' },
            { name: 'Health', value: healthMins, fill: '#10b981' },
            { name: 'Timepass', value: timepassMins, fill: '#ef4444' }
        ].filter(d => d.value > 0);

        return {
            displayStats: {
                productivityScore: `${stats.productivityScore}%`,
                aiSkillMatch: `${stats.aiSkillMatch}%`,
                learningToday: `${stats.learningToday}m`,
                healthToday: `${stats.healthToday}m`,
                timepassToday: `${stats.timepassToday}m`,
                totalActivities: stats.totalActivities,
            },
            rawStats: stats,
            activityData: trendData,
            breakdownData: breakdownData,
        };
    }, [activities, skillAnalysis]);

    // AI recommendation is now fetched manually via UI button to preserve API quotas, but cached.
    const [roadmapLoading, setRoadmapLoading] = useState(false);
    const [showRoadmapModal, setShowRoadmapModal] = useState(false);

    const handleGenerateRoadmap = async () => {
        if (!aiRec || roadmapLoading || !user) return;
        setRoadmapLoading(true);
        try {
            const data = await generateImprovementRoadmap({
                ...rawStats,
                percentile: aiRec.percentile,
                rankingText: aiRec.rankingText
            });
            const todayStr = new Date().toISOString().split('T')[0];
            await setAiCache(user.uid, todayStr, 'dashboardRoadmap', data);
            await refreshAiCache();
            setShowRoadmapModal(true);
        } catch (err) {
            alert("Failed to generate roadmap. Please try again.");
        } finally {
            setRoadmapLoading(false);
        }
    };

    if (!isLoaded) {
        return (
            <AuthenticatedLayout>
                <div className="flex justify-center items-center py-24">
                    <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </AuthenticatedLayout>
        );
    }

    return (
        <AuthenticatedLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-brand-600/10 border border-brand-500/20 p-4 rounded-xl">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
                        <p className="text-gray-400 text-sm">Balanced growth tracking: Learning, Health, and Skill Progress.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsCard title="Growth Score" value={displayStats.productivityScore} icon={FiActivity} colorClass="text-accent-400" />
                    <StatsCard title="AI Skill Match" value={displayStats.aiSkillMatch} icon={FiCpu} colorClass="text-brand-400" />
                    <StatsCard title="Learning Today" value={displayStats.learningToday} icon={FiBookOpen} colorClass="text-brand-500" />
                    <StatsCard title="Health Today" value={displayStats.healthToday} icon={FiHeart} colorClass="text-green-400" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-6"
                    >
                        <div className="glass-card p-6">
                            <h2 className="text-lg font-bold text-white mb-4">Growth Trend (Last 7 Days)</h2>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={activityData}>
                                        <defs>
                                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" vertical={false} />
                                        <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                            itemStyle={{ color: '#8b5cf6' }}
                                        />
                                        <Area type="monotone" dataKey="score" stroke="#8b5cf6" border-radius="20" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Overall Performance Metrics */}
                        <div className="glass-card p-6">
                            <h2 className="text-lg font-bold text-white mb-4">Overall Performance Metrics</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {/* Growth Score Chart */}
                                <div className="bg-surface-hover p-4 rounded-xl border border-surface-border flex flex-col items-center justify-center">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Growth Score</h3>
                                    <div className="w-full h-32 relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Score', value: rawStats.productivityScore || 0, fill: '#8b5cf6' },
                                                        { name: 'Remaining', value: 100 - (rawStats.productivityScore || 0), fill: '#334155' }
                                                    ]}
                                                    cx="50%" cy="50%"
                                                    innerRadius={35} outerRadius={50}
                                                    startAngle={90} endAngle={-270}
                                                    dataKey="value" stroke="none"
                                                >
                                                    <Cell key="cell-0" fill="#8b5cf6" />
                                                    <Cell key="cell-1" fill="#334155" />
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-lg font-bold text-white">{displayStats.productivityScore}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Skill Match Chart */}
                                <div className="bg-surface-hover p-4 rounded-xl border border-surface-border flex flex-col items-center justify-center">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">AI Skill Match</h3>
                                    <div className="w-full h-32 relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Match', value: rawStats.aiSkillMatch || 0, fill: '#06b6d4' },
                                                        { name: 'Remaining', value: 100 - (rawStats.aiSkillMatch || 0), fill: '#334155' }
                                                    ]}
                                                    cx="50%" cy="50%"
                                                    innerRadius={35} outerRadius={50}
                                                    startAngle={90} endAngle={-270}
                                                    dataKey="value" stroke="none"
                                                >
                                                    <Cell key="cell-0" fill="#06b6d4" />
                                                    <Cell key="cell-1" fill="#334155" />
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-lg font-bold text-white">{displayStats.aiSkillMatch}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-brand-600/10 to-accent-600/10 border border-brand-500/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-500 rounded-lg text-white">
                                        <FiActivity className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm text-gray-300 font-medium">Total Logged Activities</span>
                                </div>
                                <span className="text-xl font-bold text-brand-400">{displayStats.totalActivities}</span>
                            </div>
                        </div>

                        {/* Today's Activity Breakdown Pie Chart */}
                        <div className="glass-card p-6">
                            <h2 className="text-lg font-bold text-white mb-4">Today's Activity Breakdown</h2>
                            {breakdownData.length > 0 ? (
                                <div className="h-48 w-full mt-4 flex items-center justify-center relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={breakdownData}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {breakdownData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-48 w-full flex items-center justify-center border-2 border-dashed border-surface-border rounded-xl">
                                    <p className="text-gray-500 text-sm">No activities logged today.</p>
                                </div>
                            )}
                            <div className="flex justify-around mt-4 pt-4 border-t border-surface-border text-sm">
                                <div className="flex flex-col items-center">
                                    <span className="text-gray-400 uppercase text-[10px] tracking-widest font-bold">Learning</span>
                                    <span className="text-lg text-[#8b5cf6] font-bold">{displayStats.learningToday}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-gray-400 uppercase text-[10px] tracking-widest font-bold">Health</span>
                                    <span className="text-lg text-[#10b981] font-bold">{displayStats.healthToday}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-gray-400 uppercase text-[10px] tracking-widest font-bold">Timepass</span>
                                    <span className="text-lg text-[#ef4444] font-bold">{displayStats.timepassToday}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="space-y-6"
                    >
                        <div className="glass-card p-6 glow-box relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2"></div>
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                                <span className="flex items-center"><FiCpu className="mr-2 text-brand-400" /> AI Insights</span>
                                <button
                                    onClick={async () => {
                                        if (!user || aiRecLoading) return;
                                        setAiRecLoading(true);
                                        try {
                                            const rec = await getAIRecommendation(rawStats);
                                            const todayStr = new Date().toISOString().split('T')[0];
                                            await setAiCache(user.uid, todayStr, 'dashboardInsights', rec);
                                            await refreshAiCache();
                                        } catch (err) {
                                            console.error(err);
                                            alert("AI is currently busy. Please try again.");
                                        } finally {
                                            setAiRecLoading(false);
                                        }
                                    }}
                                    disabled={aiRecLoading}
                                    className="text-xs bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 relative z-10"
                                >
                                    {aiRecLoading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiZap className="w-3 h-3" />} 
                                    {aiRec ? "Refresh" : "Generate"}
                                </button>
                            </h2>
                            <div className="bg-surface-hover p-5 rounded-xl border border-surface-border">
                                {aiRecLoading ? (
                                    <div className="flex flex-col items-center gap-3 py-4 text-sm text-gray-400">
                                        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                                        <span>AI is calculating your global ranking...</span>
                                    </div>
                                ) : aiRec ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b border-surface-border pb-3">
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-widest">Global Ranking</p>
                                                <p className="text-2xl font-black text-brand-400">{aiRec.percentile}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-brand-500 font-bold uppercase">{aiRec.rankingText}</p>
                                                <FiTrendingUp className="ml-auto text-brand-400 animate-pulse" />
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-300 leading-relaxed italic">
                                            "{aiRec.insight}"
                                        </p>
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Optimization Tips</p>
                                            <ul className="space-y-2">
                                                {aiRec.tips.map((tip, i) => (
                                                    <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1 shrink-0" />
                                                        {tip}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <button
                                            onClick={handleGenerateRoadmap}
                                            disabled={roadmapLoading}
                                            className="w-full mt-4 py-3 bg-gradient-to-r from-brand-600 to-brand-400 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                                        >
                                            {roadmapLoading ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : <FiZap />}
                                            {roadmapLoading ? "Processing..." : roadmap ? "Regenerate Roadmap" : "Create Improvement Roadmap"}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-xs text-gray-500 mb-2">Click generate for personalized ranking</p>
                                        <FiTrendingUp className="mx-auto text-gray-600 text-xl opacity-20" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {roadmap && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-card p-6 border-brand-500/30"
                            >
                                <h3 className="text-brand-400 font-bold mb-2 flex items-center gap-2">
                                    <FiZap /> {roadmap.goal}
                                </h3>
                                <p className="text-xs text-gray-400 mb-4">{roadmap.summary}</p>
                                <div className="space-y-4">
                                    {roadmap.weeks.map((w, i) => (
                                        <div key={i} className="p-3 bg-surface-hover rounded-lg border border-surface-border">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-brand-500">Week {w.week}</span>
                                                <span className="text-[10px] text-gray-500">{w.dailyTarget}</span>
                                            </div>
                                            <p className="text-xs font-bold text-white mb-2">{w.focus}</p>
                                            <ul className="space-y-1">
                                                {w.tasks.map((t, ti) => (
                                                    <li key={ti} className="text-[10px] text-gray-400 flex items-center gap-2">
                                                        <div className="w-1 h-1 bg-brand-500 rounded-full" /> {t}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 p-3 bg-brand-500/10 rounded-lg border border-brand-500/20">
                                    <p className="text-[10px] font-bold text-brand-400 mb-1 uppercase">Ultimate Milestone</p>
                                    <p className="text-xs text-white">{roadmap.ultimateMilestone}</p>
                                </div>
                            </motion.div>
                        )}


                    </motion.div>
                </div>
            </div>

            {/* Roadmap Modal */}
            <AnimatePresence>
                {showRoadmapModal && roadmap && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-background border border-surface-border w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl relative"
                        >
                            <div className="sticky top-0 bg-background/80 backdrop-blur-md p-6 border-b border-surface-border flex justify-between items-center z-10">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <FiZap className="text-brand-400" /> Improvement Roadmap
                                    </h2>
                                    <p className="text-xs text-brand-500 font-bold uppercase mt-1">{roadmap.goal}</p>
                                </div>
                                <button
                                    onClick={() => setShowRoadmapModal(false)}
                                    className="p-2 hover:bg-surface-hover rounded-full text-gray-400 transition-colors"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-8 space-y-8">
                                <div className="p-5 bg-brand-500/5 border border-brand-500/20 rounded-xl">
                                    <p className="text-sm text-gray-300 leading-relaxed italic">
                                        "{roadmap.summary}"
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    {roadmap.weeks.map((w, i) => (
                                        <div key={i} className="relative pl-8 border-l-2 border-surface-border group">
                                            <div className="absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full bg-surface-border border-4 border-background group-hover:bg-brand-500 group-hover:border-brand-500/30 transition-all duration-300" />
                                            <div className="mb-2 flex justify-between items-baseline">
                                                <h3 className="text-brand-400 font-black text-sm uppercase tracking-tighter">Week {w.week}</h3>
                                                <span className="text-[10px] bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full font-bold">{w.dailyTarget} Targets</span>
                                            </div>
                                            <div className="bg-surface-hover/50 p-4 rounded-xl border border-surface-border">
                                                <p className="text-white font-bold text-sm mb-3 underline decoration-brand-500/30 underline-offset-4">{w.focus}</p>
                                                <ul className="space-y-2">
                                                    {w.tasks.map((t, ti) => (
                                                        <li key={ti} className="text-xs text-gray-400 flex items-start gap-2">
                                                            <FiTrendingUp className="w-3 h-3 text-brand-400 mt-0.5 shrink-0" />
                                                            {t}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-6 bg-gradient-to-br from-brand-600/20 to-accent-600/10 border border-brand-500/30 rounded-2xl">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-brand-500 rounded-lg text-white">
                                            <FiTarget className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-white font-black text-sm uppercase">Ultimate Milestone</h4>
                                    </div>
                                    <p className="text-gray-200 text-sm font-medium pl-10">
                                        {roadmap.ultimateMilestone}
                                    </p>
                                </div>

                                <button
                                    onClick={() => setShowRoadmapModal(false)}
                                    className="w-full py-4 bg-surface-hover hover:bg-surface-border text-white font-bold rounded-xl transition-colors border border-surface-border"
                                >
                                    Dismiss Roadmap
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </AuthenticatedLayout>
    );
}
