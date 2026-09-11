const express = require('express');
const app = express();

app.use(express.json());

app.post('/alexa', async (req, res) => {
    try {
        const requestType = req.body?.request?.type;
        const intentName = req.body?.request?.intent?.name;

        // معالجة إغلاق الجلسة
        if (requestType === 'SessionEndedRequest') {
            console.log('Session ended:', req.body?.request?.reason);
            return res.json({ version: '1.0', response: {} });
        }

        // معالجة طلبات النظام
        if (req.body?.event?.header?.namespace === 'System') {
            return res.json({ version: '1.0', response: {} });
        }

        let speakOutput = '';

        // 1. عند فتح المهارة (افتح مساعد جيميناي)
        if (requestType === 'LaunchRequest') {
            speakOutput = 'مرحباً بك! أنا جيميناي، كيف يمكنني مساعدتك اليوم؟';
        } 
        // 2. عند طرح سؤال (AskGeminiIntent)
        else if (requestType === 'IntentRequest' && intentName === 'AskGeminiIntent') {
            const slots = req.body?.request?.intent?.slots;
            const query = slots?.query?.value;

            if (!query) {
                speakOutput = 'لم أتمكن من سماع سؤالك، يرجى إعادة المحاولة.';
            } else {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    speakOutput = 'مفتاح API الخاص بجيميناي غير معرف في السيرفر.';
                } else {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: query }] }]
                        })
                    });

                    const data = await response.json();
                    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                        speakOutput = data.candidates[0].content.parts[0].text.replace(/[*_#`~]/g, '');
                    } else {
                        speakOutput = 'عذراً، لم أتمكن من الحصول على إجابة من جيميناي حالياً.';
                    }
                }
            }
        } 
        // 3. عند الإيقاف
        else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
            speakOutput = 'مع السلامة!';
        } 
        // 4. الحالات الأخرى
        else {
            speakOutput = 'أهلاً بك، يمكنك سؤالي مباشرة بعد فتح المهارة.';
        }

        return res.json({
            version: '1.0',
            response: {
                outputSpeech: {
                    type: 'SSML',
                    ssml: `<speak>${speakOutput}</speak>`
                },
                shouldEndSession: requestType !== 'LaunchRequest'
            }
        });

    } catch (error) {
        console.error('Express Error:', error);
        return res.json({
            version: '1.0',
            response: {
                outputSpeech: {
                    type: 'SSML',
                    ssml: '<speak>حدث خطأ أثناء معالجة الطلب.</speak>'
                },
                shouldEndSession: true
            }
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
