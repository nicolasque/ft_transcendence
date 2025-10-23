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
	twofa_enabled: boolean;
	avatar_url?: string;
}

interface Match {
	id: number;
	palyer1: number;
	palyer2: number;
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


async function handleLogout() {
	try {
		await authenticatedFetch('/api/auth/logout', {
			method: 'POST',
		});
	}
	catch (error) {
		console.error("Error contacting server to log out:", (error as Error).message);
	}
	finally {
		localStorage.clear();
		navigate('/login');
	}
}

export async function renderProfile(appElement: HTMLElement): Promise<void> {
	if (!appElement) {
		return;
	}

	const storedUser: { id?: number } | null = JSON.parse(localStorage.getItem('user') || 'null');
	if (!storedUser?.id) {
		console.log("No user ID found in localStorage, redirecting to login.");
		navigate('/login');
		return;
	}
	const userId = storedUser.id;

	let user: User;

	try {
		console.log(`Fetching fresh data for user ID: ${userId}`);
		const userResponse = await authenticatedFetch(`/api/users/${userId}`);

		if (!userResponse.ok) {
			const errorData = await userResponse.json();
			console.error(`Failed to fetch user data (Status: ${userResponse.status}):`, errorData);
			localStorage.clear();
			navigate('/login');
			return;
		}

		user = await userResponse.json();
		console.log("Fresh user data received:", user);

		localStorage.setItem('user', JSON.stringify(user));

	} catch (error) {
		console.error("Network or parsing error fetching user data:", (error as Error).message);
		localStorage.clear();
		navigate('/login');
		return;
	}

	const stats: Stats = { played: 0, victories: 0, defeats: 0, draws: 0 };
	let history: Match[] = [];
	try {
		const historyResponse = await authenticatedFetch(`/api/match/getall?user_id=${user.id}`);
		if (!historyResponse.ok) {
			throw new Error('Failed to fetch match history');
		}
		const allMatches: Match[] = await historyResponse.json();
		history = allMatches.filter(match => match.match_status === 'finish');

		stats.played = history.length;
		stats.victories = history.filter(match => {
			if (match.player_one_points === match.player_two_points) return false;
			const isPlayerOne = match.palyer1 === user.id;
			return isPlayerOne ? match.player_one_points > match.player_two_points : match.player_two_points > match.player_one_points;
		}).length;
		stats.draws = history.filter(match => match.player_one_points === match.player_two_points).length; // Contar empates
		stats.defeats = stats.played - stats.victories - stats.draws; // Ajustar derrotas

	} catch (error) {
		console.error("Failed to load match history and stats:", (error as Error).message);
		stats.played = 0;
		stats.victories = 0;
		stats.defeats = 0;
		stats.draws = 0;
	}

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
						<div class="relative mb-4">
							<img id="avatar-img" src="${user.avatar_url ? `${user.avatar_url}?t=${new Date().getTime()}` : `/assets/placeholder.png`}" alt="Avatar" class="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-cyan-400 object-cover onerror="this.onerror=null; this.src='/assets/placeholder.png';">
							<label for="avatar-upload" class="absolute bottom-0 right-0 bg-gray-900 p-2 rounded-full cursor-pointer hover:bg-cyan-500">
								✏️
							</label>
							<input type="file" id="avatar-upload" class="hidden" accept="image/*">
						</div>
						<div class="w-full">
							<label class="font-bold">${i18next.t('username')}</label>
							<input id="username-input" class="w-full bg-gray-700 p-2 rounded mt-1 mb-3 text-sm md:text-base" value="${user.username}">

							<label class="font-bold">${i18next.t('email')}</label>
							<input id="email-input" class="w-full bg-gray-700 p-2 rounded mt-1 mb-3 text-sm md:text-base" value="${user.email}">

							<p class="text-base md:text-lg"><span class="font-bold">ELO:</span> <span class="text-cyan-300 font-bold">${user.elo}</span></p>

							<button id="save-profile-btn" class="relative w-full h-[75px] cursor-pointer transform hover:scale-125 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg mt-4">
								<img src="${i18next.t('img.accept')}" alt="${i18next.t('accept')}" class="absolute inset-0 w-full h-full object-contain drop-shadow-lg hover:drop-shadow-xl">
							</button>
						</div>
					</div>
				</div>

				<div class="bg-gray-800 bg-opacity-75 p-6 rounded-lg border-2 border-cyan-400 shadow-lg">
					<h3 class="text-xl md:text-2xl font-bold mb-4">${i18next.t('security')}</h3>
					<div id="2fa-section"></div>
				</div>

				<div class="bg-gray-800 bg-opacity-75 p-6 rounded-lg border-2 border-cyan-400 shadow-lg">
					<button id="logout-btn" class="relative w-full h-[75px] cursor-pointer transform hover:scale-125 transition-transform duration-200">
						<img src="${i18next.t('img.logOut')}" alt="${i18next.t('logOut')}" class="absolute inset-0 w-full h-full object-contain drop-shadow-lg hover:drop-shadow-xl">
					</button>
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
		const isPlayerOne = match.palyer1 === user.id;
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
							</div>
						`}).join('') : `<p class="text-center text-gray-400">${i18next.t('noMatchHistory')}</p>`}
					</div>
				</div>
			</div>
		</div>
	</div>

	<div id="2fa-modal" class="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center hidden z-50 p-4">
		<div id="2fa-modal-content" class="bg-gray-900 p-6 md:p-8 rounded-lg border-4 border-cyan-500 shadow-2xl text-center relative max-w-md w-full">
		</div>
	</div>
	`;

	playTrack('/assets/Techno_Syndrome.mp3');
	document.getElementById('homeButton')?.addEventListener('click', () => navigate('/start'));
	document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
	setupProfileEditing(user);
	setupAvatarUpload(user);
	setup2FA(user);
}

async function setupProfileEditing(user: User) {
	document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
		const usernameInput = document.getElementById('username-input') as HTMLInputElement;
		const emailInput = document.getElementById('email-input') as HTMLInputElement;

		const updatedData: Partial<User> = {};
		if (usernameInput.value !== user.username) updatedData.username = usernameInput.value;
		if (emailInput.value !== user.email) updatedData.email = emailInput.value;

		if (Object.keys(updatedData).length === 0) {
			alert(i18next.t('noChanges'));
			return;
		}

		try {
			const response = await authenticatedFetch(`/api/users/${user.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updatedData),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || i18next.t('errorUpdatingProfile'));
			}

			const updatedUser = await response.json();
			localStorage.setItem('user', JSON.stringify(updatedUser));
			alert(i18next.t('profileUpdated'));
			location.reload(); // Recarga para ver cambios
		}
		catch (error) {
			alert(`Error: ${(error as Error).message}`);
		}
	});
}

function setupAvatarUpload(user: User) {
	const uploadInput = document.getElementById('avatar-upload') as HTMLInputElement;
	const avatarImg = document.getElementById('avatar-img') as HTMLImageElement;

	uploadInput.addEventListener('change', async () => {
		const file = uploadInput.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			avatarImg.src = reader.result as string;
		};
		reader.readAsDataURL(file);

		const formData = new FormData();
		formData.append('avatar', file);

		try {
			const response = await authenticatedFetch('/api/users/avatar', { // Asegúrate que esta es la ruta correcta
				method: 'POST',
				body: formData, // No necesitas 'Content-Type', fetch lo deduce para FormData
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || result.error || 'Error al subir el avatar.');
			}

			const updatedUser = { ...user, avatar_url: result.avatarUrl };
			localStorage.setItem('user', JSON.stringify(updatedUser));
			avatarImg.src = `${result.avatarUrl}?t=${new Date().getTime()}`; // Añadir timestamp para evitar caché
			alert(i18next.t('profileUpdated'));

		} catch (error) {
			console.error('Error al subir avatar:', error);
			alert(`Error: ${(error as Error).message}`);
			avatarImg.src = user.avatar_url ? `${user.avatar_url}?t=${new Date().getTime()}` : `/assets/placeholder.png`;
		}
	});
}

function setup2FA(user: User) {
	const twoFASection = document.getElementById('2fa-section')!;

	const update2FAStatus = () => {
		const currentUser: User = JSON.parse(localStorage.getItem('user') || '{}');
		if (currentUser.twofa_enabled) {
			twoFASection.innerHTML = `
				<p class="text-green-400 mb-2">✔️ ${i18next.t('2faActive')}</p>
				<button id="disable-2fa-btn" class="w-full bg-red-600 hover:bg-red-700 py-2 rounded font-bold">${i18next.t('disable2FA')}</button>
			`;
			document.getElementById('disable-2fa-btn')?.addEventListener('click', showDisable2FAModal);
		}
		else {
			twoFASection.innerHTML = `
				<p class="text-yellow-400 mb-2">⚠️ ${i18next.t('2faInactive')}</p>
				<button id="enable-2fa-btn" class="relative w-full h-[75px] cursor-pointer transform hover:scale-125 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
					<img src="${i18next.t('img.activate2FA')}" alt="${i18next.t('activate2FA')}" class="absolute inset-0 w-full h-full object-contain">
				</button>
			`;
			document.getElementById('enable-2fa-btn')?.addEventListener('click', handleSetup2FA);
		}
	};

	update2FAStatus();
}

async function handleSetup2FA() {
	try {
		const response = await authenticatedFetch('/api/auth/2fa/setup', { method: 'POST' });
		if (!response.ok) throw new Error(i18next.t('errorStarting2fa'));

		const data = await response.json();
		showEnable2FAModal(data.qr_code);

	}
	catch (error) {
		alert(`Error: ${(error as Error).message}`);
	}
}

function showEnable2FAModal(qrCode: string) {
	const modal = document.getElementById('2fa-modal')!;
	const modalContent = document.getElementById('2fa-modal-content')!;

	modalContent.innerHTML = `
		<h3 class="text-2xl font-bold mb-4">${i18next.t('activate2FA')}</h3>
		<p class="mb-4">${i18next.t('scanQr')}</p>
		<img src="${qrCode}" alt="QR Code" class="mx-auto border-4 border-white rounded-lg mb-4">
		<p class="mb-2">${i18next.t('enter6DigitCodeToVerify')}</p>
		<input id="2fa-code-input" class="w-full bg-gray-700 p-2 rounded text-center text-2xl tracking-[0.5em]" placeholder="000000" maxlength="6">
		<div class="flex gap-4 mt-4">
			<button id="verify-2fa-btn" class="w-full bg-cyan-600 hover:bg-cyan-700 py-2 rounded font-bold">${i18next.t('verify')}</button>
			<button id="cancel-2fa-btn" class="w-full bg-gray-600 hover:bg-gray-700 py-2 rounded font-bold">${i18next.t('cancel')}</button>
		</div>
	`;
	modal.classList.remove('hidden');

	document.getElementById('cancel-2fa-btn')?.addEventListener('click', () => modal.classList.add('hidden'));
	document.getElementById('verify-2fa-btn')?.addEventListener('click', async () => {
		const code = (document.getElementById('2fa-code-input') as HTMLInputElement).value;
		if (!/^\d{6}$/.test(code)) return alert(i18next.t('enterValid6DigitCode')); // Validar que sean 6 dígitos

		try {
			const response = await authenticatedFetch('/api/auth/2fa/enable', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ code }),
			});

			const data = await response.json(); // Leer respuesta siempre

			if (!response.ok) throw new Error(data.message || i18next.t('incorrectVerificationCode'));
			alert(i18next.t('2faEnabledSuccess'));

			const user: User | null = JSON.parse(localStorage.getItem('user') || 'null');
			if (user) {
				user.twofa_enabled = true;
				localStorage.setItem('user', JSON.stringify(user));
			}
			modal.classList.add('hidden');
			setup2FA(user!); // Llamar setup2FA para refrescar la sección en la página principal
		}
		catch (error) {
			alert(`Error: ${(error as Error).message}`);
		}
	});
}

function showDisable2FAModal() {
	const modal = document.getElementById('2fa-modal')!;
	const modalContent = document.getElementById('2fa-modal-content')!;

	modalContent.innerHTML = `
		<h3 class="text-white text-2xl font-bold mb-4">${i18next.t('disable2FA')}</h3>
		<p class="text-white mb-4">${i18next.t('confirm2faDisable')}</p>

		<label class="text-white">${i18next.t('password')}</label>
		<input id="password-input" type="password" class="w-full bg-gray-700 p-2 rounded mt-1 mb-3">

		<label class="text-white">2FA Code</label>
		<input id="2fa-code-input" class="w-full bg-gray-700 p-2 rounded text-center text-2xl tracking-[0.5em] mt-1" placeholder="000000" maxlength="6">

		<div class="flex gap-4 mt-4">
			<button id="confirm-disable-btn" class="w-full bg-red-600 hover:bg-red-700 py-2 rounded font-bold">${i18next.t('disable2FA')}</button>
			<button id="cancel-disable-btn" class="w-full bg-gray-600 hover:bg-gray-700 py-2 rounded font-bold">${i18next.t('cancel')}</button>
		</div>
	`;
	modal.classList.remove('hidden');

	document.getElementById('cancel-disable-btn')?.addEventListener('click', () => modal.classList.add('hidden'));
	document.getElementById('confirm-disable-btn')?.addEventListener('click', async () => {
		const password = (document.getElementById('password-input') as HTMLInputElement).value;
		const code = (document.getElementById('2fa-code-input') as HTMLInputElement).value;

		if (!password || !/^\d{6}$/.test(code)) return alert(i18next.t('fillBothFields')); // Validar código también

		try {
			const response = await authenticatedFetch('/api/auth/2fa/disable', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ password, code }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.message || i18next.t('errorDisabling2fa'));

			alert(i18next.t('2faDisabledSuccess'));
			modal.classList.add('hidden');
			localStorage.clear();
			navigate('/login');
		}
		catch (error) {
			alert(`Error: ${(error as Error).message}`);
		}
	});
}