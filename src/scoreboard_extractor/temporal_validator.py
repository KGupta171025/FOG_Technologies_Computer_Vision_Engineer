from collections import Counter


class TemporalValidator:
    def __init__(self, min_required_votes: int = 5):
        self.min_required_votes = min_required_votes
        # Key: (player, col_idx, roll_idx) -> Counter of character detections
        self.votes = {}

    def add_vote(self, player: str, col_idx: int, roll_idx: int, char: str):
        """Adds a detection character vote for a specific cell."""
        if not char:
            return

        key = (player, col_idx, roll_idx)
        if key not in self.votes:
            self.votes[key] = Counter()

        self.votes[key][char] += 1

    def get_stabilized_character(self, player: str, col_idx: int, roll_idx: int, current_val: str) -> tuple[str, bool]:
        """
        Resolves the stabilized character using majority vote.
        Enforces physical consistency: prevents changing already committed values.
        """
        key = (player, col_idx, roll_idx)
        if key not in self.votes:
            return current_val, False

        most_common_char, count = self.votes[key].most_common(1)[0]

        # Stabilize only if it has enough votes
        if count >= self.min_required_votes:
            # If current committed value is empty and we have a new stabilized character
            if not current_val and most_common_char:
                return most_common_char, True
            # Reject impossible changes (e.g., cell changing from one digit to another)
            if current_val and most_common_char and current_val != most_common_char:
                # Log or flag warning but keep original stable value
                return current_val, False

        return current_val, False
