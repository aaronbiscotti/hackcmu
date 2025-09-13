# backend/services.py
import asyncio
import json
import logging
import time
from typing import Optional, Dict, Any
from vosk import Model, KaldiRecognizer
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

VOSK_MODEL_PATH = "vosk-model"
VOSK_SAMPLE_RATE = 16000
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "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")
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"

# LOGGING
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

vosk_model = None
try:
    if os.path.exists(VOSK_MODEL_PATH):
        vosk_model = Model(VOSK_MODEL_PATH)
        logger.info("Vosk model loaded successfully")
    else:
        logger.warning(f"Vosk model not found at {VOSK_MODEL_PATH}")
except Exception as e:
    logger.error(f"Failed to load Vosk model: {e}")

# helpers, not necessarily needed - llm can discern
FILLER_WORDS = {"um", "uh", "like", "so", "you know", "actually", "basically", "literally", "well", "right"}

class SessionMetrics:
    def __init__(self):
        self.word_count = 0
        self.start_time = time.time()
        self.filler_count = 0
        self.sentences = []

    def add_transcript(self, text: str):
        """Add a new transcript and update metrics"""
        words = text.lower().split()
        self.word_count += len(words)
        self.sentences.append(text)

        # Count filler words
        for word in words:
            cleaned_word = word.strip('.,!?')
            if cleaned_word in FILLER_WORDS:
                self.filler_count += 1

    def get_wpm(self) -> int:
        """Calculate words per minute"""
        elapsed_minutes = (time.time() - self.start_time) / 60
        if elapsed_minutes == 0:
            return 0
        return round(self.word_count / elapsed_minutes)

    def get_clarity_score(self) -> int:
        """Calculate clarity score (100 - filler word percentage)"""
        if self.word_count == 0:
            return 100
        filler_ratio = self.filler_count / self.word_count
        return max(0, round(100 - (filler_ratio * 100)))

# LLM
async def get_emotion_from_text(text: str) -> str:
    """
    Sends text to Anthropic's API to get an emotion analysis.
    """
    if not text.strip():
        return "idle"

    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }

    # LLM should give a single word answer for this part
    prompt = (
        "Analyze the emotion and content of the following speech text and respond with a single word from this list: "
        "idle, question, nodding, shaking_head, excited, thinking, confused, speaking. "
        "Choose based on the content and emotional tone. If it's a question, return 'question'. "
        "If it shows agreement, return 'nodding'. If disagreement, return 'shaking_head'. "
        "If enthusiastic/positive, return 'excited'. If contemplative, return 'thinking'. "
        "If shows confusion, return 'confused'. Otherwise return 'speaking'.\n\n"
        f"Text: '{text}'\n\nEmotion:"
    )

    payload = {
        "model": "claude-3-7-sonnet-20250219",
        "max_tokens": 10,
        "messages": [{"role": "user", "content": prompt}]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(ANTHROPIC_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            emotion = result.get('content', [{}])[0].get('text', 'speaking').strip().lower()
            logger.info(f"LLM emotion analysis: '{text}' -> '{emotion}'")
            return emotion
    except httpx.RequestError as e:
        logger.error(f"Error calling Anthropic API: {e}")
        return "speaking"
    except Exception as e:
        logger.error(f"Unexpected error in emotion analysis: {e}")
        return "speaking"

# Transcription
class TranscriptionService:
    def __init__(self):
        if vosk_model is None:
            raise ValueError("Vosk model not loaded - cannot create transcription service")
        self.recognizer = KaldiRecognizer(vosk_model, VOSK_SAMPLE_RATE)
        self.metrics = SessionMetrics()
        logger.info("TranscriptionService initialized")

    async def process_audio(self, data: bytes) -> Optional[Dict[str, Any]]:
        """
        Processes a chunk of audio and returns the final transcript if available.
        """
        try:
            # Run blocking Vosk code in a separate thread to avoid blocking the event loop
            accept_result = await asyncio.to_thread(self.recognizer.AcceptWaveform, data)

            if accept_result:
                # Final result
                result = json.loads(self.recognizer.Result())
                if result.get('text'):
                    text = result['text']
                    logger.info(f"Final transcript: '{text}'")

                    # Update metrics
                    self.metrics.add_transcript(text)

                    # Get emotion analysis from LLM
                    emotion = await get_emotion_from_text(text)

                    return {
                        "type": "final",
                        "transcript": text,
                        "animation_trigger": emotion,
                        "metrics": {
                            "wpm": self.metrics.get_wpm(),
                            "filler_words": self.metrics.filler_count,
                            "clarity_score": self.metrics.get_clarity_score(),
                            "word_count": self.metrics.word_count
                        },
                        "timestamp": time.time()
                    }
            else:
                # Partial result
                partial_result = json.loads(self.recognizer.PartialResult())
                if partial_result.get('partial'):
                    partial_text = partial_result['partial']
                    logger.debug(f"Partial transcript: '{partial_text}'")
                    return {
                        "type": "partial",
                        "transcript": partial_text,
                        "timestamp": time.time()
                    }

        except Exception as e:
            logger.error(f"Error processing audio: {e}")
            return {
                "type": "error",
                "message": f"Audio processing error: {str(e)}"
            }

        return None

def create_transcription_service() -> Optional[TranscriptionService]:
    """Factory function to create a transcription service"""
    try:
        return TranscriptionService()
    except ValueError as e:
        logger.error(f"Cannot create transcription service: {e}")
        return None