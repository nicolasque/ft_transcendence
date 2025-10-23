export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PongMap = 'classic' | 'obstacles_center' | 'tunnel';

export interface MapConfig {
  obstacles: Obstacle[];
  // Puedes añadir más propiedades aquí si quieres (ej: backgroundColor: string)
}

export interface ParticipantInfo {
    id: number;
    username: string;
    displayName: string;
    is_guest?: boolean;
}
export const PONG_MAPS: Record<string, MapConfig> = {
  classic: {
    obstacles: []
  },
  obstacles_center: {
    obstacles: [
      { x: 550, y: 150, width: 100, height: 100 },
      { x: 550, y: 650, width: 100, height: 100 }
    ]
  },
  retro_wave: {
    obstacles: []
  }
};

export interface GameObjects {
    ball: BallObject;
    player1: PaddleObject;
    player2: PaddleObject;
    player3: PaddleObject;
    player4: PaddleObject;
}

export interface Score {
    p1: number;
    p2: number;
    p3?: number;
    p4?: number;
}

export type GameMode = 'ONE_PLAYER' | 'TWO_PLAYERS' | 'FOUR_PLAYERS';

export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD' | 'IMPOSSIBLE';

export interface DifficultyConfig {
    name: string;
    speedMultiplier: number;
}

export interface PaddleObject {
    x: number;
    y: number;
    width: number;
    height: number;
    isAlive: boolean;
}

export interface BallObject {
    x: number;
    y: number;
    dx: number;
    dy: number;
}

export interface Score {
    p1: number;
    p2: number;
    p3?: number;
    p4?: number;
}

export type GameMode = 'ONE_PLAYER' | 'TWO_PLAYERS' | 'FOUR_PLAYERS';

export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD' | 'IMPOSSIBLE';

export interface DifficultyConfig {
    name: string;
    speedMultiplier: number;
}

export interface PaddleObject {
    x: number;
    y: number;
    width: number;
    height: number;
    isAlive: boolean;
}

export interface BallObject {
    x: number;
    y: number;
    dx: number;
    dy: number;
}