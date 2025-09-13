class Buddy:
    def __init__(self):
        # List of possible states
        self.states_bank = \
            ["idle", "surprised", "nodding", "shaking head",
             "nerd", "angry", "slow down", "bored", "thumbs up",
             "cheer"]
        self.current_state = "idle" # Default state

    def update_state(self, new_state):
        if new_state in self.states_bank:
            self.current_state = new_state
            print(f"Buddy state updated to: {self.current_state}")
        else:
            print(f"State '{new_state}' not in states bank.")

    def get_state(self):
        return self.current_state

    def react(self, profiles): # Do I need newest_data?
        # TODO: Implement reaction logic
        return