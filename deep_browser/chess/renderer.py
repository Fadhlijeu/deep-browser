"""
Chessboard Visual Renderer
==========================

Generates clean HTML / SVG mini-board cards with eval bars,
highlighted move squares, piece symbols, and move prediction overlays for chat.
"""

from typing import Any, Dict, List, Optional
import chess

PIECE_ICONS = {
    "P": "♙", "N": "♘", "B": "♗", "R": "♖", "Q": "♕", "K": "♔",
    "p": "♟", "n": "♞", "b": "♝", "r": "♜", "q": "♛", "k": "♚",
}


def render_html_board(
    board: chess.Board,
    last_move_uci: Optional[str] = None,
    eval_cp: int = 0,
    playing_as: str = "w",
    move_label: str = "BEST",
    commentary: Optional[List[str]] = None,
) -> str:
    """
    Renders a responsive 8x8 chessboard HTML string with visual pieces,
    highlighted move squares, eval bar, and commentary.
    """
    from_sq = last_move_uci[:2] if last_move_uci and len(last_move_uci) >= 4 else None
    to_sq = last_move_uci[2:4] if last_move_uci and len(last_move_uci) >= 4 else None

    # Calculate eval bar height/percentage (White vs Black)
    # cp ranges from -1000 to +1000 normalized to 0-100%
    clamped_cp = max(-1000, min(1000, eval_cp))
    white_pct = int(50 + (clamped_cp / 20.0))
    white_pct = max(5, min(95, white_pct))

    eval_sign = f"+{eval_cp / 100:.1f}" if eval_cp > 0 else f"{eval_cp / 100:.1f}"

    # Generate board squares
    # If playing as Black, flip board
    ranks = range(7, -1, -1) if playing_as == "w" else range(8)
    files = range(8) if playing_as == "w" else range(7, -1, -1)

    squares_html = []
    for r in ranks:
        for f in files:
            sq_idx = r * 8 + f
            sq_name = chess.square_name(sq_idx)
            is_light = (r + f) % 2 == 1
            sq_class = "light" if is_light else "dark"

            if from_sq and sq_name == from_sq:
                sq_class += " highlight-from"
            elif to_sq and sq_name == to_sq:
                sq_class += " highlight-to"

            piece = board.piece_at(sq_idx)
            piece_html = ""
            if piece:
                sym = piece.symbol()
                icon = PIECE_ICONS.get(sym, "")
                p_color = "piece-white" if piece.color == chess.WHITE else "piece-black"
                piece_html = f'<span class="chess-piece {p_color}">{icon}</span>'

            squares_html.append(
                f'<div class="board-sq {sq_class}" data-sq="{sq_name}">{piece_html}</div>'
            )

    grid_content = "".join(squares_html)
    comm_html = "".join([f'<div class="chess-comm-line">{c}</div>' for c in (commentary or [])])

    badge_color = (
        "#00ecff" if move_label == "BRILLIANT" else
        "#22c55e" if move_label in ("BEST", "EXCELLENT") else
        "#3b82f6" if move_label == "GOOD" else
        "#eab308" if move_label == "SAFE" else
        "#f97316" if move_label == "INACCURACY" else
        "#ef4444"
    )

    return f"""
<div class="chess-chat-card">
  <div class="chess-card-header">
    <div style="display:flex;align-items:center;gap:6px">
      <span class="material-symbols-outlined" style="font-size:18px;color:#00ecff">sports_esports</span>
      <span style="font-weight:700;color:#f4f4f5">Deep-Browser Chess Engine</span>
    </div>
    <span class="chess-move-badge" style="background:{badge_color}22;color:{badge_color};border:1px solid {badge_color}55">
      {move_label}
    </span>
  </div>

  <div class="chess-body-flex">
    <!-- Eval Bar -->
    <div class="chess-eval-bar-wrapper" title="Evaluasi: {eval_sign}">
      <div class="chess-eval-fill" style="height:{white_pct}%"></div>
      <div class="chess-eval-text">{eval_sign}</div>
    </div>

    <!-- 8x8 Board -->
    <div class="chess-board-grid">
      {grid_content}
    </div>
  </div>

  <!-- Commentary & Move Info -->
  <div class="chess-commentary-box">
    {comm_html}
  </div>
</div>
"""
