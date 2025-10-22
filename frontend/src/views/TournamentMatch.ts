import { navigate } from '../main';
import { playTrack } from '../utils/musicPlayer';
import { protectedRoute } from '../utils/auth.ts';

import { GameObjects, Score, GameMode, DifficultyLevel, PaddleObject, BallObject } from '../utils/types';
import { PADDLE_THICKNESS, BALL_RADIUS, WINNING_SCORE, INITIAL_BALL_SPEED, ACCELERATION_FACTOR, DIFFICULTY_LEVELS, MAX_BOUNCE_ANGLE, PADDLE_INFLUENCE_FACTOR, MAX_BALL_SPEED, PADDLE_LENGTH_CLASSIC, PADDLE_SPEED_CLASSIC, PADDLE_LENGTH_4P, PADDLE_SPEED_4P, shuffleArray } from '../utils/constants';
import i18next from '../utils/i18n';
import {initializePongGame} from './Pong.ts';

// Interfaz ajustada a lo que guardamos
interface ParticipantInfo {
    id: number;
    username: string; // Username real (e.g., guest5)
    displayName: string; // Alias o username para mostrar
    is_guest?: boolean;
    // Añade más campos si los guardaste
}

let pongElement;

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

            <div class="mb-8 w-full max-w-4xl bg-gray-800 p-4 rounded border-2 border-cyan-400">
                <h3 class="text-xl mb-4">Participantes:</h3>
                <ul class="list-disc list-inside space-y-1">
                    ${participants.map(p => `<li>${p.displayName} ${p.is_guest ? '(Invitado)' : ''} (ID: ${p.id})</li>`).join('')}
                </ul>
            </div>

            <div id="bracket-container" class="w-full max-w-6xl text-center">
                <p class="text-gray-400">(Visualización del bracket pendiente)</p>
                </div>

            <button id="back-to-start" class="mt-8 px-6 py-3 bg-gray-600 rounded hover:bg-gray-500">
                ${i18next.t('return')} al Menú Principal
            </button>
			<div id="pong">
			</div>
		</main>
		<button id="homeButton" class="mt-8 px-8 py-4 text-lg rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-110 bg-gray-700 text-white hover:bg-gray-600">${i18next.t('return')}</button>
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

    // --- Lógica Adicional (Próximos pasos) ---
    // ... (igual que antes)


    // --- Lógica Adicional (Próximos pasos) ---
    // 1. Fetch de las partidas actuales del torneo desde el backend usando tournamentId.
    // 2. Renderizar el bracket (visualización de las rondas y partidas).
    // 3. Añadir botones/lógica para iniciar/ver partidas.
    // 4. Implementar la lógica de juego real (posiblemente en otra vista o componente).
    // 5. Actualizar el estado del torneo y las partidas (polling o WebSockets).

	pongElement = document.getElementById('pong');
	initializePongGame(pongElement);
}
