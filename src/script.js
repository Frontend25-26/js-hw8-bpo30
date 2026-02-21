const board = document.getElementById("board");

const BOARD_SIZE = 8;
const INITIAL_ROWS = 3;
const MOVE_STEP = 1;
const CAPTURE_STEP = 2;
const CAPTURE_DIRECTIONS = [
    [-2, -2],
    [-2, 2],
    [2, -2],
    [2, 2]
];

const gameState = {
    selectedPiece: null,
    currentPlayer: 'white',
    isMoving: false,
    gameOver: false,
    pieceWithPendingCapture: null
};

const cells = [];

const getCell = (row, col) => {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
        return null;
    }
    return cells[row][col];
};

const isWithinBoard = (row, col) => row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

const getPieceAt = (row, col) => {
    const cell = getCell(row, col);
    return cell ? cell.querySelector('.piece:not(.hidden):not(.remove)') : null;
};

const isCellEmpty = (row, col) => !getPieceAt(row, col);

function createBoard() {
    for (let i = 0; i < BOARD_SIZE; i++) {
        cells[i] = [];
        const row = document.createElement('div');
        row.className = 'row';
        for (let j = 0; j < BOARD_SIZE; j++) {
            const cell = document.createElement('div');
            const cellClass = (i + j) % 2 === 0 ? 'white' : 'black';
            cell.className = `cell ${cellClass}`;
            cell.dataset.i = i;
            cell.dataset.j = j;
            cells[i][j] = cell;

            const isBlackCell = (i + j) % 2 !== 0;
            if (i < INITIAL_ROWS && isBlackCell) {
                addPiece(cell, 'black', i, j);
            } else if (i >= BOARD_SIZE - INITIAL_ROWS && isBlackCell) {
                addPiece(cell, 'white', i, j);
            }

            row.appendChild(cell);
        }
        board.appendChild(row);
    }
}

function addPiece(cell, color, row, col) {
    const piece = document.createElement("div");
    piece.classList.add("piece", color);
    piece.dataset.color = color;
    piece.dataset.col = col;
    piece.dataset.row = row;
    cell.appendChild(piece);
}

function canMove(startRow, startCol, endRow, endCol, player) {
    if (!isWithinBoard(endRow, endCol)) {
        return false;
    }
    if (!isCellEmpty(endRow, endCol)) {
        return false;
    }

    const rowDiff = endRow - startRow;
    const colDiff = Math.abs(endCol - startCol);
    if (colDiff !== MOVE_STEP || Math.abs(rowDiff) !== MOVE_STEP) {
        return false;
    }
    if (player === 'white' && rowDiff >= 0) {
        return false;
    }
    if (player === 'black' && rowDiff <= 0) {
        return false;
    }
    return true;
}

function canCapture(startRow, startCol, endRow, endCol, player) {
    if (!isWithinBoard(endRow, endCol)) {
        return false;
    }
    if (!isCellEmpty(endRow, endCol)) {
        return false;
    }

    const rowDiff = endRow - startRow;
    const colDiff = endCol - startCol;
    if (Math.abs(rowDiff) !== CAPTURE_STEP || Math.abs(colDiff) !== CAPTURE_STEP) {
        return false;
    }

    const jumpedRow = startRow + rowDiff / 2;
    const jumpedCol = startCol + colDiff / 2;
    const jumpedPiece = getPieceAt(jumpedRow, jumpedCol);
    if (!jumpedPiece || jumpedPiece.dataset.color === player) {
        return false;
    }
    return true;
}

function canPieceCaptureAgain(piece) {
    const row = +piece.dataset.row;
    const col = +piece.dataset.col;
    const color = piece.dataset.color;
    for (const [dr, dc] of CAPTURE_DIRECTIONS) {
        if (canCapture(row, col, row + dr, col + dc, color)) {
            return true;
        }
    }
    return false;
}

function animateRemoval(piece, callback) {
    piece.classList.add('remove');
    piece.addEventListener('animationend', function onEnd() {
        piece.removeEventListener('animationend', onEnd);
        piece.remove();
        if (callback) {
            callback();
        }
    });
}

