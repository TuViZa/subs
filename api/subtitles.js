// File: api/subtitles.js
//
// IMPORTANT: To make this work on Vercel, you need a 'package.json' file in your project root.
// It should contain the following dependencies:
//
// {
//   "name": "youtube-sub-downloader-backend",
//   "version": "1.0.0",
//   "description": "A Vercel serverless function to fetch YouTube subtitles.",
//   "main": "api/subtitles.js",
//   "scripts": {
//     "start": "node api/subtitles.js"
//   },
//   "dependencies": {
//     "ytdl-core": "^4.11.5",
//     "axios": "^1.7.2",
//     "xml2js": "^0.6.2"
//   }
// }
//
// Ensure this file and your index.html are in the project root,
// and the 'subtitles.js' file is inside an 'api' directory.
//

const ytdl = require('ytdl-core');
const axios = require('axios');
const xml2js = require('xml2js');

// Helper function to convert a YouTube XML subtitle to SRT format
const convertToSrt = (xml) => {
    let srt = '';
    let index = 1;
    xml.transcript.text.forEach(line => {
        const startSeconds = parseFloat(line.$.start);
        const durationSeconds = parseFloat(line.$.dur);
        const endSeconds = startSeconds + durationSeconds;

        const formatTime = (time) => {
            const date = new Date(null);
            date.setSeconds(time);
            // This is the correct way to format time for SRT
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            const seconds = String(date.getUTCSeconds()).padStart(2, '0');
            const milliseconds = String(time.toFixed(3).split('.')[1] || '000').padStart(3, '0');
            return `${hours}:${minutes}:${seconds},${milliseconds}`;
        };

        const startTime = formatTime(startSeconds);
        const endTime = formatTime(endSeconds);
        const text = line._.replace(/<[^>]*>/g, '').replace(/(\n)/gm, ' ');

        srt += `${index}\n${startTime} --> ${endTime}\n${text}\n\n`;
        index++;
    });
    return srt.trim();
};

// Helper function to convert a YouTube XML subtitle to TXT format
const convertToTxt = (xml) => {
    let txt = '';
    xml.transcript.text.forEach(line => {
        const text = line._.replace(/<[^>]*>/g, '').replace(/(\n)/gm, ' ');
        txt += text + ' ';
    });
    return txt.trim();
};

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

        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;
        const captionTracks = videoDetails.subtitles;

        if (!captionTracks || captionTracks.length === 0) {
            res.status(404).json({ error: 'No subtitles found for this video.' });
            return;
        }

        const subtitlesData = {
            originals: [],
            translations: []
        };

        for (const track of captionTracks) {
            try {
                // Fetch the XML content from YouTube
                const { data: xmlData } = await axios.get(track.baseUrl);

                // Parse XML to JavaScript object
                const parser = new xml2js.Parser();
                const result = await parser.parseStringPromise(xmlData);

                // Convert to SRT and TXT formats
                const srtContent = convertToSrt(result);
                const txtContent = convertToTxt(result);

                const subtitle = {
                    lang: track.name.simpleText,
                    formats: {
                        srt: srtContent,
                        txt: txtContent
                    }
                };

                // Distinguish between original and translated captions
                if (track.isTranslatable) {
                    subtitlesData.translations.push(subtitle);
                } else {
                    subtitlesData.originals.push(subtitle);
                }
            } catch (trackError) {
                console.error(`Error processing track for language ${track.languageCode}:`, trackError);
                // Continue to the next track even if one fails
            }
        }

        if (subtitlesData.originals.length === 0 && subtitlesData.translations.length === 0) {
            res.status(404).json({ error: 'No subtitles could be processed for this video.' });
            return;
        }

        res.status(200).json(subtitlesData);

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};
