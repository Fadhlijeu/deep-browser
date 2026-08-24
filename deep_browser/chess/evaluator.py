"""
Chess Position & Move Evaluator
===============================

Calculates Stockfish centipawns, win probabilities, tactical classifications
(BRILLIANT, BEST, EXCELLENT, GOOD, SAFE, INACCURACY, MISTAKE, BLUNDER),
and opponent blunder detection.
"""

from typing import Any, Dict, List, Optional, Tuple, Union
import chess
import chess.engine

from deep_browser.chess.engine import ChessEngineManager

PIECE_NAMES_ID = {
    chess.KING: "Raja",
    chess.QUEEN: "Menteri",
    chess.ROOK: "Benteng",
    chess.BISHOP: "Gajah",
    chess.KNIGHT: "Kuda",
    chess.PAWN: "Pion",
}

PIECE_ICONS = {
    "K": "♔", "Q": "♕", "R": "♖", "B": "♗", "N": "♘", "P": "♙",
    "k": "♚", "q": "♛", "r": "♜", "b": "♝", "n": "♞", "p": "♟",
}


def score_to_cp(score_obj: chess.engine.Score, turn: chess.Color) -> int:
    """Converts a Score object (from POV of side to move) to an integer centipawn value."""
    try:
        score_pov = score_obj.pov(turn)
        cp = score_pov.score(mate_score=100000)
        if cp is not None:
            return int(cp)
        mate = score_pov.mate()
        if mate is None:
            return 0
        return (100000 - abs(mate) * 1000) if mate > 0 else (-100000 + abs(mate) * 1000)
    except Exception:
        return 0


def cp_to_percent(delta_cp: int) -> int:
    """Converts a centipawn loss into a move quality percentage (1-100%)."""
    try:
        pct = 100 - int(delta_cp / 3.0)
        return max(1, min(100, pct))
    except Exception:
        return 1


def is_tactical_sacrifice(board: chess.Board, move: chess.Move) -> bool:
    """
    Determines if a move is a genuine tactical sacrifice:
    A Queen, Rook, Bishop, or Knight moves to an attacked square and gives up material
    for tactical or positional compensation without immediately dropping into a losing evaluation.
    """
    piece = board.piece_at(move.from_square)
    if not piece or piece.piece_type == chess.PAWN or piece.piece_type == chess.KING:
        return False

    tmp = board.copy(stack=False)
    try:
        tmp.push(move)
        # Check if destination square is attacked by opponent
        is_attacked = tmp.is_attacked_by(not board.turn, move.to_square)
        # Check if the piece is protected or hanging
        is_protected = tmp.is_attacked_by(board.turn, move.to_square)
        return is_attacked and (piece.piece_type in (chess.QUEEN, chess.ROOK) or not is_protected)
    except Exception:
        return False


def classify_move(board: chess.Board, move: chess.Move, best_cp: int, move_cp: int) -> str:
    """Classifies a move based on centipawn loss and tactical brilliance."""
    delta = best_cp - move_cp
    sacrifice = is_tactical_sacrifice(board, move)

    if delta <= 15 and sacrifice:
        return "BRILLIANT"
    if delta <= 10:
        return "BEST"
    if delta <= 30:
        return "BRILLIANT" if sacrifice else "EXCELLENT"
    if delta <= 70:
        return "GOOD"
    if delta <= 110:
        return "SAFE"
    if delta <= 190:
        return "INACCURACY"
    if delta <= 350:
        return "MISTAKE"
    return "BLUNDER"


