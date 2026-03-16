"use client";
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiUser, FiZap, FiTarget, FiTrendingUp, FiMessageSquare } from 'react-icons/fi';
import { getCoachResponse, getIndustryRecommendations } from '@/lib/gemini';
import { useData } from '@/hooks/useData';
import { useAuth } from '@/hooks/useAuth';
import { setAiCache } from '@/lib/firestore';

export default function AICoach() {
    const { user } = useAuth();
    const { skillAnalysis, aiCache, refreshAiCache } = useData();
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hello! I am your AI Coach. I'm here to help you navigate the 2025-2026 AI era. I can help you with career growth, technical deep-dives, or just figuring out what to learn next. What's on your mind today?" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    // Cached Industry Data
    const industryData = aiCache?.industryData || null;
    const [loadingIndustry, setLoadingIndustry] = useState(false);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch and cache Industry Data
    const fetchIndustryData = async () => {
        if (!user || loadingIndustry) return;
        setLoadingIndustry(true);
        try {
            const data = await getIndustryRecommendations();
            const todayStr = new Date().toISOString().split('T')[0];
            await setAiCache(user.uid, todayStr, 'industryData', data);
            await refreshAiCache();
        } catch (err) {
            console.error('Error fetching industry data:', err);
        } finally {
            setLoadingIndustry(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await getCoachResponse(messages, input, skillAnalysis);
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `🚨 AI API FAILURE: ${err.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    const handleTopicClick = async (topic, type) => {
        if (loading) return;
        const query = `I want to deep dive into: ${topic}. Please provide a comprehensive briefing about its importance in 2026, key concepts, and how I can start learning it today.`;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: `[Deep Dive] ${topic}` }]);
        setLoading(true);

        try {
            const response = await getCoachResponse(messages, query, skillAnalysis);
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `🚨 AI API FAILURE: ${err.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthenticatedLayout>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">

                {/* Chat Section */}
                <div className="lg:col-span-3 flex flex-col glass-card overflow-hidden">
                    <div className="p-4 border-b border-surface-border bg-brand-600/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400">
                                <FiMessageSquare className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white leading-none">AI Career Coach</h2>
                                <span className="text-xs text-brand-500 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Global Live Intelligence 2026
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                        <AnimatePresence>
                            {messages.map((m, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[80%] p-4 rounded-2xl ${m.role === 'user'
                                        ? 'bg-brand-600 text-white rounded-tr-none'
                                        : 'bg-surface-hover border border-surface-border text-gray-200 rounded-tl-none'
                                        }`}>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-surface-hover border border-surface-border p-4 rounded-2xl rounded-tl-none">
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" />
                                        <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                                        <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="p-4 border-t border-surface-border bg-black/20">
                        <div className="relative">
                            <input
                                title="Type your message"
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask about trending skills, career roadmap, or tech queries..."
                                className="w-full bg-surface-hover border border-surface-border text-white px-5 py-4 pr-14 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            />
                            <button
                                title="Send message"
                                type="submit"
                                disabled={loading || !input.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
                            >
                                <FiSend className="w-5 h-5" />
                            </button>
                        </div>
                    </form>
                </div>

                {/* Recommendations Sidebar */}
                <div className="space-y-6 overflow-y-auto scrollbar-hide pr-2">
                    <div className="glass-card p-5 border-brand-500/20">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <FiTrendingUp className="text-brand-400" /> Trending 2026
                            </h3>
                            {!loadingIndustry && (
                                <button
                                    onClick={fetchIndustryData}
                                    className="text-[10px] bg-brand-500 hover:bg-brand-600 text-white px-2 py-1 flex items-center gap-1 rounded transition-colors"
                                >
                                    <FiZap /> {industryData ? "Refresh" : "Load"}
                                </button>
                            )}
                        </div>
                        <div className="space-y-4">
                            {!industryData ? (
                                loadingIndustry ? (
                                    [1, 2, 3].map(i => (
                                        <div key={i} className="h-16 bg-surface-hover rounded-xl animate-pulse" />
                                    ))
                                ) : (
                                    <div className="text-center py-6 border-2 border-dashed border-surface-border rounded-xl">
                                        <FiZap className="mx-auto text-gray-600 text-2xl mb-2 opacity-30" />
                                        <p className="text-xs text-gray-500">Load today's trending skills</p>
                                    </div>
                                )
                            ) : (
                                industryData.trendingSkills.map((skill, i) => (
                                    <div
                                        key={i}
                                        onClick={() => handleTopicClick(skill.name, 'trending')}
                                        className="p-3 bg-surface-hover rounded-xl border border-surface-border group hover:border-brand-500/50 transition-all cursor-pointer hover:bg-brand-500/5 active:scale-95"
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-white group-hover:text-brand-400 transition-colors">{skill.name}</span>
                                            <span className="text-[10px] text-green-400 font-bold">{skill.growth}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 line-clamp-2">{skill.description}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="glass-card p-5">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                            <FiZap className="text-brand-400" /> Daily Picks
                        </h3>
                        <div className="space-y-3">
                            {!industryData ? (
                                loadingIndustry ? (
                                    <div className="h-24 bg-surface-hover rounded-xl animate-pulse" />
                                ) : (
                                    <div className="text-center py-6 border-2 border-dashed border-surface-border rounded-xl">
                                        <p className="text-xs text-gray-500">Load trending data to see daily picks</p>
                                    </div>
                                )
                            ) : (
                                industryData.dailyPicks.map((pick, i) => (
                                    <div
                                        key={i}
                                        onClick={() => handleTopicClick(pick.title, 'daily')}
                                        className="flex items-center gap-3 p-3 bg-surface-hover rounded-xl border border-surface-border group hover:border-brand-500/50 transition-all cursor-pointer hover:bg-brand-500/5 active:scale-95"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center text-brand-400 shrink-0 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                                            <FiTarget className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white leading-tight group-hover:text-brand-400 transition-colors">{pick.title}</p>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-[9px] text-brand-400 uppercase">{pick.type}</span>
                                                <span className="text-[9px] text-gray-500 uppercase">{pick.estTime}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </AuthenticatedLayout>
    );
}
