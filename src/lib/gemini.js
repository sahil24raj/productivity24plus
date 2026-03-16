"use server";

const GROK_KEYS = [
    process.env.GROK_API_KEY_1,
    process.env.GROK_API_KEY_2,
    process.env.GROK_API_KEY
].filter(Boolean);

const GEMINI_KEYS = [
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY
].filter(Boolean);

const MODEL_CONFIGS = [];

// Push Gemini configurations first (Highest Priority as per user request)
GEMINI_KEYS.forEach(key => {
    ['gemini-1.5-flash', 'gemini-pro'].forEach(model => {
        MODEL_CONFIGS.push({ provider: 'gemini', key, model });
    });
});

// Push Grok configurations next (Fallback)
GROK_KEYS.forEach(key => {
    ['grok-2-latest'].forEach(model => {
        MODEL_CONFIGS.push({ provider: 'grok', key, model });
    });
});

let currentConfigIndex = 0;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Try calling AI APIs with automatic provider/model fallback.
 * Cycles from Grok -> Gemini transparently on quota errors.
 */
async function callWithRetry(prompt, retries = 2, systemMsg = 'You are an API that returns ONLY raw valid JSON text without markdown formatting or code blocks. Never wrap output in ```json or ```.') {
    if (MODEL_CONFIGS.length === 0) {
        throw new Error("No API keys configured on the server.");
    }

    let lastError = '';
    let allErrors = [];
    // Enforce delay for rate limits
    await delay(1500 + Math.random() * 500);

    for (let i = 0; i < MODEL_CONFIGS.length; i++) {
        const indexToUse = (currentConfigIndex + i) % MODEL_CONFIGS.length;
        const config = MODEL_CONFIGS[indexToUse];

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                if (config.provider === 'grok') {
                    const messages = [];
                    if (systemMsg) {
                        messages.push({ role: 'system', content: systemMsg });
                    }
                    messages.push({ role: 'user', content: prompt });

                    const res = await fetch('https://api.x.ai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${config.key}`
                        },
                        body: JSON.stringify({
                            messages: messages,
                            model: config.model,
                            temperature: 0.7,
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        return data.choices?.[0]?.message?.content || '';
                    }

                    const errData = await res.json().catch(() => ({}));
                    lastError = errData?.error?.message || `Grok HTTP ${res.status}`;
                    allErrors.push(`Grok ${config.model}: ${lastError}`);

                    console.warn(`[Grok Fallback] Error: ${lastError}. Switching to next API key/model...`);
                    if (res.status === 429 || res.status === 401 || res.status === 403 || res.status === 400) {
                        currentConfigIndex = (currentConfigIndex + 1) % MODEL_CONFIGS.length;
                        break; // Move to next config immediately for rate limits / bad keys
                    }

                } else if (config.provider === 'gemini') {
                    const fullPrompt = systemMsg ? `${systemMsg}\n\n${prompt}` : prompt;

                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.key}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: fullPrompt }] }],
                            generationConfig: {
                                temperature: 0.7
                            },
                        }),
                    });

                    if (res.ok) {
                        const data = await res.json();
                        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    }

                    const errData = await res.json().catch(() => ({}));
                    lastError = errData?.error?.message || `Gemini HTTP ${res.status}`;
                    allErrors.push(`Gemini ${config.model}: ${lastError}`);

                    console.warn(`[Gemini Fallback] Error: ${lastError}. Switching to next API key/model...`);
                    if (res.status === 429 || res.status === 400 || res.status === 403 || res.status === 404 || res.status === 500) {
                        currentConfigIndex = (currentConfigIndex + 1) % MODEL_CONFIGS.length;
                        break; // Move to next config immediately for rate limits / bad keys
                    }
                }
            } catch (err) {
                lastError = err.message;
                allErrors.push(`Network ${config.provider} ${config.model}: ${lastError}`);
                console.warn(`[Network Fallback] ${config.provider} failed: ${lastError}`);
                break; // Skip to next config on network issues
            }
        }
    }

    const uniqueErrors = [...new Set(allErrors)].join(' | ');
    throw new Error(`AI Failures -> ${uniqueErrors}`);
}

