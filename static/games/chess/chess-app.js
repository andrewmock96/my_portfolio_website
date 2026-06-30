import { Chess } from "./vendor/chess.js";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const PIECE_ORDER = ["q", "r", "r", "b", "b", "n", "n", "p", "p", "p", "p", "p", "p", "p", "p"];
const STARTING_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
const PIECE_RECTS = {
  k: [[2, 12, -2, 12, -2, 5, 2, 5], [-5, 10, 5, 10, 5, 8, -5, 8], [-4, 7, 4, 7, 4, 6, -4, 6], [-7, 5, 7, 5, 6, 2, -6, 2], [-10, 2, 10, 2, 10, -1, -10, -1], [-7, -1, 7, -1, 7, -7, -7, -7], [-9, -7, 9, -7, 8, -9, -8, -9], [-11, -9, 11, -9, 11, -12, -11, -12], [-13, -12, 13, -12, 12, -15, -12, -15]],
  q: [[-7, 8, -5, 8, -5, 5, -7, 5], [-1, 11, 1, 11, 1, 5, -1, 5], [5, 8, 7, 8, 7, 5, 5, 5], [-8, 5, 8, 5, 6, 2, -6, 2], [-6, 2, 6, 2, 5, 0, -5, 0], [-3, 0, 3, 0, 2, -5, -2, -5], [-4, -5, 4, -5, 6, -10, -6, -10], [-8, -10, 8, -10, 8, -12, -8, -12], [-10, -12, 10, -12, 9, -15, -9, -15]],
  r: [[-8, 8, -5, 8, -5, 4, -8, 4], [-2, 8, 2, 8, 2, 4, -2, 4], [5, 8, 8, 8, 8, 4, 5, 4], [-9, 4, 9, 4, 9, 1, -9, 1], [-7, 1, 7, 1, 6, -8, -6, -8], [-8, -8, 8, -8, 7, -10, -7, -10], [-10, -10, 10, -10, 10, -12, -10, -12], [-12, -12, 12, -12, 11, -15, -11, -15]],
  n: [[-7, 10, -5, 10, -5, 7, -7, 7], [-8, 7, -5, 7, -5, 4, -8, 4], [-9, 4, -5, 4, -5, 0, -9, 0], [-10, 0, -5, 0, -5, -10, -10, -10], [-5, 13, -2, 13, -2, 9, -5, 9], [1, 12, 4, 12, 4, 8, 1, 8], [-7, 9, 5, 9, 6, 7, -8, 7], [-8, 7, 6, 7, 7, 4, -8, 4], [-8, 4, 8, 4, 9, 1, -8, 1], [-8, 3, 8, 3, 9, 1, -8, 1], [-1, 1, 12, 1, 12, -3, -1, -3], [-4, 1, -1, 1, -1, -3, -3, -3], [2, -3, 12, -3, 9, -6, 3, -6], [-8, 1, -1, 1, -2, -11, -9, -11], [-6, -5, 1, -5, 2, -8, -7, -8], [-5, -8, 2, -8, 3, -11, -6, -11], [-10, -11, 10, -11, 10, -13, -10, -13], [-13, -13, 13, -13, 12, -16, -12, -16]],
  b: [[-4, 12, 4, 12, 4, 8, -4, 8], [-5, 8, 5, 8, 4, 5, -4, 5], [-3, 5, 3, 5, 3, 2, -3, 2], [-6, 2, 6, 2, 6, 0, -6, 0], [-6, 0, -1, 0, -1, -2, -6, -2], [1, 0, 6, 0, 6, -2, 1, -2], [-6, -2, -3, -2, -3, -3, -6, -3], [3, -2, 6, -2, 6, -3, 3, -3], [-6, -3, -1, -3, -1, -6, -6, -6], [1, -3, 6, -3, 6, -6, 1, -6], [-7, -6, 7, -6, 8, -9, -8, -9], [-10, -9, 10, -9, 10, -11, -10, -11], [-13, -11, 13, -11, 12, -14, -12, -14]],
  p: [[-3, 10, 3, 10, 3, 5, -3, 5], [-4, 8, 4, 8, 4, 6, -4, 6], [-2, 5, 2, 5, 2, 1, -2, 1], [-4, 1, 4, 1, 5, -7, -5, -7], [-6, -7, 6, -7, 5, -9, -5, -9], [-8, -9, 8, -9, 8, -11, -8, -11], [-10, -11, 10, -11, 9, -14, -9, -14]],
};

