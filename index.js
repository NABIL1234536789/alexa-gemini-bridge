const express = require('express');
const { ExpressAdapter } = require('ask-sdk-express-adapter');
const Alexa = require('ask-sdk-core');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 10000;

// 1. Handlers
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'مرحباً بك، أنا جيميناي. كيف يمكنني مساعدتك اليوم؟';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const GeminiQueryIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GeminiQueryIntent';
    },
    async handle(handlerInput) {
        const prompt = Alexa.getSlotValue(handlerInput.requestEnvelope, 'prompt');
        const apiKey = process.env.GEMINI_API_KEY;

        if (!prompt) {
            return handlerInput.responseBuilder
                .speak('لم أتمكن من سماع سؤالك بوضوح.')
                .reprompt('تفضل بسؤالك')
                .getResponse();
        }

        try {
            const reply = await callGeminiApi(prompt, apiKey);
            return handlerInput.responseBuilder
                .speak(reply)
                .reprompt('هل لديك سؤال آخر؟')
                .getResponse();
        } catch (error) {
            console.error('Gemini API Error:', error);
            return handlerInput.responseBuilder
                .speak('حدث خطأ أثناء الاتصال بجيميناي، يرجى المحاولة لاحقاً.')
                .getResponse();
        }
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('يمكنك سؤالي أي سؤال وسأجيبك باستخدام جيميناي.')
            .reprompt('تفضل بسؤالك')
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak('مع السلامة!')
            .getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error(`Error handled: ${error.message}`);
        return handlerInput.responseBuilder
            .speak('عذراً، حدث خطأ أثناء معالجة الطلب.')
            .getResponse();
    }
};

// 2. Gemini API Function
function callGeminiApi(prompt, apiKey) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.candidates && json.candidates[0].content.parts[0].text) {
                        const text = json.candidates[0].content.parts[0].text;
                        const cleanText = text.replace(/[*_#`~]/g, '');
                        resolve(cleanText);
                    } else {
                        reject(new Error('Invalid response structure'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

// 3. Alexa Skill Instance & Express Adapter
const skillBuilder = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        GeminiQueryIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler
    )
    .addErrorHandlers(ErrorHandler);

const skill = skillBuilder.create();
const adapter = new ExpressAdapter(skill, false, false);

app.post('/', adapter.getRequestHandlers());

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
