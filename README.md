

<img width="1470" height="715" alt="Screenshot 2025-09-13 at 6 17 46 PM" src="https://github.com/user-attachments/assets/16788509-5ed4-44b8-aa40-cf1edbbd3039" />

# Totter - Your Guided Companion Video Calling

> **"AI Can Code. You Still Need to Convince."**

We built Totter as a video calling platform that helps you communicate more effectively. Built with Next.js and LiveKit, it features an AI companion character that reacts dynamically during calls to enhance engagement and connection.

## Features
- **Real time Video Calls**: High-quality, real time video conferencing powered by LiveKit
- **AI Companion**: Totter character with animated reactions during calls
- **Weighted Reaction System**: Smart emotion distribution for natural interactions
- **Retro UI**: Windows 98-inspired design aesthetic
- **Simple Join Flow**: Easy meeting creation and participation

## Totter the Otter

Totter the Otter appears in the top-left corner during video calls with various reactions to what the user is saying, aimed at "dumbing" down communication between both familiar and nonfamiliar parties when presenting, discussing, or teaching.
- **Fast** - You're going too fast, slow down!
- **Nerd** - You're using too much technical jargon!
- **Shake** - Totter catches that you said something wrong!
- **Surprised** - Totter found what you said surprising or unexpected!
- **Excited** - Totter matches your excitation
- **Angry** - Totter did not like what you said. Be careful.

## Architecture

### Frontend (`/frontend`)
- **Framework**: Next.js 14 with TypeScript
- **UI Library**: React with custom Windows 98-style components
- **Video SDK**: LiveKit Components React
- **Styling**: Tailwind CSS with custom retro styling
- **Real-time**: WebSocket connections for live interactions

### Backend (`/backend`)
- **Framework**: FastAPI (Python)
- **WebRTC**: LiveKit server integration
  **Claude Sonnet 3.7 API**: "Game" states for structured output via. Instructor for outputting LLM's thoughts (factoring in word speed, content, tone of language) and decision for Totter to use our tooling functions to trigger a reaction.
- **Speech Recognition**: Vosk model for transcription support via. 2GB English 
- **API**: RESTful endpoints for connection management

**Built with ❤️ for better human connections in the age of AI by Aaron, Barbara, Joon, and Jonathan**
