import { navigate } from '../main';
import { authenticatedFetch } from '../utils/auth';
import i18next from '../utils/i18n';

interface User 
{
    id: number;
    username: string;
}

interface Match 
{
    id: number;
    tournament_id: number;
    player1_id: number;
    player2_id: number;
    winner_id: number | null;
    match_status: 'waiting' | 'playing' | 'finish';
    game: 'pong' | 'tictactoe';
    player1: User; // Asumido que viene anidado en /api/match/getall
    player2: User; // Asumido que viene anidado en /api/match/getall
}

interface MatchmakingProps 
{
    tournamentId: number;
    initialSize: number;
    gameType: 'pong' | 'tictactoe';
}

// Constantes globales asumidas (deberían venir de un archivo de constantes)
const AI_USER_ID = -1; 
const ROUTE_START = '/start';
const ROUTE_PONG_TOURNAMENT = '/tournamentpong';
const ROUTE_TTT_TOURNAMENT = '/tournamentttt';
const navigateTo = (route: string, props: any = {}) => navigate(route, props);

// --- Funciones de Utilidad ---

/**
 * Obtiene las partidas de la ronda actual.
 */
async function fetchMatches(tournamentId: number): Promise<Match[]> {
    try {
        const url = `/api/match/getall?tournament_id=${tournamentId}`;
        const response = await authenticatedFetch(url);
        const data = await response.json();
        return data as Match[] || [];
    } catch (error) {
        console.error('Error al obtener los emparejamientos:', error);
        return [];
    }
}

/**
 * Filtra las partidas para encontrar los IDs de los ganadores humanos para la siguiente ronda.
 */
function getHumanWinners(matches: Match[], currentUserId: number): number[] {
    const humanWinners: number[] = [];
    for (const match of matches) {
        if (match.match_status === 'finish') {
            const winnerId = match.winner_id;
            
            // Si el ganador es un humano (no la IA) y es el usuario activo o un amigo
            if (winnerId !== AI_USER_ID && winnerId !== null) {
                 if (humanWinners.indexOf(winnerId) === -1) {
                     humanWinners.push(winnerId);
                 }
            }
        }
    }
    return humanWinners;
}

// --- Render y Lógica Principal ---

