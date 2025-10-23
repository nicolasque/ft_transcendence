import { navigate } from '../main';
import { playTrack } from '../utils/musicPlayer';
import { GameMode, DifficultyLevel } from '../utils/types';
import i18next from '../utils/i18n';

export function renderCharQP(appElement: HTMLElement): void {
	if (!appElement) return;

	appElement.innerHTML = `
	<div id="main-container" class="h-screen flex flex-col items-center justify-start md:justify-center p-4 md:p-8 relative overflow-y-auto">
		<div class="w-full flex justify-center mb-8">
			<button id="homeButton" class="focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
				<img src="/assets/logo.gif" alt="Game Logo" class="w-full max-w-sm md:max-w-2xl">
			</button>
		</div>
		<div class="flex flex-col items-center">
			<div class="bg-gray-800 bg-opacity-75 shadow-lg rounded-xl p-4 md:p-8 flex flex-col items-center space-y-6 mb-8 w-full max-w-2xl">
				<div id="mode-selection" class="flex flex-wrap justify-center items-center gap-4 md:gap-6">
					<button data-mode="ONE_PLAYER" class="mode-btn relative h-10 w-28 md:h-12 md:w-36 cursor-pointer transition-transform transform hover:scale-110 opacity-100 border-b-4 border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
						<img src="../assets/vs_IA.png" alt="${i18next.t('vsIA')}" class="absolute inset-0 w-full h-full object-contain">
					</button>
					<button data-mode="TWO_PLAYERS" class="mode-btn relative h-10 w-28 md:h-12 md:w-36 cursor-pointer transition-transform transform hover:scale-110 opacity-50 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
						<img src="${i18next.t('img.2players')}" alt="${i18next.t('2players')}" class="absolute inset-0 w-full h-full object-contain">
					</button>
					<button data-mode="FOUR_PLAYERS" class="mode-btn relative h-10 w-28 md:h-12 md:w-36 cursor-pointer transition-transform transform hover:scale-110 opacity-50 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
						<img src="${i18next.t('img.4players')}" alt="${i18next.t('4players')}" class="absolute inset-0 w-full h-full object-contain">
					</button>
				</div>

				<div id="options-container" class="flex flex-col items-center gap-4 md:gap-6 w-full">
					<div id="difficulty-buttons" class="flex flex-wrap justify-center items-center gap-4 md:gap-6">
						 <button data-difficulty="EASY" class="difficulty-btn relative h-8 w-24 md:h-10 md:w-32 cursor-pointer transition-transform transform hover:scale-110 opacity-50 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
							<img src="${i18next.t('img.easy')}" alt="${i18next.t('easy')}" class="absolute inset-0 w-full h-full object-contain">
						</button>
						<button data-difficulty="MEDIUM" class="difficulty-btn relative h-8 w-24 md:h-10 md:w-32 cursor-pointer transition-transform transform hover:scale-110 opacity-50 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
							<img src="${i18next.t('img.medium')}" alt="${i18next.t('medium')}" class="absolute inset-0 w-full h-full object-contain">
						</button>
						<button data-difficulty="HARD" class="difficulty-btn relative h-8 w-24 md:h-10 md:w-32 cursor-pointer transition-transform transform hover:scale-110 opacity-100 border-b-4 border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
							<img src="${i18next.t('img.hard')}" alt="${i18next.t('hard')}" class="absolute inset-0 w-full h-full object-contain">
						</button>
						<button data-difficulty="IMPOSSIBLE" class="difficulty-btn relative h-8 w-24 md:h-10 md:w-32 cursor-pointer transition-transform transform hover:scale-110 opacity-50 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
							<img src="${i18next.t('img.impossible')}" alt="${i18next.t('impossible')}" class="absolute inset-0 w-full h-full object-contain">
						</button>
					</div>
					<div id="map-selection" class="flex flex-wrap justify-center items-center gap-4 md:gap-6 mt-4">
						<button data-map="classic" class="map-btn relative h-8 w-32 md:h-10 md:w-40 cursor-pointer transition-transform transform hover:scale-110 opacity-100 border-b-4 border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
							<img src="${i18next.t('img.classic')}" alt="${i18next.t('classic')}" class="absolute inset-0 w-full h-full object-contain">
						</button>
						<button data-map="obstacles_center" class="map-btn relative h-8 w-32 md:h-10 md:w-40 cursor-pointer transition-transform transform hover:scale-110 opacity-50 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
							<img src="${i18next.t('img.obstacles')}" alt="${i18next.t('obstacles')}" class="absolute inset-0 w-full h-full object-contain">
						</button>
						<button data-map="custom" class="map-btn relative h-8 w-32 md:h-10 md:w-40 cursor-pointer transition-transform transform hover:scale-110 opacity-50 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
							<img src="${i18next.t('img.custom')}" alt="${i18next.t('custom')}" class="absolute inset-0 w-full h-full object-contain">
						</button>
					</div>
				</div>

				<div id="custom-options-container" class="hidden flex flex-col items-center gap-4 md:gap-6 mt-4 w-full max-w-md text-white">
					<div class="w-full flex justify-between items-center">
						<label class="mb-1">${i18next.t('ballSpeed')}:</label>
						<div class="flex items-center gap-2">
							<button class="custom-btn bg-red-600 px-3 py-1 rounded" data-setting="ball-speed" data-action="decrease">-</button>
							<span id="ball-speed-value" class="font-bold text-lg w-10 text-center">10</span>
							<button class="custom-btn bg-green-600 px-3 py-1 rounded" data-setting="ball-speed" data-action="increase">+</button>
						</div>
					</div>
					<div class="w-full flex justify-between items-center">
						<label class="mb-1">${i18next.t('paddleSpeed')}:</label>
						 <div class="flex items-center gap-2">
							<button class="custom-btn bg-red-600 px-3 py-1 rounded" data-setting="paddle-speed" data-action="decrease">-</button>
							<span id="paddle-speed-value" class="font-bold text-lg w-10 text-center">10</span>
							<button class="custom-btn bg-green-600 px-3 py-1 rounded" data-setting="paddle-speed" data-action="increase">+</button>
						</div>
					</div>
				   <div class="w-full flex justify-between items-center">
						<label class="mb-1">${i18next.t('ballSize')}:</label>
						 <div class="flex items-center gap-2">
							<button class="custom-btn bg-red-600 px-3 py-1 rounded" data-setting="ball-size" data-action="decrease">-</button>
							<span id="ball-size-value" class="font-bold text-lg w-10 text-center">10</span>
							<button class="custom-btn bg-green-600 px-3 py-1 rounded" data-setting="ball-size" data-action="increase">+</button>
						</div>
					</div>
					 <div class="w-full flex justify-between items-center">
						<label class="mb-1">${i18next.t('paddleLength')}:</label>
						 <div class="flex items-center gap-2">
							<button class="custom-btn bg-red-600 px-3 py-1 rounded" data-setting="paddle-size" data-action="decrease">-</button>
							<span id="paddle-size-value" class="font-bold text-lg w-12 text-center">120</span>
							<button class="custom-btn bg-green-600 px-3 py-1 rounded" data-setting="paddle-size" data-action="increase">+</button>
						</div>
					</div>
				</div>
			</div>
			<div class="bg-gray-800 bg-opacity-75 shadow-lg rounded-xl p-6 md:p-16 flex flex-col items-center mb-8">
				<img src="${i18next.t('img.chooseYourFighter')}" alt="${i18next.t('chooseYourFighter')}" class="w-full max-w-sm md:max-w-2xl mb-8 md:mb-12">
				<div id="character-selection" class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-12">
					<img src="/assets/char1_profile.png" alt="Character 1" class="character-portrait w-32 h-32 md:w-64 md:h-64 cursor-pointer border-4 border-white transform hover:scale-110 transition-all duration-200" data-char="1" tabindex="0">
					<img src="/assets/char2_profile.png" alt="Character 2" class="character-portrait w-32 h-32 md:w-64 md:h-64 cursor-pointer border-4 border-white transform hover:scale-110 transition-all duration-200" data-char="2" tabindex="0">
					<img src="/assets/char3_profile.png" alt="Character 3" class="character-portrait w-32 h-32 md:w-64 md:h-64 cursor-pointer border-4 border-white transform hover:scale-110 transition-all duration-200" data-char="3" tabindex="0">
					<img src="/assets/char4_profile.png" alt="Character 4" class="character-portrait w-32 h-32 md:w-64 md:h-64 cursor-pointer border-4 border-white transform hover:scale-110 transition-all duration-200" data-char="4" tabindex="0">
				</div>
			</div>

			<div id="accept-container">
				<button id="accept-button" class="relative w-64 h-[60px] md:w-80 md:h-[75px] cursor-pointer transform hover:scale-110 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
					<img src="${i18next.t('img.accept')}" alt="${i18next.t('accept')}" class="absolute inset-0 w-full h-full object-contain">
				</button>
			</div>
		</div>
	</div>
	`;

	playTrack('/assets/DangerZone.mp3');

	document.getElementById('homeButton')?.addEventListener('click', () => navigate('/start'));
	const acceptButton = document.getElementById('accept-button');
	const difficultyButtonsContainer = document.getElementById('difficulty-buttons')!;
	const mapSelectionContainer = document.getElementById('map-selection')!;
	const optionsContainer = document.getElementById('options-container')!;
	const characterPortraits = document.querySelectorAll('.character-portrait');
	const customOptionsContainer = document.getElementById('custom-options-container')!;

	let selectedPortrait: HTMLElement | null = null;
	let gameMode: GameMode = 'ONE_PLAYER';
	let difficulty: DifficultyLevel = 'HARD';
	let selectedMap: string = 'classic';

	const customSettings = {
		'ball-speed': { value: 10, min: 5, max: 25, step: 1, elementId: 'ball-speed-value' },
		'paddle-speed': { value: 10, min: 5, max: 20, step: 1, elementId: 'paddle-speed-value' },
		'ball-size': { value: 10, min: 5, max: 25, step: 1, elementId: 'ball-size-value' },
		'paddle-size': { value: 120, min: 50, max: 250, step: 10, elementId: 'paddle-size-value' },
	};

	function updateCustomValueDisplay(setting: string) {
		const span = document.getElementById(customSettings[setting].elementId);
		if (span) {
			span.textContent = customSettings[setting].value.toString();
		}
	}

	document.querySelectorAll('.custom-btn').forEach(button => {
		button.addEventListener('click', () => {
			const setting = button.getAttribute('data-setting');
			const action = button.getAttribute('data-action');
			if (setting && action && customSettings[setting]) {
				const config = customSettings[setting];
				if (action === 'increase') {
					config.value = Math.min(config.max, config.value + config.step);
				} else if (action === 'decrease') {
					config.value = Math.max(config.min, config.value - config.step);
				}
				updateCustomValueDisplay(setting);
			}
		});
	});

	Object.keys(customSettings).forEach(updateCustomValueDisplay);

	localStorage.setItem('gameMode', gameMode);
	localStorage.setItem('difficulty', difficulty);
	localStorage.setItem('selectedMap', selectedMap);

	function selectCharacter(portrait: HTMLElement) {
		if (selectedPortrait) {
			selectedPortrait.classList.remove('border-cyan-400', 'border-8');
			selectedPortrait.classList.add('border-white', 'border-4');
		}
		selectedPortrait = portrait;
		selectedPortrait.classList.remove('border-white', 'border-4');
		selectedPortrait.classList.add('border-cyan-400', 'border-8');
	}

	characterPortraits.forEach(portrait => {
		portrait.addEventListener('click', () => {
			selectCharacter(portrait as HTMLElement);
		});
		portrait.addEventListener('keydown', (event) => {
			if ((event as KeyboardEvent).key === 'Enter') {
				selectCharacter(portrait as HTMLElement);
			}
		});
	});

	acceptButton?.addEventListener('click', (event) => {
		event.stopPropagation();
		if (selectedPortrait) {
			localStorage.setItem('selectedCharacter', selectedPortrait.dataset.char || '1');

			if (selectedMap === 'custom') {
				 localStorage.setItem('custom_ballSpeed', customSettings['ball-speed'].value.toString());
				 localStorage.setItem('custom_paddleSpeed', customSettings['paddle-speed'].value.toString());
				 localStorage.setItem('custom_ballSize', customSettings['ball-size'].value.toString());
				 localStorage.setItem('custom_paddleLength', customSettings['paddle-size'].value.toString());
			} else {
				 localStorage.removeItem('custom_ballSpeed');
				 localStorage.removeItem('custom_paddleSpeed');
				 localStorage.removeItem('custom_ballSize');
				 localStorage.removeItem('custom_paddleLength');
			}

			localStorage.setItem('gameMode', gameMode);
			if (gameMode === 'ONE_PLAYER') {
				 localStorage.setItem('difficulty', difficulty);
			} else {
				 localStorage.removeItem('difficulty');
			}
			 localStorage.setItem('selectedMap', selectedMap);

			const nextRoute = localStorage.getItem('nextRoute') || '/pong';
			navigate(nextRoute);
		} else {
			alert(i18next.t('chooseCharacter'));
		}
	});

	appElement.querySelectorAll('.mode-btn').forEach(button => {
		button.addEventListener('click', () => {
			gameMode = button.getAttribute('data-mode') as GameMode;
			localStorage.setItem('gameMode', gameMode);

			 if (gameMode === 'ONE_PLAYER') {
				 optionsContainer.style.display = 'flex';
				 difficultyButtonsContainer.style.display = 'flex';
				 mapSelectionContainer.style.display = 'flex';
				 if(selectedMap === 'custom') customOptionsContainer.classList.remove('hidden');
				 else customOptionsContainer.classList.add('hidden');
			 } else if (gameMode === 'FOUR_PLAYERS') {
				 optionsContainer.style.display = 'none';
				 customOptionsContainer.classList.add('hidden');
				 selectedMap = 'classic';
				 localStorage.setItem('selectedMap', selectedMap);
				  appElement.querySelectorAll('.map-btn').forEach(btn => {
					  const isClassic = btn.getAttribute('data-map') === 'classic';
					  btn.classList.toggle('opacity-100', isClassic);
					  btn.classList.toggle('border-b-4', isClassic);
					  btn.classList.toggle('border-cyan-400', isClassic);
					  btn.classList.toggle('opacity-50', !isClassic);
				  });
			 } else {
				 optionsContainer.style.display = 'flex';
				 difficultyButtonsContainer.style.display = 'none';
				 mapSelectionContainer.style.display = 'flex';
				 if(selectedMap === 'custom') customOptionsContainer.classList.remove('hidden');
				 else customOptionsContainer.classList.add('hidden');
			 }

			appElement.querySelectorAll('.mode-btn').forEach(btn => {
				btn.classList.remove('opacity-100', 'border-b-4', 'border-cyan-400');
				btn.classList.add('opacity-50');
			});
			button.classList.add('opacity-100', 'border-b-4', 'border-cyan-400');
			button.classList.remove('opacity-50');
		});
	});

	appElement.querySelectorAll('.map-btn').forEach(button => {
		button.addEventListener('click', () => {
			selectedMap = button.getAttribute('data-map')!;
			localStorage.setItem('selectedMap', selectedMap);

			if (selectedMap === 'custom' && gameMode !== 'FOUR_PLAYERS') {
				customOptionsContainer.classList.remove('hidden');
			} else {
				customOptionsContainer.classList.add('hidden');
			}

			appElement.querySelectorAll('.map-btn').forEach(btn => {
				btn.classList.remove('opacity-100', 'border-b-4', 'border-cyan-400');
				btn.classList.add('opacity-50');
			});
		   button.classList.add('opacity-100', 'border-b-4', 'border-cyan-400');
		   button.classList.remove('opacity-50');
	   });
	});

	appElement.querySelectorAll('.difficulty-btn').forEach(button => {
		button.addEventListener('click', () => {
			difficulty = button.getAttribute('data-difficulty') as DifficultyLevel;
			localStorage.setItem('difficulty', difficulty);
			appElement.querySelectorAll('.difficulty-btn').forEach(btn => {
				btn.classList.remove('opacity-100', 'border-b-4', 'border-cyan-400');
				btn.classList.add('opacity-50');
			});
			button.classList.add('opacity-100', 'border-b-4', 'border-cyan-400');
			button.classList.remove('opacity-50');
		});
	});

	if (gameMode === 'ONE_PLAYER') {
		optionsContainer.style.display = 'flex';
		difficultyButtonsContainer.style.display = 'flex';
		mapSelectionContainer.style.display = 'flex';
		if(selectedMap === 'custom') customOptionsContainer.classList.remove('hidden');
		else customOptionsContainer.classList.add('hidden');
	} else if (gameMode === 'FOUR_PLAYERS') {
		 optionsContainer.style.display = 'none';
		 customOptionsContainer.classList.add('hidden');
	} else {
		 optionsContainer.style.display = 'flex';
		 difficultyButtonsContainer.style.display = 'none';
		 mapSelectionContainer.style.display = 'flex';
		 if(selectedMap === 'custom') customOptionsContainer.classList.remove('hidden');
		 else customOptionsContainer.classList.add('hidden');
	}
}