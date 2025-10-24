import { navigate } from '../main';
import { playTrack } from '../utils/musicPlayer';
import { GameObjects, Score, GameMode, DifficultyLevel, PaddleObject, BallObject, MapConfig, Obstacle, PONG_MAPS, DifficultyConfig, Point, ParticipantInfo } from '../utils/types';
import { PADDLE_THICKNESS, BALL_RADIUS, WINNING_SCORE, INITIAL_BALL_SPEED, ACCELERATION_FACTOR, DIFFICULTY_LEVELS, MAX_BOUNCE_ANGLE, PADDLE_INFLUENCE_FACTOR, MAX_BALL_SPEED, PADDLE_LENGTH_CLASSIC, PADDLE_SPEED_CLASSIC, PADDLE_LENGTH_4P, PADDLE_SPEED_4P } from '../utils/constants';
import i18next from '../utils/i18n';
import { authenticatedFetch } from '../utils/auth';

export interface MatchResult {
	player_one_points: number;
	player_two_points: number;
}

function distToSegmentSquared(px: number, py: number, vx: number, vy: number, wx: number, wy: number): { distSq: number; closestX: number; closestY: number } {
  const l2 = (vx - wx) * (vx - wx) + (vy - wy) * (vy - wy);
  if (l2 === 0) {
      const distSq = (px - vx) * (px - vx) + (py - vy) * (py - vy);
      return { distSq, closestX: vx, closestY: vy };
  }
  let t = ((px - vx) * (wx - vx) + (py - vy) * (wy - vy)) / l2;
  t = Math.max(0, Math.min(1, t));
  const closestX = vx + t * (wx - vx);
  const closestY = vy + t * (wy - vy);
  const distSq = (px - closestX) * (px - closestX) + (py - closestY) * (py - closestY);
  return { distSq, closestX, closestY };
}

function calculateNormal(vx: number, vy: number, wx: number, wy: number): Point {
    const dx = wx - vx;
    const dy = wy - vy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: 0, y: 1 };
    return { x: -dy / len, y: dx / len };
}

function checkObstacleCollision(ball: BallObject, obstacle: Obstacle, ballRadius: number): { type: 'horizontal' | 'vertical' | 'segment' | 'circle', normal: Point, penetration: number, collisionPoint: Point } | null {
    const ballRadiusSq = ballRadius * ballRadius;

    if (obstacle.shape === 'circle' && obstacle.radius) {
        const dx = ball.x - obstacle.x;
        const dy = ball.y - obstacle.y;
        const distSq = dx * dx + dy * dy;
        const combinedRadius = ballRadius + obstacle.radius;

        if (distSq < combinedRadius * combinedRadius) {
            const dist = Math.sqrt(distSq);
            const penetration = combinedRadius - dist;
            const normalX = dist === 0 ? 1 : dx / dist;
            const normalY = dist === 0 ? 0 : dy / dist;
            const collisionX = obstacle.x + normalX * obstacle.radius;
            const collisionY = obstacle.y + normalY * obstacle.radius;

            return { type: 'circle', normal: { x: normalX, y: normalY }, penetration, collisionPoint: {x: collisionX, y: collisionY} };
        }
    } else if (obstacle.shape === 'rhombus' && obstacle.vertices) {
        let minPenetration = Infinity;
        let collisionNormal: Point | null = null;
        let closestCollisionPoint: Point | null = null;

        for (let i = 0; i < 4; i++) {
            const v = obstacle.vertices[i];
            const w = obstacle.vertices[(i + 1) % 4];
            const segmentInfo = distToSegmentSquared(ball.x, ball.y, v.x, v.y, w.x, w.y);

            if (segmentInfo.distSq < ballRadiusSq) {
                const penetrationDepth = ballRadius - Math.sqrt(segmentInfo.distSq);
                if (penetrationDepth < minPenetration) {
                    minPenetration = penetrationDepth;
                    collisionNormal = calculateNormal(v.x, v.y, w.x, w.y);
                    closestCollisionPoint = { x: segmentInfo.closestX, y: segmentInfo.closestY };
                }
            }
        }

        if (collisionNormal && closestCollisionPoint) {
            const dxToCenter = ball.x - obstacle.x;
            const dyToCenter = ball.y - obstacle.y;
            if (collisionNormal.x * dxToCenter + collisionNormal.y * dyToCenter < 0) {
                collisionNormal.x *= -1;
                collisionNormal.y *= -1;
            }
             return { type: 'segment', normal: collisionNormal, penetration: minPenetration, collisionPoint: closestCollisionPoint };
        }

    } else if (obstacle.shape === 'rectangle') {
        const closestX = Math.max(obstacle.x, Math.min(ball.x, obstacle.x + (obstacle.width ?? 0)));
        const closestY = Math.max(obstacle.y, Math.min(ball.y, obstacle.y + (obstacle.height ?? 0)));
        const distX = ball.x - closestX;
        const distY = ball.y - closestY;
        const distanceSquared = (distX * distX) + (distY * distY);

        if (distanceSquared < ballRadiusSq) {
            const penetration = ballRadius - Math.sqrt(distanceSquared);
            const absDistX = Math.abs(distX);
            const absDistY = Math.abs(distY);

            if (absDistX > absDistY) {
                 return { type: 'horizontal', normal: { x: distX > 0 ? 1 : -1, y: 0 }, penetration, collisionPoint: { x: closestX, y: ball.y } };
            } else {
                 return { type: 'vertical', normal: { x: 0, y: distY > 0 ? 1 : -1 }, penetration, collisionPoint: { x: ball.x, y: closestY } };
            }
        }
    }

    return null;
}

