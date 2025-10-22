import { navigate } from '../main';
import { playTrack } from '../utils/musicPlayer';
import i18next from '../utils/i18n';
import { authenticatedFetch } from '../utils/auth';

const AI_USER_ID = -1; // Asumido
const ROUTE_MATCHMAKING = '/matchmaking';

interface TournamentTTTProps {
    tournamentId: number;
    matchId: number;
    initialSize: number;
    player1Id: number;
    player2Id: number;
    gameType: 'pong' | 'tictactoe';
}

/**
 * Reporta el resultado de la partida al backend para actualizar ELO y estado.
 */
async function reportMatchResult(matchId: number, winnerId: number, p1Score: number, p2Score: number) {
    try {
        const payload = {
            match_status: 'finish',
            winner_id: winnerId,
            player_one_points: p1Score, 
            player_two_points: p2Score 
        };
        const response = await authenticatedFetch(`/api/match/update/${matchId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to update match on server.');
        }

    } catch (error) {
        console.error('Error al reportar el resultado del TicTacToe:', error);
        alert(`${i18next.t('errorReportingResult')}: ${(error as Error).message}`);
    }
}


export function renderTournamentTTT(container: HTMLElement, props: TournamentTTTProps): void {
	if (!container) return;

    const { tournamentId, matchId, initialSize, player1Id, player2Id, gameType } = props;
    const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;
    const isCurrentUserP1 = player1Id === currentUserId;
    const isHvsAI = player2Id === AI_USER_ID || player1Id === AI_USER_ID;
    
	container.innerHTML = `
	<div class="h-screen w-full flex flex-col items-center justify-center p-4 text-white overflow-y-auto font-press-start">
	  <div class="w-full flex justify-center my-8">
		<button id="homeButton" class="focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
			<img src="/assets/logo.gif" alt="Game Logo" class="w-24 h-24 md:w-32 md:h-32">
		</button>
	  </div>
      <h1 class="text-xl font-bold text-cyan-400 mb-4">${i18next.t('tournament_match')} - ${isHvsAI ? i18next.t('vsIA') : i18next.t('PvP')}</h1>
	  <div class="w-full max-w-md">
        <div id="game-board" class="grid grid-cols-3 gap-2 bg-black shadow-xl rounded-lg border-4 border-cyan-400">
            ${Array.from({ length: 9 }).map((_, i) => `<div class="cell w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 bg-gray-800 flex items-center justify-center text-6xl cursor-pointer hover:bg-gray-700 transition duration-150" data-cell-index="${i}" role="button" tabindex="0"></div>`).join('')}
        </div>
        <div id="game-overlay" class="absolute top-0 left-0 w-full h-full flex flex-col justify-center items-center bg-black bg-opacity-75 gap-4" style="display: none; z-index: 10;">
            <h1 id="winner-message" class="text-5xl font-black text-center text-yellow-400 p-4 rounded-lg"></h1>
            <button id="return-button" class="px-8 py-4 text-2xl rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-110 bg-cyan-400 text-gray-900 hover:bg-white">${i18next.t('return_to_matchmaking')}</button>
        </div>
	  </div>
	</div>
	`;

  playTrack('/assets/Techno_Syndrome.mp3');
  document.getElementById('homeButton')?.addEventListener('click', () => navigate(ROUTE_START));

  const cells = container.querySelectorAll('.cell');
  const gameOverlay = container.querySelector('#game-overlay') as HTMLElement;
  const winnerMessage = container.querySelector('#winner-message')!;
  const returnButton = container.querySelector('#return-button')!;

  let isGameActive = true;
  let currentPlayer = "X"; // X es Player 1 (player1Id) y O es Player 2 (player2Id)
  let gameState = ["", "", "", "", "", "", "", "", ""];

  const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  // Modificado: Simplemente inicia el juego ya que el match ya existe
  function startGame() {
    isGameActive = true;
    currentPlayer = "X";
    gameState = ["", "", "", "", "", "", "", "", ""];
    cells.forEach(cell => {
        cell.innerHTML = "";
        cell.classList.remove('text-cyan-400', 'text-white');
    });
    gameOverlay.style.display = 'none';
    container.querySelector('#game-board')!.classList.remove('pointer-events-none');
    
    // Si la IA es P1 y comienza, forzar el primer movimiento de la IA
    if (player1Id === AI_USER_ID && isHvsAI) {
        container.querySelector('#game-board')!.classList.add('pointer-events-none');
        setTimeout(makeAIMove, 700);
    }
  }

  async function endGame(winner: 'X' | 'O' | 'draw') { // Modificado: Reporta resultado y vuelve a Matchmaking
    isGameActive = false;
    gameOverlay.style.display = 'flex';

    let winnerId: number | null = null;
    let p1_points = 0;
    let p2_points = 0;

    if (winner === 'X') {
        winnerId = player1Id;
        p1_points = 1;
        winnerMessage.innerHTML = i18next.t('playerXWins');
    } else if (winner === 'O') {
        winnerId = player2Id;
        p2_points = 1;
        winnerMessage.innerHTML = i18next.t('playerOWins');
    } else {
        winnerId = null; // En el backend, null/0 para empate
        winnerMessage.innerHTML = i18next.t('draw');
    }

    await reportMatchResult(matchId, winnerId || -1, p1_points, p2_points);
  }

  function handleResultValidation() {
    let roundWon = false;
    for (const winCondition of winningConditions) {
      const a = gameState[winCondition[0]];
      const b = gameState[winCondition[1]];
      const c = gameState[winCondition[2]];
      if (a === '' || b === '' || c === '') continue;
      if (a === b && b === c) {
        roundWon = true;
        break;
      }
    }

    if (roundWon) {
      const winner = currentPlayer as 'X' | 'O';
      endGame(winner);
      return;
    }

    if (!gameState.includes("")) {
      endGame('draw');
      return;
    }

    handlePlayerChange();
  }

  function handlePlayerChange() {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    
    // Lógica IA para TTT
    const currentTurnPlayerId = currentPlayer === "X" ? player1Id : player2Id;
    if (isHvsAI && currentTurnPlayerId === AI_USER_ID && isGameActive) {
      container.querySelector('#game-board')!.classList.add('pointer-events-none');
      setTimeout(makeAIMove, 700);
    }
  }

  function handleCellPlayed(cell: HTMLElement, cellIndex: number) {
    gameState[cellIndex] = currentPlayer;
    cell.innerHTML = currentPlayer;
    cell.classList.add(currentPlayer === 'X' ? 'text-cyan-400' : 'text-white');
    handleResultValidation();
  }

  function handleCellClick(event: Event) {
    const clickedCell = event.target as HTMLElement;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-cell-index')!);
    
    // El turno es de un jugador, debe ser el usuario actual
    const expectedPlayerId = currentPlayer === 'X' ? player1Id : player2Id;

    if (gameState[clickedCellIndex] !== "" || !isGameActive) return;
    
    // Si es vs IA, y el turno es de la IA (no debería ocurrir aquí, sino en handlePlayerChange)
    if (isHvsAI && expectedPlayerId === AI_USER_ID) return;
    
    // Si es PvP, solo el jugador local (X) puede hacer click, el otro jugador debe ser remoto.
    if (!isHvsAI && expectedPlayerId !== currentUserId) {
        // En un torneo local de 1v1, el usuario puede ser X o O, si no es su turno, no permite el click.
        // Asumimos que si es PvP local, ambos jugadores humanos se turnan en el mismo teclado.
        // Si no es PvP local, sino PvP online (lo cual es más complejo y no se implementa ahora),
        // este check bloquearía el juego. Mantendremos el flujo de TicTacToe.ts que es local HvsH o HvsAI.
        // Aquí no necesitamos chequear currentUserId, ya que ambos pueden ser el mismo usuario en 1v1 local.
    }
    
    handleCellPlayed(clickedCell, clickedCellIndex);
  }

  function makeAIMove() { // Duplicada sin cambios
    const bestMove = findBestMove();
    if (bestMove !== -1) {
      const cell = container.querySelector(`[data-cell-index='${bestMove}']`) as HTMLElement;
      handleCellPlayed(cell, bestMove);
    }
    container.querySelector('#game-board')!.classList.remove('pointer-events-none');
  }

  function findBestMove(): number { // Duplicada sin cambios
    const AI_SYMBOL = currentPlayer;
    const HUMAN_SYMBOL = AI_SYMBOL === 'X' ? 'O' : 'X';
    
	for (let i = 0; i < 9; i++) {
		if (gameState[i] === "") {
		  gameState[i] = AI_SYMBOL;
		  if (checkWinner(AI_SYMBOL)) {
			gameState[i] = "";
			return i;
		  }
		  gameState[i] = "";
		}
	}
	for (let i = 0; i < 9; i++) {
		if (gameState[i] === "") {
		  gameState[i] = HUMAN_SYMBOL;
		  if (checkWinner(HUMAN_SYMBOL)) {
			gameState[i] = "";
			return i;
		  }
		  gameState[i] = "";
		}
	}
	if (gameState[4] === "") return 4;
	const corners = [0, 2, 6, 8];
	const emptyCorners = corners.filter(i => gameState[i] === "");
	if (emptyCorners.length > 0) {
		return emptyCorners[Math.floor(Math.random() * emptyCorners.length)];
	}
	const sides = [1, 3, 5, 7];
	const emptySides = sides.filter(i => gameState[i] === "");
	if (emptySides.length > 0) {
		return emptySides[Math.floor(Math.random() * emptySides.length)];
	}
	const availableCells = gameState.map((cell, index) => cell === "" ? index : -1).filter(index => index !== -1);
    return availableCells.length > 0 ? availableCells[0] : -1;
  }

  function checkWinner(player: string): boolean { // Duplicada sin cambios
    return winningConditions.some(condition => {
      return condition.every(index => gameState[index] === player);
    });
  }

  cells.forEach(cell => {
      cell.addEventListener('click', handleCellClick);
      cell.addEventListener('keydown', (e) => {
          if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
              handleCellClick(e);
          }
      });
  });

  returnButton.addEventListener('click', () => {
    navigate(ROUTE_MATCHMAKING, { 
        tournamentId, 
        initialSize,
        gameType
    });
  });
  
  startGame();
}