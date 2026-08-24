"""
Autonomous Chess Game Loop Controller
=====================================

Drives continuous, end-to-end chess games on web platforms (Chess.com, Lichess):
Observes board FEN → Evaluates with Stockfish → Chooses move with Policy →
Executes DOM interaction → Broadcasts visual board to chat → Repeats until Game Over.
"""

import asyncio
import logging
import time
from typing import Any, Callable, Dict, Optional

import chess

from deep_browser.chess.engine import ChessEngineManager
from deep_browser.chess.evaluator import analyze_position
from deep_browser.chess.policy import ChessPlayPolicy
from deep_browser.chess.renderer import render_html_board
from deep_browser.events import DeepBrowserEvent, EventBroadcaster, EventType

logger = logging.getLogger(__name__)


class ChessGameController:
    """
    Autonomous orchestrator that plays chess on the active browser tab until completion.
    """

    def __init__(
        self,
        browser_session: Any,
        level: str = "normal",
        task_id: str = "chess_task",
        broadcaster: Optional[EventBroadcaster] = None,
        poll_interval: float = 0.6,
        max_moves: int = 200,
    ):
        self.browser_session = browser_session
        self.level = level
        self.task_id = task_id
        self.broadcaster = broadcaster or EventBroadcaster.get_instance()
        self.policy = ChessPlayPolicy(level=level)
        self.poll_interval = poll_interval
        self.max_moves = max_moves
        self.is_running = False
        self.move_count = 0
        self.last_fen = ""
        self.playing_side = "w"

    async def run_game(self) -> Dict[str, Any]:
        """
        Executes the main chess loop until game termination.
        """
        self.is_running = True
        logger.info(f"[ChessController] Starting autonomous chess game (Level: {self.level})")

        await self.broadcaster.broadcast(
            DeepBrowserEvent(
                task_id=self.task_id,
                event_type=EventType.TASK_STARTED,
                message=f"🎮 Memulai pertandingan catur otomatis (Level: {self.level.upper()})...",
                data={"level": self.level},
            )
        )

        try:
            while self.is_running and self.move_count < self.max_moves:
                # 1. Fetch current board state from web page
                state = await self._get_web_board_state()
                fen = state.get("fen")
                if not fen:
                    logger.debug("[ChessController] Waiting for chessboard to be loaded on page...")
                    await asyncio.sleep(self.poll_interval)
                    continue

                side = state.get("side", self.playing_side)
                self.playing_side = side
                turn = state.get("turn", "w")
                is_game_over = state.get("isGameOver", False)

                try:
                    board = chess.Board(fen)
                except Exception as e:
                    logger.warning(f"[ChessController] Invalid FEN received: {fen} ({e})")
                    await asyncio.sleep(self.poll_interval)
                    continue

                if is_game_over or board.is_game_over():
                    result_str = board.result() if board.is_game_over() else "Game Over"
                    logger.info(f"[ChessController] Game finished! Result: {result_str}")
                    break

                # 2. Check if it's our turn to move
                our_turn = (board.turn == chess.WHITE and side == "w") or (board.turn == chess.BLACK and side == "b")

                if not our_turn:
                    # Opponent's turn — wait for move
                    await asyncio.sleep(self.poll_interval)
                    continue

                # 3. Analyze position with Stockfish
                logger.info(f"[ChessController] Move #{self.move_count + 1}: Calculating with Stockfish...")
                analysis = analyze_position(board, depth=self.policy.config["depth"])
                selected_move = self.policy.select_move(board, analysis)
                move_uci = selected_move.get("move_uci")

                if not move_uci:
                    logger.warning("[ChessController] No move selected by policy.")
                    break

                # 4. Render visual board & broadcast to sidepanel chat
                html_board = render_html_board(
                    board=board,
                    last_move_uci=move_uci,
                    eval_cp=analysis.get("best_cp", 0),
                    playing_as=side,
                    move_label=selected_move.get("label", "BEST"),
                    commentary=analysis.get("commentary", []),
                )

                await self.broadcaster.broadcast(
                    DeepBrowserEvent(
                        task_id=self.task_id,
                        event_type=EventType.CHESS_BOARD_UPDATED,
                        message=f"Langkah #{self.move_count + 1}: {selected_move.get('display_notation', move_uci)} ({selected_move.get('label', 'BEST')})",
                        data={
                            "fen": fen,
                            "move_uci": move_uci,
                            "label": selected_move.get("label", "BEST"),
                            "eval_cp": analysis.get("best_cp", 0),
                            "html_board": html_board,
                            "commentary": analysis.get("commentary", []),
                            "reason": selected_move.get("reason", ""),
                        },
                    )
                )

                # 5. Execute move on web chessboard via CDP/Bridge
                logger.info(f"[ChessController] Executing move on board: {move_uci}")
                exec_res = await self._execute_move_on_page(move_uci)
                self.move_count += 1
                self.last_fen = fen

                # Short human-like pause between moves
                await asyncio.sleep(0.8)

            # Game complete
            final_report = f"Pertandingan catur selesai ({self.move_count} langkah dimainkan)."
            await self.broadcaster.broadcast(
                DeepBrowserEvent(
                    task_id=self.task_id,
                    event_type=EventType.CHESS_GAME_OVER,
                    message=final_report,
                    data={"total_moves": self.move_count, "level": self.level},
                )
            )

            return {
                "status": "completed",
                "total_moves": self.move_count,
                "message": final_report,
                "level": self.level,
            }

        except Exception as e:
            logger.error(f"[ChessController] Error during game loop: {e}", exc_info=True)
            return {"status": "error", "error": str(e)}
        finally:
            self.is_running = False

    async def _get_web_board_state(self) -> Dict[str, Any]:
        """Queries FEN and side from the browser page via transport."""
        try:
            if hasattr(self.browser_session, "_transport"):
                res = await self.browser_session._transport.request("GET_CHESS_STATE", {}, timeout=5.0)
                return res or {}
        except Exception as e:
            logger.debug(f"[ChessController] GET_CHESS_STATE error: {e}")
        return {}

    async def _execute_move_on_page(self, move_uci: str) -> Dict[str, Any]:
        """Dispatches move execution to web page."""
        try:
            if hasattr(self.browser_session, "_transport"):
                res = await self.browser_session._transport.request(
                    "EXECUTE_CHESS_MOVE",
                    {"move": move_uci, "from": move_uci[:2], "to": move_uci[2:4]},
                    timeout=10.0,
                )
                return res or {}
        except Exception as e:
            logger.error(f"[ChessController] EXECUTE_CHESS_MOVE failed: {e}")
            return {"error": str(e)}
        return {}

    def stop(self) -> None:
        """Stops the autonomous loop."""
        self.is_running = False
