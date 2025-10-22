import { authenticatedFetch, navigate } from '../utils/auth';
import { getLang } from '../utils/i18n';

// Tipos para la estructura de datos
interface Participant {
    id: number;
    username: string;
    avatar: string;
}

interface TournamentInfo {
    gameType: 'pong' | 'tictactoe';
    participants: Participant[];
}

// Almacén temporal para los resultados de las partidas
const matchResults: { [key: string]: number } = {};

function getMatchId(p1Id: number, p2Id: number): string {
    // Ordena los IDs para que la clave sea consistente sin importar el orden
    return [p1Id, p2Id].sort((a, b) => a - b).join('_');
}

function saveWinner(p1Id: number, p2Id: number, winnerId: number) {
    const matchId = getMatchId(p1Id, p2Id);
    matchResults[matchId] = winnerId;
    localStorage.setItem(`tournament_match_${matchId}`, winnerId.toString());
}

function getWinner(p1Id: number, p2Id: number): number | null {
    const matchId = getMatchId(p1Id, p2Id);
    if (matchResults[matchId]) {
        return matchResults[matchId];
    }
    const storedWinner = localStorage.getItem(`tournament_match_${matchId}`);
    if (storedWinner) {
        const winnerId = parseInt(storedWinner, 10);
        matchResults[matchId] = winnerId;
        return winnerId;
    }
    return null;
}


