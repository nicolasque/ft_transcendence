import { navigate } from '../main';
import { playTrack } from '../utils/musicPlayer';
import { authenticatedFetch } from '../utils/auth';
import i18next from '../utils/i18n';

let gameType: 'pong' | 'tictactoe' = 'pong';

// --- Interfaz User (restauramos guestAlias) ---
interface User {
	id: number;
	username: string; // Este será el username real (e.g., guest1), no el alias
	email?: string;
	elo?: number;
	avatar_url?: string;
	is_guest?: boolean; // Flag de la BD
	isGuest?: boolean; // Flag frontend para tipo seleccionado
	guestAlias?: string; // Alias personalizado en el frontend
}

let participants: (User | null)[] = [];
let allFriends: User[] = [];
let availableGuests: User[] = [];

async function fetchFriends(): Promise<User[]> {
	try {
		const response = await authenticatedFetch('/api/friends');
		if (!response.ok) throw new Error(i18next.t('errorLoadingFriends'));
		return await response.json();
	} catch (error) {
		console.error("Error fetching friends:", error);
		alert((error as Error).message);
		return [];
	}
}

async function fetchGuests(): Promise<User[]> {
	try {
		const response = await authenticatedFetch('/api/users?is_guest=1');
		if (!response.ok) throw new Error(i18next.t('Error cargando invitados', { ns: 'translation', defaultValue: 'Error loading guests' }));
		const guests: User[] = await response.json();
		return guests.map(g => ({ ...g, is_guest: true }));
	} catch (error) {
		console.error("Error fetching guests:", error);
		alert((error as Error).message);
		return [];
	}
}

// --- Función actualizada para renderizar las cajas ---
function renderParticipantBoxes(count: number, container: HTMLElement, currentUser: User) {
	container.innerHTML = '';
	const initialParticipants: (User | null)[] = [{ ...currentUser, isGuest: false, is_guest: false }];
	for (let i = 1; i < count; i++) {
		initialParticipants.push(participants[i] || null);
	}
	participants = initialParticipants.slice(0, count);

	for (let i = 0; i < count; i++) {
		const participantBox = document.createElement('div');
		participantBox.className = 'participant-box bg-gray-800 p-4 rounded mb-2 border border-gray-700';
		participantBox.dataset.index = i.toString();
		let boxContent: string;

		if (i === 0) {
			// Caja para el usuario actual
			boxContent = `
                <p class="text-white font-bold text-lg">${currentUser.username} (${i18next.t('you')})</p>
                <input type="hidden" name="participant-${i}-id" value="${currentUser.id}">
                <input type="hidden" name="participant-${i}-type" value="user">
            `;
		} else {
			const currentParticipant = participants[i];
			const isGuestSelected = currentParticipant ? (currentParticipant.isGuest || currentParticipant.is_guest) : true;
			const selectedFriendId = (!isGuestSelected && currentParticipant) ? currentParticipant.id : '';
			// No necesitamos selectedGuestId aquí porque no hay <select>
			const guestAliasValue = isGuestSelected ? (currentParticipant?.guestAlias || '') : ''; // Recuperar alias si ya existe

			boxContent = `
                <label class="block text-lg font-medium text-gray-300 mb-2">${i18next.t('participant')} ${i + 1}:</label>
                <div class="flex items-center space-x-4 mb-3">
                    <label class="flex items-center text-white cursor-pointer">
                        <input type="radio" name="participant-${i}-type" value="friend" class="participant-type-radio mr-2" data-index="${i}" ${!isGuestSelected ? 'checked' : ''}> ${i18next.t('friend')}
                    </label>
                    <label class="flex items-center text-white cursor-pointer">
                        <input type="radio" name="participant-${i}-type" value="guest" class="participant-type-radio mr-2" data-index="${i}" ${isGuestSelected ? 'checked' : ''}> ${i18next.t('guest')}
                    </label>
                </div>

                <div id="friend-selector-${i}" class="${isGuestSelected ? 'hidden' : ''}">
                    <select name="participant-${i}-friend" class="participant-select-friend bg-gray-700 p-2 rounded text-white w-full mb-2" data-index="${i}">
                        <option value="">-- ${i18next.t('selectFriend')} --</option>
                        ${allFriends.map(friend => `<option value="${friend.id}" ${friend.id === selectedFriendId ? 'selected' : ''}>${friend.username}</option>`).join('')}
                    </select>
                </div>

                <div id="guest-alias-input-${i}" class="${!isGuestSelected ? 'hidden' : ''}">
                     <input type="text" value="${guestAliasValue}" name="participant-${i}-guest-alias" class="participant-input-guest-alias bg-gray-700 p-2 rounded text-white w-full" placeholder="${i18next.t('guestAliasFor')} ${i + 1}" data-index="${i}">
                     <p id="assigned-guest-info-${i}" class="text-xs text-gray-400 mt-1">
                        ${(isGuestSelected && currentParticipant) ? `(${i18next.t('assigned')}: ${currentParticipant.username})` : ''}
                     </p>
                </div>
            `;
		}

		participantBox.innerHTML = boxContent;
		container.appendChild(participantBox);

		if (i > 0) {
			participantBox.querySelectorAll(`.participant-type-radio`).forEach(radio => {
				radio.addEventListener('change', handleParticipantTypeChange);
			});
			participantBox.querySelector('.participant-select-friend')?.addEventListener('change', handleFriendSelectionChange);
			participantBox.querySelector('.participant-input-guest-alias')?.addEventListener('input', handleGuestAliasChange);
			participantBox.querySelector('.participant-input-guest-alias')?.addEventListener('change', handleGuestAliasChange); // Captura final
		}
	}
	console.log("Participantes al final de renderParticipantBoxes:", JSON.parse(JSON.stringify(participants)));
}

