const express = require('express');
const app = express();

app.use(express.json());

app.post('/alexa', async (req, res) => {
    try {
        // قراءة نوع الطلب سواء كان حدث نظام أو Intent أو Launch
        const requestType = req.body?.request?.type || req.body?.event?.header?.name;
        const intentName = req.body?.request?.intent?.name;

        // 1. التعامل مع طلبات النظام الداخلية للمجهزة (مثل SynchronizeState)
        if (req.body?.event?.header?.namespace === 'System') {
            return res.json({
                version: '1.0',
                response: {}
            });
        }

        let speakOutput = '';

        // 2. معالجة فتح المهارة (LaunchRequest)
        if (requestType === 'LaunchRequest') {
            speakOutput = 'مرحباً بك! أنا جيميناي، كيف يمكنني مساعدتك اليوم؟';
        } 
        // 3. معالجة الأسئلة عبر AskGeminiIntent
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
        // 4. معالجة الإيقاف والخروج
        else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
            speakOutput = 'مع السلامة!';
        } 
        // 5. الرد الافتراضي لباقي الحالات
        else {
            speakOutput = 'أهلاً بك، يمكنك سؤالي بالقول: اسأل مساعد جيميناي متبوعاً بسؤالك.';
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
                    ssml: '<speak>حدث خطأ أثناء معالجة الطلب، يرجى المحاولة لاحقاً.</speak>'
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
