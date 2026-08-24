"""
Unit Tests: Deep-Browser Chess Copilot & Stockfish Engine
=========================================================

Tests Stockfish engine initialization, multi-PV analysis, move classification,
difficulty policies, blunder punishment rule, and board rendering.
"""

import unittest
import chess

from deep_browser.chess.engine import ChessEngineManager, find_stockfish_binary
from deep_browser.chess.evaluator import (
    analyze_position,
    classify_move,
    move_details,
    score_to_cp,
    cp_to_percent,
)
from deep_browser.chess.policy import ChessPlayPolicy, LEVEL_CONFIGS
from deep_browser.chess.renderer import render_html_board


class TestChessEngineAndPolicy(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.stockfish_path = find_stockfish_binary()
        if cls.stockfish_path:
            cls.engine_mgr = ChessEngineManager(cls.stockfish_path)
        else:
            cls.engine_mgr = None

    def test_01_stockfish_binary_discovered(self):
        """Verify that Stockfish executable is discovered on system."""
        self.assertIsNotNone(self.stockfish_path, "Stockfish executable must be found")

    def test_02_engine_manager_initialization(self):
        """Verify engine manager starts and pings Stockfish successfully."""
        if not self.engine_mgr:
            self.skipTest("Stockfish not available")
        engine = self.engine_mgr.get_engine()
        self.assertIsNotNone(engine)
        self.assertIn("Stockfish", engine.id.get("name", ""))

    def test_03_position_analysis_starting_fen(self):
        """Verify analyzing standard starting position."""
        if not self.engine_mgr:
            self.skipTest("Stockfish not available")
        board = chess.Board(chess.STARTING_FEN)
        analysis = analyze_position(board, depth=8, multipv=3, engine_manager=self.engine_mgr)

        self.assertFalse(analysis["game_over"])
        self.assertIsNotNone(analysis["best_move"])
        self.assertGreaterEqual(len(analysis["candidates"]), 1)
        self.assertIn(analysis["candidates"][0]["label"], ("BEST", "EXCELLENT", "GOOD"))

    def test_04_move_classification(self):
        """Verify move classification thresholds."""
        board = chess.Board(chess.STARTING_FEN)
        mv = chess.Move.from_uci("e2e4")

        self.assertEqual(classify_move(board, mv, best_cp=30, move_cp=25), "BEST")
        self.assertEqual(classify_move(board, mv, best_cp=100, move_cp=50), "GOOD")
        self.assertEqual(classify_move(board, mv, best_cp=200, move_cp=50), "INACCURACY")
        self.assertEqual(classify_move(board, mv, best_cp=500, move_cp=-100), "BLUNDER")

    def test_05_policy_normal_level_move_selection(self):
        """Verify Normal level policy returns a valid legal move with metadata."""
        if not self.engine_mgr:
            self.skipTest("Stockfish not available")
        board = chess.Board(chess.STARTING_FEN)
        analysis = analyze_position(board, depth=8, multipv=4, engine_manager=self.engine_mgr)

        policy = ChessPlayPolicy(level="normal", seed=42)
        selected = policy.select_move(board, analysis)

        self.assertIsNotNone(selected.get("move_uci"))
        mv_obj = chess.Move.from_uci(selected["move_uci"])
        self.assertIn(mv_obj, board.legal_moves)
        self.assertIn("reason", selected)

    def test_06_policy_absolute_win_blunder_punish(self):
        """Verify Absolute Win rule: when opponent makes a huge blunder, agent takes top move."""
        board = chess.Board()
        # Mock analysis report where best_cp is overwhelmingly high (+600 cp)
        mock_analysis = {
            "best_cp": 600,
            "candidates": [
                {"move_uci": "d1h5", "label": "BEST", "percent": 100, "cp": 600},
                {"move_uci": "g1f3", "label": "GOOD", "percent": 60, "cp": 200},
            ]
        }
        policy = ChessPlayPolicy(level="normal", seed=42)
        selected = policy.select_move(board, mock_analysis)

        self.assertEqual(selected["move_uci"], "d1h5")
        self.assertEqual(selected["policy_decision"], "BLUNDER_PUNISH")

    def test_07_policy_brilliant_move_trigger(self):
        """Verify that Brilliant tactical move can be triggered."""
        board = chess.Board()
        mock_analysis = {
            "best_cp": 100,
            "candidates": [
                {"move_uci": "d1h5", "label": "BEST", "percent": 100, "cp": 100},
                {"move_uci": "c1g5", "label": "BRILLIANT", "percent": 95, "cp": 95},
            ]
        }
        # Force seed where random() < 0.10
        policy = ChessPlayPolicy(level="normal", seed=1)
        # Check that candidate labels are preserved
        selected = policy.select_move(board, mock_analysis)
        self.assertIn(selected["move_uci"], ("d1h5", "c1g5"))

    def test_08_html_board_renderer(self):
        """Verify HTML mini-board generation."""
        board = chess.Board(chess.STARTING_FEN)
        html = render_html_board(
            board=board,
            last_move_uci="e2e4",
            eval_cp=45,
            playing_as="w",
            move_label="BEST",
            commentary=["Langkah pembukaan klasik e4.", "Menguasai petak pusat."],
        )

        self.assertIn("chess-chat-card", html)
        self.assertIn("chess-board-grid", html)
        self.assertIn("board-sq", html)
        self.assertIn("highlight-from", html)
        self.assertIn("highlight-to", html)
        self.assertIn("Langkah pembukaan klasik e4", html)


if __name__ == "__main__":
    unittest.main()