// --- Handlers modificados ---

function handleParticipantTypeChange(event: Event) {
	try {
		const target = event.target as HTMLInputElement;
		const index = parseInt(target.dataset.index || '0');
		if (index <= 0 || index >= participants.length) return;
		const isGuest = target.value === 'guest';
		const box = target.closest('.participant-box') as HTMLElement;
		const participantsContainer = document.getElementById('participants-container')!;
		const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

		console.log(`Caja ${index}: Cambiado tipo a ${isGuest ? 'Invitado' : 'Amigo'}`);

		// Manually toggle UI elements for instant feedback
		document.getElementById(`friend-selector-${index}`)?.classList.toggle('hidden', isGuest);
		document.getElementById(`guest-alias-input-${index}`)?.classList.toggle('hidden', !isGuest);

		if (isGuest) {
			const assignedGuestIds = new Set(
				participants
					.map((p, idx) => (p?.is_guest && idx !== index ? p.id : null))
					.filter(id => id !== null && id >= 0) as number[]
			);

			const nextAvailableGuest = availableGuests.find(guest => !assignedGuestIds.has(guest.id));

			if (nextAvailableGuest) {
				const aliasInput = box.querySelector('.participant-input-guest-alias') as HTMLInputElement;
				const currentAlias = aliasInput.value.trim() || `${i18next.t('guest')} ${index + 1}`;
				participants[index] = {
					...nextAvailableGuest,
					isGuest: true,
					is_guest: true,
					guestAlias: currentAlias
				};
			} else {
				alert(i18next.t('notEnoughGuests'));
				participants[index] = null;
			}
			renderParticipantBoxes(participants.length, participantsContainer, currentUser);

		} else { // Switching to Friend
			participants[index] = null;
		}

	} catch (error) {
		console.error("Error en handleParticipantTypeChange:", error);
	}
}