function createAnimatedClone(originalPiece, startRect, endRect) {
    const boardRect = board.getBoundingClientRect();
    const pieceSize = originalPiece.getBoundingClientRect().width;

    const startX = startRect.left + startRect.width / 2 - boardRect.left - pieceSize / 2;
    const startY = startRect.top + startRect.height / 2 - boardRect.top - pieceSize / 2;
    const endX = endRect.left + endRect.width / 2 - boardRect.left - pieceSize / 2;
    const endY = endRect.top + endRect.height / 2 - boardRect.top - pieceSize / 2;

    const clone = originalPiece.cloneNode();
    clone.classList.remove('hidden');
    Object.assign(clone.style, {
        position: 'absolute',
        width: pieceSize + 'px',
        height: pieceSize + 'px',
        left: startX + 'px',
        top: startY + 'px',
        transition: 'left 0.3s, top 0.3s',
        zIndex: 1000,
        pointerEvents: 'none'
    });
    board.appendChild(clone);

    clone.getBoundingClientRect();
    clone.style.left = endX + 'px';
    clone.style.top = endY + 'px';

    return clone;
}

function applyMove(piece, endCell) {
    endCell.appendChild(piece);
    piece.classList.remove('hidden');
    piece.dataset.row = endCell.dataset.i;
    piece.dataset.col = endCell.dataset.j;
}

function finishMoveSequence(piece, capturedPiece) {
    if (capturedPiece) {
        animateRemoval(capturedPiece, () => {
            if (canPieceCaptureAgain(piece)) {
                gameState.pieceWithPendingCapture = piece;
                piece.classList.add('selected');
                gameState.selectedPiece = piece;
            } else {
                gameState.pieceWithPendingCapture = null;
                piece.classList.remove('selected');
                gameState.selectedPiece = null;
                gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';
            }
            checkWinner();
            gameState.isMoving = false;
        });
    } else {
        checkWinner();
        gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';
        gameState.isMoving = false;
        gameState.pieceWithPendingCapture = null;
        piece.classList.remove('selected');
        gameState.selectedPiece = null;
    }
}

function movePiece(piece, startCell, endCell, capturedPiece) {
    gameState.isMoving = true;
    piece.classList.add('hidden');

    const startRect = startCell.getBoundingClientRect();
    const endRect = endCell.getBoundingClientRect();

    const clone = createAnimatedClone(piece, startRect, endRect);

    clone.addEventListener('transitionend', function onTransitionEnd(e) {
        if (e.propertyName !== 'left' && e.propertyName !== 'top') {
            return;
        }
        clone.removeEventListener('transitionend', onTransitionEnd);
        clone.remove();

        applyMove(piece, endCell);
        finishMoveSequence(piece, capturedPiece);
    });
}

function checkWinner() {
    if (gameState.gameOver) {
        return;
    }
    const whiteCount = document.querySelectorAll('.piece.white:not(.remove)').length;
    const blackCount = document.querySelectorAll('.piece.black:not(.remove)').length;

    if (whiteCount === 0) {
        showWinner('black');
    } else if (blackCount === 0) {
        showWinner('white');
    }
}

function showWinner(winner) {
    gameState.gameOver = true;
    const existing = document.querySelector('.winner-message');
    if (existing) {
        existing.remove();
    }
    const msg = document.createElement('div');
    msg.className = 'winner-message';
    msg.textContent = winner === 'white' ? 'Победили белые!' : 'Победили чёрные!';
    document.body.appendChild(msg);
}

board.addEventListener('click', (e) => {
    if (gameState.isMoving || gameState.gameOver) {
        return;
    }

    const piece = e.target.closest('.piece');
    const cell = e.target.closest('.cell');

    if (piece && !piece.classList.contains('remove')) {
        if (piece.dataset.color !== gameState.currentPlayer) {
            return;
        }
        if (gameState.pieceWithPendingCapture && piece !== gameState.pieceWithPendingCapture) {
            return;
        }
        document.querySelectorAll('.piece.selected').forEach((p) => p.classList.remove('selected'));
        piece.classList.add('selected');
        gameState.selectedPiece = piece;
    }
    else if (cell && gameState.selectedPiece) {
        const startCell = gameState.selectedPiece.parentElement;
        const startRow = +startCell.dataset.i;
        const startCol = +startCell.dataset.j;
        const endRow = +cell.dataset.i;
        const endCol = +cell.dataset.j;
        const player = gameState.currentPlayer;

        if (canCapture(startRow, startCol, endRow, endCol, player)) {
            const jumpedRow = (startRow + endRow) / 2;
            const jumpedCol = (startCol + endCol) / 2;
            const capturedPiece = getPieceAt(jumpedRow, jumpedCol);
            if (capturedPiece) {
                gameState.selectedPiece.classList.remove('selected');
                movePiece(gameState.selectedPiece, startCell, cell, capturedPiece);
                gameState.selectedPiece = null;
            }
        } else if (canMove(startRow, startCol, endRow, endCol, player)) {
            gameState.selectedPiece.classList.remove('selected');
            movePiece(gameState.selectedPiece, startCell, cell, null);
            gameState.selectedPiece = null;
        }
    }
});

createBoard();