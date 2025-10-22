import { navigate } from '../main';
import { playTrack } from '../utils/musicPlayer';
import { authenticatedFetch } from '../utils/auth';
import i18next from '../utils/i18n';
import { PADDLE_SPEED_CLASSIC } from '../utils/constants';

interface Player {
    id: number;
    username: string;
    avatar_url?: string;
    isAI: boolean;
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD' | 'IMPOSSIBLE';
}

interface Match {
    player1: Player;
    player2: Player;
    winner: Player | null;
    played: boolean;
}

let tournamentState: {
    round: number;
    matches: Match[];
} | null = null;

let hasUnsavedChanges = true;

const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
};

export function renderMatchmaking(appElement: HTMLElement): void {
    if (!appElement) return;

    window.addEventListener('beforeunload', onBeforeUnload);

    if (!tournamentState) {
        initializeTournament();
    }

    appElement.innerHTML = `
    <div class="h-screen flex flex-col items-center p-4 text-white font-press-start overflow-y-auto">
        <div class="w-full flex justify-center mt-10 md:mt-20 mb-8">
            <button id="homeButton" class="focus:outline-none focus:ring-4 focus:ring-cyan-300 rounded-lg">
                <img src="/assets/logo.gif" alt="Game Logo" class="w-full max-w-sm md:max-w-5xl">
            </button>
        </div>

        <div class="w-full max-w-4xl flex gap-4">
            <div id="matchmaking-container" class="flex-grow bg-black border-4 border-cyan-400 rounded-lg p-4 overflow-y-auto shadow-lg space-y-4">
                ${renderMatches(tournamentState!.matches)}
            </div>
            <div class="flex-shrink-0">
                <button id="next-round-btn" class="relative w-48 h-16">
                    <img src="${i18next.t('img.nextRound')}" alt="${i18next.t('nextRound')}" class="w-full h-full object-contain">
                </button>
            </div>
        </div>
    </div>
    `;

    playTrack('/assets/Techno_Syndrome.mp3');
    setupEventListeners();
}

function setupEventListeners() {
    document.getElementById('homeButton')?.addEventListener('click', () => {
        if (confirm(i18next.t('confirmLeaveTournament'))) {
            hasUnsavedChanges = false;
            tournamentState = null; // Reiniciar torneo
            navigate('/start');
        }
    });

    document.querySelectorAll('.play-match-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const matchIndex = parseInt((e.currentTarget as HTMLElement).dataset.matchIndex!);
            const match = tournamentState!.matches[matchIndex];
            
            localStorage.setItem('pongMatchInfo', JSON.stringify({
                player1: match.player1,
                player2: match.player2,
                matchIndex: matchIndex
            }));
            
            hasUnsavedChanges = false;
            navigate('/pong-tournament');
        });
    });

    document.getElementById('next-round-btn')?.addEventListener('click', () => {
        const allHumanMatchesPlayed = tournamentState!.matches
            .filter(m => !m.player1.isAI || !m.player2.isAI)
            .every(m => m.played);

        if (!allHumanMatchesPlayed) {
            alert(i18next.t('matchesNotFinished'));
            return;
        }
        
        advanceToNextRound();
        renderMatchmaking(document.getElementById('app')!);
    });
}

function renderMatches(matches: Match[]): string {
    return matches.map((match, index) => `
        <div class="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
            ${!match.played && (!match.player1.isAI || !match.player2.isAI) ? `
                <button class="play-match-btn relative w-24 h-12 mr-4" data-match-index="${index}">
                    <img src="${i18next.t('img.play')}" alt="${i18next.t('play')}" class="w-full h-full object-contain">
                </button>
            ` : `<div class="w-24 mr-4"></div>`}
            
            <div class="flex-grow flex items-center justify-center gap-2">
                <img src="${match.player1.avatar_url || '/assets/placeholder.png'}" class="w-12 h-12 rounded-full border-2 ${match.winner && match.winner.id === match.player1.id ? 'border-green-500' : 'border-gray-500'}">
                <span class="truncate max-w-[100px]">${match.player1.username}</span>
                <img src="/assets/vs.png" class="w-8 h-8">
                <span class="truncate max-w-[100px]">${match.player2.username}</span>
                <img src="${match.player2.avatar_url || '/assets/IAphoto.png'}" class="w-12 h-12 rounded-full border-2 ${match.winner && match.winner.id === match.player2.id ? 'border-green-500' : 'border-gray-500'}">
            </div>

            <div class="w-24 ml-4 text-center">
                ${match.played ? `<strong>${match.winner?.username} ${i18next.t('wins')}</strong>` : ''}
            </div>
        </div>
    `).join('');
}


