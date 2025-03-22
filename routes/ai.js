const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const router = express.Router();
const cookieJar = new CookieJar();
const client = wrapper(axios.create({ jar: cookieJar }));

const chatPageUrl = "https://venice.ai/chat/";
const apiUrl = "https://venice.ai/api/inference/chat";

router.get("/venice", async (req, res) => {
    try {
        const userQuestion = req.query.question;
        if (!userQuestion) {
            return res.status(400).json({ error: "Query parameter 'question' is required." });
        }

        const chatPageResponse = await client.get(chatPageUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
        });

        const $ = cheerio.load(chatPageResponse.data);
        const sentryTrace = $('meta[name="sentry-trace"]').attr('content');
        const baggage = $('meta[name="baggage"]').attr('content');

        if (!sentryTrace || !baggage) {
            return res.status(500).json({ error: "Required metadata not found." });
        }

        const payload = {
            requestId: `req-${Date.now()}`,
            modelId: "llama-3.3-70b",
            prompt: [{ content: userQuestion, role: "user" }],
            systemPrompt: "",
            conversationType: "text",
            temperature: 0.8,
            webEnabled: true,
            topP: 0.9,
            includeVeniceSystemPrompt: true,
            isCharacter: false,
            clientProcessingTime: 725
        };

        const headers = {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "baggage": baggage,
            "content-type": "application/json",
            "priority": "u=1, i",
            "sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "sentry-trace": sentryTrace,
            "x-venice-version": "20250321.232600",
            "Referer": chatPageUrl,
            "Referrer-Policy": "strict-origin-when-cross-origin"
        };

        const aiResponse = await client.post(apiUrl, payload, { headers, responseType: "stream" });

        let fullResponse = "";

        aiResponse.data.on("data", (chunk) => {
            const chunkString = chunk.toString();
            try {
                const jsonData = JSON.parse(chunkString);
                if (jsonData.kind === "content" && jsonData.content) {
                    fullResponse += jsonData.content;
                }
            } catch (error) {
                console.error(chunkString, error);
            }
        });

        aiResponse.data.on("end", () => {
            res.json({ success: true, response: fullResponse });
        });

        aiResponse.data.on("error", (err) => {
            console.error(err);
            res.status(500).json({ error: "Error processing AI response" });
        });

    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;