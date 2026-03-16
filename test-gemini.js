const key = process.argv[2];
if (!key) { console.error('Please provide an API key as an argument.'); process.exit(1); }
console.log('Testing key: ' + key.substring(0, 5) + '...');
fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key)
  .then(res => res.json())
  .then(data => {
    if (data.error) throw new Error(data.error.message);
    console.log('\n✅ AVAILABLE MODELS FOR THIS KEY:');
    data.models.filter(m => m.supportedGenerationMethods.includes('generateContent')).forEach(m => console.log(' -> ' + m.name));
  })
  .catch(err => console.error('\n❌ ERROR:', err.message));