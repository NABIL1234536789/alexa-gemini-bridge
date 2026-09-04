import express from 'express';
import https from 'https';

const app = express();
app.use(express.json());

// ضع مفتاح Gemini API هنا
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.post('/', async (req, res) => {
    const event = req.body;
    const requestType = event.request?.type;

    if (requestType === 'LaunchRequest') {
        return res.json(buildResponse("مرحباً بك، أنا جيميناي. كيف يمكنني مساعدتك اليوم؟", false));
    }

    if (requestType === 'IntentRequest') {
        const intentName = event.request.intent.name;

        if (intentName === 'GeminiQueryIntent') {
            const userPrompt = event.request.intent.slots.prompt.value;
            
            let sessionAttributes = event.session.attributes || {};
            let history = sessionAttributes.history || [];

            history.push({ role: "user", parts: [{ text: userPrompt }] });

            const geminiReply = await callGeminiAPI(history);

            history.push({ role: "model", parts: [{ text: geminiReply }] });
            sessionAttributes.history = history;

            return res.json(buildResponse(geminiReply, false, sessionAttributes));
        }

        if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
            return res.json(buildResponse("مع السلامة!", true));
        }
    }

    return res.json(buildResponse("عذراً، لم أفهم ذلك. هل يمكنك التكرار؟", false));
});

async function callGeminiAPI(contents) {
    return new Promise((resolve) => {
        const data = JSON.stringify({ contents });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (response) => {
            let body = '';
            response.on('data', (chunk) => body += chunk);
            response.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    const text = parsed.candidates[0].content.parts[0].text;
                    const cleanText = text.replace(/[\*#_]/g, '');
                    resolve(cleanText);
                } catch (e) {
                    resolve("حدث خطأ أثناء معالجة الإجابة من جيميناي.");
                }
            });
        });

        req.on('error', () => resolve("تعذر الاتصال بـ جيميناي."));
        req.write(data);
        req.end();
    });
}

function buildResponse(speechText, shouldEndSession, sessionAttributes = {}) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: {
            outputSpeech: {
                type: "PlainText",
                text: speechText
            },
            shouldEndSession: shouldEndSession
        }
    };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