function initializeTournament() {
    const participants: Player[] = JSON.parse(localStorage.getItem('tournamentParticipants') || '[]');
    const tournamentSize = parseInt(localStorage.getItem('tournamentSize') || '4');

    const AIs: Player[] = [
        { id: -1, username: i18next.t('easy'), avatar_url: '/assets/IAphoto.png', isAI: true, difficulty: 'EASY' },
        { id: -2, username: i18next.t('medium'), avatar_url: '/assets/IAphoto.png', isAI: true, difficulty: 'MEDIUM' },
        { id: -3, username: i18next.t('hard'), avatar_url: '/assets/IAphoto.png', isAI: true, difficulty: 'HARD' },
        { id: -4, username: i18next.t('impossible'), avatar_url: '/assets/IAphoto.png', isAI: true, difficulty: 'IMPOSSIBLE' }
    ];

    while (participants.length < tournamentSize) {
        const aiToAdd = AIs[Math.floor(Math.random() * AIs.length)];
        participants.push({...aiToAdd, id: -participants.length -1}); // Ensure unique negative IDs
    }

    const humans = participants.filter(p => !p.isAI);
    const ais = participants.filter(p => p.isAI);

    let matches: Match[] = [];
    let shuffledHumans = [...humans].sort(() => Math.random() - 0.5);
    let shuffledAIs = [...ais].sort(() => Math.random() - 0.5);

    // Prioritize Human vs AI
    while (shuffledHumans.length > 0 && shuffledAIs.length > 0) {
        matches.push({
            player1: shuffledHumans.pop()!,
            player2: shuffledAIs.pop()!,
            winner: null,
            played: false
        });
    }
    
    // Pair remaining players (either all humans or all AIs)
    const remainingPlayers = [...shuffledHumans, ...shuffledAIs];
    while (remainingPlayers.length > 0) {
        matches.push({
            player1: remainingPlayers.pop()!,
            player2: remainingPlayers.pop()!,
            winner: null,
            played: false
        });
    }

    tournamentState = {
        round: 1,
        matches: matches
    };
}

function advanceToNextRound() {
    // Simulate AI vs AI matches
    tournamentState!.matches.forEach(match => {
        if (!match.played && match.player1.isAI && match.player2.isAI) {
            const difficultyOrder = ['EASY', 'MEDIUM', 'HARD', 'IMPOSSIBLE'];
            const p1Difficulty = difficultyOrder.indexOf(match.player1.difficulty!);
            const p2Difficulty = difficultyOrder.indexOf(match.player2.difficulty!);
            match.winner = p1Difficulty > p2Difficulty ? match.player1 : match.player2;
            match.played = true;
        }
    });

    const winners = tournamentState!.matches.map(m => m.winner).filter(Boolean) as Player[];

    if (winners.length === 1) {
        alert(`${i18next.t('tournamentWinner')}: ${winners[0].username}`);
        hasUnsavedChanges = false;
        tournamentState = null;
        navigate('/start');
        return;
    }

    let newMatches: Match[] = [];
    let shuffledWinners = [...winners].sort(() => Math.random() - 0.5);

    while (shuffledWinners.length > 0) {
        newMatches.push({
            player1: shuffledWinners.pop()!,
            player2: shuffledWinners.pop()!,
            winner: null,
            played: false
        });
    }

    tournamentState!.round++;
    tournamentState!.matches = newMatches;
}

export function updateMatchResult(matchIndex: number, winner: Player) {
    if (tournamentState && tournamentState.matches[matchIndex]) {
        tournamentState.matches[matchIndex].winner = winner;
        tournamentState.matches[matchIndex].played = true;
    }
}
