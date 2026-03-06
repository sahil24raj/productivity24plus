"use client";
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToCollection, getUserDoc } from '@/lib/firestore';

const DataContext = createContext({});

export const DataProvider = ({ children }) => {
    const { user } = useAuth();
    const [activities, setActivities] = useState([]);
    const [goals, setGoals] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [skillAnalysis, setSkillAnalysis] = useState(null);
    const [settings, setSettings] = useState(null);
    const [loaded, setLoaded] = useState({
        activities: false,
        skills: false,
        settings: false,
    });

    // Subscribe to all collections once when user logs in
    useEffect(() => {
        if (!user) {
            // Reset on logout
            setActivities([]);
            setSkillAnalysis(null);
            setSettings(null);
            setLoaded({ activities: false, skills: false, settings: false });
            return;
        }

        // Subscribe to activities
        const unsubActivities = subscribeToCollection(user.uid, 'activities', (docs) => {
            setActivities(docs);
            setLoaded(prev => ({ ...prev, activities: true }));
        });

        // Load skill analysis (one-time, refreshed manually)
        getUserDoc(user.uid, 'skillAnalysis/latest').then(data => {
            setSkillAnalysis(data);
            setLoaded(prev => ({ ...prev, skills: true }));
        }).catch(() => setLoaded(prev => ({ ...prev, skills: true })));

        // Load settings
        getUserDoc(user.uid, 'settings/preferences').then(data => {
            setSettings(data);
            setLoaded(prev => ({ ...prev, settings: true }));
        }).catch(() => setLoaded(prev => ({ ...prev, settings: true })));

        return () => {
            unsubActivities();
        };
    }, [user]);

    // Refresh skill analysis (called after new upload)
    const refreshSkillAnalysis = useCallback(async () => {
        if (!user) return;
        const data = await getUserDoc(user.uid, 'skillAnalysis/latest');
        setSkillAnalysis(data);
    }, [user]);

    // Refresh settings (called after save)
    const refreshSettings = useCallback(async () => {
        if (!user) return;
        const data = await getUserDoc(user.uid, 'settings/preferences');
        setSettings(data);
    }, [user]);

    return (
        <DataContext.Provider value={{
            activities,
            skillAnalysis,
            settings,
            loaded,
            refreshSkillAnalysis,
            refreshSettings,
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => useContext(DataContext);