def move_details(board: chess.Board, move: chess.Move) -> Dict[str, Any]:
    """Extracts human-readable move details (from, to, piece, captures, check)."""
    piece = board.piece_at(move.from_square)
    from_sq = chess.square_name(move.from_square)
    to_sq = chess.square_name(move.to_square)

    if not piece:
        return {
            "from": from_sq,
            "to": to_sq,
            "piece_name": "Bidak",
            "piece_symbol": "",
            "piece_icon": "♟",
            "capture": False,
            "captured_name": "",
            "captured_symbol": "",
            "captured_icon": "",
            "capture_square": "",
            "gives_check": False,
        }

    capture = board.is_capture(move)
    captured_piece = None
    capture_sq = None
    if capture:
        capture_sq = move.to_square
        if board.is_en_passant(move):
            capture_sq = move.to_square - 8 if board.turn == chess.WHITE else move.to_square + 8
        if 0 <= capture_sq < 64:
            captured_piece = board.piece_at(capture_sq)

    tmp = board.copy(stack=False)
    gives_check = False
    try:
        tmp.push(move)
        gives_check = tmp.is_check()
    except Exception:
        pass

    piece_sym = piece.symbol()
    cap_sym = captured_piece.symbol() if captured_piece else ""

    return {
        "from": from_sq,
        "to": to_sq,
        "piece_name": PIECE_NAMES_ID.get(piece.piece_type, "Bidak"),
        "piece_symbol": piece_sym,
        "piece_icon": PIECE_ICONS.get(piece_sym, "♟"),
        "capture": bool(capture),
        "captured_name": PIECE_NAMES_ID.get(captured_piece.piece_type, "Bidak") if captured_piece else "",
        "captured_symbol": cap_sym,
        "captured_icon": PIECE_ICONS.get(cap_sym, "") if cap_sym else "",
        "capture_square": chess.square_name(capture_sq) if capture_sq is not None and 0 <= capture_sq < 64 else "",
        "gives_check": gives_check,
    }


def move_to_san_line(board: chess.Board, pv_moves: List[chess.Move], max_len: int = 6) -> List[str]:
    """Generates standard algebraic notation line for PV."""
    tmp = board.copy(stack=False)
    out = []
    for mv in pv_moves[:max_len]:
        try:
            out.append(tmp.san(mv))
            tmp.push(mv)
        except Exception:
            out.append(mv.uci())
            try:
                tmp.push(mv)
            except Exception:
                break
    return out


def build_commentary(candidates: List[Dict[str, Any]], best_line_san: List[str]) -> List[str]:
    """Builds descriptive Indonesian commentary for the current position and best move."""
    if not candidates:
        return ["Belum ada prediksi pergerakan.", "Papan catur sedang dianalisa."]

    best = candidates[0]
    lines = []
    move_txt = f"{best.get('piece_name', 'Bidak')} ke {best.get('to', '').upper()}"
    lbl = best.get("label", "BEST")

    if lbl == "BRILLIANT":
        lines.append(f"✨ LANGKAH BRILLIANT! Pengorbanan taktis {move_txt} menghasilkan keuntungan besar.")
    elif lbl in ("BEST", "EXCELLENT"):
        lines.append(f"🌟 Langkah terbaik: {move_txt}. Posisi sangat solid dan aman.")
    elif lbl == "GOOD":
        lines.append(f"👍 Langkah bagus: {move_txt}. Menjaga struktur dan dominasi ruang.")
    elif lbl == "SAFE":
        lines.append(f"🛡️ Langkah defensif aman: {move_txt}.")
    elif lbl == "INACCURACY":
        lines.append(f"⚠️ {move_txt} dapat dimainkan, namun ada alternatif yang lebih akurat.")
    elif lbl in ("MISTAKE", "BLUNDER"):
        lines.append(f"💥 Hati-hati! {move_txt} berisiko melemahkan posisi raja.")
    else:
        lines.append(f"Direkomendasikan: {move_txt}.")

    if best.get("capture"):
        lines.append(f"⚔️ Memakan {best.get('captured_name', 'bidak')} lawan di {best['to'].upper()}.")
    if best.get("gives_check"):
        lines.append("👑 Serangan langsung (Check) terhadap raja lawan!")
    if len(best_line_san) >= 2:
        lines.append(f"Prediksi lanjutan: {' → '.join(best_line_san[:4])}")

    return lines[:3]


