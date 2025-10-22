import { navigate } from '../main';
import { playTrack } from '../utils/musicPlayer';
import i18next from '../utils/i18n';
import { authenticatedFetch } from '../utils/auth';

// --- Imports de constantes de juego duplicadas de Pong.ts ---
const PADDLE_THICKNESS = 10;
const BALL_RADIUS = 8;
const WINNING_SCORE = 11;
const INITIAL_BALL_SPEED = 6;
const ACCELERATION_FACTOR = 1.05;
const MAX_BOUNCE_ANGLE = Math.PI / 3;
const PADDLE_INFLUENCE_FACTOR = 0.5;
const MAX_BALL_SPEED = 15;
const PADDLE_LENGTH_CLASSIC = 150;
const PADDLE_SPEED_CLASSIC = 8;
const PADDLE_LENGTH_4P = 100; // Asumido
const PADDLE_SPEED_4P = 6;    // Asumido

const AI_USER_ID = -1; // Asumido
const DIFFICULTY_LEVELS = { 
    HARD: { speedMultiplier: 0.9, reactionTime: 0.8 } 
};
const ROUTE_MATCHMAKING = '/matchmaking';
// -------------------------------------------------------------

// --- Tipos de Juego Duplicados de Pong.ts ---
type Score = { p1: number, p2: number, p3?: number, p4?: number };
type PaddleObject = { x: number, y: number, width: number, height: number, isAlive: boolean };
type BallObject = { x: number, y: number, dx: number, dy: number };
type GameObjects = { ball: BallObject, player1: PaddleObject, player2: PaddleObject, player3: PaddleObject, player4: PaddleObject };
type GameMode = 'TWO_PLAYERS' | 'FOUR_PLAYERS'; // Solo 2P para torneo

interface TournamentPongProps {
    tournamentId: number;
    matchId: number;
    initialSize: number;
    player1Id: number;
    player2Id: number;
    opponentType: 'AI' | 'HUMAN';
    gameType: 'pong' | 'tictactoe';
}
// -------------------------------------------------------------

/**
 * Reporta el resultado de la partida al backend para actualizar ELO y estado.
 */
