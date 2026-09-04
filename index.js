const express = require('express');
const Alexa = require('ask-sdk-core');
const { ExpressAdapter } = require('ask-sdk-express-adapter');
const https = require('https');

const app = express();

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'مرحباً بك! أنا جيميناي، كيف يمكنني مساعدتك اليوم؟';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const AskGeminiIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AskGeminiIntent';
    },
    async handle(handlerInput) {
        const query = Alexa.getSlotValue(handlerInput.requestEnvelope, 'query');
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return handlerInput.responseBuilder
                .speak('لم يتم ضبط مفتاح جيميناي في السيرفر بعد.')
                .getResponse();
        }

        try {
            const reply = await callGemini(query, apiKey);
            return handlerInput.responseBuilder
                .speak(reply)
                .getResponse();
        } catch (error) {
            console.error('Gemini Error:', error);
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
            .speak('يمكنك إلقاء أي سؤال علي وسأجيبك باستخدام ذكاء جيميناي.')
            .reprompt('ما هو سؤالك؟')
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
        console.log(`Error handled: ${error.message}`);
        return handlerInput.responseBuilder
            .speak('عذراً، حدث خطأ في معالجة طلبك.')
            .getResponse();
    }
};

function callGemini(prompt, apiKey) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
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
                    const response = JSON.parse(body);
                    const text = response.candidates[0].content.parts[0].text;
                    resolve(text);
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

const skill = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        AskGeminiIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler
    )
    .addErrorHandlers(ErrorHandler)
    .create();

const adapter = new ExpressAdapter(skill, true, true);

app.post('/alexa', adapter.getRequestHandler());

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
