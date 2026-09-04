const express = require('express');
const Alexa = require('ask-sdk-core');

const app = express();
app.use(express.json());

// 1. معالج التشغيل المباشر عند قول "افتحي جيميناي"
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

// 2. معالج الأسئلة وإرسالها إلى Gemini API
const AskGeminiIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AskGeminiIntent';
    },
    async handle(handlerInput) {
        let speakOutput = '';
        const slots = handlerInput.requestEnvelope.request.intent.slots;
        const query = slots && slots.query && slots.query.value ? slots.query.value : null;

        if (!query) {
            speakOutput = 'لم أتمكن من سماع سؤالك، يرجى إعادة المحاولة.';
            return handlerInput.responseBuilder.speak(speakOutput).getResponse();
        }

        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error('GEMINI_API_KEY is not set');
            }

            // طلب API المباشر لـ Gemini 1.5 Flash
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: query }]
                    }]
                })
            });

            const data = await response.json();

            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                speakOutput = data.candidates[0].content.parts[0].text;
                // إزالة أي رموز أو تنسيقات Markdown لتتمكن أليكسا من قراءتها بوضوح
                speakOutput = speakOutput.replace(/[*_#`~]/g, '');
            } else {
                speakOutput = 'عذراً، لم أتمكن من الحصول على إجابة من جيميناي حالياً.';
            }

        } catch (error) {
            console.error('Gemini API Error:', error);
            speakOutput = 'حدث خطأ أثناء الاتصال بالذكاء الاصطناعي، يرجى المحاولة لاحقاً.';
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

// 3. معالج المساعدة
const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'يمكنك سؤالي أي سؤال بالقول: اسأل جيميناي متبوعاً بسؤالك.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// 4. معالج الإلغاء والإيقاف
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

// 5. معالج الأخطاء العامة
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error('Alexa Error:', error);
        const speakOutput = 'عذراً، حدث خطأ أثناء معالجة طلبك.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

// بناء الـ Alexa Skill
const skill = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        AskGeminiIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler
    )
    .addErrorHandlers(ErrorHandler)
    .create();

// استقبال طلبات أليكسا من خلال Express
app.post('/alexa', (req, res) => {
    skill.invoke(req.body)
        .then(responseBody => {
            res.json(responseBody);
        })
        .catch(error => {
            console.error('Skill Invoke Error:', error);
            res.status(500).send('Error processing request');
        });
});

// تشغيل الخادم
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
