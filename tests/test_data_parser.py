from scoreboard_extractor.data_parser import DataParser


def test_normalize_roll():
    # Test common OCR replacements
    assert DataParser.normalize_roll("O", 0) == "-"
    assert DataParser.normalize_roll("0", 0) == "-"
    assert DataParser.normalize_roll("I", 0) == "1"
    assert DataParser.normalize_roll("S", 0) == "5"
    assert DataParser.normalize_roll("X", 0) == "X"
    assert DataParser.normalize_roll("/", 1) == "/"

    # Test context-based spare validation
    assert DataParser.normalize_roll("1", 1, "9") == "/"
    assert DataParser.normalize_roll("1", 0, "9") == "1"

def test_parse_roll_val():
    assert DataParser.parse_roll_val("X") == 10
    assert DataParser.parse_roll_val("-") == 0
    assert DataParser.parse_roll_val("7") == 7
    assert DataParser.parse_roll_val("/", 4) == 6
    assert DataParser.parse_roll_val("") is None

def test_calculate_bowling_scores():
    # Test game with strikes, spares, open frames
    rolls = [
        ["X", ""],   # Frame 1: Strike. Score = 10 + 4 + 6 = 20
        ["4", "/"],  # Frame 2: Spare.  Score = 20 + 10 + 9 = 39
        ["9", "7"],  # Frame 3: Open.   Score = 39 + 16 = 55
        ["", ""],    # Empty frames
        ["", ""],
        ["", ""],
        ["", ""],
        ["-", ""],
        ["-", ""],
        ["", "", "-"]
    ]
    scores = DataParser.calculate_bowling_scores(rolls)
    assert scores[0] == 20
    assert scores[1] == 39
    assert scores[2] == 55
    assert scores[3] == ""
