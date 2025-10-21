import { navigate } from '../main';
import { playTrack } from '../utils/musicPlayer';
import { GameObjects, Score, GameMode, DifficultyLevel, PaddleObject, BallObject, Player } from '../utils/types';
import { PADDLE_THICKNESS, BALL_RADIUS, WINNING_SCORE, INITIAL_BALL_SPEED, ACCELERATION_FACTOR, DIFFICULTY_LEVELS, MAX_BOUNCE_ANGLE, PADDLE_INFLUENCE_FACTOR, MAX_BALL_SPEED, PADDLE_LENGTH_CLASSIC, PADDLE_SPEED_CLASSIC } from '../utils/constants';
import i18next from '../utils/i18n';
import { updateMatchResult } from './Matchmaking';

export function renderPongTournament(container: HTMLElement) {
    container.innerHTML = `
	  <div class="h-screen w-full flex flex-col items-center justify-center p-4 text-white font-press-start">
		<main class="relative w-full max-w-6xl">
			<canvas id="pong-canvas" class="w-full block shadow-2xl shadow-cyan-400/50 border-4 border-cyan-400 bg-black"></canvas>
			<div id="game-overlay" class="absolute top-0 left-0 w-full h-full flex flex-col justify-center items-center bg-black bg-opacity-75 gap-4 hidden">
			  <h1 id="winner-message" class="text-5xl font-black text-center text-cyan-400 p-4 rounded-lg"></h1>
			  <button id="return-button" class="px-8 py-4 text-2xl rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-110 bg-cyan-400 text-gray-900 hover:bg-white">${i18next.t('return')}</button>
			</div>
		</main>
		<button id="homeButton" class="mt-8 px-8 py-4 text-lg rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-110 bg-gray-700 text-white hover:bg-gray-600">${i18next.t('return')}</button>
	  </div>
	`;

	playTrack('/assets/DangerZone.mp3');
    document.getElementById('homeButton')?.addEventListener('click', () => navigate('/matchmaking'));
    document.getElementById('return-button')?.addEventListener('click', () => navigate('/matchmaking'));

	const canvas = container.querySelector('#pong-canvas') as HTMLCanvasElement;
	const context = canvas.getContext('2d')!;
	const gameOverlay = container.querySelector('#game-overlay') as HTMLElement;
	const winnerMessage = container.querySelector('#winner-message')!;
	
	type GameState = 'PLAYING' | 'SCORED' | 'GAME_OVER';
	let gameState: GameState = 'PLAYING';
	
	let score: Score;
	let gameObjects: GameObjects;
	let animationFrameId: number | null = null;
    let difficulty: DifficultyLevel;

	const keysPressed: { [key: string]: boolean } = {};
	let playerVelocities = { p1: 0, p2: 0 };
  
    function setupGame() {
        const matchInfo = JSON.parse(localStorage.getItem('pongMatchInfo') || '{}');
        if (!matchInfo.player1) {
            navigate('/start'); // Si no hay info, no se puede jugar
            return;
        }

        difficulty = matchInfo.player2.isAI ? matchInfo.player2.difficulty : 'HARD';

        canvas.width = 1200;
        canvas.height = 900;
        score = { p1: 0, p2: 0 };
        
        gameObjects = {
            ball: { x: canvas.width / 2, y: canvas.height / 2, dx: 0, dy: 0 },
            player1: { x: PADDLE_THICKNESS, y: canvas.height / 2 - PADDLE_LENGTH_CLASSIC / 2, width: PADDLE_THICKNESS, height: PADDLE_LENGTH_CLASSIC, isAlive: true },
            player2: { x: canvas.width - PADDLE_THICKNESS * 2, y: canvas.height / 2 - PADDLE_LENGTH_CLASSIC / 2, width: PADDLE_THICKNESS, height: PADDLE_LENGTH_CLASSIC, isAlive: true },
            player3: { x: 0, y: 0, width: 0, height: 0, isAlive: false }, // Not used
            player4: { x: 0, y: 0, width: 0, height: 0, isAlive: false }, // Not used
        };

        resetBall();
        if (!animationFrameId) {
			animationFrameId = requestAnimationFrame(gameLoop);
		}
    }

	function resetBall() {
		const { ball, player1, player2 } = gameObjects;
		ball.x = canvas.width / 2;
		ball.y = canvas.height / 2;
	
		player1.y = canvas.height / 2 - PADDLE_LENGTH_CLASSIC / 2;
		player2.y = canvas.height / 2 - PADDLE_LENGTH_CLASSIC / 2;

		const maxAngle = Math.PI / 6;
		let angle = (Math.random() - 0.5) * 2 * maxAngle;
		if (Math.random() > 0.5) angle += Math.PI;
	
		ball.dx = Math.cos(angle) * INITIAL_BALL_SPEED;
		ball.dy = Math.sin(angle) * INITIAL_BALL_SPEED;
	}

	function update() {
		if (gameState !== 'PLAYING') return;
	
		const { ball, player1, player2 } = gameObjects;
	
        // Player 1 movement (always human in tournament)
		playerVelocities.p1 = (keysPressed['s'] ? PADDLE_SPEED_CLASSIC : 0) - (keysPressed['w'] ? PADDLE_SPEED_CLASSIC : 0);
		player1.y += playerVelocities.p1;
		
        // Player 2 movement
        const matchInfo = JSON.parse(localStorage.getItem('pongMatchInfo') || '{}');
        if (matchInfo.player2.isAI) {
            const currentDifficulty = DIFFICULTY_LEVELS[difficulty];
            const aiMaxSpeed = PADDLE_SPEED_CLASSIC * currentDifficulty.speedMultiplier;
            const targetY = ball.y - player2.height / 2;
            const deltaY = targetY - player2.y;
            player2.y += Math.max(-aiMaxSpeed, Math.min(aiMaxSpeed, deltaY));
        } else {
            playerVelocities.p2 = (keysPressed['l'] ? PADDLE_SPEED_CLASSIC : 0) - (keysPressed['o'] ? PADDLE_SPEED_CLASSIC : 0);
            player2.y += playerVelocities.p2;
        }
		
		player1.y = Math.max(0, Math.min(player1.y, canvas.height - player1.height));
		player2.y = Math.max(0, Math.min(player2.y, canvas.height - player2.height));
	
		ball.x += ball.dx;
		ball.y += ball.dy;
	
		if (checkCollision(ball, player1)) handlePaddleBounce(player1, playerVelocities.p1);
		if (checkCollision(ball, player2)) handlePaddleBounce(player2, playerVelocities.p2);
	
		handleScoring();
	}

	function handlePaddleBounce(paddle: PaddleObject, paddleVelocity: number) {
		const { ball } = gameObjects;
		const speed = Math.min(Math.sqrt(ball.dx**2 + ball.dy**2) * ACCELERATION_FACTOR, MAX_BALL_SPEED);
        const relativeImpact = (ball.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2);
        const bounceAngle = relativeImpact * MAX_BOUNCE_ANGLE;
        ball.dx = speed * Math.cos(bounceAngle) * (ball.dx > 0 ? -1 : 1);
        ball.dy = speed * Math.sin(bounceAngle) + paddleVelocity * PADDLE_INFLUENCE_FACTOR;
        ball.x = paddle.x + (ball.dx > 0 ? paddle.width + BALL_RADIUS : -BALL_RADIUS);
	}

	function handleScoring() {
		const { ball } = gameObjects;
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

	function draw() {
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
	
		const matchInfo = JSON.parse(localStorage.getItem('pongMatchInfo') || '{}');
		const player1Name = matchInfo.player1.username;
		const player2Name = matchInfo.player2.username;

		drawTextWithSizing(player1Name, 40, 60, 'left', canvas.width / 3);
		drawTextWithSizing(player2Name, canvas.width - 40, 60, 'right', canvas.width / 3);
		
		context.font = "48px 'Press Start 2P'";
		context.textAlign = 'center';
		context.fillText(`${score.p1 || 0}`, canvas.width / 4, 120);
		context.fillText(`${score.p2 || 0}`, (canvas.width / 4) * 3, 120);
	
		const { player1, player2, ball } = gameObjects;
		
		context.fillStyle = 'white';
		context.fillRect(player1.x, player1.y, player1.width, player1.height);
		context.fillRect(player2.x, player2.y, player2.width, player2.height);
	
		if (gameState === 'PLAYING' || gameState === 'SCORED') {
		  context.fillStyle = 'white';
		  context.beginPath();
		  context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
		  context.fill();
		}
	}

    function drawTextWithSizing(text: string, x: number, y: number, align: 'left' | 'right' | 'center', maxWidth: number) {
		const defaultFontSize = 32;
		let fontSize = defaultFontSize;
		context.font = `${fontSize}px 'Press Start 2P'`;
		while (context.measureText(text).width > maxWidth && fontSize > 10) {
			fontSize--;
			context.font = `${fontSize}px 'Press Start 2P'`;
		}
		context.textAlign = align;
		context.fillStyle = 'rgba(255, 255, 255, 0.75)';
		context.fillText(text, x, y);
	}

	function gameLoop() {
		update();
		draw();
		animationFrameId = requestAnimationFrame(gameLoop);
	}

	function endGame(winnerPlayerNum: number) {
		gameState = 'GAME_OVER';
		if (animationFrameId) cancelAnimationFrame(animationFrameId);
		animationFrameId = null;
  
        const matchInfo = JSON.parse(localStorage.getItem('pongMatchInfo') || '{}');
        const winner = winnerPlayerNum === 1 ? matchInfo.player1 : matchInfo.player2;
        
		winnerMessage.textContent = i18next.t('winnerMessage', { winnerName: winner.username });
		gameOverlay.classList.remove('hidden');

        updateMatchResult(matchInfo.matchIndex, winner);
        localStorage.removeItem('pongMatchInfo');
	}

	function handleKeyDown(event: KeyboardEvent) { keysPressed[event.key.toLowerCase()] = true; }
	function handleKeyUp(event: KeyboardEvent) { keysPressed[event.key.toLowerCase()] = false; }
	
	window.addEventListener('keydown', handleKeyDown);
	window.addEventListener('keyup', handleKeyUp);
	
	setupGame();
	draw();
}