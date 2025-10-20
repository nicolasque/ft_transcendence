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
    player_one: { id: number, username: string };
    player_two: { id: number, username: string };
}

interface Stats {
    played: number;
    victories: number;
    defeats: number;
}

export async function renderFriendProfile(appElement: HTMLElement): Promise<void> {
    if (!appElement) {
        return;
    }

    const pathParts = window.location.pathname.split('/');
    const friendId = pathParts[pathParts.length - 1];

    if (!friendId) {
        navigate('/friends');
        return;
    }

    try {
        const userResponse = await authenticatedFetch(`/api/users/${friendId}`);
        if (!userResponse.ok) throw new Error('Failed to fetch user data');
        const user: User = await userResponse.json();

        const matchesResponse = await authenticatedFetch(`/api/match/getall?user_id=${user.id}`);
        if (!matchesResponse.ok) throw new Error('Failed to fetch match history');
        const allMatches: Match[] = await matchesResponse.json();

        const history = allMatches.filter(match => match.match_status === 'finish');
        const stats: Stats = {
            played: history.length,
            victories: history.filter(match => {
                const isPlayerOne = match.player_one_id === user.id;
                return isPlayerOne ? match.player_one_points > match.player_two_points : match.player_two_points > match.player_one_points;
            }).length,
            defeats: history.length - history.filter(match => {
                const isPlayerOne = match.player_one_id === user.id;
                return isPlayerOne ? match.player_one_points > match.player_two_points : match.player_two_points > match.player_one_points;
            }).length,
        };

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
                            <img src="${user.avatar_url || '/assets/placeholder.png'}" alt="Avatar" class="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-cyan-400 object-cover mb-4">
                            <h2 class="text-3xl font-bold">${user.username}</h2>
                            <p class="text-gray-400">${user.email}</p>
                            <p class="text-lg mt-2"><span class="font-bold">ELO:</span> <span class="text-cyan-300 font-bold">${user.elo}</span></p>
                        </div>
                    </div>
                </div>

                <div class="col-span-1 lg:col-span-2 space-y-8 lg:flex lg:flex-col">
                    <div class="bg-gray-800 bg-opacity-75 p-6 rounded-lg border-2 border-cyan-400 shadow-lg">
                        <h3 class="text-xl md:text-2xl font-bold mb-4">${i18next.t('statistics')}</h3>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
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
                                <p class="text-3xl md:text-4xl font-bold text-yellow-400">${(stats.played > 0 ? (stats.victories / stats.played) * 100 : 0).toFixed(1)}%</p>
                                <p class="text-gray-400 text-sm">${i18next.t('winRate')}</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-gray-800 bg-opacity-75 p-6 rounded-lg border-2 border-cyan-400 shadow-lg lg:flex lg:flex-col lg:flex-grow">
                        <h3 class="text-xl md:text-2xl font-bold mb-4">${i18next.t('matchHistory')}</h3>
                        <div id="history-container" class="space-y-3 max-h-80 lg:max-h-none overflow-y-auto pr-2 lg:flex-grow">
                            ${history.length > 0 ? history.map(match => {
                                const isPlayerOne = match.player_one_id === user.id;
                                const result = (isPlayerOne ? match.player_one_points > match.player_two_points : match.player_two_points > match.player_one_points) ? i18next.t('victory') : i18next.t('defeat');
                                const score = isPlayerOne ? `${match.player_one_points}-${match.player_two_points}` : `${match.player_two_points}-${match.player_one_points}`;
                                const opponent = isPlayerOne ? match.player_two : match.player_one;
                                const opponentUsername = opponent ? opponent.username : 'Desconocido';

                                return `
                                <div class="flex flex-wrap justify-between items-center bg-gray-700 p-3 rounded text-sm md:text-base">
                                    <p>${i18next.t('vs')} <span class="font-bold">${opponentUsername}</span></p>
                                    <p class="${result === i18next.t('victory') ? 'text-green-400' : 'text-red-400'} font-bold">${result}</p>
                                    <p class="font-mono bg-gray-900 px-2 py-1 rounded">${score}</p>
                                </div>`;
                            }).join('') : `<p class="text-center text-gray-400">${i18next.t('noMatchHistory')}</p>`}
                        </div>
                    </div>
                </div>
            </div>
             <button id="backToFriends" class="relative w-[250px] h-[75px] cursor-pointer transform hover:scale-125 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg mt-8">
                <img src="${i18next.t('img.return')}" alt="${i18next.t('return')}" class="absolute inset-0 w-full h-full object-contain drop-shadow-lg hover:drop-shadow-xl">
            </button>
        </div>
        `;
        playTrack('/assets/Techno_Syndrome.mp3');
        document.getElementById('homeButton')?.addEventListener('click', () => navigate('/start'));
        document.getElementById('backToFriends')?.addEventListener('click', () => navigate('/friends'));
    } catch (error) {
        console.error("Failed to load friend profile:", (error as Error).message);
        appElement.innerHTML = `<div class="text-white text-center p-8"><h1>Error al cargar el perfil del amigo</h1></div>`;
    }
}