export async function renderMatchmaking(appElement: HTMLElement) {
    const tournamentId = localStorage.getItem('currentTournamentId');
    const lang = getLang();

    if (!tournamentId) {
        console.error('No tournament ID found in localStorage.');
        navigate('/start');
        return;
    }

    try {
        const data: TournamentInfo = await authenticatedFetch(`https://localhost:8000/api/tournaments/${tournamentId}`);

        const { gameType, participants } = data;
        let humanMatchesCount = 0;
        let humanMatchesCompleted = 0;

        // Limpiar resultados de rondas anteriores si es un nuevo torneo
        if (localStorage.getItem('lastRenderedTournamentId') !== tournamentId) {
             Object.keys(localStorage).forEach(key => {
                if (key.startsWith('tournament_match_')) {
                    localStorage.removeItem(key);
                }
            });
            localStorage.setItem('lastRenderedTournamentId', tournamentId);
        }


        // Generar HTML para los emparejamientos
        let matchesHtml = '';
        for (let i = 0; i < participants.length; i += 2) {
            const player1 = participants[i];
            const player2 = participants[i + 1];

            const isHumanMatch = player1.username !== 'ia' || player2.username !== 'ia';
            if (isHumanMatch) {
                humanMatchesCount++;
            }

            const winnerId = getWinner(player1.id, player2.id);
            let matchActionHtml = '';

            if (winnerId) {
                 if (isHumanMatch) {
                    humanMatchesCompleted++;
                }
                const winner = winnerId === player1.id ? player1 : player2;
                matchActionHtml = `<div class="text-lg font-bold text-green-400">Winner: ${winner.username}</div>`;
            } else if (isHumanMatch) {
                matchActionHtml = `<button class="play-match-btn bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                                            data-game="${gameType}"
                                            data-p1-id="${player1.id}" data-p1-name="${player1.username}"
                                            data-p2-id="${player2.id}" data-p2-name="${player2.username}">
                                        PLAY
                                   </button>`;
            } else {
                 matchActionHtml = `<div class="text-lg font-bold text-gray-500">IA vs IA</div>`;
            }

            matchesHtml += `
                <div class="flex items-center justify-between bg-gray-800 p-4 rounded-lg mb-4 border border-purple-500">
                    <div class="flex items-center gap-4">
                        <img src="/frontend/assets/${player1.avatar}" alt="${player1.username}" class="w-16 h-16 rounded-full border-2 border-blue-400">
                        <span class="text-xl font-semibold text-white">${player1.username}</span>
                    </div>
                    <span class="text-2xl font-bold text-red-500 mx-4">VS</span>
                    <div class="flex items-center gap-4">
                        <span class="text-xl font-semibold text-white">${player2.username}</span>
                        <img src="/frontend/assets/${player2.avatar}" alt="${player2.username}" class="w-16 h-16 rounded-full border-2 border-yellow-400">
                    </div>
                    <div class="w-48 text-center ml-8">
                        ${matchActionHtml}
                    </div>
                </div>
            `;
        }

        // Renderizado final
        const isNextButtonDisabled = humanMatchesCompleted < humanMatchesCount;
        appElement.innerHTML = `
            <div class="flex justify-center items-center h-screen">
                <div class="w-full max-w-4xl bg-black bg-opacity-80 rounded-3xl border-2 border-purple-500 shadow-lg p-8">
                    <h1 class="text-4xl text-center text-white font-bold mb-8">TOURNAMENT BRACKET</h1>
                    <div id="matches-container">${matchesHtml}</div>
                    <div class="text-center mt-8">
                        <button id="next-round-btn" class="py-3 px-8 text-white font-bold rounded-lg text-2xl
                            ${isNextButtonDisabled ? 'bg-gray-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-800'}">
                            NEXT
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Lógica de los botones después de renderizar
        attachEventListeners(appElement, participants);

    } catch (error) {
        console.error('Failed to fetch tournament info:', error);
        appElement.innerHTML = `<div class="text-red-500 text-center mt-10">Error loading tournament. Redirecting...</div>`;
        setTimeout(() => navigate('/start'), 3000);
    }
}

function attachEventListeners(appElement: HTMLElement, participants: Participant[]) {
    // Event listeners para los botones PLAY
    appElement.querySelectorAll('.play-match-btn').forEach(button => {
        button.addEventListener('click', () => {
            const btn = button as HTMLButtonElement;
            const gameType = btn.dataset.game;
            
            // Guardar info para la vista del juego
            localStorage.setItem('tournament_player1_id', btn.dataset.p1Id!);
            localStorage.setItem('tournament_player1_name', btn.dataset.p1Name!);
            localStorage.setItem('tournament_player2_id', btn.dataset.p2Id!);
            localStorage.setItem('tournament_player2_name', btn.dataset.p2Name!);

            if (gameType === 'pong') {
                navigate('/tournamentPong');
            } else if (gameType === 'tictactoe') {
                navigate('/tournamentTTT');
            }
        });
    });

    // Event listener para el botón NEXT
    const nextButton = appElement.querySelector('#next-round-btn') as HTMLButtonElement;
    if (nextButton) {
        nextButton.addEventListener('click', async () => {
            if (nextButton.classList.contains('cursor-not-allowed')) {
                alert('Please complete all your matches before proceeding to the next round.');
                return;
            }

            // Lógica para la final del torneo
            if (participants.length === 2) {
                const winnerId = getWinner(participants[0].id, participants[1].id);
                const winner = participants.find(p => p.id === winnerId);
                const tournamentContainer = appElement.querySelector('.max-w-4xl') as HTMLElement;
                tournamentContainer.innerHTML = `
                     <h1 class="text-5xl text-center text-yellow-400 font-bold mb-8 animate-pulse">WINNER</h1>
                     <div class="text-center">
                         <img src="/frontend/assets/${winner?.avatar}" alt="${winner?.username}" class="w-32 h-32 rounded-full border-4 border-yellow-400 mx-auto mb-4">
                         <h2 class="text-3xl text-white font-bold">${winner?.username}</h2>
                         <p class="text-xl text-gray-300 mt-2">Congratulations!</p>
                         <button id="finish-btn" class="mt-8 bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl">
                             FINISH
                         </button>
                     </div>
                `;
                tournamentContainer.querySelector('#finish-btn')?.addEventListener('click', () => {
                    localStorage.removeItem('currentTournamentId');
                    localStorage.removeItem('lastRenderedTournamentId');
                    Object.keys(localStorage).forEach(key => {
                        if (key.startsWith('tournament_match_')) {
                            localStorage.removeItem(key);
                        }
                    });
                    navigate('/start');
                });
                return;
            }

            // Lógica para crear la siguiente ronda
            const winners: number[] = [];
            for (let i = 0; i < participants.length; i += 2) {
                const p1 = participants[i];
                const p2 = participants[i + 1];
                let winnerId = getWinner(p1.id, p2.id);

                // Si es una partida IA vs IA, se elige un ganador al azar
                if (!winnerId && p1.username === 'ia' && p2.username === 'ia') {
                   winnerId = Math.random() < 0.5 ? p1.id : p2.id;
                }
                
                if (winnerId) {
                    const winnerIsHuman = participants.find(p => p.id === winnerId)?.username !== 'ia';
                    if(winnerIsHuman) {
                        winners.push(winnerId);
                    }
                }
            }
            
            try {
                const currentTournament: TournamentInfo = await authenticatedFetch(`https://localhost:8000/api/tournaments/${localStorage.getItem('currentTournamentId')}`);
                const response = await authenticatedFetch('https://localhost:8000/api/tournaments/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: `Round of ${participants.length / 2}`,
                        game: currentTournament.gameType,
                        size: participants.length / 2,
                        participants: winners // Solo enviamos los IDs de los ganadores humanos
                    }),
                });

                // Guardar el nuevo ID y recargar la vista
                localStorage.setItem('currentTournamentId', response.tournamentId);
                renderMatchmaking(appElement);

            } catch (error) {
                console.error('Failed to create next round:', error);
                alert('An error occurred while creating the next round.');
            }
        });
    }
}
