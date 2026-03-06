const GEMINI_API_KEYS = [
    'AIzaSyCYeFANOqztafI6zzXlXPpogL2ah75bxZo',
    'AIzaSyCDi43ZqaOu-vMeBCnw1hlId_xC-SV2sGI',
    'AIzaSyAkO2eDqrwvvN8m93z-o0rKgkEG12UHMyU',
    'AIzaSyChtI0ZUNUKKsyJVb52AchU_qTuhrEGPH4'
];

const MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3-flash-preview',
];

let currentKeyIndex = 0;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Try calling Gemini API with automatic model fallback on quota errors.
 */
async function callWithRetry(prompt, retries = 3) {
    let lastError = '';

    // Enforce a 1.5s delay before every API call to rate-spread out of 15 Requests Per Minute
    await delay(1500 + Math.random() * 500); // 1.5s - 2.0s jitter

    for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
        // Round-robin start from the globally tracked index
        const indexToUse = (currentKeyIndex + i) % GEMINI_API_KEYS.length;
        const key = GEMINI_API_KEYS[indexToUse];

        let keyDepleted = false;

        for (const model of MODELS) {
            if (keyDepleted) break; // Skip evaluating other models if this key is completely rate limited

            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 4096,
                            },
                        }),
                    });

                    if (res.ok) {
                        const data = await res.json();
                        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    }

                    const code = res.status;
                    let errorData = {};
                    try {
                        errorData = await res.json();
                    } catch (e) {
                        // ignore JSON parse error on bad status
                    }

                    lastError = errorData?.error?.message || `HTTP ${code}`;

                    // 429 Quota Exceeded -> This entire API KEY has exhausted its limit.
                    // Switching models won't help. We must switch to the next KEY.
                    if (code === 429 || lastError.toLowerCase().includes('quota') || lastError.toLowerCase().includes('busy') || lastError.toLowerCase().includes('too many requests')) {
                        console.warn(`[Gemini Fallback] Quota exceeded on key ending in ...${key.slice(-4)}. Switching to next API key immediately...`);
                        currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
                        keyDepleted = true;
                        break; // break attempt loop -> then breaks model loop
                    }

                    // 500/503 -> Server error, retry the exact same model & key after a delay
                    if (code >= 500) {
                        const delay = Math.pow(2, attempt) * 1000;
                        await new Promise(r => setTimeout(r, delay));
                        continue;
                    }

                    // 400/404 -> Model not found or unavailable in your region. Try the NEXT MODEL on this same key.
                    console.warn(`[Gemini Fallback] Model ${model} failed (${lastError}). Trying next model...`);
                    break; // break attempt loop -> continues to next model

                } catch (err) {
                    if (err.message && !err.message.includes('HTTP')) {
                        lastError = err.message;
                    }
                    console.warn(`[Gemini Fallback] Network error for ${model}. Trying next model...`);
                    break; // Skip to next model
                }
            }
        }
    }

    throw new Error(`All AI models and API keys are currently busy. Please wait a minute and try again. Latest Error: ${lastError}`);
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

    const response = await callWithRetry(prompt);
    return extractJSON(response);
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

    const response = await callWithRetry(prompt);
    return extractJSON(response);
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

    const response = await callWithRetry(prompt);
    try {
        return extractJSON(response);
    } catch (e) {
        throw new Error('AI failed to generate a valid health plan. Please try again.');
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

    const response = await callWithRetry(prompt);
    try {
        return extractJSON(response);
    } catch (e) {
        throw new Error('AI failed to generate your roadmap. Please try again.');
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
        return await callWithRetry(prompt);
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
