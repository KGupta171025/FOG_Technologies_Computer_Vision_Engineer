from typing import List, Union


class DataParser:
    @staticmethod
    def normalize_roll(text: str, roll_idx: int, prev_roll: str = "") -> str:
        """
        Normalizes OCR character mistakes depending on the roll position slot.
        e.g., O/0 in roll 1/2 is normalized to '-', I/1 to '1', S to '5', etc.
        """
        if not text:
            return ""

        # Clean text
        text = text.upper().strip()

        # Replace common OCR misreads
        replacements = {
            "O": "0",
            "I": "1",
            "L": "1",
            "S": "5",
            "G": "6",
            "B": "8",
        }
        for k, v in replacements.items():
            text = text.replace(k, v)

        # Normalize zero ('0') to gutter ('-')
        if text == "0":
            text = "-"

        # Check context rules
        if roll_idx == 1 and text == "1":
            # If roll 1 + roll 2 = 10, check if this was meant to be a spare '/'
            try:
                val1 = int(prev_roll) if prev_roll.isdigit() else 0
                if val1 == 9:
                    return "/"
            except ValueError:
                pass

        # If roll 2 is a slash or completes a spare
        if text == "/":
            return "/"

        # Limit to known bowling symbols
        valid_symbols = {"X", "/", "-", "1", "2", "3", "4", "5", "6", "7", "8", "9"}
        if text in valid_symbols:
            return text

        return ""

    @staticmethod
    def parse_roll_val(val: str, prev_val: int = 0) -> Union[int, None]:
        """Converts a roll symbol to its numeric value."""
        if not val or val == " ":
            return None
        if val == "X":
            return 10
        if val == "/":
            return 10 - prev_val
        if val == "-":
            return 0
        try:
            return int(val)
        except ValueError:
            return None

    @staticmethod
    def calculate_bowling_scores(player_frames: List[List[str]]) -> List[Union[int, str]]:
        """
        Calculates cumulative bowling scores across 10 frames based on official rules.
        """
        flat_rolls = []
        for f_idx, frame in enumerate(player_frames):
            for r_idx, roll in enumerate(frame):
                if not roll or roll == " ":
                    continue
                prev_num_val = 0
                if r_idx == 1 and len(flat_rolls) > 0:
                    last_roll = flat_rolls[-1]
                    if last_roll[0] == f_idx and last_roll[3] is not None:
                        prev_num_val = last_roll[3]

                num_val = DataParser.parse_roll_val(roll, prev_num_val)
                flat_rolls.append((f_idx, r_idx, roll, num_val))

        cumulative_scores = [""] * 10
        current_sum = 0

        for f_idx in range(10):
            frame_rolls = [r for r in flat_rolls if r[0] == f_idx]
            if not frame_rolls:
                break

            is_strike = frame_rolls[0][2] == 'X'
            is_spare = f_idx < 9 and len(frame_rolls) > 1 and frame_rolls[1][2] == '/'

            if f_idx < 9:
                if is_strike:
                    strike_idx = next(i for i, r in enumerate(flat_rolls) if r[0] == f_idx and r[1] == 0)
                    next_rolls = flat_rolls[strike_idx+1:]
                    if len(next_rolls) >= 2:
                        val1 = next_rolls[0][3]
                        val2 = next_rolls[1][3]
                        if val1 is not None and val2 is not None:
                            current_sum += 10 + val1 + val2
                            cumulative_scores[f_idx] = current_sum
                        else:
                            break
                    else:
                        break
                elif is_spare:
                    spare_idx = next(i for i, r in enumerate(flat_rolls) if r[0] == f_idx and r[1] == 1)
                    next_rolls = flat_rolls[spare_idx+1:]
                    if len(next_rolls) >= 1:
                        val1 = next_rolls[0][3]
                        if val1 is not None:
                            current_sum += 10 + val1
                            cumulative_scores[f_idx] = current_sum
                        else:
                            break
                    else:
                        break
                else:
                    if len(frame_rolls) == 2:
                        val1 = frame_rolls[0][3]
                        val2 = frame_rolls[1][3]
                        if val1 is not None and val2 is not None:
                            current_sum += val1 + val2
                            cumulative_scores[f_idx] = current_sum
                        else:
                            break
                    else:
                        break
            else:
                # Frame 10
                val1 = frame_rolls[0][3] if len(frame_rolls) > 0 else None
                val2 = frame_rolls[1][3] if len(frame_rolls) > 1 else None
                val3 = frame_rolls[2][3] if len(frame_rolls) > 2 else None

                if val1 is None:
                    break

                is_f10_strike = frame_rolls[0][2] == 'X'
                is_f10_spare = len(frame_rolls) > 1 and frame_rolls[1][2] == '/'

                if is_f10_strike or is_f10_spare:
                    if val1 is not None and val2 is not None and val3 is not None:
                        current_sum += val1 + val2 + val3
                        cumulative_scores[f_idx] = current_sum
                    else:
                        break
                else:
                    if val1 is not None and val2 is not None:
                        current_sum += val1 + val2
                        cumulative_scores[f_idx] = current_sum
                    else:
                        break

        return cumulative_scores
