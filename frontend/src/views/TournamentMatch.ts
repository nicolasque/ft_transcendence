import { navigate } from '../main';
import { playTrack } from '../utils/musicPlayer';
import { authenticatedFetch, protectedRoute } from '../utils/auth.ts';

import { GameObjects, Score, GameMode, DifficultyLevel, PaddleObject, BallObject } from '../utils/types';
import { PADDLE_THICKNESS, BALL_RADIUS, WINNING_SCORE, INITIAL_BALL_SPEED, ACCELERATION_FACTOR, DIFFICULTY_LEVELS, MAX_BOUNCE_ANGLE, PADDLE_INFLUENCE_FACTOR, MAX_BALL_SPEED, PADDLE_LENGTH_CLASSIC, PADDLE_SPEED_CLASSIC, PADDLE_LENGTH_4P, PADDLE_SPEED_4P, shuffleArray } from '../utils/constants';
import i18next from '../utils/i18n';
import { initializePongGame, MatchResult } from './Pong.ts';
import TournamentModel from '../../../backend/models/Tournament.js';

// Interfaz ajustada a lo que guardamos
interface ParticipantInfo {
	id: number;
	username: string; // Username real (e.g., guest5)
	displayName: string; // Alias o username para mostrar
	is_guest?: boolean;
	// Añade más campos si los guardaste
}

interface TournamentMatchInfo {
	id: number;
	round: number;
	match_status: 'pending' | 'playing' | 'finish';
	player_one: ParticipantInfo | null; // Corregido
	player_two: ParticipantInfo | null; // Corregido
	player_one_points: number; // Corregido
	player_two_points: number; // Corregido
	next_match_id: number | null;
}

let pongElement;

async function fetchTornamentMatch() {
	try {
		const tournamentId = localStorage.getItem('currentTournamentId');
		if (!tournamentId) throw new Error('No tournament ID found');

		const response = await authenticatedFetch(`/api/match/getall?tournament_id=${tournamentId}`);
		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.message || i18next.t('Error cargando torneo'));
		}
		const matches: TournamentMatchInfo[] = await response.json();
		matches.sort((a, b) => a.id - b.id);
		console.log("Partidas del torneo cargadas:", matches);
		return matches;
	} catch (error) {
		console.error("Error fetching tournament matches:", error);
		alert((error as Error).message);
		return [];
	}
}

export async function renderTournamentMatch(appElement: HTMLElement): Promise<void> {
	if (!appElement) return;

	playTrack('/assets/Techno_Syndrome.mp3');

	// --- Recuperar datos de localStorage ---
	const tournamentIdStr = localStorage.getItem('currentTournamentId');
	const participantsStr = localStorage.getItem('currentTournamentParticipants');
	const gameType = localStorage.getItem('currentTournamentGame');

	if (!tournamentIdStr || !participantsStr || !gameType) {
		console.error("Faltan datos del torneo en localStorage. Volviendo al inicio.");
		localStorage.removeItem('currentTournamentId');
		localStorage.removeItem('currentTournamentParticipants');
		localStorage.removeItem('currentTournamentGame');
		navigate('/start');
		return;
	}

	const tournamentId = parseInt(tournamentIdStr);
	let participants: ParticipantInfo[] = [];
	try {
		participants = JSON.parse(participantsStr);
		if (!Array.isArray(participants) || participants.length === 0) {
			throw new Error("Formato de participantes inválido.");
		}
	} catch (error) {
		console.error("Error al parsear participantes desde localStorage:", error);
		localStorage.removeItem('currentTournamentParticipants');
		navigate('/start');
		return;
	}

	console.log(`Mostrando torneo ${tournamentId} (${gameType}) con participantes:`, participants);

	// --- Renderizado Básico ---
	appElement.innerHTML = `
        <div class="h-screen flex flex-col items-center p-4 text-white font-press-start">
            <h1 class="text-3xl mb-4">Torneo ID: ${tournamentId}</h1>
            <h2 class="text-2xl mb-8">Juego: ${gameType === 'pong' ? 'Pong' : 'Tic Tac Toe'}</h2>


			<div class="flex flex-col items-center w-full">
		<main class="flex flex-col items-center w-full">
			<div class="mb-8 w-full max-w-4xl bg-gray-800 p-4 rounded border-2 border-cyan-400">
				<div id="tournament-status" class="text-lg">
					Estado del Torneo: <span id="tournament-status-text">Cargando...</span>
				
					</div>
			</div>
			<div id="pong">
			</div>
            <div id="bracket-container" class="w-full max-w-6xl text-center">
                <p class="text-gray-400">(Visualización del bracket pendiente)</p>
                </div>

            <button id="back-to-start" class="mt-8 px-6 py-3 bg-gray-600 rounded hover:bg-gray-500">
                ${i18next.t('return')} al Menú Principal
            </button>
		</main>
	  </div>
			</div>
        </div>
    `;

	document.getElementById('back-to-start')?.addEventListener('click', () => {
		localStorage.removeItem('currentTournamentId');
		localStorage.removeItem('currentTournamentParticipants');
		localStorage.removeItem('currentTournamentGame');
		navigate('/start');
	});



	let tournamentMatchs = await fetchTornamentMatch();
	tournamentMatchs = asingDisplayNamesToParticipants(tournamentMatchs, participants);
	console.log(tournamentMatchs);


	renderTournamentScores(document.getElementById('tournament-status-text') as HTMLElement, tournamentMatchs);

	pongElement = document.getElementById('pong');
	// initializePongGame(pongElement);
	manageTournamentState(participants);
}

