import { navigate } from '../main';
import { playTrack } from '../utils/musicPlayer';
import { GameObjects, Score, GameMode, DifficultyLevel, PaddleObject, BallObject, MapConfig, Obstacle, PONG_MAPS, DifficultyConfig } from '../utils/types';
import { PADDLE_THICKNESS, BALL_RADIUS, WINNING_SCORE, INITIAL_BALL_SPEED, ACCELERATION_FACTOR, DIFFICULTY_LEVELS, MAX_BOUNCE_ANGLE, PADDLE_INFLUENCE_FACTOR, MAX_BALL_SPEED, PADDLE_LENGTH_CLASSIC, PADDLE_SPEED_CLASSIC, PADDLE_LENGTH_4P, PADDLE_SPEED_4P } from '../utils/constants';
import i18next from '../utils/i18n';
import { authenticatedFetch } from '../utils/auth';

let aiLastUpdateTime = 0;
let aiTargetY: number | null = null;

function predictBallTrajectory(ball: BallObject, targetX: number, canvasHeight: number, currentMapConfig: MapConfig, ballRadius: number): number {
    let simBall = { ...ball };

    for (let i = 0; i < 500; i++) {
        simBall.x += simBall.dx;
        simBall.y += simBall.dy;

        if (simBall.y - ballRadius < 0 && simBall.dy < 0) {
            simBall.dy *= -1;
            simBall.y = ballRadius;
        } else if (simBall.y + ballRadius > canvasHeight && simBall.dy > 0) {
            simBall.dy *= -1;
            simBall.y = canvasHeight - ballRadius;
        }

        if (currentMapConfig && currentMapConfig.obstacles) {
            for (const obstacle of currentMapConfig.obstacles) {
                const collisionType = checkObstacleCollision(simBall, obstacle, ballRadius);
                if (collisionType === 'horizontal') {
                    simBall.dx *= -1;
                    simBall.x += simBall.dx > 0 ? 1 : -1;
                    break;
                } else if (collisionType === 'vertical') {
                    simBall.dy *= -1;
                    simBall.y += simBall.dy > 0 ? 1 : -1;
                    break;
                }
            }
        }

        if ((ball.dx > 0 && simBall.x >= targetX) || (ball.dx < 0 && simBall.x <= targetX)) {
            return simBall.y;
        }
    }

    return ball.y;
}

function checkObstacleCollision(ball: BallObject, obstacle: Obstacle, ballRadius: number): ('horizontal' | 'vertical' | null) {
    const closestX = Math.max(obstacle.x, Math.min(ball.x, obstacle.x + obstacle.width));
    const closestY = Math.max(obstacle.y, Math.min(ball.y, obstacle.y + obstacle.height));

    const distX = ball.x - closestX;
    const distY = ball.y - closestY;
    const distanceSquared = (distX * distX) + (distY * distY);

    if (distanceSquared < (ballRadius * ballRadius)) {
        const overlapX = ballRadius - Math.abs(distX);
        const overlapY = ballRadius - Math.abs(distY);

        if (overlapX > overlapY) {
             return 'vertical';
        } else {
             return 'horizontal';
        }
    }
    return null;
}

