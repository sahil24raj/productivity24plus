"use client";
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUploadCloud, FiCpu, FiTrendingUp, FiTrendingDown, FiMinus, FiMap, FiX, FiChevronRight, FiBookOpen, FiStar, FiAlertTriangle, FiZap } from 'react-icons/fi';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import { setUserDoc } from '@/lib/firestore';
import { analyzeResume, generateRoadmap } from '@/lib/gemini';
import * as pdfjsLib from 'pdfjs-dist';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

const getSurvivalColor = (pct) => {
    if (pct >= 80) return 'text-green-400';
    if (pct >= 60) return 'text-yellow-400';
    if (pct >= 40) return 'text-orange-400';
    return 'text-red-400';
};

const getSurvivalBg = (pct) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 60) return 'bg-yellow-500';
    if (pct >= 40) return 'bg-orange-500';
    return 'bg-red-500';
};

const getDemandBadge = (level) => {
    switch (level) {
        case 'high': return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'low': return 'bg-red-500/20 text-red-400 border-red-500/30';
        default: return 'bg-gray-500/20 text-gray-400';
    }
};

export default function Skills() {
    const { user } = useAuth();
    const { skillAnalysis, loaded, refreshSkillAnalysis } = useData();
    const [file, setFile] = useState(null);
    const [parsing, setParsing] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [roadmap, setRoadmap] = useState(null);
    const [roadmapLoading, setRoadmapLoading] = useState(false);
    const [roadmapSkill, setRoadmapSkill] = useState('');
    const [showRoadmap, setShowRoadmap] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('skills');
    const fileInputRef = useRef(null);

    // Sync from global cache
    useEffect(() => {
        if (skillAnalysis?.aiAnalysis) {
            setAnalysis(skillAnalysis.aiAnalysis);
        }
    }, [skillAnalysis]);

    const handleFileUpload = async (e) => {
        const uploadedFile = e.target.files[0];
        if (!uploadedFile || uploadedFile.type !== 'application/pdf') return;

        setFile(uploadedFile);
        setParsing(true);
        setError('');
        setAnalysis(null);
        setActiveTab('skills');

        try {
            // Extract text from PDF
            const arrayBuffer = await uploadedFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + ' ';
            }

            if (fullText.trim().length < 50) {
                setError('Could not extract enough text from the PDF. Please try a different file.');
                setParsing(false);
                return;
            }

            // Send to Gemini for AI analysis
            const result = await analyzeResume(fullText);
            setAnalysis(result);

            // Save to Firestore
            if (user) {
                await setUserDoc(user.uid, 'skillAnalysis/latest', {
                    aiAnalysis: result,
                    score: result.overallScore || 0,
                    skills: result.skills || [],
                    fileName: uploadedFile.name,
                    analyzedAt: new Date().toISOString(),
                });
                await refreshSkillAnalysis();
            }
        } catch (err) {
            console.error('Error analyzing resume:', err);
            setError(err.message || 'Failed to analyze resume. Please try again.');
        }
        setParsing(false);
    };

    const handleGenerateRoadmap = async (skillName) => {
        setRoadmapSkill(skillName);
        setRoadmapLoading(true);
        setShowRoadmap(true);
        setRoadmap(null);
        try {
            const result = await generateRoadmap(skillName);
            setRoadmap(result);
        } catch (err) {
            console.error('Error generating roadmap:', err);
            setError('Failed to generate roadmap. Please try again.');
            setShowRoadmap(false);
        }
        setRoadmapLoading(false);
    };

    const hasAnalysis = analysis && analysis.skills && analysis.skills.length > 0;

    return (
        <AuthenticatedLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1 flex items-center">
                            <FiCpu className="mr-2 text-brand-400" /> AI Skill Tracker
                        </h1>
                        <p className="text-gray-400 text-sm">Upload your resume for AI-powered skill analysis, future survival predictions, and learning roadmaps.</p>
                    </div>
                </div>

                {/* Upload Area */}
                <motion.div
                    whileHover={{ scale: 1.005 }}
                    onClick={() => !parsing && fileInputRef.current?.click()}
                    className={`glass-card p-8 border-2 border-dashed cursor-pointer transition-all text-center ${parsing ? 'border-brand-500/50 opacity-70' : 'border-surface-border hover:border-brand-500/50'
                        }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                    />

                    {parsing ? (
                        <div className="py-4">
                            <div className="w-12 h-12 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-white font-medium text-lg">🤖 AI is analyzing your resume...</p>
                            <p className="text-gray-400 text-sm mt-1">This may take 10-15 seconds</p>
                        </div>
                    ) : (
                        <div className="py-4">
                            <FiUploadCloud className="w-12 h-12 text-brand-400 mx-auto mb-3" />
                            <p className="text-white font-medium text-lg">
                                {file ? `✓ ${file.name}` : 'Drop your resume PDF here or click to upload'}
                            </p>
                            <p className="text-gray-400 text-sm mt-1">Gemini AI will analyze your skills, predict future relevance, and suggest what to learn next</p>
                        </div>
                    )}
                </motion.div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-center">
                        <FiAlertTriangle className="mr-2 flex-shrink-0" /> {error}
                    </div>
                )}

                {/* Analysis Results */}
                {hasAnalysis && (
                    <>
                        {/* Score + Summary */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="glass-card p-6 flex flex-col items-center justify-center glow-box"
                            >
                                <p className="text-gray-400 text-sm mb-2">Future-Proof Score</p>
                                <div className="w-full h-32 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Score', value: analysis.overallScore || 0, fill: '#06b6d4' },
                                                    { name: 'Remaining', value: 100 - (analysis.overallScore || 0), fill: '#334155' }
                                                ]}
                                                cx="50%" cy="50%"
                                                innerRadius={45} outerRadius={60}
                                                startAngle={90} endAngle={-270}
                                                dataKey="value" stroke="none"
                                            >
                                                <Cell key="cell-0" fill="#06b6d4" />
                                                <Cell key="cell-1" fill="#334155" />
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-3xl font-bold text-white">{analysis.overallScore}</span>
                                    </div>
                                </div>
                                <p className={`text-sm font-medium mt-2 ${analysis.overallScore >= 70 ? 'text-green-400' : analysis.overallScore >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {analysis.overallScore >= 70 ? '🚀 Future-Ready' : analysis.overallScore >= 40 ? '⚡ Needs Growth' : '⚠️ At Risk'}
                                </p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="glass-card p-6 lg:col-span-3"
                            >
                                <h3 className="text-white font-bold mb-3">AI Analysis Summary</h3>
                                <p className="text-gray-300 text-sm leading-relaxed mb-4">{analysis.summary}</p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="text-green-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center"><FiStar className="mr-1" /> Strengths</h4>
                                        <ul className="space-y-1">
                                            {analysis.strengths?.map((s, i) => (
                                                <li key={i} className="text-sm text-gray-300 flex items-start">
                                                    <span className="text-green-500 mr-2">✓</span> {s}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center"><FiAlertTriangle className="mr-1" /> Gaps to Fill</h4>
                                        <ul className="space-y-1">
                                            {analysis.gaps?.map((g, i) => (
                                                <li key={i} className="text-sm text-gray-300 flex items-start">
                                                    <span className="text-orange-500 mr-2">!</span> {g}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex gap-2 border-b border-surface-border pb-0">
                            {[
                                { key: 'skills', label: 'Your Skills', icon: FiCpu },
                                { key: 'trending', label: 'Trending to Learn', icon: FiTrendingUp },
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`px-5 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-all -mb-[1px] ${activeTab === tab.key
                                        ? 'text-brand-400 border-brand-500'
                                        : 'text-gray-400 border-transparent hover:text-white hover:border-surface-border'
                                        }`}
                                >
                                    <tab.icon /> {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Skills Found in Resume */}
                        {activeTab === 'skills' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {analysis.skills?.map((skill, index) => (
                                    <motion.div
                                        key={skill.name}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="glass-card p-5 group hover:bg-surface-hover transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-white font-bold">{skill.name}</h4>
                                            <span className={`text-xs font-bold px-2 py-1 rounded border ${getDemandBadge(skill.demandLevel)}`}>
                                                {skill.demandLevel?.toUpperCase()}
                                            </span>
                                        </div>

                                        <p className="text-xs text-gray-400 mb-3">{skill.category}</p>

                                        {/* Survival Bar */}
                                        <div className="mb-2">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-400">Survival through 2030</span>
                                                <span className={`font-bold ${getSurvivalColor(skill.survivalPercentage)}`}>
                                                    {skill.survivalPercentage}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${skill.survivalPercentage}%` }}
                                                    transition={{ duration: 1, delay: 0.3 + index * 0.05 }}
                                                    className={`h-full rounded-full ${getSurvivalBg(skill.survivalPercentage)}`}
                                                />
                                            </div>
                                        </div>

                                        <p className="text-xs text-gray-400 italic mb-2">{skill.futureOutlook}</p>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {/* Trending Skills to Learn */}
                        {activeTab === 'trending' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {analysis.trendingSkillsToLearn?.map((skill, index) => (
                                    <motion.div
                                        key={skill.name}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.08 }}
                                        className="glass-card p-5 flex items-center gap-4 group hover:bg-surface-hover transition-all"
                                    >
                                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/20 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
                                            <FiZap className="text-brand-400 text-xl" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="text-white font-bold">{skill.name}</h4>
                                                <span className={`text-xs font-bold ${getSurvivalColor(skill.survivalPercentage)}`}>
                                                    {skill.survivalPercentage}% survival
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 mb-2">{skill.reason}</p>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span className="bg-surface-hover px-2 py-0.5 rounded">{skill.difficulty}</span>
                                                <span>⏱ {skill.timeToLearn}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleGenerateRoadmap(skill.name)}
                                            className="p-3 text-brand-400 hover:text-brand-300 border border-brand-500/30 hover:bg-brand-500/10 rounded-xl transition-all flex-shrink-0"
                                            title="Create Roadmap"
                                        >
                                            <FiMap />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* No analysis yet empty state */}
                {!hasAnalysis && !parsing && !error && (
                    <div className="text-center py-8">
                        <FiBookOpen className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                        <p className="text-gray-400">Upload your resume to get AI-powered skill insights</p>
                    </div>
                )}
            </div>

            {/* Roadmap Modal */}
            <AnimatePresence>
                {showRoadmap && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
                        onClick={() => setShowRoadmap(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto glow-box my-8"
                        >
                            <div className="flex justify-between items-center mb-6 sticky top-0 bg-[#0f172a] pb-4 border-b border-surface-border -mt-2 pt-2">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center">
                                        <FiMap className="mr-2 text-brand-400" /> Learning Roadmap
                                    </h2>
                                    <p className="text-gray-400 text-sm mt-1">{roadmapSkill}</p>
                                </div>
                                <button onClick={() => setShowRoadmap(false)} className="text-gray-400 hover:text-white p-2">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            {roadmapLoading ? (
                                <div className="flex flex-col items-center py-16">
                                    <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
                                    <p className="text-white font-medium">🤖 AI is creating your roadmap...</p>
                                    <p className="text-gray-400 text-sm mt-1">Building personalized learning phases</p>
                                </div>
                            ) : roadmap ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 text-sm text-gray-400">
                                        <span className="bg-brand-500/20 text-brand-400 px-3 py-1.5 rounded-lg font-medium">
                                            ⏱ {roadmap.totalDuration}
                                        </span>
                                        <span className="bg-accent-500/20 text-accent-400 px-3 py-1.5 rounded-lg font-medium">
                                            {roadmap.phases?.length} Phases
                                        </span>
                                    </div>

                                    {/* Phases */}
                                    <div className="relative">
                                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-surface-border" />

                                        {roadmap.phases?.map((phase, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.15 }}
                                                className="relative pl-14 pb-8 last:pb-0"
                                            >
                                                <div className="absolute left-3 w-5 h-5 rounded-full bg-brand-500 border-4 border-[#0f172a] z-10 shadow-[0_0_10px_rgba(139,92,246,0.5)]" />

                                                <div className="bg-surface-hover rounded-xl border border-surface-border p-5">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h3 className="text-white font-bold flex items-center">
                                                            Phase {phase.phase}: {phase.title}
                                                        </h3>
                                                        <span className="text-xs text-gray-400 bg-surface px-2 py-1 rounded">{phase.duration}</span>
                                                    </div>

                                                    <p className="text-sm text-gray-300 mb-3">{phase.description}</p>

                                                    <div className="mb-3">
                                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Topics</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {phase.topics?.map((t, i) => (
                                                                <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-300 border border-brand-500/20">
                                                                    {t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {phase.resources?.length > 0 && (
                                                        <div className="mb-3">
                                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Resources</p>
                                                            <div className="space-y-1.5">
                                                                {phase.resources.map((r, i) => (
                                                                    <a
                                                                        key={i}
                                                                        href={r.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-xs text-accent-400 hover:text-accent-300 flex items-center"
                                                                    >
                                                                        <FiChevronRight className="mr-1 flex-shrink-0" />
                                                                        <span>{r.name}</span>
                                                                        <span className="ml-2 text-gray-500 bg-surface px-1.5 py-0.5 rounded text-[10px]">{r.type}</span>
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {phase.project && (
                                                        <div className="bg-brand-500/5 border border-brand-500/15 rounded-lg p-3">
                                                            <p className="text-xs font-bold text-brand-400 mb-1">🛠 Practice Project</p>
                                                            <p className="text-xs text-gray-300">{phase.project}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Capstone */}
                                    {roadmap.finalProject && (
                                        <div className="bg-gradient-to-r from-brand-600/20 to-accent-600/20 border border-brand-500/30 rounded-xl p-5">
                                            <h3 className="text-white font-bold mb-2 flex items-center">
                                                <FiStar className="mr-2 text-yellow-400" /> Capstone Project
                                            </h3>
                                            <p className="text-sm text-gray-300">{roadmap.finalProject}</p>
                                        </div>
                                    )}

                                    {roadmap.careerImpact && (
                                        <div className="bg-surface-hover rounded-xl border border-surface-border p-5">
                                            <h3 className="text-white font-bold mb-2">💼 Career Impact</h3>
                                            <p className="text-sm text-gray-300">{roadmap.careerImpact}</p>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AuthenticatedLayout>
    );
}