function handleFriendSelectionChange(event: Event) {
	try {
		const selectElement = event.target as HTMLSelectElement;
		const index = parseInt(selectElement.dataset.index || '0');
		if (index <= 0 || index >= participants.length) return;
		const selectedFriendId = parseInt(selectElement.value);
		const participantsContainer = document.getElementById('participants-container')!;
		const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

		console.log(`Caja ${index}: Amigo seleccionado ID: ${selectedFriendId || 'ninguno'}`);

		if (selectedFriendId) {
			const selectedFriend = allFriends.find(f => f.id === selectedFriendId);
			participants[index] = selectedFriend ? { ...selectedFriend, isGuest: false, is_guest: false } : null;
		} else {
			participants[index] = null;
		}
        
        renderParticipantBoxes(participants.length, participantsContainer, currentUser);

		console.log("Array completo tras selección amigo:", JSON.parse(JSON.stringify(participants)));


	} catch (error) {
		console.error("Error en handleFriendSelectionChange:", error);
	}
}


function handleGuestAliasChange(event: Event) {
	try {
		const inputElement = event.target as HTMLInputElement;
		const index = parseInt(inputElement.dataset.index || '0');
		if (index <= 0 || index >= participants.length) return;
		const alias = inputElement.value.trim();

		if (participants[index] && participants[index]?.is_guest) {
			participants[index]!.guestAlias = alias || `${i18next.t('guest')} ${index + 1}`; // Usar alias o default
			console.log(`Caja ${index}: Alias para guest ID ${participants[index]?.id} actualizado a "${participants[index]!.guestAlias}"`);
		} else {
			console.log(`Caja ${index}: Intento de actualizar alias, pero no hay guest asignado.`);
		}
	} catch (error) {
		console.error("Error en handleGuestAliasChange:", error);
	}
}