export function initializePongGame(container: HTMLElement) {
	container.innerHTML = `
	  <div class="h-screen w-full flex flex-col items-center justify-center p-4 text-white font-press-start">
		<main class="relative w-full max-w-6xl">
			<canvas id="pong-canvas" class="w-full block shadow-2xl shadow-cyan-400/50 border-4 border-cyan-400 bg-black"></canvas>
			<div id="game-overlay" class="absolute top-0 left-0 w-full h-full flex flex-col justify-center items-center bg-black bg-opacity-75 gap-4">
			  <h1 id="winner-message" class="text-5xl font-black text-center text-cyan-400 p-4 rounded-lg hidden"></h1>
				<button id="start-button" class="px-8 py-4 text-2xl rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-110 bg-cyan-400 text-gray-900 hover:bg-white">${i18next.t('startGame')}</button>
			</div>
		</main>
		<button id="homeButton" class="mt-8 px-8 py-4 text-lg rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-110 bg-gray-700 text-white hover:bg-gray-600">${i18next.t('return')}</button>
	  </div>
	`;

	playTrack('/assets/DangerZone.mp3');
	document.getElementById('homeButton')?.addEventListener('click', () => navigate('/start'));

	const canvas = container.querySelector('#pong-canvas') as HTMLCanvasElement;
	const context = canvas.getContext('2d')!;
	const gameOverlay = container.querySelector('#game-overlay') as HTMLElement;
	const winnerMessage = container.querySelector('#winner-message')!;
	const startButton = container.querySelector('#start-button')!;

	type GameState = 'MENU' | 'PLAYING' | 'SCORED' | 'GAME_OVER';
	let gameState: GameState = 'MENU';

	let score: Score;
	let gameObjects: GameObjects;
	let animationFrameId: number | null = null;
  	let matchId: number | null = null;
    let currentMapConfig: MapConfig;

	const gameMode: GameMode = localStorage.getItem('gameMode') as GameMode || 'ONE_PLAYER';
	const difficulty: DifficultyLevel = localStorage.getItem('difficulty') as DifficultyLevel || 'EASY';
    const selectedMap = localStorage.getItem('selectedMap') || 'classic';

    let currentBallSpeed: number;
    let currentPaddleSpeed: number;
    let currentBallRadius: number;
    let currentPaddleLength: number;
    let currentPaddleThickness = PADDLE_THICKNESS;

    if (selectedMap === 'custom') {
        currentBallSpeed = parseInt(localStorage.getItem('custom_ballSpeed') || `${INITIAL_BALL_SPEED}`);
        currentPaddleSpeed = parseInt(localStorage.getItem('custom_paddleSpeed') || `${PADDLE_SPEED_CLASSIC}`);
        currentBallRadius = parseInt(localStorage.getItem('custom_ballSize') || `${BALL_RADIUS}`);
        currentPaddleLength = parseInt(localStorage.getItem('custom_paddleLength') || `${PADDLE_LENGTH_CLASSIC}`);
        currentMapConfig = PONG_MAPS['classic']; // Use classic map layout for custom settings
        console.log("Modo Custom - Valores:", { currentBallSpeed, currentPaddleSpeed, currentBallRadius, currentPaddleLength });
    } else {
        currentMapConfig = PONG_MAPS[selectedMap] || PONG_MAPS.classic;
        if (gameMode === 'FOUR_PLAYERS') {
            currentBallSpeed = INITIAL_BALL_SPEED;
            currentPaddleSpeed = PADDLE_SPEED_4P;
            currentBallRadius = BALL_RADIUS;
            currentPaddleLength = PADDLE_LENGTH_4P;
        } else {
            currentBallSpeed = INITIAL_BALL_SPEED;
            currentPaddleSpeed = PADDLE_SPEED_CLASSIC;
            currentBallRadius = BALL_RADIUS;
            currentPaddleLength = PADDLE_LENGTH_CLASSIC;
        }
    }


	const keysPressed: { [key: string]: boolean } = {};
	let playerVelocities = { p1: 0, p2: 0, p3: 0, p4: 0 };

	function checkCollision(ball: BallObject, paddle: PaddleObject, ballRadius: number): boolean {
		if (!paddle.isAlive) return false;
		const paddleRight = paddle.x + paddle.width;
		const paddleBottom = paddle.y + paddle.height;
		const ballLeft = ball.x - ballRadius;
		const ballRight = ball.x + ballRadius;
		const ballTop = ball.y - ballRadius;
		const ballBottom = ball.y + ballRadius;

		return ballLeft < paddleRight && ballRight > paddle.x && ballTop < paddleBottom && ballBottom > paddle.y;
	}


	function resetBall() {
		const { ball, player1, player2, player3, player4 } = gameObjects;
		ball.x = canvas.width / 2;
		ball.y = canvas.height / 2;

        if (player1.isAlive) player1.y = canvas.height / 2 - currentPaddleLength / 2;
        if (player2.isAlive) player2.y = canvas.height / 2 - currentPaddleLength / 2;
        if (gameMode === 'FOUR_PLAYERS') {
            if (player3.isAlive) player3.x = canvas.width / 2 - currentPaddleLength / 2;
            if (player4.isAlive) player4.x = canvas.width / 2 - currentPaddleLength / 2;
        }

		let angle;
		if (gameMode === 'FOUR_PLAYERS') {
		  angle = Math.random() * 2 * Math.PI;
		} else {
		  const maxAngle = Math.PI / 4;
		  angle = (Math.random() - 0.5) * 2 * maxAngle;
		  if (Math.random() > 0.5) angle += Math.PI;
		}

		ball.dx = Math.cos(angle) * currentBallSpeed;
		ball.dy = Math.sin(angle) * currentBallSpeed;
	}

	function resetGame() {
		gameState = 'MENU';

        if (selectedMap === 'custom') {
             currentBallSpeed = parseInt(localStorage.getItem('custom_ballSpeed') || `${INITIAL_BALL_SPEED}`);
             currentPaddleSpeed = parseInt(localStorage.getItem('custom_paddleSpeed') || `${PADDLE_SPEED_CLASSIC}`);
             currentBallRadius = parseInt(localStorage.getItem('custom_ballSize') || `${BALL_RADIUS}`);
             currentPaddleLength = parseInt(localStorage.getItem('custom_paddleLength') || `${PADDLE_LENGTH_CLASSIC}`);
             currentMapConfig = PONG_MAPS['classic'];
        } else {
            currentMapConfig = PONG_MAPS[selectedMap] || PONG_MAPS.classic;
            if (gameMode === 'FOUR_PLAYERS') {
                 currentBallSpeed = INITIAL_BALL_SPEED;
                 currentPaddleSpeed = PADDLE_SPEED_4P;
                 currentBallRadius = BALL_RADIUS;
                 currentPaddleLength = PADDLE_LENGTH_4P;
            } else {
                 currentBallSpeed = INITIAL_BALL_SPEED;
                 currentPaddleSpeed = PADDLE_SPEED_CLASSIC;
                 currentBallRadius = BALL_RADIUS;
                 currentPaddleLength = PADDLE_LENGTH_CLASSIC;
            }
        }
        console.log("Mapa cargado:", selectedMap, currentMapConfig);

		if (gameMode === 'FOUR_PLAYERS') {
		  canvas.width = 1000; canvas.height = 1000;
		  canvas.style.aspectRatio = '1 / 1';
		  score = { p1: 3, p2: 3, p3: 3, p4: 3 };
		} else {
		  canvas.width = 1200; canvas.height = 900;
		  canvas.style.aspectRatio = '4 / 3';
		  score = { p1: 0, p2: 0 };
		}

		gameObjects = {
		  ball: { x: canvas.width / 2, y: canvas.height / 2, dx: 0, dy: 0 },
		  player1: { x: currentPaddleThickness, y: canvas.height / 2 - currentPaddleLength / 2, width: currentPaddleThickness, height: currentPaddleLength, isAlive: true },
		  player2: { x: canvas.width - currentPaddleThickness * 2, y: canvas.height / 2 - currentPaddleLength / 2, width: currentPaddleThickness, height: currentPaddleLength, isAlive: true },
		  player3: { x: canvas.width / 2 - currentPaddleLength / 2, y: currentPaddleThickness, width: currentPaddleLength, height: currentPaddleThickness, isAlive: gameMode === 'FOUR_PLAYERS' },
		  player4: { x: canvas.width / 2 - currentPaddleLength / 2, y: canvas.height - currentPaddleThickness * 2, width: currentPaddleLength, height: currentPaddleThickness, isAlive: gameMode === 'FOUR_PLAYERS' },
		};

        aiTargetY = null;
        aiLastUpdateTime = 0;

		winnerMessage.classList.add('hidden');
		gameOverlay.classList.remove('hidden');
		startButton.textContent = i18next.t('startGame');
	}

	function update() {
		if (gameState !== 'PLAYING') return;

		const PADDLE_SPEED = currentPaddleSpeed;
		const { ball, player1, player2, player3, player4 } = gameObjects;

		if (player1.isAlive) {
			playerVelocities.p1 = (keysPressed['s'] ? PADDLE_SPEED : 0) - (keysPressed['w'] ? PADDLE_SPEED : 0);
			player1.y += playerVelocities.p1;
			player1.y = Math.max(0, Math.min(player1.y, canvas.height - player1.height));
		}
		if (player2.isAlive) {
			 if (gameMode === 'ONE_PLAYER') {
					const currentDifficulty = DIFFICULTY_LEVELS[difficulty];
					const aiMaxSpeed = currentPaddleSpeed * currentDifficulty.speedMultiplier;
					const now = performance.now();
					let predictionUpdateIntervalMs = 100;
					if (difficulty === 'EASY') predictionUpdateIntervalMs = 1000;
					else if (difficulty === 'MEDIUM') predictionUpdateIntervalMs = 500;

					if (ball.dx > 0 && (now - aiLastUpdateTime >= predictionUpdateIntervalMs)) {
						 aiLastUpdateTime = now;
						 const predictedY = predictBallTrajectory({ ...ball }, player2.x, canvas.height, currentMapConfig, currentBallRadius);
						 const paddleCenterOffset = player2.height / 2;
						 const errorFactor = 1.0 - (currentDifficulty.speedMultiplier * 0.5);
						 const randomError = (Math.random() - 0.5) * paddleCenterOffset * errorFactor;
						 aiTargetY = predictedY - paddleCenterOffset + randomError;
					} else if (ball.dx <= 0) {
						const targetCenter = canvas.height / 2 - player2.height / 2;
						const deltaYCenter = targetCenter - player2.y;
						player2.y += Math.max(-aiMaxSpeed * 0.5, Math.min(aiMaxSpeed * 0.5, deltaYCenter));
					}
					if (aiTargetY !== null && ball.dx > 0) {
						const deltaY = aiTargetY - player2.y;
						const movementThreshold = 20;
						if (Math.abs(deltaY) > movementThreshold) {
							player2.y += Math.max(-aiMaxSpeed, Math.min(aiMaxSpeed, deltaY));
						}
					}
				} else {
					playerVelocities.p2 = (keysPressed['l'] ? PADDLE_SPEED : 0) - (keysPressed['o'] ? PADDLE_SPEED : 0);
					player2.y += playerVelocities.p2;
				}
			player2.y = Math.max(0, Math.min(player2.y, canvas.height - player2.height));
		}
		 if (gameMode === 'FOUR_PLAYERS') {
			  if (player3.isAlive) {
				playerVelocities.p3 = (keysPressed['h'] ? PADDLE_SPEED : 0) - (keysPressed['g'] ? PADDLE_SPEED : 0);
				player3.x += playerVelocities.p3;
				player3.x = Math.max(0, Math.min(player3.x, canvas.width - player3.width));
			  }
			  if (player4.isAlive) {
				playerVelocities.p4 = (keysPressed['n'] ? PADDLE_SPEED : 0) - (keysPressed['b'] ? PADDLE_SPEED : 0);
				player4.x += playerVelocities.p4;
				player4.x = Math.max(0, Math.min(player4.x, canvas.width - player4.width));
			  }
		 }


		const nextBallX = ball.x + ball.dx;
		const nextBallY = ball.y + ball.dy;

		const prevBallX = ball.x;
		const prevBallY = ball.y;
		ball.x = nextBallX;
		ball.y = nextBallY;
		let obstacleCollisionHandled = false;
		if (currentMapConfig && currentMapConfig.obstacles) {
			for (const obstacle of currentMapConfig.obstacles) {
				const collisionType = checkObstacleCollision(ball, obstacle, currentBallRadius);
				if (collisionType) {
					if (collisionType === 'horizontal') {
						ball.dx *= -1;
						ball.x = ball.dx > 0
							? obstacle.x + obstacle.width + currentBallRadius + 0.1
							: obstacle.x - currentBallRadius - 0.1;
						ball.y = prevBallY + ball.dy;
					} else {
						ball.dy *= -1;
						ball.y = ball.dy > 0
							? obstacle.y + obstacle.height + currentBallRadius + 0.1
							: obstacle.y - currentBallRadius - 0.1;
						 ball.x = prevBallX + ball.dx;
					}
					obstacleCollisionHandled = true;
					break;
				}
			}
		}

		if (!obstacleCollisionHandled) {
			let bounced = false;
			if (checkCollision(ball, player1, currentBallRadius) && ball.dx < 0) { handlePaddleBounce(player1, playerVelocities.p1, 'vertical'); bounced = true; }
			if (!bounced && checkCollision(ball, player2, currentBallRadius) && ball.dx > 0) { handlePaddleBounce(player2, playerVelocities.p2, 'vertical'); bounced = true; }
			if (gameMode === 'FOUR_PLAYERS') {
			  if (!bounced && checkCollision(ball, player3, currentBallRadius) && ball.dy < 0) { handlePaddleBounce(player3, playerVelocities.p3, 'horizontal'); bounced = true; }
			  if (!bounced && checkCollision(ball, player4, currentBallRadius) && ball.dy > 0) { handlePaddleBounce(player4, playerVelocities.p4, 'horizontal'); }
			}
		}
         if (gameMode !== 'FOUR_PLAYERS') {
            if (ball.y - currentBallRadius < 0 && ball.dy < 0) {
                 ball.dy *= -1;
                 ball.y = currentBallRadius;
            } else if (ball.y + currentBallRadius > canvas.height && ball.dy > 0) {
                 ball.dy *= -1;
                 ball.y = canvas.height - currentBallRadius;
            }
        }
		handleScoring();
	}

	function handlePaddleBounce(paddle: PaddleObject, paddleVelocity: number, orientation: 'vertical' | 'horizontal') {
		const { ball } = gameObjects;
		const currentSpeed = Math.sqrt(ball.dx**2 + ball.dy**2);
		const speed = Math.min(currentSpeed * ACCELERATION_FACTOR, MAX_BALL_SPEED);

		if (orientation === 'vertical') {
			const relativeImpact = (ball.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2);
			const bounceAngle = relativeImpact * MAX_BOUNCE_ANGLE;

			ball.dx = speed * Math.cos(bounceAngle) * (ball.dx > 0 ? -1 : 1);
			ball.dy = speed * Math.sin(bounceAngle);

            ball.dy += paddleVelocity * PADDLE_INFLUENCE_FACTOR;

			ball.x = paddle.x + (ball.dx > 0 ? paddle.width + currentBallRadius : -currentBallRadius);
		} else {
			const relativeImpact = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
			const bounceAngle = relativeImpact * MAX_BOUNCE_ANGLE;

			ball.dy = speed * Math.cos(bounceAngle) * (ball.dy > 0 ? -1 : 1);
			ball.dx = speed * Math.sin(bounceAngle);

            ball.dx += paddleVelocity * PADDLE_INFLUENCE_FACTOR;

			ball.y = paddle.y + (ball.dy > 0 ? paddle.height + currentBallRadius : -currentBallRadius);
		}

        const finalSpeed = Math.sqrt(ball.dx**2 + ball.dy**2);
        if(finalSpeed > MAX_BALL_SPEED) {
            const ratio = MAX_BALL_SPEED / finalSpeed;
            ball.dx *= ratio;
            ball.dy *= ratio;
        }
	}

	function handleScoring() {
		const { ball, player1, player2, player3, player4 } = gameObjects;

		if (gameMode === 'FOUR_PLAYERS') {
			if ((ball.x - currentBallRadius < 0 && !player1.isAlive)) { ball.dx *= -1; ball.x = currentBallRadius; }
			if ((ball.x + currentBallRadius > canvas.width && !player2.isAlive)) { ball.dx *= -1; ball.x = canvas.width - currentBallRadius; }
			if ((ball.y - currentBallRadius < 0 && !player3.isAlive)) { ball.dy *= -1; ball.y = currentBallRadius; }
			if ((ball.y + currentBallRadius > canvas.height && !player4.isAlive)) { ball.dy *= -1; ball.y = canvas.height - currentBallRadius; }

			if (ball.x < 0 && player1.isAlive) loseLife(1);
			else if (ball.x > canvas.width && player2.isAlive) loseLife(2);
			else if (ball.y < 0 && player3.isAlive) loseLife(3);
			else if (ball.y > canvas.height && player4.isAlive) loseLife(4);

		} else {
			let scorer: number | null = null;
			if (ball.x - currentBallRadius < 0) { score.p2++; scorer = 2; }
			else if (ball.x + currentBallRadius > canvas.width) { score.p1++; scorer = 1; }

			if (scorer) {
				if (score.p1 >= WINNING_SCORE || score.p2 >= WINNING_SCORE) {
				  const winner = score.p1 > score.p2 ? 1 : 2;
				  endGame(winner);
				} else {
				  gameState = 'SCORED';
				  resetBall();
				  setTimeout(() => { if(gameState === 'SCORED') gameState = 'PLAYING'; }, 1000);
				}
			}
		}
	}

	function loseLife(playerNumber: number) {
		gameState = 'SCORED';
		const playerKey = `p${playerNumber}` as keyof Score;
		score[playerKey] = Math.max(0, (score[playerKey] || 0) - 1);

		const gameObjectKey = `player${playerNumber}` as keyof GameObjects;
		if(score[playerKey] <= 0) {
		  gameObjects[gameObjectKey].isAlive = false;
          console.log(`Player ${playerNumber} eliminado!`);
		}

		const alivePlayers = [gameObjects.player1, gameObjects.player2, gameObjects.player3, gameObjects.player4].filter(p => p.isAlive).length;

		if (gameMode === 'FOUR_PLAYERS' && alivePlayers <= 1) {
			const winnerEntry = Object.entries(gameObjects).find(([key, paddle]) => key.startsWith('player') && (paddle as PaddleObject).isAlive);
            const winnerNum = winnerEntry ? parseInt(winnerEntry[0].replace('player', '')) : 0;
			endGame(winnerNum);
		} else {
			resetBall();
			setTimeout(() => { if(gameState === 'SCORED') gameState = 'PLAYING'; }, 1000);
		}
	}

	function drawTextWithSizing(text: string, x: number, y: number, align: 'left' | 'right' | 'center', maxWidth: number, color: string) {
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
		if (measuredWidth > maxWidth && text.length > 3) {
			while (context.measureText(finalText + '...').width > maxWidth && finalText.length > 0) {
				finalText = text.substring(0, finalText.length - 1);
			}
			finalText += '...';
		} else if (measuredWidth > maxWidth) {
			finalText = text.substring(0, 1) + '..';
		}

		context.textAlign = align;
		context.fillStyle = color;
		context.fillText(finalText, x, y);
	}

	function draw() {
		let bgColor = 'black';
		let lineAndScoreColor = 'rgba(255, 255, 255, 0.75)';
		let paddleColor = 'white';
		let ballColor = 'white';
		let obstacleColor = 'grey';

		context.clearRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = bgColor;
		context.fillRect(0, 0, canvas.width, canvas.height);

		context.strokeStyle = lineAndScoreColor;
		context.lineWidth = 5;
		context.setLineDash([15, 15]);
		context.beginPath();
		if (gameMode === 'FOUR_PLAYERS') {
			context.moveTo(0, canvas.height / 2);
			context.lineTo(canvas.width, canvas.height / 2);
		}
		context.moveTo(canvas.width / 2, 0);
		context.lineTo(canvas.width / 2, canvas.height);
		context.stroke();
		context.setLineDash([]);

		context.fillStyle = lineAndScoreColor;
		if (gameMode === 'FOUR_PLAYERS') {
			context.font = "48px 'Press Start 2P'";
			context.textAlign = 'center';
			if (gameObjects.player3.isAlive) context.fillText(`${score.p3}`, canvas.width / 2, 60);
			if (gameObjects.player1.isAlive) context.fillText(`${score.p1}`, 60, canvas.height / 2 + 15);
			if (gameObjects.player2.isAlive) context.fillText(`${score.p2}`, canvas.width - 60, canvas.height / 2 + 15);
			if (gameObjects.player4.isAlive) context.fillText(`${score.p4}`, canvas.width / 2, canvas.height - 30);
		} else {
			const user = JSON.parse(localStorage.getItem('user') || '{}');
			const player1Name = user.username || 'Player 1';
			let player2Name = i18next.t('player2');
			if (gameMode === 'ONE_PLAYER') player2Name = i18next.t('ai');
			else if (gameMode === 'TWO_PLAYERS') {
				const opponentUsername = localStorage.getItem('opponentUsername');
				player2Name = opponentUsername || 'guest';
			}
			drawTextWithSizing(player1Name, 40, 60, 'left', canvas.width / 3, lineAndScoreColor);
			drawTextWithSizing(player2Name, canvas.width - 40, 60, 'right', canvas.width / 3, lineAndScoreColor);

			context.font = "48px 'Press Start 2P'";
			context.textAlign = 'center';
			context.fillStyle = lineAndScoreColor;
			context.fillText(`${score.p1}`, canvas.width / 4, 120);
			context.fillText(`${score.p2}`, (canvas.width / 4) * 3, 120);
		}

		if (currentMapConfig && currentMapConfig.obstacles && currentMapConfig.obstacles.length > 0) {
			context.fillStyle = obstacleColor;
			currentMapConfig.obstacles.forEach(obstacle => {
				context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
			});
		}

		const { player1, player2, player3, player4, ball } = gameObjects;
		context.fillStyle = player1.isAlive ? paddleColor : '#555';
		context.fillRect(player1.x, player1.y, player1.width, player1.height);
		context.fillStyle = player2.isAlive ? paddleColor : '#555';
		context.fillRect(player2.x, player2.y, player2.width, player2.height);
		if (gameMode === 'FOUR_PLAYERS') {
			context.fillStyle = player3.isAlive ? paddleColor : '#555';
			context.fillRect(player3.x, player3.y, player3.width, player3.height);
			context.fillStyle = player4.isAlive ? paddleColor : '#555';
			context.fillRect(player4.x, player4.y, player4.width, player4.height);
		}

		if (gameState === 'PLAYING' || gameState === 'SCORED') {
		  context.fillStyle = ballColor;
		  context.beginPath();
		  context.arc(ball.x, ball.y, currentBallRadius, 0, Math.PI * 2);
		  context.fill();
		}
	}

	function gameLoop() {
		update();
		draw();
		animationFrameId = requestAnimationFrame(gameLoop);
	}

	async function startGameAction() {
		if (gameState === 'PLAYING') return;

		const user = JSON.parse(localStorage.getItem('user') || '{}');
		if (!user.id) {
		  alert("Error: Usuario no encontrado. Por favor, inicie sesión de nuevo.");
		  navigate('/login');
		  return;
		}
		const player_one_id = user.id;

		let player_two_id: number | null = null;
		let match_type: string = 'local';
		const opponentIdStr = localStorage.getItem('opponentId');

		if (gameMode === 'ONE_PLAYER') {
		  match_type = 'ia';
          console.log(`Iniciando partida 1vAI`);
		} else if (gameMode === 'TWO_PLAYERS' && opponentIdStr) {
			player_two_id = parseInt(opponentIdStr, 10);
			match_type = 'friends';
			console.log(`Iniciando partida 1v1 contra amigo ID: ${player_two_id}`);
		} else if (gameMode === 'TWO_PLAYERS' && !opponentIdStr) {
			match_type = 'local';
			console.log(`Iniciando partida local 2P (vs guess)`);
		}

		if (gameMode !== 'FOUR_PLAYERS') {
			const matchData = {
			  player_one_id: player_one_id,
			  ...(player_two_id !== null && { player_two_id: player_two_id }),
			  game: 'pong',
			  match_type: match_type,
			  match_status: 'playing',
			};

			try {
			  const response = await authenticatedFetch('/api/match/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(matchData),
			  });

			  if (!response.ok) {
				const errorData = await response.json();
                const errorMessage = errorData.error?.message || errorData.message || 'Failed to create match on the server.';
				throw new Error(errorMessage);
			  }

			  const result = await response.json();
			  if (!result.id) throw new Error('Server did not return a match ID.');

			  matchId = result.id;
			  console.log(`Partida creada en backend con ID: ${matchId}`);

			} catch (error) {
			  console.error("Error starting game:", error);
			  alert("Error al iniciar la partida: " + (error as Error).message);
			  resetGame();
			  return;
			}
		} else {
			matchId = null;
			console.log("Iniciando partida 4P localmente.");
		}

		gameState = 'PLAYING';
		gameOverlay.classList.add('hidden');
		resetBall();

		if (!animationFrameId) {
			animationFrameId = requestAnimationFrame(gameLoop);
		}
	}

	async function endGame(winner: number) {
		gameState = 'GAME_OVER';
		if (animationFrameId) cancelAnimationFrame(animationFrameId);
		animationFrameId = null;

		let winnerName = `${i18next.t('player')} ${winner}`;
		if (gameMode === 'ONE_PLAYER' && winner === 2) winnerName = i18next.t('ai');
		else if (gameMode === 'TWO_PLAYERS') {
			const opponentUsername = localStorage.getItem('opponentUsername');
			if (winner === 1) {
				const user = JSON.parse(localStorage.getItem('user') || '{}');
				winnerName = user.username || 'Player 1';
			} else if (winner === 2 && opponentUsername) {
				winnerName = opponentUsername;
			} else if (winner === 2 && !opponentUsername) {
				winnerName = 'guest';
			}
		} else if (gameMode === 'FOUR_PLAYERS') {
			winnerName = `Player ${winner}`;
		}

		winnerMessage.textContent = i18next.t('winnerMessage', { winnerName });
		startButton.textContent = i18next.t('playAgain');
		winnerMessage.classList.remove('hidden');
		gameOverlay.classList.remove('hidden');

		if (matchId && gameMode !== 'FOUR_PLAYERS') {
			const finalData = {
			  match_status: 'finish',
			  player_one_points: score.p1,
			  player_two_points: score.p2
			};
			console.log(`Enviando resultado final para Match ID ${matchId}:`, finalData);

			try {
				const response = await authenticatedFetch(`/api/match/update/${matchId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(finalData),
				});
                const responseData = await response.json();
				if (!response.ok) {
                    console.error("Server response:", responseData);
					throw new Error(responseData.error || 'Failed to update match on server.');
				}

                console.log("Respuesta de actualización de partida:", responseData);

				const { playerOne: updatedPlayerOne, playerTwo: updatedPlayerTwo } = responseData;
				const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

                if (updatedPlayerOne && currentUser.id === updatedPlayerOne.id) {
                    localStorage.setItem('user', JSON.stringify(updatedPlayerOne));
                    console.log('ELO actualizado en localStorage para Jugador 1:', updatedPlayerOne.elo);
                } else if (updatedPlayerTwo && currentUser.id === updatedPlayerTwo.id) {
                    localStorage.setItem('user', JSON.stringify(updatedPlayerTwo));
                     console.log('ELO actualizado en localStorage para Jugador 2:', updatedPlayerTwo.elo);
                } else if (updatedPlayerOne || updatedPlayerTwo) {
                     console.log("ELO actualizado, pero no para el usuario actual.");
                }

			} catch (error) {
			  console.error("Error updating match and user ELO:", error);
			}
		} else {
			console.log("Partida local (4P) finalizada, no se actualiza backend.");
		}
	}

	function handleKeyDown(event: KeyboardEvent) { keysPressed[event.key.toLowerCase()] = true; }
	function handleKeyUp(event: KeyboardEvent) { keysPressed[event.key.toLowerCase()] = false; }

	startButton.addEventListener('click', () => {
	  if (gameState === 'MENU' || gameState === 'GAME_OVER') {
		  resetGame();
		  startGameAction();
	  }
	});

	window.addEventListener('keydown', handleKeyDown);
	window.addEventListener('keyup', handleKeyUp);

	resetGame();
	draw();
}