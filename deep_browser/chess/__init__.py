"""
Deep-Browser Chess Engine & Autonomous Playing Module
=====================================================
"""

from deep_browser.chess.engine import ChessEngineManager, find_stockfish_binary
from deep_browser.chess.evaluator import analyze_position, classify_move, move_details
from deep_browser.chess.policy import ChessPlayPolicy, LEVEL_CONFIGS
from deep_browser.chess.renderer import render_html_board
from deep_browser.chess.game_loop import ChessGameController

__all__ = [
    "ChessEngineManager",
    "find_stockfish_binary",
    "analyze_position",
    "classify_move",
    "move_details",
    "ChessPlayPolicy",
    "LEVEL_CONFIGS",
    "render_html_board",
    "ChessGameController",
]