async function reportMatchResult(matchId: number, winnerId: number, score: { p1: number, p2: number }) {
    try {
        const payload = {
            match_status: 'finish',
            winner_id: winnerId,
            player_one_points: score.p1, 
            player_two_points: score.p2  
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
        console.error('Error al reportar el resultado del Pong:', error);
        alert(`${i18next.t('errorReportingResult')}: ${(error as Error).message}`);
    }
}

export function renderTournamentPong(appElement: HTMLElement, props: TournamentPongProps): void {
    if (!appElement) return;

    // Inicialización del HTML
    appElement.innerHTML = `
        <div class="h-screen w-full flex flex-col items-center justify-center p-4 text-white font-press-start">
            <h1 class="text-2xl font-bold text-cyan-400 mb-4">${i18next.t('tournament_match')}</h1>
            <main class="relative w-full max-w-6xl">
                <canvas id="pong-canvas" class="w-full block shadow-2xl shadow-cyan-400/50 border-4 border-cyan-400 bg-black aspect-video"></canvas>
                <div id="game-overlay" class="absolute top-0 left-0 w-full h-full flex flex-col justify-center items-center bg-black bg-opacity-75 gap-4">
                    <h1 id="winner-message" class="text-5xl font-black text-center text-cyan-400 p-4 rounded-lg hidden"></h1>
                    <button id="start-button" class="px-8 py-4 text-2xl rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-110 bg-cyan-400 text-gray-900 hover:bg-white">${i18next.t('startGame')}</button>
                </div>
            </main>
            <button id="returnToMatchmaking" class="mt-8 px-8 py-4 text-lg rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-110 bg-gray-700 text-white hover:bg-gray-600">${i18next.t('return_to_matchmaking')}</button>
        </div>
    `;

    playTrack('/assets/DangerZone.mp3');

    // Botón de retorno (solo para pruebas o error, el flujo normal es al finalizar la partida)
    document.getElementById('returnToMatchmaking')?.addEventListener('click', () => {
        navigate(ROUTE_MATCHMAKING, { 
            tournamentId: props.tournamentId, 
            initialSize: props.initialSize,
            gameType: props.gameType
        });
    });

    const canvas = appElement.querySelector('#pong-canvas') as HTMLCanvasElement;
    const context = canvas.getContext('2d')!;
    const gameOverlay = appElement.querySelector('#game-overlay') as HTMLElement;
    const winnerMessage = appElement.querySelector('#winner-message')!;
    const startButton = appElement.querySelector('#start-button')!;
    
    type GameState = 'MENU' | 'PLAYING' | 'SCORED' | 'GAME_OVER';
    let gameState: GameState = 'MENU';
    
    let score: Score;
    let gameObjects: GameObjects;
    let animationFrameId: number | null = null;
    
    // Variables específicas del torneo
    const gameMode: GameMode = 'TWO_PLAYERS';
    const difficulty: 'HARD' = 'HARD'; // Siempre HARD para IA
    
    const keysPressed: { [key: string]: boolean } = {};
    let playerVelocities = { p1: 0, p2: 0, p3: 0, p4: 0 };
    
    // --- Lógica de Juego Duplicada (simplificada y modificada) ---

    function checkCollision(ball: BallObject, paddle: PaddleObject): boolean { /* ... logic ... */ 
        if (!paddle.isAlive) return false;
        const closestX = Math.max(paddle.x, Math.min(ball.x, paddle.x + paddle.width));
        const closestY = Math.max(paddle.y, Math.min(ball.y, paddle.y + paddle.height));
        const distanceX = ball.x - closestX;
        const distanceY = ball.y - closestY;
        const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
        return distanceSquared < (BALL_RADIUS * BALL_RADIUS);
    }

    function resetBall() { /* ... logic ... */
        const { ball, player1, player2 } = gameObjects;
        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
    
        const paddleLengthV = PADDLE_LENGTH_CLASSIC;
        player1.y = canvas.height / 2 - paddleLengthV / 2;
        player2.y = canvas.height / 2 - paddleLengthV / 2;

        let angle;
        const maxAngle = Math.PI / 6;
        angle = (Math.random() - 0.5) * 2 * maxAngle;
        if (Math.random() > 0.5) angle += Math.PI;
    
        ball.dx = Math.cos(angle) * INITIAL_BALL_SPEED;
        ball.dy = Math.sin(angle) * INITIAL_BALL_SPEED;
    }

    function resetGame() { /* ... logic ... */
        gameState = 'MENU';
        canvas.width = 1200; canvas.height = 900;
        score = { p1: 0, p2: 0 };
        
        gameObjects = {
            ball: { x: canvas.width / 2, y: canvas.height / 2, dx: 0, dy: 0 },
            player1: { x: PADDLE_THICKNESS, y: canvas.height / 2 - PADDLE_LENGTH_CLASSIC / 2, width: PADDLE_THICKNESS, height: PADDLE_LENGTH_CLASSIC, isAlive: true },
            player2: { x: canvas.width - PADDLE_THICKNESS * 2, y: canvas.height / 2 - PADDLE_LENGTH_CLASSIC / 2, width: PADDLE_THICKNESS, height: PADDLE_LENGTH_CLASSIC, isAlive: true },
            // Player 3 y 4 no se usan en modo 2P
            player3: { x: 0, y: 0, width: 0, height: 0, isAlive: false },
            player4: { x: 0, y: 0, width: 0, height: 0, isAlive: false },
        };

        winnerMessage.classList.add('hidden');
        gameOverlay.classList.remove('hidden');
        startButton.textContent = i18next.t('startGame');
    }

    function update() { /* ... logic ... (MODIFICADO para AI HARD) */
        if (gameState !== 'PLAYING') return;
    
        const PADDLE_SPEED = PADDLE_SPEED_CLASSIC;
        const { ball, player1, player2 } = gameObjects;
        const { player1Id, player2Id, opponentType } = props;
        const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;

        // Player 1 (Usuario Humano)
        if (player1Id === currentUserId) {
            playerVelocities.p1 = (keysPressed['s'] ? PADDLE_SPEED : 0) - (keysPressed['w'] ? PADDLE_SPEED : 0);
            player1.y += playerVelocities.p1;
        } else {
            // Player 1 es la IA (solo ocurre si el usuario actual es P2 y P1 es AI)
            if (player1Id === AI_USER_ID) {
                 const currentDifficulty = DIFFICULTY_LEVELS[difficulty];
                 const aiMaxSpeed = PADDLE_SPEED * currentDifficulty.speedMultiplier;
                 const targetY = ball.y - player1.height / 2;
                 const deltaY = targetY - player1.y;
                 player1.y += Math.max(-aiMaxSpeed, Math.min(aiMaxSpeed, deltaY));
            }
        }

        // Player 2 (Oponente - Humano o AI)
        if (player2Id === currentUserId) { // Jugador Humano (si el usuario es P2)
            playerVelocities.p2 = (keysPressed['l'] ? PADDLE_SPEED : 0) - (keysPressed['o'] ? PADDLE_SPEED : 0);
            player2.y += playerVelocities.p2;
        } else {
            // Player 2 es la IA (si el oponente es AI)
            if (player2Id === AI_USER_ID) {
                const currentDifficulty = DIFFICULTY_LEVELS[difficulty];
                const aiMaxSpeed = PADDLE_SPEED * currentDifficulty.speedMultiplier;
                const targetY = ball.y - player2.height / 2;
                const deltaY = targetY - player2.y;
                player2.y += Math.max(-aiMaxSpeed, Math.min(aiMaxSpeed, deltaY));
            } else { // Player 2 es otro Humano (P2 es controlado por teclado local si es 1v1 local)
                 playerVelocities.p2 = (keysPressed['l'] ? PADDLE_SPEED : 0) - (keysPressed['o'] ? PADDLE_SPEED : 0);
                 player2.y += playerVelocities.p2;
            }
        }
        
        player1.y = Math.max(0, Math.min(player1.y, canvas.height - player1.height));
        player2.y = Math.max(0, Math.min(player2.y, canvas.height - player2.height));
    
        ball.x += ball.dx;
        ball.y += ball.dy;
    
        if (checkCollision(ball, player1)) handlePaddleBounce(player1, playerVelocities.p1, 'vertical');
        if (checkCollision(ball, player2)) handlePaddleBounce(player2, playerVelocities.p2, 'vertical');
	
		handleScoring();
    }

	function handlePaddleBounce(paddle: PaddleObject, paddleVelocity: number, orientation: 'vertical' | 'horizontal') {
        const { ball } = gameObjects;
		const speed = Math.min(Math.sqrt(ball.dx**2 + ball.dy**2) * ACCELERATION_FACTOR, MAX_BALL_SPEED);
		if (orientation === 'vertical') {
			const relativeImpact = (ball.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2);
			const bounceAngle = relativeImpact * MAX_BOUNCE_ANGLE;
			ball.dx = speed * Math.cos(bounceAngle) * (ball.dx > 0 ? -1 : 1);
			ball.dy = speed * Math.sin(bounceAngle) + paddleVelocity * PADDLE_INFLUENCE_FACTOR;
			ball.x = paddle.x + (ball.dx > 0 ? paddle.width + BALL_RADIUS : -BALL_RADIUS);
		} else { /* ... logic ... (no usado en 2P) */ }
	}

	function handleScoring() {
        const { ball, player1, player2 } = gameObjects;
        
        if (ball.y - BALL_RADIUS < 0 || ball.y + BALL_RADIUS > canvas.height) ball.dy *= -1;
        let scorer: number | null = null;
        if (ball.x < 0) { score.p2++; scorer = 2; }
        else if (ball.x > canvas.width) { score.p1++; scorer = 1; }
        
        if (scorer) {
            if (score.p1 >= WINNING_SCORE || score.p2 >= WINNING_SCORE) {
              endGame(scorer);
            } else {
              gameState = 'SCORED';
              resetBall();
              setTimeout(() => { gameState = 'PLAYING'; }, 1000);
            }
        }
	}

	function drawTextWithSizing(text: string, x: number, y: number, align: 'left' | 'right' | 'center', maxWidth: number) { /* ... logic duplicada de Pong.ts ... */
        const defaultFontSize = 32;
		const minFontSize = 16;
		let fontSize = defaultFontSize;

		context.font = `${fontSize}px 'Press Start 2P'`;
		let measuredWidth = context.measureText(text).width;

		while (measuredWidth > maxWidth && fontSize > minFontSize) {
			fontSize--;
			context.font = `${fontSize}px 'Press Start 2P'`;
			measuredWidth = context.measureText(text).width;
		}

		let finalText = text;
		if (measuredWidth > maxWidth) {
			let charsToRemove = 1;
			while (context.measureText(finalText + '...').width > maxWidth && finalText.length > 0) {
				finalText = text.substring(0, text.length - charsToRemove);
				charsToRemove++;
			}
			finalText += '...';
		}

		context.textAlign = align;
		context.fillStyle = 'rgba(255, 255, 255, 0.75)';
		context.fillText(finalText, x, y);
    }

	function draw() { /* ... logic duplicada de Pong.ts, ajustada a 2P ... */
        context.clearRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = 'black';
		context.fillRect(0, 0, canvas.width, canvas.height);
	
		context.strokeStyle = 'rgba(255, 255, 255, 0.75)';
		context.lineWidth = 5;
		context.setLineDash([15, 15]);
		context.beginPath();
		context.moveTo(canvas.width / 2, 0);
		context.lineTo(canvas.width / 2, canvas.height);
		context.stroke();
		context.setLineDash([]);
	
		context.fillStyle = 'rgba(255, 255, 255, 0.75)';
	
        const { player1Id, player2Id } = props;
        const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;

        // Mock para obtener nombres (en el flujo real se usaría fetch, aquí se asume)
        const player1Name = player1Id === currentUserId ? JSON.parse(localStorage.getItem('user') || '{}').username : (player1Id === AI_USER_ID ? i18next.t('ai') : 'Player 1 Opponent');
        const player2Name = player2Id === currentUserId ? JSON.parse(localStorage.getItem('user') || '{}').username : (player2Id === AI_USER_ID ? i18next.t('ai') : 'Player 2 Opponent');
	
		drawTextWithSizing(player1Name, 40, 60, 'left', canvas.width / 3);
		drawTextWithSizing(player2Name, canvas.width - 40, 60, 'right', canvas.width / 3);
		
		context.font = "48px 'Press Start 2P'";
		context.textAlign = 'center';
		context.fillText(`${score.p1 || 0}`, canvas.width / 4, 120);
		context.fillText(`${score.p2 || 0}`, (canvas.width / 4) * 3, 120);
	
		const { player1, player2, ball } = gameObjects;
		
		context.fillStyle = player1.isAlive ? 'white' : '#555';
		context.fillRect(player1.x, player1.y, player1.width, player1.height);
		context.fillStyle = player2.isAlive ? 'white' : '#555';
		context.fillRect(player2.x, player2.y, player2.width, player2.height);
	
		if (gameState === 'PLAYING' || gameState === 'SCORED') {
		  context.fillStyle = 'white';
		  context.beginPath();
		  context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
		  context.fill();
		}
    }

	function gameLoop() {
		update();
		draw();
		animationFrameId = requestAnimationFrame(gameLoop);
	}

	function startGame() { // Modificado: No hace POST /api/match/create
		if (gameState === 'PLAYING') return;

        // No crea el match, asume que props.matchId es válido
        
		gameState = 'PLAYING';
		gameOverlay.classList.add('hidden');
		resetBall();
	
		if (!animationFrameId) {
			animationFrameId = requestAnimationFrame(gameLoop);
		}
	}

	async function endGame(winnerPosition: number) { // Modificado: Reporta resultado y vuelve a Matchmaking
		gameState = 'GAME_OVER';
		if (animationFrameId) cancelAnimationFrame(animationFrameId);
		animationFrameId = null;

        const winnerId = winnerPosition === 1 ? props.player1Id : props.player2Id;
        const winnerName = winnerId === props.player1Id 
            ? (props.player1Id === AI_USER_ID ? i18next.t('ai') : 'Player 1')
            : (props.player2Id === AI_USER_ID ? i18next.t('ai') : 'Player 2'); // Simplificado
  
		winnerMessage.textContent = i18next.t('winnerMessage', { winnerName });
		startButton.textContent = i18next.t('playAgain');
		winnerMessage.classList.remove('hidden');
		gameOverlay.classList.remove('hidden');

		// 1. Reportar resultado al backend
        const finalScore = { p1: score.p1, p2: score.p2 };
		await reportMatchResult(props.matchId, winnerId, finalScore);
        
        // 2. Volver a Matchmaking después de un breve retraso
        setTimeout(() => {
            navigate(ROUTE_MATCHMAKING, { 
                tournamentId: props.tournamentId, 
                initialSize: props.initialSize,
                gameType: props.gameType
            });
        }, 3000); 
	}
    // -------------------------------------------------------------

	function handleKeyDown(event: KeyboardEvent) { keysPressed[event.key.toLowerCase()] = true; }
	function handleKeyUp(event: KeyboardEvent) { keysPressed[event.key.toLowerCase()] = false; }
	
	startButton.addEventListener('click', () => {
	  if (gameState === 'MENU' || gameState === 'GAME_OVER') {
		  resetGame();
		  startGame();
	  }
	});
	
	window.addEventListener('keydown', handleKeyDown);
	window.addEventListener('keyup', handleKeyUp);
	
	resetGame();
	draw();
}