/**
 * Send a prompt to Gemini and get a text response.
 */
export async function askGemini(prompt) {
    return await callWithRetry(prompt);
}

function extractJSON(text) {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Fallback: try to find anything between first { and last }
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            let inner = "";
            try {
                inner = cleaned.substring(start, end + 1);
                return JSON.parse(inner);
            } catch (innerErr) {
                console.error('Failed secondary JSON extraction:', inner);
            }
        }
        console.error('Failed to parse Gemini response:', cleaned);
        throw new Error('AI returned an invalid response. Please try again.');
    }
}

/**
 * Analyze resume text with Gemini AI — returns structured JSON
 */
export async function analyzeResume(resumeText) {
    const prompt = `You are an expert career advisor and AI industry analyst. Analyze this resume and return a JSON response. Do NOT wrap in markdown code blocks.

Resume text:
"""
${resumeText.substring(0, 6000)}
"""

Return ONLY valid JSON (no markdown, no backticks) in this exact format:
{
  "skills": [
    {
      "name": "Skill Name",
      "category": "Frontend/Backend/AI-ML/DevOps/Language/Database/Cloud/Mobile/Other",
      "demandLevel": "high/medium/low",
      "survivalPercentage": 85,
      "futureOutlook": "line outlook for this skill in 2025-2030",
      "isFoundInResume": true
    }
  ],
  "overallScore": 72,
  "summary": "2-3 sentence analysis of the candidate's skill profile",
  "strengths": ["strength1", "strength2"],
  "gaps": ["gap1", "gap2"],
  "trendingSkillsToLearn": [
    {
      "name": "Skill Name",
      "reason": "Why this skill matters",
      "survivalPercentage": 95,
      "difficulty": "beginner/intermediate/advanced",
      "timeToLearn": "2-3 months"
    }
  ]
}

Rules:
- List ALL skills found in the resume (minimum 5, maximum 20)
- Survival percentage = likelihood the skill stays relevant through 2030 (0-100)
- Also suggest 5-8 trending skills NOT in the resume that the candidate should learn
- overallScore = how future-proof the resume is (0-100)
- Be honest and realistic with percentages`;

    try {
        const response = await callWithRetry(prompt);
        return extractJSON(response);
    } catch (e) {
        console.warn('[Fallback] AI Resume Analysis failed, using static fallback.', e);
        return {
            isFallback: true,
            skills: [
                { name: "System Diagnostic", category: "Other", demandLevel: "medium", survivalPercentage: 50, futureOutlook: "Error details provided for debugging", isFoundInResume: true }
            ],
            overallScore: 0,
            summary: "🚨 AI API FAILURE: " + e.message + " --- Please verify your API keys are correct in Vercel Environment Variables and that they have quota remaining.",
            strengths: ["Debugging Required"],
            gaps: ["Valid API Response"],
            trendingSkillsToLearn: [
                { name: "Verify API Keys", reason: "Check Vercel configurations", survivalPercentage: 100, difficulty: "beginner", timeToLearn: "5 mins" }
            ]
        };
    }
}

/**
 * Generate a learning roadmap for a specific skill
 */
