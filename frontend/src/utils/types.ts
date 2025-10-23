export interface Point {
  x: number;
  y: number;
}

export interface Obstacle {
  shape: 'rectangle' | 'rhombus' | 'circle'; // Added 'circle'
  x: number; // For circle: center X
  y: number; // For circle: center Y
  width?: number; // Optional for circle
  height?: number; // Optional for circle
  radius?: number; 
  vertices?: [Point, Point, Point, Point];
}

export type PongMap = 'classic' | 'obstacles_center' | 'tunnel';

export interface MapConfig {
  obstacles: Obstacle[];
}

const circleRadius = 50;

const centerObstacleX = 600;
const topObstacleY = 200;
const bottomObstacleY = 700;

export const PONG_MAPS: Record<string, MapConfig> = {
  classic: {
    obstacles: []
  },
  obstacles_center: {
    obstacles: [
      {
        shape: 'circle',
        x: centerObstacleX, // Center X
        y: topObstacleY,    // Center Y
        radius: circleRadius
      },
      {
        shape: 'circle',
        x: centerObstacleX, // Center X
        y: bottomObstacleY, // Center Y
        radius: circleRadius
      }
    ]
  },
  retro_wave: {
    obstacles: [] // Example map
  }
};

export interface ParticipantInfo {
    id: number;
    username: string;
    displayName: string;
    is_guest?: boolean;
}

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