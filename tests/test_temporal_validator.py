from scoreboard_extractor.temporal_validator import TemporalValidator


def test_temporal_validator_stabilization():
    validator = TemporalValidator(min_required_votes=3)

    # Empty cell starting state
    player = "P"
    col_idx = 1
    roll_idx = 1
    current_val = ""

    # Cast 2 votes (less than min_required_votes=3)
    validator.add_vote(player, col_idx, roll_idx, "/")
    validator.add_vote(player, col_idx, roll_idx, "/")
    val, changed = validator.get_stabilized_character(player, col_idx, roll_idx, current_val)
    assert val == ""
    assert not changed

    # Cast 3rd vote
    validator.add_vote(player, col_idx, roll_idx, "/")
    val, changed = validator.get_stabilized_character(player, col_idx, roll_idx, current_val)
    assert val == "/"
    assert changed

def test_temporal_validator_immutable_commits():
    validator = TemporalValidator(min_required_votes=2)
    player = "J"
    col_idx = 0
    roll_idx = 0

    # Committing initial value
    validator.add_vote(player, col_idx, roll_idx, "X")
    validator.add_vote(player, col_idx, roll_idx, "X")
    val, changed = validator.get_stabilized_character(player, col_idx, roll_idx, "")
    assert val == "X"
    assert changed

    # Attempting to overwrite it to a different character
    validator.add_vote(player, col_idx, roll_idx, "9")
    validator.add_vote(player, col_idx, roll_idx, "9")
    val, changed = validator.get_stabilized_character(player, col_idx, roll_idx, "X")
    assert val == "X"  # Retains stable value
    assert not changed