export async function generateRoadmap(skillName, currentLevel = 'beginner') {
    const prompt = `You are an expert career advisor. Create a detailed learning roadmap for "${skillName}" for someone at ${currentLevel} level.

Return ONLY valid JSON (no markdown, no backticks) in this exact format:
{
  "skill": "${skillName}",
  "totalDuration": "3-6 months",
  "phases": [
    {
      "phase": 1,
      "title": "Phase Title",
      "duration": "2-3 weeks",
      "description": "What you'll learn",
      "topics": ["Topic 1", "Topic 2", "Topic 3"],
      "resources": [
        { "name": "Resource Name", "type": "course/video/article/book", "url": "https://..." }
      ],
      "project": "Build a small project to practice"
    }
  ],
  "finalProject": "Capstone project description",
  "careerImpact": "How mastering this skill impacts your career"
}

Rules:
- Create 4-6 phases from beginner to advanced
- Each phase should have 3-5 topics
- Include real, specific resource recommendations
- Include a practical project for each phase
- Make it actionable and realistic`;

    try {
        const response = await callWithRetry(prompt);
        return extractJSON(response);
    } catch (e) {
        console.warn('[Fallback] AI Skill Roadmap failed, using static fallback.', e);
        return {
            skill: skillName,
            totalDuration: "3-4 months",
            phases: [
                {
                    phase: 1,
                    title: "Fundamentals & Core Concepts",
                    duration: "3-4 weeks",
                    description: "Learn the core architecture and basic concepts of " + skillName,
                    topics: ["Installation & Setup", "Basic Syntax / Rules", "Core Principles", "Standard Tooling"],
                    resources: [
                        { name: "Official Documentation", type: "article", url: "https://google.com/search?q=" + encodeURIComponent(skillName + " official documentation") }
                    ],
                    project: "Hello World / Initial Basic Setup"
                }
            ],
            finalProject: "Build a comprehensive, production-ready portfolio project using " + skillName,
            careerImpact: "A strong mastery of " + skillName + " provides a massive competitive advantage in the modern tech landscape."
        };
    }
}

/**
 * Get AI-powered productivity recommendation and ranking
 */
export async function getAIRecommendation(stats) {
    const prompt = `You are a brutally honest AI industry analyst and productivity benchmark expert. Your goal is to provide a REALISTIC global percentile ranking based on the provided user stats and 2025 internet benchmarks.

    2025 Benchmarks for Context:
    - Average Focus/Learning Time: 2-3 hours/day.
    - Top 25% Focus Time: 5.4+ hours/day.
    - AI Skill Gap: 68% of companies lack AI talent. True "AI Skill Match" (>70%) is extremely rare (Top 3% of global workforce).
    - Median Growth Score: ~50% (balanced life).

    User Stats Today:
    - Growth Score: ${stats.productivityScore}%
    - AI Skill Match: ${stats.aiSkillMatch}%
    - Learning Today: ${stats.learningToday} mins
    - Health Today: ${stats.healthToday} mins
    - Total Activities: ${stats.totalActivities}

    Return ONLY valid JSON (no markdown, no backticks) in this exact format:
    {
      "percentile": "Top X%",
      "rankingText": "Global Standard Tier",
      "insight": "A sharp, data-driven 2-sentence analysis comparing them to global peers.",
      "tips": ["Metric-driven tip 1", "Metric-driven tip 2", "Metric-driven tip 3"]
    }

    Strict Ranking Rules:
    - DO NOT show "Top 2%" unless they have Growth Score > 90% AND AI Skill Match > 80% AND Learning > 300 mins.
    - If Learning < 60 mins, they cannot be in the Top 50% regardless of other stats.
    - If AI Skill Match is 0%, they are likely in the Bottom 70% of the "AI Era" workforce.
    - Be realistic. If they are average, show "Top 50%". If they are struggling, show "Top 80%".
    - Avoid being 'nice'—be accurate based on the numbers.`;

    try {
        const response = await callWithRetry(prompt);
        return extractJSON(response);
    } catch (e) {
        return {
            percentile: "Top 45%",
            rankingText: "Global Average",
            insight: "Your stats align with the median global workforce. To break into the elite Top 10%, you must significantly increase your focused learning time and AI skill application.",
            tips: [
                "Aim for 5.4+ hours of learning to reach the top quartile",
                "Complete a deep-dive AI project to boost your skill match",
                "Optimize your health-to-work ratio for sustained high output"
            ]
        };
    }
}

/**
 * Generate a comprehensive Mental and Physical Health Plan
 */
