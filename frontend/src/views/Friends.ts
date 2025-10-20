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

interface FriendRequest extends User {
    friendshipId: number;
}

interface Message {
    id: number;
    sender_id: number;
    message: string;
    timestamp: string;
}

// Estado local para gestionar usuarios bloqueados (solo frontend)
const blockedUserIds = new Set<number>();

export function renderFriends(appElement: HTMLElement): void {
    if (!appElement) return;

    const sentRequestIds = new Set<number>();

    appElement.innerHTML = `
    <div class="h-screen flex flex-col p-4 md:p-8 relative overflow-y-auto font-press-start">

        <div class="w-full flex justify-center mb-8">
            <button id="homeButton" class="focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
                <img src="/assets/logo.gif" alt="Game Logo" class="w-full max-w-sm md:max-w-5xl">
            </button>
        </div>

        <div class="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-7xl mx-auto min-h-0">
            
            <div class="col-span-1 flex flex-col space-y-4">
                <div class="w-full flex flex-col items-center">
                    <button data-collapsible="requests-container" class="collapsible-trigger relative w-full h-[75px] mb-2"><img src="${i18next.t('img.requests')}" class="w-full h-full object-contain"></button>
                    <div id="requests-container" class="w-full bg-black border-4 border-cyan-400 rounded-lg p-4 overflow-y-auto shadow-lg"></div>
                </div>

                <div class="w-full flex flex-col items-center">
                    <button data-collapsible="users-container" class="collapsible-trigger relative w-full h-[50px] mb-2"><img src="${i18next.t('img.users')}" class="w-full h-full object-contain"></button>
                    <div id="users-container" class="w-full bg-black border-4 border-cyan-400 rounded-lg p-4 overflow-y-auto shadow-lg hidden"></div>
                </div>
            </div>

            <div class="col-span-1 flex flex-col items-center">
                <button class="relative w-full h-[60px] mb-4"><img src="${i18next.t('img.friends')}" class="w-full h-full object-contain"></button>
                <div id="friends-container" class="w-full bg-black border-4 border-cyan-400 rounded-lg p-4 overflow-y-auto shadow-lg h-full"></div>
            </div>
            
            <div id="chat-column" class="col-span-1 w-full bg-black border-4 border-cyan-400 rounded-lg p-4 flex flex-col shadow-lg hidden h-full overflow-hidden">
                <h2 id="chat-with-username" class="text-2xl text-center text-white font-bold mb-4 truncate"></h2>
                <div id="chat-history" class="flex-grow overflow-y-auto mb-4 p-2 bg-gray-900 rounded"></div>
                <div class="flex flex-shrink-0">
                    <input id="chat-input" type="text" class="flex-grow bg-gray-700 p-2 rounded text-white">
                </div>
            </div>
        </div>
    </div>
    `;

    playTrack('/assets/Techno_Syndrome.mp3');
    document.getElementById('homeButton')?.addEventListener('click', () => navigate('/start'));

    const friendsContainer = document.getElementById('friends-container')!;
    const usersContainer = document.getElementById('users-container')!;
    const requestsContainer = document.getElementById('requests-container')!;
    const chatColumn = document.getElementById('chat-column')!;
    const chatWithUsername = document.getElementById('chat-with-username')!;
    const chatHistory = document.getElementById('chat-history')!;
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;
    
    let currentChatUserId: number | null = null;
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    document.querySelectorAll('.collapsible-trigger').forEach(trigger => 
        trigger.addEventListener('click', () => 
            document.getElementById(trigger.getAttribute('data-collapsible')!)?.classList.toggle('hidden')
        )
    );

    function openChat(userId: number, username: string) {
        currentChatUserId = userId;
        chatWithUsername.textContent = username;
        chatColumn.classList.remove('hidden');
        loadChatHistory(userId);
    }

	async function loadChatHistory(withUserId: number) {
		try {
			const response = await authenticatedFetch(`/api/chat/private/${withUserId}`);
			const messages: Message[] = await response.json();
			
			const oddIdMessages = messages.filter(msg => msg.id % 2 !== 0); // Filtro para mostrar solo mensajes con ID impar
	
			chatHistory.innerHTML = '';
			
			oddIdMessages.filter(msg => !blockedUserIds.has(msg.sender_id)).forEach(msg => {
				const isCurrentUser = msg.sender_id === currentUser.id;
				const messageDiv = document.createElement('div');
				messageDiv.className = `p-2 my-1 rounded ${isCurrentUser ? 'bg-blue-800 text-right' : 'bg-gray-700 text-left'}`;
				messageDiv.innerHTML = `<p class="text-sm text-white">${msg.message}</p><span class="text-xs text-gray-400">${new Date(msg.timestamp).toLocaleTimeString()}</span>`;
				chatHistory.appendChild(messageDiv);
			});
	
			chatHistory.scrollTop = chatHistory.scrollHeight;
		} 
		catch (error) 
		{
			chatHistory.innerHTML = `<div class="text-red-500 p-2">Error al cargar historial.</div>`;
		}
	}
    
    async function sendMessage() {
        if (!currentChatUserId || !chatInput.value.trim()) return;
        try {
            await authenticatedFetch('/api/chat/private', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipientId: currentChatUserId, message: chatInput.value })
            });
            chatInput.value = '';
            loadChatHistory(currentChatUserId);
        } catch (error) { alert('Error al enviar mensaje.'); }
    }

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

	function handlePlayInvite(opponentId: string, opponentUsername: string) {
        localStorage.setItem('opponentId', opponentId);
        localStorage.setItem('opponentUsername', opponentUsername);
        localStorage.setItem('gameMode', 'TWO_PLAYERS');
        navigate('/pong');
    }
	
    function handleBlockToggle(userId: number) {
        if (blockedUserIds.has(userId)) {
            blockedUserIds.delete(userId);
        } else {
            blockedUserIds.add(userId);
        }
        loadFriends();
        if (currentChatUserId === userId) {
            loadChatHistory(userId);
        }
    }

    async function loadFriends() {
        try {
            const friends: User[] = await authenticatedFetch('/api/friends').then(res => res.json());
            friendsContainer.innerHTML = friends.length > 0 ? friends.map(friend => `
                <div class="flex flex-col items-center text-white p-2 hover:bg-gray-800 rounded-lg mb-2">
                    <span class="font-bold text-2xl truncate" style="max-width: 200px;">${friend.username}</span>
                    <div class="flex gap-2 mt-2">
                        <button class="chat-btn" data-user-id="${friend.id}" data-username="${friend.username}"><img src="${i18next.t('img.chat')}" class="h-8"></button>
                        <button class="play-btn" data-user-id="${friend.id}" data-username="${friend.username}"><img src="/assets/PvP.png" class="h-8"></button>
                        <button class="profile-btn" data-user-id="${friend.id}"><img src="${i18next.t('img.profile')}" class="h-8"></button>
                        <button class="block-toggle-btn p-1 rounded ${blockedUserIds.has(friend.id) ? 'bg-blue-600' : 'bg-transparent'}" data-user-id="${friend.id}">
                            <img src="${i18next.t('img.block')}" class="h-8">
                        </button>
                    </div>
                </div>`).join('') : `<div class="text-gray-400 text-center text-xl">${i18next.t('noFriends')}</div>`;
            attachFriendButtonListeners();
        } catch (error) {
            friendsContainer.innerHTML = `<div class="text-red-500 p-2">${(error as Error).message}</div>`;
        }
    }

    function attachFriendButtonListeners() {
        friendsContainer.querySelectorAll('.chat-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            openChat(parseInt(target.dataset.userId!), target.dataset.username!);
        }));
        friendsContainer.querySelectorAll('.play-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            handlePlayInvite(target.dataset.userId!, target.dataset.username!);
        }));
        friendsContainer.querySelectorAll('.profile-btn').forEach(btn => btn.addEventListener('click', (e) => {
            navigate(`/profile/${(e.currentTarget as HTMLElement).dataset.userId}`);
        }));
        friendsContainer.querySelectorAll('.block-toggle-btn').forEach(btn => btn.addEventListener('click', (e) => {
            handleBlockToggle(parseInt((e.currentTarget as HTMLElement).dataset.userId!));
        }));
    }

    async function loadFriendRequests() {
        try {
            const requests: FriendRequest[] = await authenticatedFetch('/api/friends/requests').then(res => res.json());
            requestsContainer.innerHTML = requests.length > 0 ? requests.map(req => `
                <div class="flex justify-between items-center text-white p-2 border-b border-gray-700">
                    <span class="truncate" style="max-width: 120px;">${req.username}</span>
                    <div class="flex gap-1">
                        <button class="request-action-btn" data-action="accept" data-id="${req.friendshipId}"><img src="${i18next.t('img.accept')}" class="h-6"></button>
                        <button class="request-action-btn" data-action="reject" data-id="${req.friendshipId}"><img src="${i18next.t('img.cancel')}" class="h-6"></button>
                    </div>
                </div>`).join('') : `<div class="text-gray-400 text-center">${i18next.t('noPendingRequests')}</div>`;
            requestsContainer.querySelectorAll('.request-action-btn').forEach(btn => btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                handleFriendRequest(target.dataset.id!, target.dataset.action as 'accept' | 'reject');
            }));
        } catch (error) {
            requestsContainer.innerHTML = `<div class="text-red-500 p-2">${i18next.t('errorLoading')}</div>`;
        }
    }

    async function handleFriendRequest(requestId: string, action: 'accept' | 'reject') {
        try {
            await authenticatedFetch(action === 'accept' ? `/api/friends/accept/${requestId}` : `/api/friends/${requestId}`, { method: action === 'accept' ? 'POST' : 'DELETE' });
            await Promise.all([loadFriends(), loadFriendRequests(), loadAllUsers()]);
        } catch (error) { alert(`Error: ${(error as Error).message}`); }
    }

    async function loadAllUsers() {
        try {
            const [users, friends, requests] = await Promise.all([
                authenticatedFetch('/api/users').then(res => res.json()),
                authenticatedFetch('/api/friends').then(res => res.json()),
                authenticatedFetch('/api/friends/requests').then(res => res.json())
            ]);
            const friendIds = new Set(friends.map((f: User) => f.id));
            const requestIds = new Set(requests.map((r: FriendRequest) => r.id));
            
            const otherUsers = users.filter((user: User) => 
                user.id !== currentUser.id && 
                !friendIds.has(user.id) && 
                !requestIds.has(user.id) &&
                !sentRequestIds.has(user.id)
            );

            usersContainer.innerHTML = otherUsers.map((user: User) => `
				<div class="flex justify-between items-center text-white p-2">
					<span class="text-xl truncate" style="max-width: 150px;">${user.username}</span>
                    <button class="add-friend-btn" data-user-id="${user.id}"><img src="${i18next.t('img.add')}" class="h-8"></button>
				</div>`).join('');
            usersContainer.querySelectorAll('.add-friend-btn').forEach(btn => btn.addEventListener('click', (e) => {
                sendFriendRequest(currentUser.id, parseInt((e.currentTarget as HTMLElement).dataset.userId!));
            }));
        } catch (error) {
            usersContainer.innerHTML = `<div class="text-red-500 p-2">${(error as Error).message}</div>`;
        }
    }

    async function sendFriendRequest(fromId: number, toId: number) {
        try {
            await authenticatedFetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ one_user_id: fromId, two_user_id: toId })
            });
            alert(i18next.t('friendRequestSent'));
            sentRequestIds.add(toId);
            loadAllUsers();
        } catch (error) { alert(`Error: ${(error as Error).message}`); }
    }

    loadFriends();
    loadFriendRequests();
    loadAllUsers();
}