export async function renderTournament(appElement: HTMLElement): Promise<void> {
	if (!appElement) return;

	const currentUser: User | null = JSON.parse(localStorage.getItem('user') || 'null');
	if (!currentUser) {
		navigate('/login');
		return;
	}
	currentUser.isGuest = false;
	currentUser.is_guest = false;

	try {
		[allFriends, availableGuests] = await Promise.all([
			fetchFriends(),
			fetchGuests()
		]);
		console.log("Datos cargados:", { numFriends: allFriends.length, numGuests: availableGuests.length });
		if (availableGuests.length === 0) {
			console.warn("Advertencia: No se encontraron usuarios guest disponibles en la base de datos.");
			// Considera mostrar un mensaje al usuario aquí si es crítico
		}
	} catch (error) {
		console.error("Error crítico cargando datos iniciales:", error);
		appElement.innerHTML = `<div class="text-red-500 p-4">${(error as Error).message}. Por favor, recarga la página.</div>`;
		return;
	}

	const initialCountElement = document.getElementById('participant-count') as HTMLSelectElement | null;
	const initialCount = initialCountElement ? parseInt(initialCountElement.value) : 4;

	if (!Array.isArray(participants) || participants.length === 0 || !participants[0] || participants[0].id !== currentUser.id) {
		participants = new Array(initialCount).fill(null);
		participants[0] = { ...currentUser, isGuest: false, is_guest: false };

		// Pre-populate with guests
		const assignedGuestIds = new Set<number>();
		for (let i = 1; i < initialCount; i++) {
			const nextAvailableGuest = availableGuests.find(guest => !assignedGuestIds.has(guest.id));
			if (nextAvailableGuest) {
				participants[i] = {
					...nextAvailableGuest,
					isGuest: true,
					is_guest: true,
					guestAlias: `${i18next.t('guest')} ${i + 1}`
				};
				assignedGuestIds.add(nextAvailableGuest.id);
			}
		}
	} else {
		while (participants.length < initialCount) participants.push(null);
		if (participants.length > initialCount) participants.length = initialCount;
	}

	// --- HTML (igual que antes) ---
	appElement.innerHTML = `
    <div class="h-screen flex flex-col items-center p-4 md:p-8 overflow-y-auto font-press-start text-white">
        <div class="w-full flex justify-center mb-8 flex-shrink-0">
             <button id="homeButton" class="focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
                <img src="/assets/logo.gif" alt="Game Logo" class="w-full max-w-sm md:max-w-2xl">
            </button>
        </div>
        <form id="tournament-options-form" class="bg-gray-800 bg-opacity-75 p-6 rounded-lg border-2 border-cyan-400 shadow-lg mb-8 w-full max-w-lg flex-shrink-0">
            <div class="mb-4">
                <label for="tournament-name" class="block text-lg mb-2">${i18next.t('tournamentName')}:</label>
                <input type="text" id="tournament-name" name="tournament-name" class="w-full bg-gray-700 p-2 rounded text-white" placeholder="${i18next.t('egQuickTournament')}">
            </div>
            <div class="mb-4">
                <label for="participant-count" class="block text-lg mb-2">${i18next.t('numParticipants')}:</label>
                <select name="participant-count" id="participant-count" class="w-full bg-gray-700 p-2 rounded text-white">
                    <option value="4" ${initialCount === 4 ? 'selected' : ''}>4</option>
                    <option value="8" ${initialCount === 8 ? 'selected' : ''}>8</option>
                    <option value="16" ${initialCount === 16 ? 'selected' : ''}>16</option>
                </select>
            </div>
             <div class="mb-4">
                <label for="game-type" class="block text-lg mb-2">${i18next.t('game')}:</label>
                <select name="game-type" id="game-type" class="w-full bg-gray-700 p-2 rounded text-white">
                    <option value="pong">Pong</option>
                    <option value="tictactoe">Tic Tac Toe</option>
                </select>
            </div>
        </form>
        <div id="participants-container" class="w-full max-w-lg mb-8 flex-shrink-0">
            </div>
        <div class="mt-auto md:mt-8 flex-shrink-0 py-4">
            <button id="start-tournament-button" class="relative w-64 h-[60px] md:w-80 md:h-[75px] cursor-pointer transform hover:scale-110 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
                <img src="${i18next.t('img.accept')}" alt="${i18next.t('accept')}" class="absolute inset-0 w-full h-full object-contain">
            </button>
        </div>
    </div>
    `;

	// --- Listeners ---
	playTrack('/assets/Techno_Syndrome.mp3');
	document.getElementById('homeButton')?.addEventListener('click', () => navigate('/start'));

	const participantCountSelect = document.getElementById('participant-count') as HTMLSelectElement;
	const participantsContainer = document.getElementById('participants-container')!;
	const gameTypeSelect = document.getElementById('game-type') as HTMLSelectElement;
	const startTournamentButton = document.getElementById('start-tournament-button');

	gameType = gameTypeSelect.value as 'pong' | 'tictactoe';
	gameTypeSelect.addEventListener('change', () => {
		gameType = gameTypeSelect.value as 'pong' | 'tictactoe';
	});

	participantCountSelect.addEventListener('change', () => {
		const count = parseInt(participantCountSelect.value);
		while (participants.length < count) participants.push(null);
		if (participants.length > count) participants.length = count;
		renderParticipantBoxes(count, participantsContainer, currentUser);
	});

	renderParticipantBoxes(parseInt(participantCountSelect.value), participantsContainer, currentUser);

	startTournamentButton?.addEventListener('click', handleStartTournament);
}