export async function renderMatchmaking(appElement: HTMLElement, props: MatchmakingProps): Promise<void> {
    if (!appElement) 
		return;

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUserId = currentUser.id;
    const { tournamentId, initialSize, gameType } = props;
    
    let matches: Match[] = [];
    try {
        matches = await fetchMatches(tournamentId);
    } catch (e) {
         appElement.innerHTML = `<div class="text-red-500 text-center p-8">${i18next.t('errorLoadingMatches')}</div>`;
         return;
    }

    // --- Lógica de Final y Ganador Absoluto ---
    // Si solo hay 1 partido y está terminado (y no es la ronda inicial)
    if (matches.length === 1 && matches[0].match_status === 'finish' && initialSize === 2) {
        const finalMatch = matches[0];
        const winner = finalMatch.winner_id === finalMatch.player1_id ? finalMatch.player1.username : finalMatch.player2.username;
        
        appElement.innerHTML = `
            <div id="matchmaking-view" class="h-screen flex flex-col items-center justify-center p-4 text-white font-press-start">
                <button id="logo-link" class="focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg mb-8">
                    <img src="/assets/logo.gif" alt="Logo" class="w-32 h-32">
                </button>
                <h1 class="text-3xl font-bold text-yellow-400 mb-6">${i18next.t('congratulations')}</h1>
                <p class="text-xl text-white mb-8">${i18next.t('winner_message').replace('{winner}', winner)}</p>
                <button id="return-to-start-btn" class="relative w-64 h-[60px] cursor-pointer transform hover:scale-110 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
                    <img src="${i18next.t('img.return')}" alt="${i18next.t('return')}" class="absolute inset-0 w-full h-full object-contain">
                </button>
            </div>
        `;
        document.getElementById('return-to-start-btn')?.addEventListener('click', () => navigateTo(ROUTE_START));
        document.getElementById('logo-link')?.addEventListener('click', () => navigateTo(ROUTE_START));
        return;
    }
    // ----------------------------------------
    
    const allMatchesFinished = matches.every(match => match.match_status === 'finish');

    const matchContainers = matches.map(match => {
        const p1Name = match.player1.username;
        const p2Name = match.player2.username;
        const isHumanMatch = match.player1_id === currentUserId || match.player2_id === currentUserId;
        const isWaiting = match.match_status === 'waiting';
        const isFinished = match.match_status === 'finish';
        
        let actionContent = '';

        if (isFinished) {
            const winnerName = match.winner_id === match.player1_id ? p1Name : p2Name;
            actionContent = `<span class="text-yellow-400 font-bold text-lg">${winnerName} (${i18next.t('winner')})</span>`;
        } else if (isWaiting && isHumanMatch) {
            actionContent = `
                <button class="play-match-btn focus:outline-none" 
                        data-match-id="${match.id}" 
                        data-game-type="${gameType}"
                        data-p1-id="${match.player1_id}" 
                        data-p2-id="${match.player2_id}"
                        data-initial-size="${initialSize}">
                    <img src="/assets/play.png" alt="Play" class="w-10 h-10 object-contain transform hover:scale-110 transition-transform duration-200">
                </button>
            `;
        } else if (isWaiting) { // Partidas no humanas pendientes
            actionContent = `<span class="text-gray-500">${i18next.t('waiting_for_humans')}</span>`;
        }
        
        return `
            <div class="flex justify-between items-center p-4 bg-gray-800 rounded-lg border-2 border-cyan-400 mb-4 shadow-lg">
                <span class="text-white w-1/3 text-right pr-4 text-xl truncate font-bold">${p1Name}</span>
                <img src="/assets/vs.png" alt="VS" class="w-8 h-8 mx-2 object-contain">
                <span class="text-white w-1/3 pl-4 text-xl truncate font-bold">${p2Name}</span>
                <div class="w-1/3 flex justify-end pr-2">
                    ${actionContent}
                </div>
            </div>
        `;
    }).join('');

    // --- Botón NEXT/Error ---
    const nextButtonContent = allMatchesFinished
        ? `<img src="${i18next.t('img.accept')}" alt="NEXT" class="absolute inset-0 w-full h-full object-contain">`
        : `<img src="/assets/next_disabled.png" alt="NEXT Disabled" class="absolute inset-0 w-full h-full object-contain opacity-50">`;

    const nextButtonClasses = allMatchesFinished 
        ? 'cursor-pointer transform hover:scale-105 transition-transform duration-200' 
        : 'cursor-not-allowed';
    
    const nextButtonId = allMatchesFinished ? 'next-round-btn' : 'next-round-btn-disabled';

    const nextButtonHtml = `
        <button id="${nextButtonId}" class="relative w-64 h-[60px] focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg ${nextButtonClasses}"
                ${!allMatchesFinished ? `title="${i18next.t('pending_matches_error')}"` : ''}>
            ${nextButtonContent}
        </button>
    `;
    // ----------------------------
    
    appElement.innerHTML = `
        <div id="matchmaking-view" class="h-screen flex flex-col items-center p-4 md:p-8 overflow-y-auto font-press-start text-white">
            <button id="logo-link" class="focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg mb-8 flex-shrink-0">
                <img src="/assets/logo.gif" alt="Logo" class="w-24 h-24 md:w-32 md:h-32">
            </button>
            <h1 class="text-2xl font-bold text-cyan-400 mb-6 flex-shrink-0">${i18next.t('matchmaking.title')} (ID: ${tournamentId}, Size: ${initialSize})</h1>
            
            <div class="w-full max-w-3xl flex-grow overflow-y-auto min-h-0 p-2">
                <div id="match-list" class="mb-6">
                    ${matchContainers}
                </div>
            </div>
            
            <div class="mt-4 flex justify-end w-full max-w-3xl flex-shrink-0">
                ${nextButtonHtml}
            </div>
        </div>
    `;

    // --- Event Listeners ---

    document.getElementById('logo-link')?.addEventListener('click', () => navigateTo(ROUTE_START));
    
    // Botones Play
    document.querySelectorAll('.play-match-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget as HTMLElement;
            const matchId = parseInt(btn.dataset.matchId!, 10);
            const p1Id = parseInt(btn.dataset.p1Id!, 10);
            const p2Id = parseInt(btn.dataset.p2Id!, 10);
            const initialSize = parseInt(btn.dataset.initialSize!, 10);
            
            const opponentId = p1Id === currentUserId ? p2Id : p1Id;
            const opponentIsAI = opponentId === AI_USER_ID;
            
            let route: string;
            let routeProps: any = {
                tournamentId,
                matchId,
                initialSize,
                player1Id: p1Id,
                player2Id: p2Id,
                gameType: gameType
            };
            
            if (gameType === 'pong') {
                route = ROUTE_PONG_TOURNAMENT;
                // La IA es HARD
                routeProps.opponentType = opponentIsAI ? 'AI' : 'HUMAN';
            } else { // tictactoe
                route = ROUTE_TTT_TOURNAMENT;
            }

            navigateTo(route, routeProps);
        });
    });

    // Botón NEXT
    const nextBtn = document.getElementById('next-round-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
            const currentMatches = await fetchMatches(tournamentId); // Refetch por seguridad
            const humanWinners = getHumanWinners(currentMatches, currentUserId);
            
            const newSize = initialSize / 2;
            const nextRoundSize = Math.max(2, newSize); // Mínimo 2 participantes (la final)

            // Crear nueva ronda del torneo
            try {
                const response = await authenticatedFetch('/api/tournaments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        participants: humanWinners, // Solo IDs de ganadores humanos
                        tournamentSize: nextRoundSize,
                        game: gameType 
                    })
                });
                
                const result = await response.json();
                if (!response.ok) 
                    throw new Error(result.message || i18next.t('errorAdvancingRound'));
                
                // Cargar la nueva vista Matchmaking
                navigateTo(ROUTE_MATCHMAKING, {
                    tournamentId: result.tournament.id,
                    initialSize: nextRoundSize,
                    gameType: gameType
                });
                
            } catch (error) {
                alert(`${i18next.t('errorAdvancingRound')}: ${(error as Error).message}`);
            }
        });
    }
}

// Para usar con el router, debe ser la función principal
export function renderMatchmakingView(appElement: HTMLElement, props: MatchmakingProps): void {
    renderMatchmaking(appElement, props);
}

// Se debe definir el ROUTE_MATCHMAKING en constantes o en el router.
const ROUTE_MATCHMAKING = '/matchmaking';