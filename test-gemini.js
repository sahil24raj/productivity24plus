const GEMINI_API_KEYS = [
    'AIzaSyCYeFANOqztafI6zzXlXPpogL2ah75bxZo',
    'AIzaSyCDi43ZqaOu-vMeBCnw1hlId_xC-SV2sGI',
    'AIzaSyAkO2eDqrwvvN8m93z-o0rKgkEG12UHMyU',
    'AIzaSyChtI0ZUNUKKsyJVb52AchU_qTuhrEGPH4'
];

const MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
];

async function testKeys() {
    for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
        console.log(`\n\n=== TESTING KEY ${i + 1} (${GEMINI_API_KEYS[i].substring(0, 10)}...) ===`);
        for (const model of MODELS) {
            console.log(`\nTesting model: ${model} with Key ${i + 1}`);
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEYS[i]}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'Hello' }] }]
                    }),
                });

                if (res.ok) {
                    console.log(`SUCCESS for ${model}`);
                } else {
                    const data = await res.json().catch(() => ({}));
                    console.log(`FAILED for ${model}: HTTP ${res.status}`);
                    console.log(`Message:`, data?.error?.message);
                }
            } catch (err) {
                console.log(`NETWORK ERROR for ${model}:`, err.message);
            }
        }
    }
}

testKeys();
