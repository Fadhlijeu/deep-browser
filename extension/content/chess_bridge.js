/**
 * Deep-Browser Chess Bridge — Content Script
 * ==========================================
 * Real-time FEN perception, side detection, and move execution for Chess.com & Lichess.
 */

(function () {
  'use strict';

  let lastFen = '';
  let lastSide = 'w';
  let lastTurn = 'w';
  let lastGameOver = false;
  let lastBridgeTime = 0;

  // ── 1. Inject Page Script Bridge (Accesses Chess.com wc-chess-board directly) ──
  function injectGameBridge() {
    try {
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          let lastReportedFen = '';

          function checkBoard() {
            try {
              const board = document.querySelector('wc-chess-board, chess-board');
              if (!board) return;

              let fen = null;
              let turn = 'w';
              let side = 'w';
              let isGameOver = false;

              if (board.game) {
                if (typeof board.game.getFEN === 'function') fen = board.game.getFEN();
                if (typeof board.game.getTurn === 'function') {
                  const t = board.game.getTurn();
                  turn = (t === 2 || t === 'b' || t === 'black') ? 'b' : 'w';
                }
                if (typeof board.game.getPlayingAs === 'function') {
                  const p = board.game.getPlayingAs();
                  side = (p === 2 || p === 'b' || p === 'black') ? 'b' : 'w';
                }
                if (typeof board.game.isGameOver === 'function') {
                  isGameOver = board.game.isGameOver();
                }
              }

              // Fallback to board flipped orientation
              if (!side || side === 'w') {
                const isFlipped = board.classList.contains('flipped') || board.getAttribute('orientation') === 'black';
                if (isFlipped) side = 'b';
              }

              if (fen && fen !== lastReportedFen) {
                lastReportedFen = fen;
                window.postMessage({
                  source: 'DEEP_BROWSER_CHESS_SYNC',
                  fen: fen,
                  side: side,
                  turn: turn,
                  isGameOver: isGameOver
                }, '*');
              }
            } catch(e) {}
          }

          function hookEvents() {
            const board = document.querySelector('wc-chess-board, chess-board');
            if (board && board.game && board.game.on && !board._hasHookedSync) {
              board._hasHookedSync = true;
              board.game.on('Move', checkBoard);
              board.game.on('Update', checkBoard);
              board.game.on('Reset', checkBoard);
              board.game.on('NewGame', checkBoard);
            }
          }

          setInterval(() => {
            hookEvents();
            checkBoard();
          }, 200);

          hookEvents();
          checkBoard();
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {}
  }

  // ── 2. Listen for Bridge Messages ──────────────────────────────────────────
  window.addEventListener('message', (event) => {
    if (event.data && event.data.source === 'DEEP_BROWSER_CHESS_SYNC') {
      lastBridgeTime = Date.now();
      const { fen, side, turn, isGameOver } = event.data;
      if (fen) {
        lastFen = fen;
        lastSide = side || lastSide;
        lastTurn = turn || lastTurn;
        lastGameOver = !!isGameOver;
      }
    }
  });

  // ── 3. Fallback DOM Piece Scraper ──────────────────────────────────────────
  function parsePieceAndSquare(el) {
    const cls = (el.getAttribute('class') || '') + ' ' + (el.className?.baseVal || el.className || '');
    const mPiece = cls.match(/\b([wb])([pnbrqk])\b/i);
    if (!mPiece) return null;

    const color = mPiece[1].toLowerCase();
    const type = mPiece[2].toUpperCase();
    const pieceChar = color === 'w' ? type : type.toLowerCase();

    const mSquare = cls.match(/\bsquare-(\d)(\d)\b/);
    if (mSquare) {
      const file = parseInt(mSquare[1], 10) - 1;
      const rank = parseInt(mSquare[2], 10);
      if (file >= 0 && file < 8 && rank >= 1 && rank <= 8) {
        return { piece: pieceChar, row: 8 - rank, col: file };
      }
    }

    const mAlg = cls.match(/\bsquare-([a-h])([1-8])\b/i);
    if (mAlg) {
      const file = mAlg[1].toLowerCase().charCodeAt(0) - 97;
      const rank = parseInt(mAlg[2], 10);
      if (file >= 0 && file < 8 && rank >= 1 && rank <= 8) {
        return { piece: pieceChar, row: 8 - rank, col: file };
      }
    }
    return null;
  }

  function getPlayerSideFallback() {
    const board = document.querySelector('wc-chess-board, chess-board, .board');
    if (board) {
      const cls = (board.className || '') + ' ' + (board.getAttribute('class') || '');
      if (cls.includes('flipped') || cls.includes('orientation-black')) return 'b';
    }
    return 'w';
  }

  function extractFenFromDom() {
    const board = document.querySelector('wc-chess-board, chess-board, .board, #board-single');
    if (!board) return null;

    const pieceEls = board.querySelectorAll('.piece, [class*="piece "]');
    if (!pieceEls || pieceEls.length === 0) {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }

    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    let count = 0;

    pieceEls.forEach((el) => {
      const parsed = parsePieceAndSquare(el);
      if (parsed) {
        grid[parsed.row][parsed.col] = parsed.piece;
        count++;
      }
    });

    if (count === 0) return null;

    let fenBoard = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        if (grid[r][c] === null) {
          empty++;
        } else {
          if (empty > 0) {
            fenBoard += empty;
            empty = 0;
          }
          fenBoard += grid[r][c];
        }
      }
      if (empty > 0) fenBoard += empty;
      if (r < 7) fenBoard += '/';
    }

    const side = getPlayerSideFallback();
    const moveNodes = document.querySelectorAll('wc-move-list .node, .move-list .node, .vertical-move-list-table .node');
    const turn = (moveNodes.length % 2 === 1) ? 'b' : 'w';

    return `${fenBoard} ${turn} - - 0 1`;
  }

  // ── 4. Move Execution on Board ─────────────────────────────────────────────
  function squareToCoordinates(sq, boardEl) {
    const rect = boardEl.getBoundingClientRect();
    const isFlipped = boardEl.classList.contains('flipped') || boardEl.getAttribute('orientation') === 'black' || lastSide === 'b';
    const file = sq.charCodeAt(0) - 97; // 0..7 for a..h
    const rank = parseInt(sq[1], 10) - 1; // 0..7 for 1..8

    const col = isFlipped ? 7 - file : file;
    const row = isFlipped ? rank : 7 - rank;

    const sqWidth = rect.width / 8;
    const sqHeight = rect.height / 8;

    return {
      x: rect.left + col * sqWidth + sqWidth / 2,
      y: rect.top + row * sqHeight + sqHeight / 2,
    };
  }

  async function executeMove(fromSq, toSq) {
    const board = document.querySelector('wc-chess-board, chess-board, .board, #board-single');
    if (!board) throw new Error('Chessboard element not found on page.');

    const fromCoords = squareToCoordinates(fromSq, board);
    const toCoords = squareToCoordinates(toSq, board);

    function dispatchMouseEvent(type, x, y) {
      const el = document.elementFromPoint(x, y) || board;
      const evt = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
      });
      el.dispatchEvent(evt);
    }

    // Step 1: Click / Mousedown on source square
    dispatchMouseEvent('pointerdown', fromCoords.x, fromCoords.y);
    dispatchMouseEvent('mousedown', fromCoords.x, fromCoords.y);
    await new Promise(r => setTimeout(r, 60));

    // Step 2: Click / Mouseup on target square
    dispatchMouseEvent('mousemove', toCoords.x, toCoords.y);
    dispatchMouseEvent('pointerup', toCoords.x, toCoords.y);
    dispatchMouseEvent('mouseup', toCoords.x, toCoords.y);
    dispatchMouseEvent('click', toCoords.x, toCoords.y);

    return { success: true, from: fromSq, to: toSq };
  }

  // ── 5. Extension Message Listener ──────────────────────────────────────────
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'DEEP_BROWSER_CMD' || msg.command) {
        const cmd = msg.command;

        if (cmd === 'GET_CHESS_STATE') {
          const fen = lastFen || extractFenFromDom() || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
          const side = lastSide || getPlayerSideFallback();
          sendResponse({
            fen: fen,
            side: side,
            turn: lastTurn || (fen.includes(' b ') ? 'b' : 'w'),
            isGameOver: lastGameOver,
            url: window.location.href,
          });
          return true;
        }

        if (cmd === 'EXECUTE_CHESS_MOVE') {
          const fromSq = msg.from || (msg.move ? msg.move.slice(0, 2) : '');
          const toSq = msg.to || (msg.move ? msg.move.slice(2, 4) : '');
          executeMove(fromSq, toSq)
            .then(res => sendResponse(res))
            .catch(err => sendResponse({ error: err.message }));
          return true;
        }
      }
    });
  }

  injectGameBridge();
  console.log('[Deep-Browser] Chess Bridge initialized on', window.location.hostname);
})();
