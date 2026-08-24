"""
Chess Play Policy & Difficulty Manager
======================================

Implements human-like move selection, difficulty presets,
blunder punishment (Absolute Win Rule), and Brilliant move flash probability (1:10).
"""

import random
import logging
from typing import Any, Dict, List, Optional, Tuple

import chess
from deep_browser.chess.evaluator import analyze_position

logger = logging.getLogger(__name__)

LEVEL_CONFIGS = {
    "casual": {
        "label": "Casual (Pemula)",
        "elo": 1000,
        "depth": 6,
        "multipv": 8,
        "weights": {"BRILLIANT": 0.10, "BEST": 0.25, "EXCELLENT": 0.25, "GOOD": 0.25, "SAFE": 0.15, "INACCURACY": 0.08, "MISTAKE": 0.02},
        "blunder_punish_threshold_cp": 500,  # Absolute win on massive blunder
    },
    "normal": {
        "label": "Normal (Club Human)",
        "elo": 1400,
        "depth": 9,
        "multipv": 6,
        "weights": {"BRILLIANT": 0.10, "BEST": 0.40, "EXCELLENT": 0.30, "GOOD": 0.20, "SAFE": 0.08, "INACCURACY": 0.02},
        "blunder_punish_threshold_cp": 350,  # Punishes hung pieces / major blunders
    },
    "strong": {
        "label": "Strong (Master)",
        "elo": 1850,
        "depth": 12,
        "multipv": 5,
        "weights": {"BRILLIANT": 0.25, "BEST": 0.70, "EXCELLENT": 0.25, "GOOD": 0.05},
        "blunder_punish_threshold_cp": 200,
    },
    "grandmaster": {
        "label": "Grandmaster (Ultra Max)",
        "elo": 2700,
        "depth": 16,
        "multipv": 4,
        "weights": {"BRILLIANT": 0.50, "BEST": 0.95, "EXCELLENT": 0.05},
        "blunder_punish_threshold_cp": 100,
    },
}


class ChessPlayPolicy:
    """
    Selects moves from Stockfish candidates based on target difficulty level,
    human randomness distribution, and tactical triggers.
    """

    def __init__(self, level: str = "normal", seed: Optional[int] = None):
        self.level_name = level.lower().strip() if level else "normal"
        if self.level_name not in LEVEL_CONFIGS:
            self.level_name = "normal"
        self.config = LEVEL_CONFIGS[self.level_name]
        self._rng = random.Random(seed)

    def select_move(
        self,
        board: chess.Board,
        analysis_report: Dict[str, Any],
        opponent_last_move: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Selects the move to play according to the difficulty policy:
        1. Absolute Win / Blunder Punishment: If opponent blundered or position is winning (> threshold), pick top BEST move.
        2. Brilliant Move Flash: 1:10 (10%) chance to immediately seize a BRILLIANT sacrifice.
        3. Weighted Human Sampling: Probabilistically picks among BEST, EXCELLENT, GOOD, SAFE.
        """
        candidates = analysis_report.get("candidates", [])
        if not candidates:
            # Fallback to any legal move
            legal = list(board.legal_moves)
            if not legal:
                return {"move_uci": None, "label": "NO_MOVE", "reason": "No legal moves available"}
            fallback_mv = self._rng.choice(legal)
            return {"move_uci": fallback_mv.uci(), "label": "RANDOM", "reason": "Fallback random move"}

        best_cand = candidates[0]
        best_cp = analysis_report.get("best_cp", 0)

        # ── 1. Check for Brilliant Move Flash (1:10 probability) ──────────────
        brilliant_cands = [c for c in candidates if c.get("label") == "BRILLIANT"]
        if brilliant_cands:
            # 1:10 trigger chance (10%)
            if self._rng.random() < self.config["weights"].get("BRILLIANT", 0.10):
                chosen = brilliant_cands[0]
                logger.info(f"[ChessPolicy] ✨ Brilliant move triggered ({chosen['move_uci']})!")
                return {
                    **chosen,
                    "reason": "✨ Mengambil langkah BRILLIANT (Peluang Taktis 1:10)",
                    "policy_decision": "BRILLIANT_TRIGGER",
                }

        # ── 2. Absolute Win Rule: Punish Opponent Blunders ─────────────────────
        # If position is overwhelmingly winning (e.g. > +350 cp) or checkmate in sight
        punish_thresh = self.config.get("blunder_punish_threshold_cp", 350)
        if best_cp >= punish_thresh:
            logger.info(f"[ChessPolicy] 🎯 Absolute Win / Blunder Punish triggered (CP: {best_cp})")
            return {
                **best_cand,
                "reason": "🎯 Menghukum Blunder Lawan: Mengambil langkah kemenangan mutlak",
                "policy_decision": "BLUNDER_PUNISH",
            }

        # ── 3. Level-specific Weighted Randomness ─────────────────────────────
        # If Ultra Max / Grandmaster, play BEST almost always
        if self.level_name == "grandmaster":
            return {
                **best_cand,
                "reason": "🏆 Grandmaster: Memilih langkah mesin paling akurat",
                "policy_decision": "ENGINE_OPTIMAL",
            }

        # In Normal or Casual level: sample candidate moves according to category weights
        weights_map = self.config["weights"]
        valid_pool = []
        pool_weights = []

        for cand in candidates:
            lbl = cand.get("label", "GOOD")
            w = weights_map.get(lbl, 0.05)
            # Apply quality percentage modifier
            pct = cand.get("percent", 50) / 100.0
            effective_weight = max(0.01, w * (pct ** 1.5))
            valid_pool.append(cand)
            pool_weights.append(effective_weight)

        if valid_pool and sum(pool_weights) > 0:
            chosen = self._rng.choices(valid_pool, weights=pool_weights, k=1)[0]
        else:
            chosen = best_cand

        return {
            **chosen,
            "reason": f"♟️ Level {self.config['label']}: Memilih pergerakan {chosen.get('label', 'NORMAL')} ({chosen.get('percent', 100)}%)",
            "policy_decision": "WEIGHTED_HUMAN_SELECTION",
        }
