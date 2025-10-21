import { navigate } from '../main';
import { playTrack } from '../utils/musicPlayer';
import { authenticatedFetch } from '../utils/auth';
import i18next from '../utils/i18n';

interface User {
    id: number;
    username: string;
    email: string;
    fullname: string;
    elo: number;
    avatar_url?: string;
}

interface Match {
    id: number;
    player_one_id: number;
    player_two_id: number;
    player_one_points: number;
    player_two_points: number;
    match_status: 'pending' | 'playing' | 'finish';
    createdAt: string;
    game: 'pong' | 'tictactoe';
    player_one: { id: number, username: string };
    player_two: { id: number, username: string };
}

interface Stats {
    played: number;
    victories: number;
    defeats: number;
    draws: number;
}

export async function renderFriendProfile(appElement: HTMLElement): Promise<void> {
    if (!appElement) {
        return;
    }

    const pathParts = window.location.pathname.split('/');
    const friendId = pathParts[pathParts.length - 1];

    const userIdNum = parseInt(friendId);
    if (isNaN(userIdNum)) {
        console.error("Invalid friend ID in URL");
        navigate('/friends');
        return;
    }

    try {
        const userResponse = await authenticatedFetch(`/api/users/${userIdNum}`);
        if (!userResponse.ok) throw new Error('Failed to fetch user data');
        const user: User = await userResponse.json();

        const matchesResponse = await authenticatedFetch(`/api/match/getall?user_id=${user.id}`);
        if (!matchesResponse.ok) throw new Error('Failed to fetch match history');
        const allMatches: Match[] = await matchesResponse.json();

        const history = allMatches.filter(match => match.match_status === 'finish');

        const stats: Stats = {
            played: history.length,
            victories: 0,
            defeats: 0,
            draws: 0
        };

        history.forEach(match => {
            if (match.player_one_points === match.player_two_points) {
                stats.draws++;
            } else {
                const isPlayerOne = match.player_one_id === user.id;
                const won = isPlayerOne ? match.player_one_points > match.player_two_points : match.player_two_points > match.player_one_points;
                if (won) {
                    stats.victories++;
                } else {
                    stats.defeats++;
                }
            }
        });
        stats.defeats = stats.played - stats.victories - stats.draws;

        appElement.innerHTML = `
        <div class="h-screen flex flex-col items-center justify-start p-4 text-white overflow-y-auto">
            <div class="w-full flex justify-center mt-10 md:mt-20 mb-8">
                <button id="homeButton" class="focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
                    <img src="/assets/logo.gif" alt="Game Logo" class="w-full max-w-sm md:max-w-5xl">
                </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-7xl">
                <div class="col-span-1 space-y-8">
                    <div class="bg-gray-800 bg-opacity-75 p-6 rounded-lg border-2 border-cyan-400 shadow-lg">
                        <div class="flex flex-col items-center">
                            <img src="${user.avatar_url ? `${user.avatar_url}?t=${new Date().getTime()}` : '/assets/placeholder.png'}" alt="Avatar" class="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-cyan-400 object-cover mb-4 onerror="this.onerror=null; this.src='/assets/placeholder.png';">
                            <h2 class="text-3xl font-bold">${user.username}</h2>
                            <p class="text-gray-400">${user.email}</p>
                            <p class="text-lg mt-2"><span class="font-bold">ELO:</span> <span class="text-cyan-300 font-bold">${user.elo}</span></p>
                        </div>
                    </div>
                </div>

                <div class="col-span-1 lg:col-span-2 space-y-8 lg:flex lg:flex-col">
                    <div class="bg-gray-800 bg-opacity-75 p-6 rounded-lg border-2 border-cyan-400 shadow-lg">
                        <h3 class="text-xl md:text-2xl font-bold mb-4">${i18next.t('statistics')}</h3>
                        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                            <div>
                                <p class="text-3xl md:text-4xl font-bold text-cyan-300">${stats.played}</p>
                                <p class="text-gray-400 text-sm">${i18next.t('matches')}</p>
                            </div>
                            <div>
                                <p class="text-3xl md:text-4xl font-bold text-green-400">${stats.victories}</p>
                                <p class="text-gray-400 text-sm">${i18next.t('victories')}</p>
                            </div>
                            <div>
                                <p class="text-3xl md:text-4xl font-bold text-red-400">${stats.defeats}</p>
                                <p class="text-gray-400 text-sm">${i18next.t('defeats')}</p>
                            </div>
                            <div>
                                <p class="text-3xl md:text-4xl font-bold text-yellow-400">${stats.draws}</p>
                                <p class="text-gray-400 text-sm">${i18next.t('drawsStat')}</p> 
                            </div>
                            <div>
                                <p class="text-3xl md:text-4xl font-bold text-blue-400">${(stats.played > 0 ? (stats.victories / (stats.played - stats.draws)) * 100 : 0).toFixed(1)}%</p>
                                <p class="text-gray-400 text-sm">${i18next.t('winRate')}</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-gray-800 bg-opacity-75 p-6 rounded-lg border-2 border-cyan-400 shadow-lg lg:flex lg:flex-col lg:flex-grow">
                        <h3 class="text-xl md:text-2xl font-bold mb-4">${i18next.t('matchHistory')}</h3>
                        <div id="history-container" class="space-y-3 max-h-80 lg:max-h-none overflow-y-auto pr-2 lg:flex-grow">
                            ${history.length > 0 ? history.map(match => {
                                const isPlayerOne = match.player_one_id === user.id;
                                let result = '';
                                let resultClass = '';

                                if (match.player_one_points === match.player_two_points) {
                                    result = i18next.t('drawResult');
                                    resultClass = 'text-yellow-400';
                                } else {
                                    const didWin = isPlayerOne ? match.player_one_points > match.player_two_points : match.player_two_points > match.player_one_points;
                                    result = didWin ? i18next.t('victory') : i18next.t('defeat');
                                    resultClass = didWin ? 'text-green-400' : 'text-red-400';
                                }

                                const score = isPlayerOne ? `${match.player_one_points}-${match.player_two_points}` : `${match.player_two_points}-${match.player_one_points}`;
                                const opponent = isPlayerOne ? match.player_two : match.player_one;
                                const opponentUsername = opponent ? opponent.username : 'Desconocido';
                                const gameName = match.game === 'tictactoe' ? 'TicTacToe' : 'Pong';

                                return `
                                <div class="flex flex-wrap justify-between items-center bg-gray-700 p-3 rounded text-sm md:text-base">
                                    <p class="font-bold text-cyan-300">${gameName}</p>
                                    <p>${i18next.t('vs')} <span class="font-bold">${opponentUsername}</span></p>
                                    <p class="${resultClass} font-bold">${result}</p>
                                    <p class="font-mono bg-gray-900 px-2 py-1 rounded">${score}</p>
                                </div>`;
                            }).join('') : `<p class="text-center text-gray-400">${i18next.t('noMatchHistory')}</p>`}
                        </div>
                    </div>
                </div>
            </div>
             <button id="backButton" class="relative w-[250px] h-[75px] cursor-pointer transform hover:scale-125 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg mt-8">
                <img src="${i18next.t('img.return')}" alt="${i18next.t('return')}" class="absolute inset-0 w-full h-full object-contain drop-shadow-lg hover:drop-shadow-xl">
            </button>
        </div>
        `;

        playTrack('/assets/Techno_Syndrome.mp3');
        document.getElementById('homeButton')?.addEventListener('click', () => navigate('/start'));
        
        const backButton = document.getElementById('backButton');
        backButton?.addEventListener('click', () => {
            const fromTournament = localStorage.getItem('fromTournament');
            if (fromTournament === 'true') {
                localStorage.removeItem('fromTournament');
                navigate('/tournament');
            } else {
                navigate('/friends');
            }
        });

    } catch (error) {
        console.error("Failed to load friend profile:", (error as Error).message);
        appElement.innerHTML = `<div class="text-white text-center p-8"><h1>${i18next.t('errorLoadingUserDetails', { error: (error as Error).message })}</h1><button id="backButtonFallback" class="mt-4 bg-cyan-600 px-4 py-2 rounded">${i18next.t('return')}</button></div>`;
        const backButtonFallback = document.getElementById('backButtonFallback');
        backButtonFallback?.addEventListener('click', () => {
            const fromTournament = localStorage.getItem('fromTournament');
            if (fromTournament === 'true') {
                localStorage.removeItem('fromTournament');
                navigate('/tournament');
            } else {
                navigate('/friends');
            }
        });
    }
}