export function initializePongGame(
	container: HTMLElement,
	player1?: ParticipantInfo,
	player2?: ParticipantInfo,
    matchId_Variatic?: number
): Promise<MatchResult> {
	return new Promise((resolve) => {
        const isTournamentMatch = matchId_Variatic !== undefined;
        const mainContainerClass = isTournamentMatch ? '' : 'h-screen';

        container.innerHTML = `
          <div class="${mainContainerClass} w-full flex flex-col items-center justify-center p-4 text-white font-press-start">
            <main class="relative w-full max-w-6xl">
                <canvas id="pong-canvas" class="w-full block shadow-2xl shadow-cyan-400/50 border-4 border-cyan-400 bg-black"></canvas>
                <div id="game-overlay" class="absolute top-0 left-0 w-full h-full flex flex-col justify-center items-center bg-black bg-opacity-75 gap-4">
                  <h1 id="winner-message" class="text-5xl font-black text-center text-cyan-400 p-4 rounded-lg hidden"></h1>
                    <button id="start-button" class="px-8 py-4 text-2xl rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-110 bg-cyan-400 text-gray-900 hover:bg-white">${i18next.t('startGame')}</button>
                </div>
            </main>
            ${!isTournamentMatch ? `<button id="homeButton" class="mt-8 px-8 py-4 text-lg rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-110 bg-gray-700 text-white hover:bg-gray-600">${i18next.t('return')}</button>` : ''}
          </div>
            `;

        playTrack('/assets/DangerZone.mp3');
        if (!isTournamentMatch) {
            document.getElementById('homeButton')?.addEventListener('click', () => navigate('/start'));
        }

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

        let aiLastUpdateTime = 0;
        let aiTargetY: number | null = null;

        if (isTournamentMatch) {
            matchId = matchId_Variatic;
        }

        const gameMode: GameMode = localStorage.getItem('gameMode') as GameMode || 'ONE_PLAYER';
        const difficulty: DifficultyLevel = localStorage.getItem('difficulty') as DifficultyLevel || 'HARD';
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

        const keysPressed: { [key: string]: boolean } = {};
        let playerVelocities = { p1: 0, p2: 0, p3: 0, p4: 0 };

        function checkCollision(ball: BallObject, paddle: PaddleObject): boolean {
            if (!paddle.isAlive) return false;
            const closestX = Math.max(paddle.x, Math.min(ball.x, paddle.x + paddle.width));
            const closestY = Math.max(paddle.y, Math.min(ball.y, paddle.y + paddle.height));
            const distanceX = ball.x - closestX;
            const distanceY = ball.y - closestY;
            const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
            return distanceSquared < (currentBallRadius * currentBallRadius);
        }

        function resetBall() {
            const { ball, player1, player2, player3, player4 } = gameObjects;
            ball.x = canvas.width / 2;
            ball.y = canvas.height / 2;
            const paddleLengthV = currentPaddleLength;
            player1.y = canvas.height / 2 - paddleLengthV / 2;
            player2.y = canvas.height / 2 - paddleLengthV / 2;

            if (gameMode === 'FOUR_PLAYERS') {
                const paddleLengthH = currentPaddleLength;
                player3.x = canvas.width / 2 - paddleLengthH / 2;
                player4.x = canvas.width / 2 - paddleLengthH / 2;
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

            if (isTournamentMatch) {
                currentMapConfig = PONG_MAPS['classic'];
                currentBallSpeed = INITIAL_BALL_SPEED;
                currentPaddleSpeed = PADDLE_SPEED_CLASSIC;
                currentBallRadius = BALL_RADIUS;
                currentPaddleLength = PADDLE_LENGTH_CLASSIC;
            } else if (selectedMap === 'custom') {
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

        function predictBallTrajectory(ball: BallObject, targetX: number, canvasHeight: number, mapConfig: MapConfig, radius: number): number {
            let simBall = { ...ball };

            for (let i = 0; i < 500; i++) {
                simBall.x += simBall.dx;
                simBall.y += simBall.dy;

                if (simBall.y - radius < 0 && simBall.dy < 0) {
                    simBall.dy *= -1;
                    simBall.y = radius;
                } else if (simBall.y + radius > canvasHeight && simBall.dy > 0) {
                    simBall.dy *= -1;
                    simBall.y = canvasHeight - radius;
                }

                if (mapConfig && mapConfig.obstacles) {
                    for (const obstacle of mapConfig.obstacles) {
                        const collisionResult = checkObstacleCollision(simBall, obstacle, radius);
                        if (collisionResult) {
                            const normal = collisionResult.normal;
                            const dot = simBall.dx * normal.x + simBall.dy * normal.y;
                            simBall.dx = simBall.dx - 2 * dot * normal.x;
                            simBall.dy = simBall.dy - 2 * dot * normal.y;
                            simBall.x += normal.x * collisionResult.penetration * 1.1;
                            simBall.y += normal.y * collisionResult.penetration * 1.1;
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

        function update() {
            if (gameState !== 'PLAYING') return;

            const PADDLE_SPEED = currentPaddleSpeed;
            const { ball, player1, player2, player3, player4 } = gameObjects;

            if (player1.isAlive) {
                playerVelocities.p1 = (keysPressed['s'] ? PADDLE_SPEED : 0) - (keysPressed['w'] ? PADDLE_SPEED : 0);
                player1.y += playerVelocities.p1;
            }

            if (player2.isAlive) {
                if (gameMode === 'ONE_PLAYER') {
                    const currentDifficulty = DIFFICULTY_LEVELS[difficulty];
                    const aiMaxSpeed = PADDLE_SPEED_CLASSIC * currentDifficulty.speedMultiplier;
                    const now = performance.now();

                    let updateIntervalMs = 0;
                    switch (difficulty) {
                        case 'EASY':       updateIntervalMs = 500; break;
                        case 'MEDIUM':     updateIntervalMs = 250; break;
                        case 'HARD':       updateIntervalMs = 100; break;
                        case 'IMPOSSIBLE': updateIntervalMs = 50;  break;
                    }

                    if (ball.dx > 0 && (now - aiLastUpdateTime >= updateIntervalMs || aiTargetY === null)) {
                        aiLastUpdateTime = now;
                        const predictedY = predictBallTrajectory({ ...ball }, player2.x, canvas.height, currentMapConfig, currentBallRadius);
                        const paddleCenterOffset = player2.height / 2;
                        let targetRawY = predictedY - paddleCenterOffset;

                        if (difficulty !== 'IMPOSSIBLE') {
                            const maxError = player2.height * (1 - currentDifficulty.speedMultiplier) * 0.7;
                            const error = (Math.random() - 0.5) * 2 * maxError;
                            targetRawY += error;
                        }
                        aiTargetY = targetRawY;
                    } else if (ball.dx <= 0 && aiTargetY === null) {
                         aiTargetY = canvas.height / 2 - player2.height / 2;
                    }

                    if (aiTargetY !== null) {
                        const deltaY = aiTargetY - player2.y;
                        player2.y += Math.max(-aiMaxSpeed, Math.min(aiMaxSpeed, deltaY));
                    }
                } else {
                    playerVelocities.p2 = (keysPressed['l'] ? PADDLE_SPEED : 0) - (keysPressed['o'] ? PADDLE_SPEED : 0);
                    player2.y += playerVelocities.p2;
                }
            }

            player1.y = Math.max(0, Math.min(player1.y, canvas.height - player1.height));
            player2.y = Math.max(0, Math.min(player2.y, canvas.height - player2.height));

            if (gameMode === 'FOUR_PLAYERS') {
                if (player3.isAlive) {
                    playerVelocities.p3 = (keysPressed['h'] ? PADDLE_SPEED : 0) - (keysPressed['g'] ? PADDLE_SPEED : 0);
                    player3.x += playerVelocities.p3;
                }
                if (player4.isAlive) {
                    playerVelocities.p4 = (keysPressed['n'] ? PADDLE_SPEED : 0) - (keysPressed['b'] ? PADDLE_SPEED : 0);
                    player4.x += playerVelocities.p4;
                }
                player3.x = Math.max(0, Math.min(player3.x, canvas.width - player3.width));
                player4.x = Math.max(0, Math.min(player4.x, canvas.width - player4.width));
            }

            ball.x += ball.dx;
            ball.y += ball.dy;

            let obstacleCollisionHandled = false;
            if (currentMapConfig && currentMapConfig.obstacles) {
                for (const obstacle of currentMapConfig.obstacles) {
                    const collisionResult = checkObstacleCollision(ball, obstacle, currentBallRadius);
                    if (collisionResult) {
                         const normal = collisionResult.normal;
                         const dot = ball.dx * normal.x + ball.dy * normal.y;

                         ball.dx = ball.dx - 2 * dot * normal.x;
                         ball.dy = ball.dy - 2 * dot * normal.y;

                         ball.x += normal.x * collisionResult.penetration * 1.1;
                         ball.y += normal.y * collisionResult.penetration * 1.1;

                         obstacleCollisionHandled = true;
                         break;
                    }
                }
            }

            if (!obstacleCollisionHandled) {
                let bounced = false;
                if (checkCollision(ball, player1) && ball.dx < 0) {
                    handlePaddleBounce(player1, playerVelocities.p1, 'vertical');
                    bounced = true;
                }
                if (!bounced && checkCollision(ball, player2) && ball.dx > 0) {
                    handlePaddleBounce(player2, playerVelocities.p2, 'vertical');
                    bounced = true;
                }
                if (gameMode === 'FOUR_PLAYERS') {
                    if (!bounced && checkCollision(ball, player3) && ball.dy < 0) {
                        handlePaddleBounce(player3, playerVelocities.p3, 'horizontal');
                        bounced = true;
                    }
                    if (!bounced && checkCollision(ball, player4) && ball.dy > 0) {
                        handlePaddleBounce(player4, playerVelocities.p4, 'horizontal');
                    }
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
            const currentSpeed = Math.sqrt(ball.dx ** 2 + ball.dy ** 2);
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

            const finalSpeed = Math.sqrt(ball.dx ** 2 + ball.dy ** 2);
            if (finalSpeed > MAX_BALL_SPEED) {
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

                if (ball.x - currentBallRadius < 0 && player1.isAlive) loseLife(1);
                else if (ball.x + currentBallRadius > canvas.width && player2.isAlive) loseLife(2);
                else if (ball.y - currentBallRadius < 0 && player3.isAlive) loseLife(3);
                else if (ball.y + currentBallRadius > canvas.height && player4.isAlive) loseLife(4);

            } else {
                let scorer: number | null = null;
                if (ball.x - currentBallRadius < 0) { score.p2++; scorer = 2; }
                else if (ball.x + currentBallRadius > canvas.width) { score.p1++; scorer = 1; }

                if (scorer) {
                    if (score.p1 >= WINNING_SCORE || score.p2 >= WINNING_SCORE) {
                        endGame(scorer === 1 ? (score.p1 > score.p2 ? 1 : 2) : (score.p2 > score.p1 ? 2 : 1));
                    } else {
                        gameState = 'SCORED';
                        resetBall();
                        setTimeout(() => { if (gameState === 'SCORED') gameState = 'PLAYING'; }, 1000);
                    }
                }
            }
        }

       function loseLife(playerNumber: number) {
            gameState = 'SCORED';
            const playerKey = `p${playerNumber}` as keyof Score;
            score[playerKey] = Math.max(0, (score[playerKey] ?? 0) - 1);

            const gameObjectKey = `player${playerNumber}` as keyof GameObjects;
            const paddle = gameObjects[gameObjectKey];

            if (paddle && 'isAlive' in paddle && score[playerKey] !== undefined && score[playerKey]! <= 0) {
                paddle.isAlive = false;
            }

            const alivePlayers = [gameObjects.player1, gameObjects.player2, gameObjects.player3, gameObjects.player4]
                                .filter(p => p && 'isAlive' in p && p.isAlive).length;

            if (gameMode === 'FOUR_PLAYERS' && alivePlayers <= 1) {
                const winnerKey = Object.keys(score).find(k => {
                    const playerIndex = parseInt(k.replace('p', ''));
                    const player = gameObjects[`player${playerIndex}` as keyof GameObjects];
                    return player && 'isAlive' in player && player.isAlive;
                });
                endGame(winnerKey ? parseInt(winnerKey.replace('p', '')) : 0);
            } else {
                resetBall();
                setTimeout(() => { if (gameState === 'SCORED') gameState = 'PLAYING'; }, 1000);
            }
        }

        function drawTextWithSizing(text: string, x: number, y: number, align: 'left' | 'right' | 'center', maxWidth: number, color?: string) {
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
			if (color) context.fillStyle = color;
			context.fillText(finalText, x, y);
		}


        function draw() {
            let bgColor = 'black';
			let lineAndScoreColor = 'rgba(255, 255, 255, 0.75)';
			let paddleColor = 'white';
			let ballColor = 'white';
			let obstacleColor = '#888888';

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

            if (gameMode === 'FOUR_PLAYERS') {
				context.font = "48px 'Press Start 2P'";
				context.textAlign = 'center';
				context.fillStyle = lineAndScoreColor;
				context.fillText(`${score.p3 ?? 3}`, canvas.width / 2, 60);
				context.fillText(`${score.p1 ?? 3}`, 60, canvas.height / 2 + 15);
				context.fillText(`${score.p2 ?? 3}`, canvas.width - 60, canvas.height / 2 + 15);
				context.fillText(`${score.p4 ?? 3}`, canvas.width / 2, canvas.height - 30);
			} else {
                let displayPlayer1Name: string;
                let displayPlayer2Name: string;

                if (player1 && player2) {
                    displayPlayer1Name = player1.displayName;
                    displayPlayer2Name = player2.displayName;
                } else {
                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                    displayPlayer1Name = user.username || 'Player 1';
                    if (gameMode === 'ONE_PLAYER') {
                        displayPlayer2Name = i18next.t('ai');
                    } else if (gameMode === 'TWO_PLAYERS') {
                        const opponentUsername = localStorage.getItem('opponentUsername');
                        displayPlayer2Name = opponentUsername || 'guest';
                    } else {
                        displayPlayer2Name = i18next.t('player2');
                    }
                }

				context.fillStyle = lineAndScoreColor;
                drawTextWithSizing(displayPlayer1Name, 40, 60, 'left', canvas.width / 3, lineAndScoreColor);
                drawTextWithSizing(displayPlayer2Name, canvas.width - 40, 60, 'right', canvas.width / 3, lineAndScoreColor);

				context.font = "48px 'Press Start 2P'";
				context.textAlign = 'center';
				context.fillStyle = lineAndScoreColor;
				context.fillText(`${score.p1}`, canvas.width / 4, 120);
				context.fillText(`${score.p2}`, (canvas.width / 4) * 3, 120);
			}

            if (currentMapConfig && currentMapConfig.obstacles) {
                context.fillStyle = obstacleColor;
                currentMapConfig.obstacles.forEach(obstacle => {
                    if (obstacle.shape === 'circle' && obstacle.radius) {
                        context.beginPath();
                        context.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
                        context.fill();
                    } else if (obstacle.shape === 'rhombus' && obstacle.vertices) {
                        context.beginPath();
                        context.moveTo(obstacle.vertices[0].x, obstacle.vertices[0].y);
                        for (let i = 1; i < 4; i++) {
                            context.lineTo(obstacle.vertices[i].x, obstacle.vertices[i].y);
                        }
                        context.closePath();
                        context.fill();
                    } else if (obstacle.shape === 'rectangle') {
                        context.fillRect(obstacle.x, obstacle.y, obstacle.width ?? 0, obstacle.height ?? 0);
                    }
                });
            }

            const { player1: paddle1, player2: paddle2, player3, player4, ball } = gameObjects;
            context.fillStyle = paddle1.isAlive ? paddleColor : '#555';
            context.fillRect(paddle1.x, paddle1.y, paddle1.width, paddle1.height);
            context.fillStyle = paddle2.isAlive ? paddleColor : '#555';
            context.fillRect(paddle2.x, paddle2.y, paddle2.width, paddle2.height);
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

            if (isTournamentMatch && matchId !== null) {
                gameState = 'PLAYING';
                gameOverlay.classList.add('hidden');
                resetBall();
                if (!animationFrameId) {
                    animationFrameId = requestAnimationFrame(gameLoop);
                }
                return;
            }

            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (!user.id) {
                alert("Error: Usuario no encontrado. Por favor, inicie sesión de nuevo.");
                navigate('/login');
                return;
            }
            const palyer1 = user.id;

            let palyer2: number | null = null;
            let match_type: string = 'local';
            const opponentIdStr = localStorage.getItem('opponentId');

            if (gameMode === 'ONE_PLAYER') {
                match_type = 'ia';
            } else if (gameMode === 'TWO_PLAYERS' && opponentIdStr) {
                palyer2 = parseInt(opponentIdStr, 10);
                match_type = 'friends';
            } else if (gameMode === 'TWO_PLAYERS' && !opponentIdStr) {
                match_type = 'local';
            }

            if (gameMode !== 'FOUR_PLAYERS') {
                const matchData = {
                    palyer1: palyer1,
                    ...(palyer2 !== null && { palyer2: palyer2 }),
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
                    if (!result.id) {
                        throw new Error('Server did not return a match ID.');
                    }
                    matchId = result.id;

                } catch (error) {
                    alert("Error al iniciar la partida: " + (error as Error).message);
                    resetGame();
                    return;
                }
            } else {
                matchId = null;
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

             if (isTournamentMatch && player1 && player2) {
                winnerName = winner === 1 ? player1.displayName : player2.displayName;
            } else if (gameMode === 'ONE_PLAYER' && winner === 2) {
                winnerName = i18next.t('ai');
            } else if (gameMode === 'TWO_PLAYERS') {
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
                 const winnerPKey = `p${winner}` as keyof Score;
                const winnerGameObjectKey = `player${winner}` as keyof GameObjects;
                const winnerPaddle = gameObjects[winnerGameObjectKey];
                 const tournamentParticipantsStr = localStorage.getItem('currentTournamentParticipants');
                 let winnerInfo: ParticipantInfo | undefined;
                 if (tournamentParticipantsStr) {
                    try {
                        const participants: ParticipantInfo[] = JSON.parse(tournamentParticipantsStr);
                         winnerInfo = participants.find(p => p.id === (winnerPaddle as PaddleObject)?.id); // Requires paddle to have an ID if 4P uses real users
                    } catch (e) { console.error("Could not parse tournament participants for 4P winner name"); }
                 }
                winnerName = winnerInfo?.displayName || `Player ${winner}`;
            }

            winnerMessage.textContent = i18next.t('winnerMessage', { winnerName });
            startButton.textContent = i18next.t('playAgain');
            winnerMessage.classList.remove('hidden');
            gameOverlay.classList.remove('hidden');

            if (matchId !== null && (isTournamentMatch || gameMode !== 'FOUR_PLAYERS')) {
                const finalData = {
                    match_status: 'finish',
                    player_one_points: score.p1,
                    player_two_points: score.p2
                };

                try {
                    const response = await authenticatedFetch(`/api/match/update/${matchId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(finalData),
                    });
                    const responseData = await response.json();
                    if (!response.ok) {
                        throw new Error(responseData.error || 'Failed to update match on server.');
                    }

                    const { playerOne: updatedPlayerOne, playerTwo: updatedPlayerTwo } = responseData;
                    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

                    if (updatedPlayerOne && currentUser.id === updatedPlayerOne.id) {
                        localStorage.setItem('user', JSON.stringify(updatedPlayerOne));
                    } else if (updatedPlayerTwo && currentUser.id === updatedPlayerTwo.id) {
                        localStorage.setItem('user', JSON.stringify(updatedPlayerTwo));
                    }

                } catch (error) {
                    console.error("Error updating match and user ELO:", error);
                }
            }

            if (isTournamentMatch) {
                resolve({
                    player_one_points: score.p1,
                    player_two_points: score.p2
                });
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
    });
}