import { navigate } from '../main';
import { playTrack } from '../utils/musicPlayer';
import { authenticatedFetch } from '../utils/auth';
import i18next from '../utils/i18n';

interface User {
    id: number;
    username: string;
    email: string;
    elo: number;
    avatar?: string;
}

let participants: User[] = [];
let allFriends: User[] = [];
let tournamentSize = 4;

export function renderTournament(appElement: HTMLElement): void {
    if (!appElement) return;

    const currentUser: User = JSON.parse(localStorage.getItem('user') || '{}');
    if (participants.length === 0 || participants[0].id !== currentUser.id) {
        participants = [currentUser];
    }

    appElement.innerHTML = `
    <div class="h-screen flex flex-col items-center p-4 md:p-8 relative overflow-y-auto font-press-start">
        <div class="w-full flex justify-center mb-8">
            <button id="homeButton" class="focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
                <img src="/assets/logo.gif" alt="Game Logo" class="w-full max-w-sm md:max-w-2xl">
            </button>
        </div>

        <div class="flex-grow grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-7xl mx-auto min-h-0">
            <div class="col-span-1 flex flex-col items-center h-full">
                <button class="relative w-full h-[60px] mb-4 flex-shrink-0">
                    <img src="${i18next.t('img.friends')}" class="w-full h-full object-contain">
                </button>
                <div id="friends-container" class="w-full bg-black border-4 border-cyan-400 rounded-lg p-4 overflow-y-auto shadow-lg flex-grow"></div>
            </div>

            <div class="col-span-1 flex flex-col items-center h-full">
                 <button class="relative w-full h-[60px] mb-4 flex-shrink-0">
                     <img src="${i18next.t('img.participants')}" class="w-full h-full object-contain">
                </button>
                <div class="bg-gray-800 bg-opacity-75 shadow-lg rounded-xl p-4 md:p-6 flex flex-col items-center space-y-4 mb-4 flex-shrink-0">
                    <div id="tournament-size-selection" class="flex flex-wrap justify-center items-center gap-4 md:gap-6">
                        <button data-size="4" class="size-btn relative h-12 w-28 md:h-16 md:w-36 cursor-pointer transition-transform transform hover:scale-110 opacity-100 border-b-4 border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
                            <img src="/assets/4.png" class="w-full h-full object-contain p-2">
                        </button>
                        <button data-size="8" class="size-btn relative h-12 w-28 md:h-16 md:w-36 cursor-pointer transition-transform transform hover:scale-110 opacity-50 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
                            <img src="/assets/8.png" class="w-full h-full object-contain p-2">
                        </button>
                        <button data-size="16" class="size-btn relative h-12 w-28 md:h-16 md:w-36 cursor-pointer transition-transform transform hover:scale-110 opacity-50 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
                            <img src="/assets/16.png" class="w-full h-full object-contain p-2">
                        </button>
                    </div>
                </div>
                <div id="participants-container" class="w-full bg-black border-4 border-cyan-400 rounded-lg p-4 overflow-y-auto shadow-lg flex-grow"></div>
            </div>
        </div>
        <div class="mt-8">
            <button id="start-tournament-button" class="relative w-64 h-[60px] md:w-80 md:h-[75px] cursor-pointer transform hover:scale-110 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
                <img src="${i18next.t('img.accept')}" alt="${i18next.t('accept')}" class="absolute inset-0 w-full h-full object-contain">
            </button>
        </div>
    </div>
    `;

    playTrack('/assets/Techno_Syndrome.mp3');
    document.getElementById('homeButton')?.addEventListener('click', () => navigate('/start'));

    const friendsContainer = document.getElementById('friends-container')!;
    const participantsContainer = document.getElementById('participants-container')!;

    function updateParticipantsList() {
        participantsContainer.innerHTML = participants.map((p, index) => `
            <div class="flex justify-between items-center text-white p-2">
                <span class="font-bold text-xl">${p.username}</span>
                ${index > 0 ? `<button class="remove-participant-btn" data-user-id="${p.id}"><img src="${i18next.t('img.remove')}" class="h-8"></button>` : ''}
            </div>
        `).join('');
        attachParticipantButtonListeners();
    }
    
    function attachParticipantButtonListeners() {
        participantsContainer.querySelectorAll('.remove-participant-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const userId = parseInt((e.currentTarget as HTMLElement).dataset.userId!);
            participants = participants.filter(p => p.id !== userId);
            updateParticipantsList();
            renderFriendsList();
        }));
    }

    function renderFriendsList() {
        const availableFriends = allFriends.filter(friend => !participants.some(p => p.id === friend.id));
        friendsContainer.innerHTML = availableFriends.length > 0 ? availableFriends.map(friend => `
            <div class="flex justify-between items-center text-white p-2 hover:bg-gray-800 rounded-lg mb-2">
                <span class="font-bold text-xl truncate" style="max-width: 150px;">${friend.username}</span>
                <div class="flex gap-2">
                    <button class="chat-btn" data-user-id="${friend.id}" data-username="${friend.username}"><img src="${i18next.t('img.chat')}" class="h-8"></button>
                    <button class="profile-btn" data-user-id="${friend.id}"><img src="${i18next.t('img.profile')}" class="h-8"></button>
                    <button class="add-participant-btn" data-user-id="${friend.id}" data-username="${friend.username}" data-user-email="${friend.email}" data-user-elo="${friend.elo}"><img src="${i18next.t('img.add')}" class="h-8"></button>
                </div>
            </div>`).join('') : `<div class="text-gray-400 text-center text-xl">${i18next.t('noFriends')}</div>`;
        
        attachFriendButtonListeners();
    }

    async function loadAllFriends() {
        try {
            allFriends = await authenticatedFetch('/api/friends').then(res => res.json());
            renderFriendsList();
        } catch (error) {
            friendsContainer.innerHTML = `<div class="text-red-500 p-2">${(error as Error).message}</div>`;
        }
    }

    function attachFriendButtonListeners() {
        friendsContainer.querySelectorAll('.chat-btn').forEach(btn => btn.addEventListener('click', (e) => {
            console.log('Chat with ' + (e.currentTarget as HTMLElement).dataset.username);
        }));

        friendsContainer.querySelectorAll('.profile-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const userId = (e.currentTarget as HTMLElement).dataset.userId;
            navigate(`/profile/${userId}`);
        }));

        friendsContainer.querySelectorAll('.add-participant-btn').forEach(btn => btn.addEventListener('click', (e) => {
            if (participants.length >= tournamentSize) {
                alert('Número máximo de participantes alcanzado.');
                return;
            }
            const target = e.currentTarget as HTMLElement;
            const userId = parseInt(target.dataset.userId!);
            const username = target.dataset.username!;
            const email = target.dataset.userEmail!;
            const elo = parseInt(target.dataset.userElo!);

            if (!participants.find(p => p.id === userId)) {
                participants.push({ id: userId, username, email, elo });
                updateParticipantsList();
                renderFriendsList();
            }git
        }));
    }

    document.querySelectorAll('.size-btn').forEach(button => {
        button.addEventListener('click', () => {
            tournamentSize = parseInt(button.getAttribute('data-size')!);
            document.querySelectorAll('.size-btn').forEach(btn => {
                btn.classList.remove('opacity-100', 'border-b-4', 'border-cyan-400');
                btn.classList.add('opacity-50');
            });
            button.classList.add('opacity-100', 'border-b-4', 'border-cyan-400');
            button.classList.remove('opacity-50');
        });
    });

    loadAllFriends();
    updateParticipantsList();
}