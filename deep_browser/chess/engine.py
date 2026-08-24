"""
Stockfish Engine Manager for Deep-Browser
=========================================

Handles Stockfish UCI engine discovery, lifecycle, thread safety,
and multi-pv deep evaluation using python-chess.
"""

import os
import shutil
import logging
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple, Union

import chess
import chess.engine

logger = logging.getLogger(__name__)

_ENGINE_LOCK = Lock()
_ENGINE_INSTANCE: Optional[chess.engine.SimpleEngine] = None
_ENGINE_PATH_CACHE: Optional[str] = None


def find_stockfish_binary() -> Optional[str]:
    """
    Auto-discovers the Stockfish executable.
    Checks:
      1. Reference project path: D:/PROJECT/catur/stockfish.exe
      2. Workspace / local relative directories
      3. STOCKFISH_PATH environment variable
      4. System PATH
    """
    global _ENGINE_PATH_CACHE
    if _ENGINE_PATH_CACHE and os.path.isfile(_ENGINE_PATH_CACHE):
        return _ENGINE_PATH_CACHE

    candidates = [
        os.environ.get("STOCKFISH_PATH"),
        r"d:\PROJECT\catur\stockfish.exe",
        "d:/PROJECT/catur/stockfish.exe",
        os.path.join(os.getcwd(), "stockfish.exe"),
        os.path.join(os.getcwd(), "stockfish"),
        os.path.join(os.path.dirname(__file__), "stockfish.exe"),
        os.path.join(os.path.dirname(__file__), "stockfish"),
        "stockfish.exe",
        "stockfish",
    ]

    for cand in candidates:
        if not cand:
            continue
        if os.path.isabs(cand):
            if os.path.exists(cand) and os.path.isfile(cand):
                _ENGINE_PATH_CACHE = cand
                logger.info(f"[ChessEngine] Found Stockfish binary at: {cand}")
                return cand
        else:
            found = shutil.which(cand)
            if found:
                _ENGINE_PATH_CACHE = found
                logger.info(f"[ChessEngine] Found Stockfish binary in PATH: {found}")
                return found

    logger.warning("[ChessEngine] Stockfish binary not found in standard paths.")
    return None


class ChessEngineManager:
    """
    Singleton wrapper around python-chess SimpleEngine with UCI configuration.
    """
    _instance: Optional["ChessEngineManager"] = None

    def __init__(self, binary_path: Optional[str] = None):
        self.binary_path = binary_path or find_stockfish_binary()
        self._engine: Optional[chess.engine.SimpleEngine] = None
        self._lock = Lock()

    @classmethod
    def get_instance(cls) -> "ChessEngineManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_engine(self) -> chess.engine.SimpleEngine:
        """Returns or starts the SimpleEngine instance."""
        with self._lock:
            if self._engine is not None:
                try:
                    # Ping engine to ensure it is alive
                    self._engine.ping()
                    return self._engine
                except Exception:
                    logger.warning("[ChessEngine] Engine was dead, restarting...")
                    self.close()

            if not self.binary_path or not os.path.isfile(self.binary_path):
                self.binary_path = find_stockfish_binary()
                if not self.binary_path:
                    raise RuntimeError(
                        "Stockfish binary not found. Please place 'stockfish.exe' at 'D:/PROJECT/catur/stockfish.exe' "
                        "or set STOCKFISH_PATH environment variable."
                    )

            logger.info(f"[ChessEngine] Launching Stockfish from {self.binary_path}")
            self._engine = chess.engine.SimpleEngine.popen_uci(self.binary_path)
            try:
                self._engine.configure({"Threads": 2, "Hash": 64, "Ponder": False})
            except Exception as e:
                logger.warning(f"[ChessEngine] Optional UCI configure failed: {e}")

            return self._engine

    def configure_strength(self, elo: Union[int, str]) -> None:
        """Configures UCI limit strength or Skill Level based on target ELO."""
        engine = self.get_engine()
        elo_str = str(elo).strip().lower()

        if elo_str in ("max", "stockfish", "maximum", "sfmax", "ultra_max"):
            try:
                engine.configure({"UCI_LimitStrength": False})
            except Exception:
                pass
            return

        try:
            elo_num = int(elo)
            engine.configure({"UCI_LimitStrength": True, "UCI_Elo": elo_num})
            return
        except Exception:
            pass

        try:
            elo_num = int(elo)
            skill = 0 if elo_num < 1200 else 2 if elo_num < 1400 else 4 if elo_num < 1600 else 8 if elo_num < 2000 else 14
            engine.configure({"Skill Level": skill})
        except Exception:
            pass

    def close(self) -> None:
        """Gracefully quits the Stockfish engine."""
        with self._lock:
            if self._engine is not None:
                try:
                    self._engine.quit()
                except Exception:
                    pass
                self._engine = None
