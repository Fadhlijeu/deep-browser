---
name: chess-copilot
description: Autonomous Stockfish Chess Copilot skill for playing chess on Chess.com / Lichess with realistic human levels, blunder punishment, and in-chat live board rendering.
---

# Chess Copilot Skill (Stockfish 16.1 Integration)

The **Chess Copilot** skill enables Deep-Browser to autonomously analyze and play chess on platforms like **Chess.com** and **Lichess**.

---

## 1. Core Directives & Difficulty Levels

### Difficulty Presets
- **`casual` (Pemula ~1000 ELO)**:
  - Natural human blunders, loose play, high variance.
- **`normal` (Default ~1400 ELO)**:
  - Human club level play with realistic move distributions (~4:10 win/loss tuning).
  - Can make minor positional concessions (`GOOD`, `SAFE`, `INACCURACY`).
  - **Absolute Win Rule**: If opponent makes a major blunder (hung piece or mate in $N$), the agent immediately capitalizes and takes the winning move!
  - **Brilliant Move Flash (1:10)**: 10% tactical trigger chance to seize brilliant sacrifices (`BRILLIANT ✨`).
- **`strong` (Master ~1850 ELO)**:
  - Tight calculation, minimal mistakes, strong endgame conversion.
- **`grandmaster` (Ultra Max ~2700 ELO)**:
  - Peak engine accuracy using Stockfish deep search.

---

## 2. Trigger Prompts

### Start Autonomous Playing Loop:
- `"Buka chess.com dan mainkan catur sampai selesai dengan level normal."`
- `"Main catur di tab chess.com yang aktif, gunakan level normal."`
- `"Play chess on chess.com using strong level until checkmate."`

### Analyze Active Board Position:
- `"Analisa posisi catur di tab ini dan beri tahu langkah terbaiknya."`
- `"Evaluasi papan catur ini dan tampilkan prediksinya di chat."`

---

## 3. Architecture & Event Stream

1. **Board Perception**: `content/chess_bridge.js` extracts exact FEN and turn state directly from `wc-chess-board.game` with DOM piece fallback.
2. **Calculation**: Stockfish calculates multi-PV centipawns and tactical sacrifices.
3. **Move Policy**: `ChessPlayPolicy` selects move based on target level and blunder punishment rules.
4. **Live Visualization**: Dispatches `CHESS_BOARD_UPDATED` with full 8x8 interactive mini-board, evaluation bar, move quality badge, and Indonesian commentary to the chat feed.
5. **Execution**: Dispatches `EXECUTE_CHESS_MOVE` to smoothly move the piece on web chessboard.
