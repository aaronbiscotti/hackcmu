import asyncio
import json
import logging
import time
from typing import Optional, Dict, Any
from vosk import KaldiRecognizer
# Removed circular import - will get these from constructor parameters
from vosk import Model, KaldiRecognizer
import httpx
import os
from dotenv import load_dotenv

# from Main import process_data  # Circular import - will be handled differently

load_dotenv()

VOSK_MODEL_PATH = "vosk-model"
VOSK_SAMPLE_RATE = 16000
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"

# LOGGING
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

class TranscriptionService:
    def __init__(self, vosk_model, sample_rate: int, process_data_func, profile):
        if vosk_model is None:
            raise ValueError("Vosk model not loaded - cannot create transcription service")
        self.recognizer = KaldiRecognizer(vosk_model, sample_rate)
        self.metrics = SessionMetrics()
        self.process_data = process_data_func
        self.profile = profile  # Store the user's profile
        logger.info(f"TranscriptionService initialized for {self.profile.name}")

    async def process_audio(self, data: bytes, executor=None) -> Optional[Dict[str, Any]]:
        try:
            # Use the provided executor or fall back to asyncio.to_thread
            if executor:
                loop = asyncio.get_event_loop()
                accept_result = await loop.run_in_executor(executor, self.recognizer.AcceptWaveform, data)
            else:
                accept_result = await asyncio.to_thread(self.recognizer.AcceptWaveform, data)

            if accept_result:
                # Also run the Result() call in the executor to avoid blocking
                if executor:
                    loop = asyncio.get_event_loop()
                    result_text = await loop.run_in_executor(executor, self.recognizer.Result)
                    result = json.loads(result_text)
                else:
                    result_text = await asyncio.to_thread(self.recognizer.Result)
                    result = json.loads(result_text)
                
                if result.get('text'):
                    text = result['text']
                    logger.info(f"Final transcript: '{text}'")

                    self.metrics.add_transcript(text)

                    data_packet = {
                        "profile_name": self.profile.name,  # Use the stored profile name
                        "message": text,
                        "timestamp": time.time(),
                        "metrics": {
                            "wpm": self.metrics.get_wpm(),
                            "filler_words": self.metrics.filler_count,
                            "clarity_score": self.metrics.get_clarity_score(),
                            "word_count": self.metrics.word_count
                        }
                    }

                    processed = await self.process_data(data_packet)

                    return {
                        "type": "final",
                        "transcript": text,
                        "animation_trigger": processed.get("emotion", "speaking"),
                        "metrics": data_packet["metrics"],
                        "timestamp": data_packet["timestamp"],
                        "current_emotion": processed.get("emotion", "speaking")
                    }
            else:
                # Also run PartialResult() in the executor
                if executor:
                    loop = asyncio.get_event_loop()
                    partial_text = await loop.run_in_executor(executor, self.recognizer.PartialResult)
                    partial_result = json.loads(partial_text)
                else:
                    partial_text = await asyncio.to_thread(self.recognizer.PartialResult)
                    partial_result = json.loads(partial_text)
                
                if partial_result.get('partial'):
                    return {
                        "type": "partial",
                        "transcript": partial_result['partial'],
                        "timestamp": time.time()
                    }

        except Exception as e:
            logger.error(f"Error processing audio: {e}")
            return {
                "type": "error",
                "message": f"Audio processing error: {str(e)}"
            }

        return None