async function handleStartTournament() {
	const tournamentNameInput = document.getElementById('tournament-name') as HTMLInputElement;
	const participantCountSelect = document.getElementById('participant-count') as HTMLSelectElement;
	const name = tournamentNameInput.value.trim() || `${i18next.t('quickTournament')}`;
	const selectedCount = parseInt(participantCountSelect.value);

	const finalParticipantIds: number[] = [];
	const guestAliasMap: { [key: number]: string } = {};

	console.log("Estado de 'participants' antes de enviar:", JSON.parse(JSON.stringify(participants)));

	for (let i = 0; i < selectedCount; i++) {
		const participant = participants[i];
		if (!participant || participant.id == null || participant.id < 0) {
			alert(`${i18next.t('completeSelectionFor')} ${i + 1}.`);
			return;
		}
		finalParticipantIds.push(participant.id);
		if (participant.is_guest) {
			guestAliasMap[participant.id] = participant.guestAlias || participant.username;
		}
	}
	if (new Set(finalParticipantIds).size !== finalParticipantIds.length) {
		alert(`${i18next.t('noDuplicateParticipants')}`);
		return;
	}
	if (finalParticipantIds.length !== selectedCount) {
		alert(`${i18next.t('errorExpectedParticipants', { count: selectedCount, processed: finalParticipantIds.length })}`);
		return;
	}


	console.log("Iniciando torneo:", name, gameType);
	console.log("IDs Finales (incluye guests):", finalParticipantIds);
	console.log("Mapa de Alias Invitados:", guestAliasMap);
	console.log("Total Participantes:", selectedCount);

	// --- Petición al Backend (CON guestAliasMap) ---
	try {
		const response = await authenticatedFetch('/api/tournaments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: name,
				game: gameType,
				participants: finalParticipantIds,
				totalParticipants: selectedCount,
				guestAliasMap: guestAliasMap
			}),
		});
		const result = await response.json();
		if (!response.ok) {
			let errorMsg = result.message || i18next.t('errorCreatingTournament');
			// ... (manejo de errores específicos)
			if (response.status === 400 && errorMsg?.includes("potencia de 2")) {
				errorMsg = i18next.t('El número de participantes debe ser una potencia de 2 (4, 8, 16...).');
			} else if (response.status === 400 && errorMsg?.includes("participantes insuficientes")) {
				errorMsg = i18next.t('Se requieren al menos 4 participantes.');
			} else if (response.status === 500 && errorMsg?.includes("invitados disponibles")) {
				errorMsg = i18next.t('No hay suficientes usuarios invitados disponibles en la base de datos para completar el torneo.');
			}
			throw new Error(errorMsg);
		}

		console.log("Torneo creado:", result);

		const tournamentId = result.tournament?.id; // Aún necesitamos el ID del torneo creado

		if (!tournamentId) {
			console.error("La respuesta del backend no incluyó el ID del torneo.");
			alert("Error al procesar la respuesta del servidor (faltan datos).");
			return;
		}


		const participantsForNextPage = finalParticipantIds.map(id => {
			const originalParticipant = participants.find(p => p?.id === id);

			let displayName = originalParticipant?.username || `Usuario ${id}`;
			let realUsername = originalParticipant?.username || `Usuario ${id}`;
			let isGuest = originalParticipant?.is_guest || false; // Default a no ser guest

			if (isGuest && guestAliasMap[id]) {
				displayName = guestAliasMap[id];
			} else if (isGuest) {
				displayName = originalParticipant?.username || `Guest ${id}`;
			}


			return {
				id: id,
				username: realUsername,
				displayName: displayName,
				is_guest: isGuest
			};
		});


		// Guardar en localStorage
		localStorage.setItem('currentTournamentId', tournamentId.toString());
		localStorage.setItem('currentTournamentParticipants', JSON.stringify(participantsForNextPage)); // Guardar nuestra lista construida
		localStorage.setItem('currentTournamentGame', gameType);
		localStorage.setItem('gameMode', 'TWO_PLAYERS');

		console.log("Datos guardados para la página de torneo:", {
			tournamentId,
			participants: participantsForNextPage,
			gameType
		});


		alert(i18next.t('tournamentCreatedSuccess', { name: name }));

		participants = [];
		allFriends = [];
		availableGuests = [];

		navigate(`/tournament-match/${tournamentId}`);
	} catch (error) {
		console.error("Error al iniciar el torneo:", error);
		alert(`${i18next.t('errorCreatingTournament')}: ${(error as Error).message}`);
	}
}