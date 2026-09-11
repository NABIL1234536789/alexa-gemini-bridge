const express = require('express');
const fetch = require('node-fetch');
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

        if (requestType === 'LaunchRequest') {
            speakOutput = 'مرحباً بك! أنا جيميناي، تفضل بطرح سؤالك.';
            shouldEnd = false;
        } 
        else if (intent?.name === 'AMAZON.StopIntent' || intent?.name === 'AMAZON.CancelIntent') {
            speakOutput = 'مع السلامة!';
            shouldEnd = true;
        } 
        else if (requestType === 'IntentRequest') {
            let query = intent?.slots?.query?.value;

            if (!query && intent?.slots) {
                for (const key in intent.slots) {
                    if (intent.slots[key]?.value) {
                        query = intent.slots[key].value;
                        break;
                    }
                }
            }

            if (!query) {
                speakOutput = 'عذراً، لم أسمع سؤالك جيداً. تفضل بإعادة طرح السؤال.';
                shouldEnd = false;
            } else {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    speakOutput = 'مفتاح API الخاص بجيميناي غير معرف في متغيرات البيئة على Render.';
                } else {
                    try {
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [
                                    {
                                        parts: [{ text: `أجب باختصار باللغة العربية: ${query}` }]
                                    }
                                ]
                            })
                        });

                        const data = await response.json();

                        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                            speakOutput = data.candidates[0].content.parts[0].text
                                .replace(/[*_#`~]/g, '')
                                .replace(/\n/g, ' ')
                                .trim();
                        } else if (data?.error?.message) {
                            console.error('Gemini API Error:', data.error);
                            speakOutput = `خطأ من جيميناي: ${data.error.message}`;
                        } else {
                            speakOutput = 'لم يتوفر رد مناسب من جيميناي حالياً.';
                        }
                    } catch (apiError) {
                        console.error('Fetch Exception:', apiError);
                        speakOutput = 'حدث خطأ أثناء الاتصال بالخادم.';
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
        console.error('General Error:', error);
        return res.json({
            version: '1.0',
            response: {
                outputSpeech: { type: 'SSML', ssml: '<speak>حدث خطأ في معالجة النظام.</speak>' },
                shouldEndSession: true
            }
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
