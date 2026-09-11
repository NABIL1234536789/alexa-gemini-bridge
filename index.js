const express = require('express');
const app = express();

app.use(express.json());

app.post('/alexa', async (req, res) => {
    try {
        const requestType = req.body?.request?.type;
        const intent = req.body?.request?.intent;

        if (requestType === 'SessionEndedRequest') {
            return res.json({ version: '1.0', response: {} });
        }

        if (req.body?.event?.header?.namespace === 'System') {
            return res.json({ version: '1.0', response: {} });
        }

        let speakOutput = '';
        let shouldEnd = false;

        // 1. عند فتح المهارة
        if (requestType === 'LaunchRequest') {
            speakOutput = 'مرحباً بك! أنا جيميناي، تفضل بطرح سؤالك مباشرة.';
            shouldEnd = false;
        } 
        // 2. إيقاف المهارة
        else if (intent?.name === 'AMAZON.StopIntent' || intent?.name === 'AMAZON.CancelIntent') {
            speakOutput = 'مع السلامة!';
            shouldEnd = true;
        } 
        // 3. استقبال أي سؤال (سواء تم التعرف عليه كـ Intent مخصص أو Fallback)
        else if (requestType === 'IntentRequest') {
            // محاولة جلب النص المدخل
            let query = intent?.slots?.query?.value;

            // إذا لم يجد query في السلوت، يحاول قراءة الجملة من بقية السلوتس
            if (!query && intent?.slots) {
                for (const key in intent.slots) {
                    if (intent.slots[key]?.value) {
                        query = intent.slots[key].value;
                        break;
                    }
                }
            }

            if (!query) {
                speakOutput = 'عذراً، لم أسمع السؤال جيداً. يمكنك قوله مرة أخرى.';
                shouldEnd = false;
            } else {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    speakOutput = 'مفتاح API غير متوفر.';
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
                        speakOutput = 'لم أتمكن من الحصول على إجابة حالياً.';
                    }
                }
            }
        } else {
            speakOutput = 'كيف يمكنني مساعدتك؟';
            shouldEnd = false;
        }

        return res.json({
            version: '1.0',
            response: {
                outputSpeech: { type: 'SSML', ssml: `<speak>${speakOutput}</speak>` },
                shouldEndSession: shouldEnd
            }
        });

    } catch (error) {
        console.error('Error:', error);
        return res.json({
            version: '1.0',
            response: {
                outputSpeech: { type: 'SSML', ssml: '<speak>حدث خطأ في النظام.</speak>' },
                shouldEndSession: true
            }
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