export async function generateHealthPlan(healthStats) {
    const prompt = `You are an expert health and wellness coach. Create a personalized Mental and Physical Health Plan based on the user's recent activity.

User's Health Activities: ${JSON.stringify(healthStats)}

Return ONLY valid JSON (no markdown, no backticks) in this exact format:
{
  "title": "Your Holistic Health Roadmap",
  "summary": "2-3 sentence overview of current status and goals",
  "physicalHealth": {
    "focus": "Primary area of improvement",
    "recommendations": ["Rec 1", "Rec 2", "Rec 3"],
    "weeklySchedule": [
      { "day": "Monday", "activity": "Specific exercise", "duration": "30 mins" }
    ]
  },
  "mentalHealth": {
    "focus": "Mindfulness/Stress reduction area",
    "recommendations": ["Rec 1", "Rec 2"],
    "exercises": ["Breathing technique", "Journaling prompt"]
  },
  "nutritionTips": ["Tip 1", "Tip 2"],
  "dailyMantra": "A short motivating phrase"
}

Rules:
- Be realistic and encouraging.
- Provide specific, actionable exercises.
- Ensure the JSON is perfectly valid.`;

    try {
        const response = await callWithRetry(prompt);
        return extractJSON(response);
    } catch (e) {
        console.warn('[Fallback] AI Health Plan failed, using static fallback.', e);
        return {
            title: "Your Fundamentals Health Roadmap",
            summary: "AI services are currently busy, but here is a timeless, foundational health roadmap based on core wellness principles.",
            physicalHealth: {
                focus: "Daily Movement & Recovery",
                recommendations: [
                    "Engage in at least 30 minutes of moderate activity daily.",
                    "Stand up and stretch for 5 minutes every hour of sitting.",
                    "Stay properly hydrated throughout the day."
                ],
                weeklySchedule: [
                    { day: "Monday to Friday", activity: "Brisk Walk & Stretching", duration: "30 mins" },
                    { day: "Weekend", activity: "Active Recreation / Sports", duration: "60 mins" }
                ]
            },
            mentalHealth: {
                focus: "Mental Clarity & Stress Reduction",
                recommendations: [
                    "Implement a 30-minute digital detox before bedtime.",
                    "Practice mindfulness or deep breathing when feeling overwhelmed."
                ],
                exercises: [
                    "Box Breathing: 4s inhale, 4s hold, 4s exhale, 4s hold.",
                    "End-of-day Gratitude: Write down 3 positive moments."
                ]
            },
            nutritionTips: ["Prioritize whole foods", "Ensure adequate protein intake", "Limit late-night snacking"],
            dailyMantra: "Consistency beats intensity. Small daily habits create lasting transformation."
        };
    }
}

/**
 * Get detailed productivity improvement tips based on categories
 */
export async function getProductivityTips(categoryStats) {
    const prompt = `You are a productivity expert. Analyze these time allocations and provide 3 specific, actionable tips to improve balance.

Stats (minutes spent today):
- Timepass: ${categoryStats.timepass} mins
- Learning: ${categoryStats.learning} mins
- Health: ${categoryStats.health} mins

Return a JSON array of 3 strings: ["Tip 1", "Tip 2", "Tip 3"]. No markdown.`;

    const response = await callWithRetry(prompt);
    try {
        return extractJSON(response);
    } catch (e) {
        return ["Try to balance your learning and timepass sessions better.", "Ensure you don't neglect physical health while studying.", "Use the Pomodoro technique to stay focused."];
    }
}
/**
 * Generate a personalized roadmap to improve ranking
 */
