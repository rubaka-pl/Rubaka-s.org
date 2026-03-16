/**
 * =====================================================
 * Rubaka's.org — Main Script
 * Vite + TypeScript
 * =====================================================
 */

import { fetchGames } from './games';
import type { Game, GameSize } from './types';
import { initFilters } from './filters';
import { renderHeaderAuth } from './headerAuth';
import {
  syncCurrentUserDailyStreak,
  startCurrentUserGameSession,
  heartbeatCurrentUserGameSession,
  finishCurrentUserGameSession,
} from './userProgress';

document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector<HTMLElement>('header');
  const gameGrid = document.getElementById('game-grid') as HTMLDivElement | null;
  const gameListSection = document.getElementById('game-list-section') as HTMLElement | null;
  const gamePlayerSection = document.getElementById('game-player-section') as HTMLElement | null;
  const backButton = document.getElementById('back-button') as HTMLButtonElement | null;
  const currentGameTitle = document.getElementById('current-game-title') as HTMLHeadingElement | null;
  const currentGameInfo = document.getElementById('current-game-info') as HTMLDivElement | null;
  const iframeContainer = document.getElementById('iframe-container') as HTMLDivElement | null;
  const fullscreenButton = document.getElementById('fullscreen-btn') as HTMLButtonElement | null;
  const filterButtons = document.querySelectorAll<HTMLElement>('.filter-btn');

  if (
    !header ||
    !gameGrid ||
    !gameListSection ||
    !gamePlayerSection ||
    !backButton ||
    !currentGameTitle ||
    !currentGameInfo ||
    !iframeContainer ||
    !fullscreenButton
  ) {
    console.error('Required DOM elements were not found.');
    return;
  }

  let allGamesData: Game[] = [];
  let currentOpenedGame: Game | null = null;
  let currentSessionStartedAt: number | null = null;
  let currentSessionId: string | null = null;
  let heartbeatIntervalId: number | null = null;
  let isSessionFinishing = false;

  const HEARTBEAT_INTERVAL_MS = 10000;

  /**
   * -----------------------------------------------------
   * Show Grid Error
   * -----------------------------------------------------
   */
  const showGridError = (message: string): void => {
    gameGrid.innerHTML = `<div class="grid-error">${message}</div>`;
  };

  /**
   * -----------------------------------------------------
   * Header Interaction
   * -----------------------------------------------------
   */
  header.addEventListener('click', () => {
    if (!header.classList.contains('game-open')) {
      header.classList.toggle('active');
    }
  });

  gameGrid.addEventListener('click', () => {
    header.classList.remove('active');
  });

  /**
   * -----------------------------------------------------
   * Stop Heartbeat
   * -----------------------------------------------------
   */
  const stopHeartbeat = (): void => {
    if (heartbeatIntervalId !== null) {
      window.clearInterval(heartbeatIntervalId);
      heartbeatIntervalId = null;
    }
  };

  /**
   * -----------------------------------------------------
   * Start Heartbeat
   * -----------------------------------------------------
   */
  const startHeartbeat = (): void => {
    stopHeartbeat();

    heartbeatIntervalId = window.setInterval(() => {
      if (!currentSessionId || !currentSessionStartedAt || !currentOpenedGame) return;

      void heartbeatCurrentUserGameSession(
        currentSessionId,
        currentOpenedGame,
        currentSessionStartedAt
      );
    }, HEARTBEAT_INTERVAL_MS);
  };

  /**
   * -----------------------------------------------------
   * Build Game Grid
   * -----------------------------------------------------
   */
  const buildGameGrid = (games: Game[]): void => {
    gameGrid.innerHTML = '';

    games.forEach((game) => {
      const card = document.createElement('div');
      const sizeClass: GameSize = game.size ?? 'small';

      card.classList.add('game-card', sizeClass);

      card.innerHTML = `
        <div class="app-icon-image-wrapper">
          <img src="${game.thumbnail}" alt="${game.title}" loading="lazy" />
          <div class="card-overlay">
            <h3>${game.title}</h3>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        void openGame(game);
      });

      gameGrid.appendChild(card);
    });
  };

  /**
   * -----------------------------------------------------
   * Open Game From URL
   * -----------------------------------------------------
   */
  const openGameFromUrl = (): void => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('game');

    if (!slug) return;

    const matchedGame = allGamesData.find((game) => game.slug === slug);

    if (matchedGame) {
      void openGame(matchedGame);
    }
  };

  /**
   * -----------------------------------------------------
   * Load Games Data
   * -----------------------------------------------------
   */
  const loadGames = async (): Promise<void> => {
    try {
      const games = await fetchGames();
      allGamesData = games;
      buildGameGrid(games);
      openGameFromUrl();
    } catch (error) {
      console.error('Error loading games:', error);
      showGridError('Failed to load games.');
    }
  };

  /**
   * -----------------------------------------------------
   * Open Game
   * -----------------------------------------------------
   */
  const openGame = async (game: Game): Promise<void> => {
    currentOpenedGame = game;
    currentSessionStartedAt = Date.now();
    isSessionFinishing = false;

    currentGameTitle.textContent = game.title;

    iframeContainer.innerHTML = `
      <div id="close-fs" class="close-fullscreen">×</div>
      ${
        game.iframeUrl
          ? `
            <iframe
              src="${game.iframeUrl}"
              title="${game.title}"
              allowfullscreen
              loading="lazy"
            ></iframe>
          `
          : `
            <div class="game-frame-placeholder">
              <p>Game is unavailable right now.</p>
            </div>
          `
      }
    `;

    const closeFullscreenButton = document.getElementById('close-fs') as HTMLDivElement | null;

    if (closeFullscreenButton) {
      closeFullscreenButton.addEventListener('click', async () => {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      });
    }

    currentGameInfo.innerHTML = `
      <div style="padding-top:25px" class="game-meta-block">
        ${game.shortDescription ? `<p class="game-short-description">${game.shortDescription}</p>` : ''}
        
        <div class="game-meta">
          ${game.category ? `<p><strong>Category:</strong> ${game.category}</p>` : ''}
          ${game.developer ? `<p><strong>Developer:</strong> ${game.developer}</p>` : ''}
          ${game.gameVersion ? `<p><strong>Version:</strong> ${game.gameVersion}</p>` : ''}
          ${game.controlsDesktop ? `<p><strong>Controls:</strong> ${game.controlsDesktop}</p>` : ''}
          ${game.rating !== null ? `<p><strong>Rating:</strong> ${game.rating}</p>` : ''}
          <p><strong>Votes:</strong> ${game.votesCount}</p>
        </div>

        ${game.fullDescription ? `
          <div class="game-full-description">
            <h3 style="font-size: 2rem; padding-top: 25px; padding-bottom: 25px;">About this game</h3>
            <p>${game.fullDescription}</p>
          </div>
        ` : ''}
      </div>
    `;

    header.classList.add('game-open');
    header.classList.remove('active');
    gameListSection.classList.add('hidden');
    gamePlayerSection.classList.remove('hidden');

const nextUrl = `./index.html?game=${encodeURIComponent(game.slug)}`;
    window.history.replaceState({}, '', nextUrl);

    currentSessionId = await startCurrentUserGameSession(game, currentSessionStartedAt);

    if (!currentSessionId) {
      console.error('Session was not created.');
      return;
    }

    startHeartbeat();
  };

  /**
   * -----------------------------------------------------
   * Close Game
   * -----------------------------------------------------
   */
  const closeGame = async (): Promise<void> => {
    if (isSessionFinishing) return;
    isSessionFinishing = true;

    stopHeartbeat();

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }

    if (currentOpenedGame && currentSessionStartedAt && currentSessionId) {
      await finishCurrentUserGameSession(
        currentSessionId,
        currentOpenedGame,
        currentSessionStartedAt
      );
    }

    currentOpenedGame = null;
    currentSessionStartedAt = null;
    currentSessionId = null;
    isSessionFinishing = false;

    iframeContainer.innerHTML = '';
    currentGameInfo.innerHTML = '';

    header.classList.remove('game-open');
    gamePlayerSection.classList.add('hidden');
    gameListSection.classList.remove('hidden');

    window.history.replaceState({}, '', '/index.html');
  };

  backButton.addEventListener('click', () => {
    void closeGame();
  });

  /**
   * -----------------------------------------------------
   * Toggle Fullscreen
   * -----------------------------------------------------
   */
  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (!document.fullscreenElement) {
        await iframeContainer.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn('Fullscreen error:', error);
    }
  };

  fullscreenButton.addEventListener('click', () => {
    void toggleFullscreen();
  });

  document.addEventListener('fullscreenchange', () => {
    const closeFullscreenButton = document.getElementById('close-fs') as HTMLDivElement | null;

    if (closeFullscreenButton) {
      closeFullscreenButton.style.display = document.fullscreenElement ? 'block' : 'none';
    }
  });

  /**
   * -----------------------------------------------------
   * Visibility Change
   * -----------------------------------------------------
   * Когда вкладка уходит в hidden,
   * делаем быстрый heartbeat.
   * -----------------------------------------------------
   */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    if (!currentSessionId || !currentSessionStartedAt || !currentOpenedGame) return;

    void heartbeatCurrentUserGameSession(
      currentSessionId,
      currentOpenedGame,
      currentSessionStartedAt
    );
  });

  /**
   * -----------------------------------------------------
   * Save Session On Page Hide
   * -----------------------------------------------------
   */
  window.addEventListener('pagehide', () => {
    if (!currentOpenedGame || !currentSessionStartedAt || !currentSessionId) return;
    if (isSessionFinishing) return;

    stopHeartbeat();

    void finishCurrentUserGameSession(
      currentSessionId,
      currentOpenedGame,
      currentSessionStartedAt
    );
  });

  initFilters({
    filterButtons,
    getAllGamesData: () => allGamesData,
    buildGameGrid,
    header,
  });

  void syncCurrentUserDailyStreak();
  void renderHeaderAuth();
  void loadGames();
});