def analyze_position(
    board: chess.Board,
    depth: int = 10,
    multipv: int = 5,
    engine_manager: Optional[ChessEngineManager] = None,
) -> Dict[str, Any]:
    """
    Performs multi-PV deep analysis on the given chess.Board using Stockfish.
    Returns structured analysis with classified candidate moves.
    """
    mgr = engine_manager or ChessEngineManager.get_instance()
    engine = mgr.get_engine()

    if board.is_game_over():
        res = board.result()
        return {
            "game_over": True,
            "result": res,
            "best_move": None,
            "best_cp": 0,
            "candidates": [],
            "commentary": [f"Permainan telah selesai ({res})."],
        }

    try:
        infos = engine.analyse(board, chess.engine.Limit(depth=depth), multipv=multipv)
        if isinstance(infos, dict):
            infos = [infos]
    except Exception as e:
        infos = []

    candidates: List[Dict[str, Any]] = []
    for info in infos:
        pv = info.get("pv") or []
        if not pv:
            continue
        move = pv[0]
        score = info.get("score")
        cp = score_to_cp(score, board.turn) if score is not None else 0
        det = move_details(board, move)

        candidates.append({
            "move_uci": move.uci(),
            "from": det["from"],
            "to": det["to"],
            "piece_name": det["piece_name"],
            "piece_symbol": det["piece_symbol"],
            "piece_icon": det["piece_icon"],
            "capture": det["capture"],
            "captured_name": det["captured_name"],
            "captured_symbol": det["captured_symbol"],
            "captured_icon": det["captured_icon"],
            "gives_check": det["gives_check"],
            "cp": cp,
            "pv_uci": [m.uci() for m in pv[:6]],
            "pv_san": move_to_san_line(board, pv, max_len=6),
        })

    # Sort descending by centipawn score
    candidates.sort(key=lambda x: x["cp"], reverse=True)

    if not candidates and not board.is_game_over():
        # Fallback quick play move if multi-pv was empty
        try:
            play_res = engine.play(board, chess.engine.Limit(depth=depth))
            if play_res and play_res.move:
                det = move_details(board, play_res.move)
                candidates.append({
                    "move_uci": play_res.move.uci(),
                    "from": det["from"],
                    "to": det["to"],
                    "piece_name": det["piece_name"],
                    "piece_symbol": det["piece_symbol"],
                    "piece_icon": det["piece_icon"],
                    "capture": det["capture"],
                    "captured_name": det["captured_name"],
                    "captured_symbol": det["captured_symbol"],
                    "captured_icon": det["captured_icon"],
                    "gives_check": det["gives_check"],
                    "cp": 0,
                    "pv_uci": [play_res.move.uci()],
                    "pv_san": [board.san(play_res.move)],
                    "delta": 0,
                    "percent": 100,
                    "label": "BEST",
                })
        except Exception:
            pass

    if not candidates:
        return {
            "game_over": False,
            "result": None,
            "best_move": None,
            "best_cp": 0,
            "candidates": [],
            "commentary": ["Tidak ada langkah legal."],
        }

    best_cp = candidates[0]["cp"]
    for item in candidates:
        delta = best_cp - item["cp"]
        item["delta"] = delta
        item["percent"] = cp_to_percent(delta)
        mv_obj = chess.Move.from_uci(item["move_uci"])
        item["label"] = classify_move(board, mv_obj, best_cp, item["cp"])

    best = candidates[0]
    commentary = build_commentary(candidates, best.get("pv_san", []))

    return {
        "game_over": False,
        "result": None,
        "depth": depth,
        "best_move": best["move_uci"],
        "best_cp": best_cp,
        "best_label": best["label"],
        "best_line_san": best.get("pv_san", []),
        "candidates": candidates,
        "commentary": commentary,
    }