async function renderTournamentScores(appElement: HTMLElement, tournamentMatchs: TournamentMatchInfo[]): Promise<void> {
	if (!appElement) {
		console.error("App element no encontrado para renderizar puntuaciones del torneo.");
		return;
	}


	appElement.innerHTML = `
		<div class="puntuaciones-container">
			<h3 class="text-xl mb-4">Puntuaciones del Torneo:</h3>
			<ul class="list-disc list-inside space-y-1">
				${tournamentMatchs.map(match => `<li>${match.player_one?.displayName || 'N/A'} vs ${match.player_two?.displayName || 'N/A'} - ${match.player_one_points} : ${match.player_two_points}</li>`).join('')}
			</ul>
		</div>
	`;

}

function asingDisplayNamesToParticipants(TournamentMatchInfo: TournamentMatchInfo[], participants: ParticipantInfo[]): TournamentMatchInfo[] {
	for (let match of TournamentMatchInfo) {
		if (match.player_one) {
			const participantOne = participants.find(p => p.id === match.player_one!.id);
			if (participantOne) {
				match.player_one.displayName = participantOne.displayName;
			}
		}
		if (match.player_two) {
			const participantTwo = participants.find(p => p.id === match.player_two!.id);
			if (participantTwo) {
				match.player_two.displayName = participantTwo.displayName;
			}
		}
	}
	return TournamentMatchInfo;
}



async function manageTournamentState(participants: ParticipantInfo[]) {
	const pongContainer = document.getElementById('pong') as HTMLElement;
	const statusContainer = document.getElementById('tournament-status-text') as HTMLElement;

	if (!pongContainer || !statusContainer) return;

	let matches = await fetchTornamentMatch();
	matches = asingDisplayNamesToParticipants(matches, participants);
	renderTournamentScores(statusContainer, matches); // Muestra puntuaciones actualizadas

	const nextMatch = matches.find(m => m.match_status === 'pending' && m.player_one && m.player_two);

	if (nextMatch) {
		pongContainer.innerHTML = `
            <div class="text-center">
                <h3 class="text-2xl mb-4">Próxima Partida</h3>
                <p class="text-xl mb-6">${nextMatch.player_one!.displayName} vs ${nextMatch.player_two!.displayName}</p>
                <button id="play-match-btn" class="px-6 py-3 bg-green-600 rounded hover:bg-green-500 transition-colors">Jugar Partida</button>
            </div>
        `;

		document.getElementById('play-match-btn')?.addEventListener('click', async () => {
			const result = await initializePongGame(pongContainer, nextMatch.player_one!, nextMatch.player_two!, nextMatch.id);

			manageTournamentState(participants);
		});

	} else {
		const finalMatch = matches.find(m => !m.next_match_id); // La final es la que no tiene `next_match_id`
		if (finalMatch && finalMatch.match_status === 'finish') {
			const winner = finalMatch.player_one_points > finalMatch.player_two_points ? finalMatch.player_one : finalMatch.player_two;
			pongContainer.innerHTML = `
                <div class="text-center">
                    <h2 class="text-4xl text-yellow-400 mb-4">🏆 ¡Torneo Finalizado! 🏆</h2>
                    <p class="text-2xl">El ganador es:</p>
                    <p class="text-3xl font-bold mt-2">${winner?.displayName || 'Desconocido'}</p>
                </div>
            `;
		} else {
			pongContainer.innerHTML = `<p>Esperando a que se definan los próximos jugadores...</p>`;
		}
	}
}