export async function generateImprovementRoadmap(stats) {
    const prompt = `You are an elite career development strategist and AI benchmark specialist. Create a 4-week high-intensity roadmap for a user to move from their current global ranking into a higher percentile.

    User Stats:
    - Current Ranking: ${stats.percentile || 'Average'} (${stats.rankingText || 'Standard Tier'})
    - Growth Score: ${stats.productivityScore}%
    - AI Skill Match: ${stats.aiSkillMatch}%
    - Learning Today: ${stats.learningToday} mins

    Return ONLY valid JSON (no markdown, no backticks) in this exact format:
    {
      "goal": "Reach Top X% Ranking",
      "summary": "1-sentence strategic focus",
      "weeks": [
        {
          "week": 1,
          "focus": "Topic of Focus",
          "tasks": ["Task 1", "Task 2"],
          "dailyTarget": "X mins of learning"
        }
      ],
      "ultimateMilestone": "Large project or certificate"
    }

    Rules:
    - Be specific and challenging.
    - If AI Skill Match is low, focus on concrete tool mastery (Claude, GPT, Agents).
    - If Learning Time is low, focus on building focus habits.
    - Ensure JSON is perfectly valid.`;

    try {
        const response = await callWithRetry(prompt);
        return extractJSON(response);
    } catch (e) {
        console.warn('[Fallback] AI Roadmap failed, using static fallback.', e);
        return {
            goal: "Establish High-Performance Habits",
            summary: "AI services are currently busy, so here is a foundational roadmap focusing on building unbreakable daily consistency.",
            weeks: [
                {
                    week: 1,
                    focus: "Audit and Routine Building",
                    tasks: ["Track every hour of your day", "Establish a strict sleep schedule"],
                    dailyTarget: "60 mins of deep work without distractions"
                },
                {
                    week: 2,
                    focus: "Skill Gap Analysis",
                    tasks: ["Identify missing technical skills", "Create a learning schedule"],
                    dailyTarget: "120 mins of focused learning"
                }
            ],
            ultimateMilestone: "Complete a foundational consistency challenge for 14 straight days."
        };
    }
}

/**
 * AI Coach: Get response for chat queries
 */
export async function getCoachResponse(history, query, skillAnalysis) {
    const isDeepDive = query.includes('deep dive into');

    const prompt = `You are the "Productivity Plus AI Coach". You are a world-class career advisor, technical mentor, and productivity consultant.
    
    Context:
    - User's current skills: ${JSON.stringify(skillAnalysis?.skills || [])}
    - Global Trends 2025-2026: Agentic AI, MLOps, Custom LLM deployment, Green-Tech, Healthcare AI.
    - User Objective: To reach the Top 1% of the AI Era global workforce.

    Chat History:
    ${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

    User Query: "${query}"

    ${isDeepDive ? `
    SPECIAL INSTRUCTION: Generate a "Detailed Topic Briefing". 
    - Use Markdown formatting: Bold headings, bullet points, and clearly separated sections.
    - Section 1: Why this matters in 2026 (Real trends).
    - Section 2: Core technical / conceptual pillars.
    - Section 3: Step-by-step roadmap to master this today.
    - Section 4: Recommended high-value tools/resources.
    - Keep it very educational and high-density.
    ` : `
    Instructions:
    - Provide "real-world" advice based on current internet/industry trends through 2025/2026.
    - Be professional, motivating, and sharp.
    - If asked for recommendations, suggest specific high-value skills (e.g., Prompt Engineering for Devs, Vector Databases, etc.).
    - Keep responses concise but high-impact (max 3-4 short paragraphs).
    `}
    - NEVER mention you are an AI model.

    Response:`;

    try {
        const systemPrompt = "You are a world-class AI Career Coach.";
        return await callWithRetry(prompt, 2, systemPrompt);
    } catch (e) {
        return "I am currently taking a quick break to process other requests! My servers are a bit busy right now. Please try asking again in about a minute!";
    }
}

/**
 * Get trending skills and recommendations for 2026
 */
export async function getIndustryRecommendations() {
    const prompt = `Provide a list of 5 trending tech skills for 2026 and 3 "Daily Learning Picks".
    
    Return ONLY valid JSON in this format:
    {
      "trendingSkills": [
        { "name": "Skill", "growth": "+120%", "description": "Why it's hot" }
      ],
      "dailyPicks": [
        { "title": "Topic", "type": "Article/Lab", "estTime": "15m" }
      ]
    }`;

    try {
        const response = await callWithRetry(prompt);
        return extractJSON(response);
    } catch (e) {
        return {
            trendingSkills: [
                { name: "Agentic AI Frameworks", growth: "+150%", description: "Building autonomous agents with LangGraph/CrewAI." },
                { name: "MLOps & LLMOps", growth: "+80%", description: "Scaling and monitoring production AI models." }
            ],
            dailyPicks: [
                { title: "Introduction to Vector DBs", type: "Lab", estTime: "20m" }
            ]
        };
    }
}