const boardEl = document.getElementById("board");
const statusText = document.getElementById("statusText");
const moveList = document.getElementById("moveList");
const moveCount = document.getElementById("moveCount");
const turnText = document.getElementById("turnText");
const checkText = document.getElementById("checkText");
const gameStateText = document.getElementById("gameStateText");
const materialText = document.getElementById("materialText");
const lastMoveText = document.getElementById("lastMoveText");
const capturedBlack = document.getElementById("capturedBlack");
const capturedWhite = document.getElementById("capturedWhite");
const blackCaptureCount = document.getElementById("blackCaptureCount");
const whiteCaptureCount = document.getElementById("whiteCaptureCount");
const resetButton = document.getElementById("resetButton");
const undoButton = document.getElementById("undoButton");
const flipButton = document.getElementById("flipButton");

const game = new Chess();
let selectedSquare = null;
let legalTargets = [];
let flipped = false;

function orderedSquares() {
  const files = flipped ? [...FILES].reverse() : FILES;
  const ranks = flipped ? RANKS : [...RANKS].reverse();
  const squares = [];
  for (const rank of ranks) {
    for (const file of files) {
      squares.push(`${file}${rank}`);
    }
  }
  return squares;
}

function squareColor(square) {
  const fileIndex = FILES.indexOf(square[0]);
  const rankIndex = RANKS.indexOf(square[1]);
  return (fileIndex + rankIndex) % 2 === 0 ? "dark" : "light";
}

function pieceSvg(piece, size = "full") {
  if (!piece) {
    return "";
  }

  const fill = piece.color === "w" ? "#f4f4f4" : "#050505";
  const rects = PIECE_RECTS[piece.type]
    .map((coords) => {
      const xs = [coords[0], coords[2], coords[4], coords[6]];
      const ys = [coords[1], coords[3], coords[5], coords[7]];
      const x = Math.min(...xs) + 16;
      const y = 16 - Math.max(...ys);
      const width = Math.max(...xs) - Math.min(...xs);
      const height = Math.max(...ys) - Math.min(...ys);
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" />`;
    })
    .join("");

  return `
    <span class="piece piece-${size} piece-${piece.color}" aria-hidden="true">
      <svg class="piece-svg" viewBox="0 0 32 32" focusable="false">
        ${rects}
      </svg>
    </span>
  `;
}

function selectionMoves(square) {
  return game.moves({ square, verbose: true });
}

function clearSelection() {
  selectedSquare = null;
  legalTargets = [];
}

function selectSquare(square) {
  const piece = game.get(square);
  if (!piece || piece.color !== game.turn()) {
    clearSelection();
    return;
  }
  selectedSquare = square;
  legalTargets = selectionMoves(square);
}

function tryMove(square) {
  const move = legalTargets.find((candidate) => candidate.to === square);
  if (!move) {
    return false;
  }

  const result = game.move({
    from: move.from,
    to: move.to,
    promotion: move.promotion || "q",
  });

  clearSelection();
  render();
  return Boolean(result);
}

function handleSquareClick(square) {
  if (selectedSquare && tryMove(square)) {
    return;
  }

  if (selectedSquare === square) {
    clearSelection();
    render();
    return;
  }

  selectSquare(square);
  render();
}

