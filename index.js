const express = require('express');
const app = express();

app.use(express.json());

app.post('/alexa', async (req, res) => {
    try {
        const requestType = req.body?.request?.type;
        const intentName = req.body?.request?.intent?.name;

        if (requestType === 'SessionEndedRequest') {
            return res.json({ version: '1.0', response: {} });
        }

        if (req.body?.event?.header?.namespace === 'System') {
            return res.json({ version: '1.0', response: {} });
        }

        let speakOutput = '';
        let shouldEnd = true; // إنهاء الجلسة افتراضياً بعد الإجابة

        // 1. عند إطلاق المهارة
        if (requestType === 'LaunchRequest') {
            speakOutput = 'مرحباً بك! أنا جيميناي، كيف يمكنني مساعدتك اليوم؟';
            shouldEnd = false; // ترك الجلسة مفتوحة لاستقبال السؤال فوراً
        } 
        // 2. عند معالجة السؤال
        else if (requestType === 'IntentRequest' && intentName === 'AskGeminiIntent') {
            const slots = req.body?.request?.intent?.slots;
            const query = slots?.query?.value;

            if (!query) {
                speakOutput = 'لم أتمكن من سماع سؤالك، يرجى إعادة المحاولة.';
                shouldEnd = false;
            } else {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    speakOutput = 'مفتاح API الخاص بجيميناي غير معرف.';
                } else {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: query }] }] })
                    });

                    const data = await response.json();
                    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                        speakOutput = data.candidates[0].content.parts[0].text.replace(/[*_#`~]/g, '');
                    } else {
                        speakOutput = 'عذراً، لم أتمكن من الحصول على إجابة حالياً.';
                    }
                }
            }
        } 
        else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
            speakOutput = 'مع السلامة!';
            shouldEnd = true;
        } 
        else {
            speakOutput = 'يرجى قول: اسأل جيميناي متبوعاً بسؤالك.';
            shouldEnd = false;
        }

        return res.json({
            version: '1.0',
            response: {
                outputSpeech: {
                    type: 'SSML',
                    ssml: `<speak>${speakOutput}</speak>`
                },
                shouldEndSession: shouldEnd
            }
        });

    } catch (error) {
        console.error('Error:', error);
        return res.json({
            version: '1.0',
            response: {
                outputSpeech: { type: 'SSML', ssml: '<speak>حدث خطأ أثناء معالجة الطلب.</speak>' },
                shouldEndSession: true
            }
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
