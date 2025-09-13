from typing import List, Dict

class Profile:
    # All floats are on a Scale of 0 to 1 (1 high, 0 low)
    def __init__(
        self,
        name: str,
        prof: str,
        mem: Dict[str, str],    # (assumption, confidence)
        understand_threshold: float = 0.5
    ):
        self.name = name
        self.prof = prof
        self.mem = mem
        self.understand_threshold = understand_threshold

    def load_from_json(self, data: Dict):
        self.name = data.get("name", self.name)
        self.prof = data.get("prof", self.prof)
        self.mem = data.get("mem", self.mem)
        self.understand_threshold = data.get("understand_threshold", self.understand_threshold)

    def __repr__(self):
        return (
            f"name={self.name!r}, prof={self.prof!r}, mem={self.mem!r}, "
            f"understand_threshold={self.understand_threshold!r}"
        )