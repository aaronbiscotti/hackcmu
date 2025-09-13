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

from main import process_data

load_dotenv()

VOSK_MODEL_PATH = "vosk-model"
VOSK_SAMPLE_RATE = 16000
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
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

# helpers
FILLER_WORDS = {"um", "uh", "like", "so", "you know", "actually", "basically", "literally", "well", "right"}

class SessionMetrics:
    def __init__(self):
        self.word_count = 0
        self.start_time = time.time()
        self.filler_count = 0
        self.sentences = []

    def add_transcript(self, text: str):
        words = text.lower().split()
        self.word_count += len(words)
        self.sentences.append(text)

        for word in words:
            cleaned_word = word.strip('.,!?')
            if cleaned_word in FILLER_WORDS:
                self.filler_count += 1

    def get_wpm(self) -> int:
        elapsed_minutes = (time.time() - self.start_time) / 60
        if elapsed_minutes == 0:
            return 0
        return round(self.word_count / elapsed_minutes)

    def get_clarity_score(self) -> int:
        if self.word_count == 0:
            return 100
        filler_ratio = self.filler_count / self.word_count
        return max(0, round(100 - (filler_ratio * 100)))

# LLM
async def get_emotion_from_text(text: str, profile: Dict[str, Any]) -> str:
    """
    Sends text + profile context to Anthropic's API to get an emotion analysis.
    """
    if not text.strip():
        return "idle"

    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }

    profile_context = json.dumps(profile, indent=2)
    prompt = (
        "Analyze the emotion of the following speech given the user's profile and memory.\n\n"
        f"Profile:\n{profile_context}\n\n"
        f"Text: '{text}'\n\n"
        "Respond with one word only from: idle, question, nodding, shaking_head, excited, thinking, confused, speaking."
    )

    payload = {
        "model": "claude-3-5-haiku-20241022",
        "max_tokens": 10,
        "messages": [{"role": "user", "content": prompt}]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(ANTHROPIC_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            emotion = result.get('content', [{}])[0].get('text', 'speaking').strip().lower()
            logger.info(f"LLM emotion analysis: '{text}' with profile -> '{emotion}'")
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
        Processes a chunk of audio and returns transcript + processed profile emotion.
        """
        try:
            accept_result = await asyncio.to_thread(self.recognizer.AcceptWaveform, data)

            if accept_result:
                result = json.loads(self.recognizer.Result())
                if result.get('text'):
                    text = result['text']
                    logger.info(f"Final transcript: '{text}'")

                    self.metrics.add_transcript(text)

                    # Build data packet to feed into process_data
                    data_packet = {
                        "profile_name": "User0",
                        "message": text,
                        "timestamp": time.time(),
                        "metrics": {
                            "wpm": self.metrics.get_wpm(),
                            "filler_words": self.metrics.filler_count,
                            "clarity_score": self.metrics.get_clarity_score(),
                            "word_count": self.metrics.word_count
                        }
                    }

                    processed = await process_data(data_packet)

                    return {
                        "type": "final",
                        "transcript": text,
                        "animation_trigger": processed.get("emotion", "speaking"),
                        "metrics": data_packet["metrics"],
                        "timestamp": data_packet["timestamp"],
                        "current_emotion": processed.get("emotion", "speaking")  # <── ADDED
                    }
            else:
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
    try:
        return TranscriptionService()
    except ValueError as e:
        logger.error(f"Cannot create transcription service: {e}")
        return None
