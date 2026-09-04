const Alexa = require('ask-sdk-core');
const https = require('https');

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
                .speak('لم أتمكن من سماع سؤالك بوضوح، يرجى المحاولة مرة أخرى.')
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
                .speak('حدث خطأ أثناء الاتصال بجيميناي، يرجى التأكد من مفتاح API والمحاولة لاحقاً.')
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
        const speakOutput = 'يمكنك سؤالي أي سؤال وسأقوم بإرساله إلى جيميناي للإجابة عليه.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
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
        const speakOutput = 'مع السلامة!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error(`Error handled: ${error.message}`);
        const speakOutput = 'عذراً، حدث خطأ في النظام الداخلي للمهارة.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

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
                        // تنظيف النص من علامات Markdown لتتمكن أليكسا من قراءته بسلاسة
                        const cleanText = text.replace(/[*_#`~]/g, '');
                        resolve(cleanText);
                    } else {
                        reject('Invalid response structure');
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

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        GeminiQueryIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();
