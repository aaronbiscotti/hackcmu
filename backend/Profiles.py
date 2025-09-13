from typing import List, Dict

class Profile:
    # All floats are on a Scale of 0 to 1 (1 high, 0 low)
    def __init__(
        self,
        name: str,
        profession: str,
        memory: Dict[str, str],    # (assumption, confidence)
        understanding_threshold: float = 0.5,
        wps: int = 3,
        filler_words: int = 8,
        interest: float = 0.6,
        confidence: float = 0.5
    ):
        self.name = name
        self.profession = profession
        self.memory = memory
        self.understanding_threshold = understanding_threshold
        self.wps = wps,
        self.filler_words = filler_words
        self.interest = interest
        self.confidence = confidence

    def __repr__(self):
        return (
            f"name={self.name!r}, "
            f"profession={self.profession!r}, "
            f"memory={self.memory!r}, "
            f"understanding_threshold={self.understanding_threshold!r}, "
            f"wps={self.wps!r}, "
            f"filler_words={self.filler_words!r}, "
            f"interest={self.interest!r}, "
            f"confidence={self.confidence!r}"
        )