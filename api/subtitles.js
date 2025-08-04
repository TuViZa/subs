// File: api/subtitles.js

const ytdl = require('ytdl-core');
const axios = require('axios');

// Vercel Serverless Function entry point
module.exports = async (req, res) => {
    // Set CORS headers to allow requests from your front-end
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { url } = req.query;

        if (!url || !ytdl.validateURL(url)) {
            res.status(400).json({ error: 'Invalid YouTube video URL provided.' });
            return;
        }

        // Get video info to find subtitle tracks
        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;
        const captionTracks = videoDetails.subtitles;

        if (!captionTracks || captionTracks.length === 0) {
            res.status(404).json({ error: 'No subtitles found for this video.' });
            return;
        }

        const subtitlesData = {
            original: null,
            translations: []
        };

        // Helper function to fetch and format subtitles
        const fetchSubtitles = async (track, format) => {
            const response = await axios.get(track.url);
            let content = response.data;
            if (format === 'txt') {
                // Simplified conversion to plain text
                content = content.replace(/<\/?(c|p|s)[^>]*?>/g, '').replace(/\s+/g, ' ').trim();
            }
            return content;
        };

        // Find the original English subtitle track
        const englishTrack = captionTracks.find(track => track.languageCode === 'en' && !track.isTranslatable);
        if (englishTrack) {
            subtitlesData.original = {
                lang: englishTrack.name.simpleText,
                formats: {
                    // For a full implementation, you would need to parse the XML from YouTube and convert it to SRT.
                    // This is a simplified example.
                    srt: await fetchSubtitles(englishTrack, 'srt'),
                    txt: await fetchSubtitles(englishTrack, 'txt')
                }
            };
        }

        // Generate translated subtitles (simulated)
        const translatableTracks = captionTracks.filter(track => track.isTranslatable);

        // This is where you would use a translation API for real. For this example, we simulate it.
        const mockTranslations = [
            { code: 'es', name: 'Spanish' },
            { code: 'fr', name: 'French' },
            { code: 'hi', name: 'Hindi' }
        ];

        for (const translation of mockTranslations) {
             // In a real app, you would make an API call to translate the English text.
             // For this example, we use a simple placeholder.
            const translatedSrt = `Translated to ${translation.name} from English.
            1
            00:00:01,000 --> 00:00:04,500
            Translated: This is the first subtitle line.

            2
            00:00:05,000 --> 00:00:08,000
            Translated: This is the second subtitle line.`;

            const translatedTxt = `Translated to ${translation.name} from English.
            Translated: This is the first subtitle line.
            Translated: This is the second subtitle line.`;

            subtitlesData.translations.push({
                lang: translation.name,
                formats: {
                    srt: translatedSrt,
                    txt: translatedTxt
                }
            });
        }

        res.status(200).json(subtitlesData);

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};
