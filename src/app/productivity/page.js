"use client";
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiActivity, FiClock, FiPlus, FiX, FiTrash2, FiZap,
    FiHeart, FiBookOpen, FiCoffee, FiTrendingUp, FiMap,
    FiCheckCircle, FiInfo
} from 'react-icons/fi';
import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import { getProductivityTips, generateHealthPlan } from '@/lib/gemini';
import { setAiCache } from '@/lib/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const CATEGORIES = {
    timepass: {
        label: 'Timepass',
        icon: FiCoffee,
        color: '#ef4444',
        subcategories: ['Social Media', 'Extra Sleep', 'Online Games', 'Movies/Series', 'Browsing', 'Other']
    },
    learning: {
        label: 'Learning',
        icon: FiBookOpen,
        color: '#8b5cf6',
        subcategories: ['Self-study', 'Online Classes', 'Reading', 'Skill Practice', 'Research']
    },
    health: {
        label: 'Health',
        icon: FiHeart,
        color: '#10b981',
        subcategories: ['Exercise', 'Play Sports', 'Yoga/Meditation', 'Walk/Run', 'Stretching']
    }
};

const COLORS = ['#ef4444', '#8b5cf6', '#10b981'];

export default function AIProductivityTracker() {
    const { user } = useAuth();
    const { activities, loaded, aiCache, refreshAiCache } = useData();
    const [showModal, setShowModal] = useState(false);
    const [modalCategory, setModalCategory] = useState('learning');
    const [saving, setSaving] = useState(false);

    // Form state
    const [actName, setActName] = useState('');
    const [actSubcategory, setActSubcategory] = useState('');
    const [actDuration, setActDuration] = useState('');

    // AI States from cache
    const aiTips = aiCache?.productivityTips || [];
    const healthPlan = aiCache?.healthPlan || null;

    const [tipsLoading, setTipsLoading] = useState(false);
    const [planLoading, setPlanLoading] = useState(false);
    const [showPlanModal, setShowPlanModal] = useState(false);

    // Toggle State
    const [viewMode, setViewMode] = useState('daily');

    const todayStr = new Date().toISOString().split('T')[0];
    const todayActivities = activities.filter(a => a.date === todayStr);

    const stats = useMemo(() => {
        const counts = { timepass: 0, learning: 0, health: 0 };

        let targetActivities = todayActivities;
        if (viewMode === 'weekly') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];
            targetActivities = activities.filter(a => a.date >= weekAgoStr && a.date <= todayStr);
        }

        targetActivities.forEach(a => {
            if (counts[a.category] !== undefined) {
                counts[a.category] += (parseInt(a.duration) || 0);
            }
        });
        return counts;
    }, [activities, todayActivities, viewMode, todayStr]);

    const chartData = useMemo(() => {
        return [
            { name: 'Timepass', value: stats.timepass, fill: CATEGORIES.timepass.color },
            { name: 'Learning', value: stats.learning, fill: CATEGORIES.learning.color },
            { name: 'Health', value: stats.health, fill: CATEGORIES.health.color },
        ].filter(d => d.value > 0);
    }, [stats]);

    const handleLogActivity = async (e) => {
        e.preventDefault();
        if (!actDuration) return;
        setSaving(true);
        try {
            // Ensure name is never blank - default to subcategory
            const finalName = actName.trim() || actSubcategory;

            await addDocument(user.uid, 'activities', {
                name: finalName,
                category: modalCategory,
                subcategory: actSubcategory,
                duration: actDuration,
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                date: todayStr,
            });
            setActName('');
            setActSubcategory('');
            setActDuration('');
            setShowModal(false);
        } catch (err) {
            console.error('Error adding activity:', err);
            if (err.code === 'permission-denied') {
                alert("Permission Denied: Please ensure you've published the Firestore Security Rules exactly as shown in the guide.");
            } else {
                alert(`Failed to save activity: ${err.message}`);
            }
        }
        setSaving(false);
    };

    const handleDelete = async (id) => {
        try {
            await deleteDocument(user.uid, 'activities', id);
        } catch (err) {
            console.error('Error deleting activity:', err);
        }
    };

    const fetchAiTips = async () => {
        if (!user || todayActivities.length === 0) return;
        setTipsLoading(true);
        try {
            const tips = await getProductivityTips(stats);
            const todayStr = new Date().toISOString().split('T')[0];
            await setAiCache(user.uid, todayStr, 'productivityTips', tips);
            await refreshAiCache();
        } catch (err) {
            console.error('Error fetching tips:', err);
        }
        setTipsLoading(false);
    };

    const handleGenerateHealthPlan = async () => {
        if (!user) return;

        setShowPlanModal(true);

        // If we already have a cached plan, don't regenerate it automatically
        if (healthPlan) return;

        setPlanLoading(true);
        try {
            const healthActivities = todayActivities.filter(a => a.category === 'health');
            const plan = await generateHealthPlan(healthActivities);
            const todayStr = new Date().toISOString().split('T')[0];
            await setAiCache(user.uid, todayStr, 'healthPlan', plan);
            await refreshAiCache();
        } catch (err) {
            console.error('Error generating health plan:', err);
        }
        setPlanLoading(false);
    };

    return (
        <AuthenticatedLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1 flex items-center">
                            <FiActivity className="mr-2 text-brand-400" /> AI Productivity Tracker
                        </h1>
                        <p className="text-gray-400 text-sm">Balanced growth across Timepass, Learning, and Health.</p>
                    </div>
                </div>

                {/* Stats & Chart Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Log Cards */}
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(CATEGORIES).map(([key, cat]) => (
                            <motion.div
                                key={key}
                                whileHover={{ y: -5 }}
                                className="glass-card p-5 relative overflow-hidden group border-b-4"
                                style={{ borderBottomColor: cat.color }}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2 rounded-lg bg-surface-hover`}>
                                        <cat.icon className="text-xl" style={{ color: cat.color }} />
                                    </div>
                                    <button
                                        onClick={() => {
                                            setModalCategory(key);
                                            setActSubcategory(cat.subcategories[0]);
                                            setShowModal(true);
                                        }}
                                        className="text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"
                                    >
                                        <FiPlus />
                                    </button>
                                </div>
                                <h3 className="text-white font-bold text-lg">{cat.label}</h3>
                                <div className="mt-2 flex items-baseline">
                                    <span className="text-2xl font-bold text-white">{stats[key]}</span>
                                    <span className="text-gray-400 text-xs ml-1">mins {viewMode === 'daily' ? 'today' : 'this week'}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Breakdown Chart */}
                    <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[250px] relative">
                        <div className="flex w-full justify-between items-center mb-6">
                            <h3 className="text-white font-bold">{viewMode === 'daily' ? 'Daily' : '7-Day'} Breakdown</h3>
                            <div className="flex bg-surface-hover rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('daily')}
                                    className={`px-3 py-1 text-xs rounded-md transition-all font-bold ${viewMode === 'daily' ? 'bg-brand-500 text-white shadow-lg' : 'text-gray-400'}`}
                                >
                                    Daily
                                </button>
                                <button
                                    onClick={() => setViewMode('weekly')}
                                    className={`px-3 py-1 text-xs rounded-md transition-all font-bold ${viewMode === 'weekly' ? 'bg-brand-500 text-white shadow-lg' : 'text-gray-400'}`}
                                >
                                    Weekly
                                </button>
                            </div>
                        </div>

                        {chartData.length > 0 ? (
                            <div className="w-full h-48">
                                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-gray-500 text-sm italic">Log activities to see your breakdown</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Activity Feed */}
                    <div className="lg:col-span-2 glass-card p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-white flex items-center">
                                <FiClock className="mr-2 text-brand-400" /> Activity Feed
                            </h2>
                        </div>

                        {!loaded.activities ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : todayActivities.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-surface-border rounded-xl">
                                <FiActivity className="mx-auto text-gray-600 text-3xl mb-3 opacity-20" />
                                <p className="text-gray-400 text-sm">No activities logged yet today.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {todayActivities.map((a) => (
                                    <motion.div
                                        key={a.id}
                                        layout
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center justify-between p-4 bg-surface-hover rounded-xl border border-surface-border group transition-all hover:border-brand-500/30"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-2 h-10 rounded-full"
                                                style={{ backgroundColor: CATEGORIES[a.category]?.color || '#fff' }}
                                            />
                                            <div>
                                                <p className="text-white font-medium">{a.name}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                    <span className="uppercase tracking-wider font-bold" style={{ color: CATEGORIES[a.category]?.color }}>
                                                        {a.category}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{a.time}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="bg-surface px-3 py-1 rounded-lg text-sm font-bold text-brand-400">
                                                {a.duration}m
                                            </div>
                                            <button
                                                onClick={() => handleDelete(a.id)}
                                                className="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* AI Insights Sidebar */}
                    <div className="space-y-6">
                        {/* Health Roadmap Card */}
                        <div className="glass-card p-6 glow-box-accent relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-accent-500/10 rounded-full blur-2xl -mr-12 -mt-12" />
                            <h3 className="text-white font-bold mb-3 flex items-center">
                                <FiHeart className="mr-2 text-accent-400" /> Wellness Coach
                            </h3>
                            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                                Get a complete personalized mental and physical health roadmap based on your lifestyle.
                            </p>
                            <button
                                onClick={handleGenerateHealthPlan}
                                className="w-full bg-accent-600 hover:bg-accent-550 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                            >
                                <FiMap /> {healthPlan ? 'View Health Plan' : 'Create Health Plan'}
                            </button>
                        </div>

                        {/* AI Tips Card */}
                        <div className="glass-card p-6 border border-brand-500/20">
                            <h3 className="text-white font-bold mb-4 flex items-center justify-between">
                                <span className="flex items-center"><FiZap className="mr-2 text-yellow-400" /> AI Optimization</span>
                                {stats.timepass > 0 || stats.learning > 0 || stats.health > 0 ? (
                                    <button
                                        onClick={fetchAiTips}
                                        disabled={tipsLoading}
                                        className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                                    >
                                        {tipsLoading ? <div className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin" /> : <FiTrendingUp />}
                                        {aiTips.length > 0 ? 'Regenerate' : 'Generate'}
                                    </button>
                                ) : null}
                            </h3>

                            {aiTips.length > 0 ? (
                                <ul className="space-y-4">
                                    {aiTips.map((tip, i) => (
                                        <li key={i} className="flex gap-3 text-sm">
                                            <FiCheckCircle className="text-green-400 mt-1 flex-shrink-0" />
                                            <span className="text-gray-300">{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-6">
                                    <FiInfo className="mx-auto text-gray-600 mb-2" />
                                    <p className="text-gray-500 text-xs">Log some activities and click refresh for personalized AI tips.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Log Activity Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card p-8 w-full max-w-md glow-box"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white flex items-center">
                                    Log {CATEGORIES[modalCategory].label}
                                </h2>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleLogActivity} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {CATEGORIES[modalCategory].subcategories.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setActSubcategory(s)}
                                                className={`text-left px-3 py-2 rounded-lg text-xs font-medium border transition-all ${actSubcategory === s
                                                    ? 'bg-brand-500/20 border-brand-500 text-white'
                                                    : 'bg-surface-hover border-surface-border text-gray-500 hover:text-white'
                                                    }`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Details (Optional)</label>
                                    <input
                                        type="text"
                                        value={actName}
                                        onChange={(e) => setActName(e.target.value)}
                                        placeholder={`e.g. ${modalCategory === 'health' ? 'Intense gym session' : 'Watching Netflix'}`}
                                        className="w-full bg-surface-hover border border-surface-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Duration (minutes)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={actDuration}
                                        onChange={(e) => setActDuration(e.target.value)}
                                        className="w-full bg-surface-hover border border-surface-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(139,92,246,0.5)] mt-4"
                                >
                                    {saving ? 'Saving...' : `Log ${CATEGORIES[modalCategory].label}`}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI Health Plan Modal */}
            <AnimatePresence>
                {showPlanModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
                        onClick={() => setShowPlanModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 30 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 30 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto glow-box my-8"
                        >
                            <div className="flex justify-between items-center mb-8 sticky top-0 bg-[#0f172a] pb-4 z-20 border-b border-surface-border">
                                <div>
                                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                        <FiMap className="text-accent-400" /> AI Global Health Roadmap
                                    </h2>
                                    <p className="text-gray-400 text-sm mt-1">Mental & Physical Well-being Strategy</p>
                                </div>
                                <button onClick={() => setShowPlanModal(false)} className="bg-surface-hover p-2 rounded-lg text-gray-400 hover:text-white transition-colors">
                                    <FiX className="w-6 h-6" />
                                </button>
                            </div>

                            {planLoading ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="w-16 h-16 border-4 border-accent-500 border-t-transparent rounded-full animate-spin mb-6" />
                                    <p className="text-white font-bold text-lg">🤖 AI is crafting your health plan...</p>
                                    <p className="text-gray-400 text-sm mt-2">Analyzing your activity and optimizing your wellness roadmap</p>
                                </div>
                            ) : healthPlan ? (
                                <div className="space-y-8 pb-8">
                                    <div className="bg-brand-500/10 border border-brand-500/20 p-6 rounded-2xl">
                                        <h3 className="text-brand-400 font-bold mb-2">Executive Summary</h3>
                                        <p className="text-gray-300 leading-relaxed italic">"{healthPlan.summary}"</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Physical */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-green-400 font-bold text-lg border-b border-green-500/20 pb-2">
                                                <FiActivity /> Physical Strategy
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-black mb-1">Target Focus</p>
                                                <p className="text-white font-medium">{healthPlan.physicalHealth.focus}</p>
                                            </div>
                                            <ul className="space-y-2">
                                                {healthPlan.physicalHealth.recommendations.map((r, i) => (
                                                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                                        <FiCheckCircle className="text-green-500 mt-1 flex-shrink-0" /> {r}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Mental */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-brand-400 font-bold text-lg border-b border-brand-500/20 pb-2">
                                                <FiHeart /> Mental Strategy
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-black mb-1">Target Focus</p>
                                                <p className="text-white font-medium">{healthPlan.mentalHealth.focus}</p>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <p className="text-xs text-gray-400 font-bold italic">Top Exercises:</p>
                                                    {healthPlan.mentalHealth.exercises.map((e, i) => (
                                                        <div key={i} className="bg-surface-hover p-3 rounded-xl border border-surface-border text-sm text-gray-300">
                                                            {e}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-surface-hover p-8 rounded-2xl border border-surface-border">
                                        <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                                            <FiTrendingUp className="text-brand-400" /> Weekly Optimization Schedule
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {healthPlan.physicalHealth.weeklySchedule.map((s, i) => (
                                                <div key={i} className="bg-surface p-4 rounded-xl border border-surface-border/50">
                                                    <p className="text-brand-400 font-bold mb-1">{s.day}</p>
                                                    <p className="text-white text-sm font-medium">{s.activity}</p>
                                                    <p className="text-gray-500 text-xs mt-1">Duration: {s.duration}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="glass-card p-5 border-l-4 border-yellow-500/50">
                                            <h4 className="text-yellow-400 font-bold text-sm mb-3">Nutrition Boosters</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {healthPlan.nutritionTips.map((t, i) => (
                                                    <span key={i} className="text-xs bg-yellow-500/10 text-yellow-300 px-3 py-1.5 rounded-full border border-yellow-500/20">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="glass-card p-5 border-l-4 border-brand-500/50 flex flex-col justify-center items-center text-center">
                                            <h4 className="text-brand-400 font-bold text-sm mb-2">Daily Mantra</h4>
                                            <p className="text-white font-bold italic text-lg leading-tight">&quot;{healthPlan.dailyMantra}&quot;</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-20 text-red-400">
                                    <p>Failed to load health plan. Please try again.</p>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AuthenticatedLayout>
    );
}