function boardMarkup() {
  return orderedSquares()
    .map((square) => {
      const piece = game.get(square);
      const move = legalTargets.find((candidate) => candidate.to === square);
      const classes = [
        "square",
        squareColor(square),
        selectedSquare === square ? "selected" : "",
        move ? (move.captured ? "capture" : "legal") : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <button class="${classes}" type="button" role="gridcell" aria-label="${square}" data-square="${square}">
          ${pieceSvg(piece)}
        </button>
      `;
    })
    .join("");
}

function gameStateLabel() {
  if (game.isCheckmate()) {
    return "Checkmate";
  }
  if (game.isDraw()) {
    return "Draw";
  }
  if (game.isStalemate()) {
    return "Stalemate";
  }
  if (game.isThreefoldRepetition()) {
    return "Threefold repetition";
  }
  if (game.isInsufficientMaterial()) {
    return "Insufficient material";
  }
  return "In progress";
}

function headlineStatus() {
  if (game.isCheckmate()) {
    return `${game.turn() === "w" ? "Black" : "White"} wins by checkmate`;
  }
  if (game.isDraw()) {
    return "Drawn position";
  }
  if (game.inCheck()) {
    return `${game.turn() === "w" ? "White" : "Black"} to move, in check`;
  }
  return `${game.turn() === "w" ? "White" : "Black"} to move`;
}

function renderMoveList() {
  const history = game.history();
  moveCount.textContent = `${history.length} ply`;
  moveList.innerHTML = history
    .map((move, index) => {
      const moveNumber = Math.floor(index / 2) + 1;
      const label = index % 2 === 0 ? `${moveNumber}. ${move}` : move;
      return `<li><strong>${label}</strong></li>`;
    })
    .join("");
}

function getRemainingCounts() {
  const counts = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };

  for (const row of game.board()) {
    for (const piece of row) {
      if (piece) {
        counts[piece.color][piece.type] += 1;
      }
    }
  }

  return counts;
}

function getCapturedPieces() {
  const remaining = getRemainingCounts();
  const captured = { w: [], b: [] };

  for (const color of ["w", "b"]) {
    for (const type of PIECE_ORDER) {
      const missing = STARTING_COUNTS[type] - remaining[color][type];
      if (missing > 0) {
        const alreadyAdded = captured[color].filter((pieceType) => pieceType === type).length;
        if (alreadyAdded < missing) {
          captured[color].push(type);
        }
      }
    }
  }

  return captured;
}

function materialAdvantage(captured) {
  const whiteScore = captured.b.reduce((sum, type) => sum + PIECE_VALUES[type], 0);
  const blackScore = captured.w.reduce((sum, type) => sum + PIECE_VALUES[type], 0);
  const diff = whiteScore - blackScore;

  if (diff > 0) {
    return `White +${diff}`;
  }
  if (diff < 0) {
    return `Black +${Math.abs(diff)}`;
  }
  return "Even";
}

function renderCapturedPieces() {
  const captured = getCapturedPieces();

  capturedBlack.innerHTML = captured.b
    .map((type) => pieceSvg({ color: "b", type }, "mini"))
    .join("");
  capturedWhite.innerHTML = captured.w
    .map((type) => pieceSvg({ color: "w", type }, "mini"))
    .join("");

  blackCaptureCount.textContent = `${captured.b.length}`;
  whiteCaptureCount.textContent = `${captured.w.length}`;
  materialText.textContent = materialAdvantage(captured);
}

function renderMeta() {
  statusText.textContent = headlineStatus();
  turnText.textContent = game.turn() === "w" ? "White" : "Black";
  checkText.textContent = game.inCheck() ? "Yes" : "No";
  gameStateText.textContent = gameStateLabel();

  const verboseHistory = game.history({ verbose: true });
  const lastMove = verboseHistory.at(-1);
  lastMoveText.textContent = lastMove ? `${lastMove.from}-${lastMove.to}` : "--";
}

function bindBoardEvents() {
  boardEl.querySelectorAll("[data-square]").forEach((button) => {
    button.addEventListener("click", () => handleSquareClick(button.dataset.square));
  });
}

function render() {
  boardEl.innerHTML = boardMarkup();
  bindBoardEvents();
  renderMoveList();
  renderMeta();
  renderCapturedPieces();
}

resetButton.addEventListener("click", () => {
  game.reset();
  clearSelection();
  render();
});

undoButton.addEventListener("click", () => {
  game.undo();
  clearSelection();
  render();
});

flipButton.addEventListener("click", () => {
  flipped = !flipped;
  render();
});

render();
