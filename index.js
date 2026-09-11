const express = require('express');
const app = express();

app.use(express.json());

app.post('/alexa', async (req, res) => {
    try {
        const requestType = req.body?.request?.type;
        const intentName = req.body?.request?.intent?.name;

        // 1. معالجة إغلاق الجلسة
        if (requestType === 'SessionEndedRequest') {
            return res.json({ version: '1.0', response: {} });
        }

        // 2. معالجة طلبات النظام
        if (req.body?.event?.header?.namespace === 'System') {
            return res.json({ version: '1.0', response: {} });
        }

        let speakOutput = '';
        let shouldEnd = false; // ترك الجلسة مفتوحة لاستقبال الأسئلة دائماً

        // 3. عند فتح المهارة لأول مرة
        if (requestType === 'LaunchRequest') {
            speakOutput = 'مرحباً بك! أنا جيميناي، كيف يمكنني مساعدتك اليوم؟';
        } 
        // 4. عند التوقف أو الخروج
        else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
            speakOutput = 'مع السلامة!';
            shouldEnd = true;
        } 
        // 5. معالجة أي سؤال أو طلب قادم من المستخدم
        else if (requestType === 'IntentRequest') {
            const slots = req.body?.request?.intent?.slots || {};
            
            // استخراج السؤال من أي Slot موجود
            let query = '';
            for (const key in slots) {
                if (slots[key]?.value) {
                    query = slots[key].value;
                    break;
                }
            }

            if (!query) {
                speakOutput = 'لم أتمكن من سماع سؤالك بوضوح، تفضل بطرح سؤالك مرة أخرى.';
            } else {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    speakOutput = 'مفتاح API الخاص بجيميناي غير معرف في السيرفر.';
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
                        speakOutput = 'عذراً، لم أتمكن من الحصول على إجابة من جيميناي حالياً.';
                    }
                }
            }
        } else {
            speakOutput = 'كيف يمكنني مساعدتك؟ يمكنك طرح سؤالك مباشرة.';
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
