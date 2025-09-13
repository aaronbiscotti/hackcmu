# backend/live_transcription.py
import asyncio
import json
import logging
import time
from fastapi import WebSocket, WebSocketDisconnect
from vosk import Model, KaldiRecognizer
import os

# --- Configuration ---
VOSK_SAMPLE_RATE = 16000
VOSK_MODEL_PATH = "vosk-model"  # You'll need to download a Vosk model

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Analysis Helpers ---
FILLER_WORDS = {"um", "uh", "like", "so", "you know", "actually", "basically", "literally", "well", "right"}

class UserSession:
    def __init__(self):
        self.word_count = 0
        self.start_time = time.time()
        self.filler_count = 0
        self.total_speech_time = 0
        self.last_speech_time = time.time()

    def calculate_wpm(self):
        elapsed_minutes = (time.time() - self.start_time) / 60
        if elapsed_minutes == 0:
            return 0
        return round(self.word_count / elapsed_minutes)

    def calculate_clarity_score(self):
        if self.word_count == 0:
            return 100
        filler_ratio = self.filler_count / self.word_count
        return max(0, round(100 - (filler_ratio * 100)))

    def process_text(self, text: str):
        words = text.lower().split()
        new_words = len(words)
        self.word_count += new_words

        # Count filler words
        for word in words:
            cleaned_word = word.strip('.,!?')
            if cleaned_word in FILLER_WORDS:
                self.filler_count += 1

        # Update speech timing
        self.last_speech_time = time.time()

        # Determine animation trigger based on content and sentiment
        animation_trigger = self._determine_animation(words, text)

        return animation_trigger

    def _determine_animation(self, words: list, text: str):
        # Question detection
        if any(word in words for word in ["what", "how", "why", "when", "where"]) or "?" in text:
            return "question"

        # Agreement/positive
        if any(word in words for word in ["yes", "agree", "absolutely", "definitely", "correct", "right"]):
            return "nodding"

        # Disagreement/negative
        if any(word in words for word in ["no", "disagree", "wrong", "incorrect", "never"]):
            return "shaking_head"

        # Excitement/positive energy
        if any(word in words for word in ["awesome", "amazing", "brilliant", "excellent", "fantastic", "wow"]):
            return "excited"

        # Thinking/contemplation
        if any(word in words for word in ["hmm", "let me think", "interesting", "consider"]):
            return "thinking"

        # Confusion
        if any(word in words for word in ["confused", "unclear", "don't understand", "what do you mean"]):
            return "confused"

        return "speaking"  # Default speaking animation

# Global variable to store the loaded model
vosk_model = None

def load_vosk_model():
    """Load the Vosk model on startup"""
    global vosk_model
    try:
        if os.path.exists(VOSK_MODEL_PATH):
            vosk_model = Model(VOSK_MODEL_PATH)
            logging.info("Vosk model loaded successfully.")
            return True
        else:
            logging.warning(f"Vosk model not found at {VOSK_MODEL_PATH}. Speech recognition will not work.")
            return False
    except Exception as e:
        logging.error(f"Failed to load Vosk model: {e}")
        return False

async def handle_transcription_websocket(websocket: WebSocket):
    """Handle WebSocket connection for live transcription"""
    await websocket.accept()
    logging.info(f"Client connected for transcription: {websocket.client}")

    if vosk_model is None:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Speech recognition model not available"
        }))
        await websocket.close()
        return

    recognizer = KaldiRecognizer(vosk_model, VOSK_SAMPLE_RATE)
    session = UserSession()

    try:
        while True:
            # Receive audio data
            data = await websocket.receive_bytes()

            # Process audio with Vosk
            if recognizer.AcceptWaveform(data):
                # Final result
                result = json.loads(recognizer.Result())
                if result.get('text'):
                    final_text = result['text']
                    logging.info(f"Final Transcript: {final_text}")

                    animation_trigger = session.process_text(final_text)

                    # Construct the response object
                    response = {
                        "type": "final",
                        "transcript": final_text,
                        "metrics": {
                            "wpm": session.calculate_wpm(),
                            "filler_words": session.filler_count,
                            "clarity_score": session.calculate_clarity_score(),
                            "word_count": session.word_count
                        },
                        "animation_trigger": animation_trigger,
                        "timestamp": time.time()
                    }
                    await websocket.send_text(json.dumps(response))
            else:
                # Partial result
                partial_result = json.loads(recognizer.PartialResult())
                if partial_result.get('partial'):
                    logging.info(f"Partial Transcript: {partial_result['partial']}")
                    response = {
                        "type": "partial",
                        "transcript": partial_result['partial'],
                        "timestamp": time.time()
                    }
                    await websocket.send_text(json.dumps(response))

    except WebSocketDisconnect:
        logging.info(f"Client disconnected: {websocket.client}")
    except Exception as e:
        logging.error(f"An error occurred with client {websocket.client}: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": str(e)
            }))
        except:
            pass  # Connection might already be closed