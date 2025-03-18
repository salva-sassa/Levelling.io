/**
 * AudioService.ts
 * Handles game audio including menu music and sound effects
 */

export class AudioService {
  private static instance: AudioService;
  private themeMusic: HTMLAudioElement | null = null;
  private gameMusic: HTMLAudioElement | null = null;
  private isMuted: boolean = false;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get the singleton instance of AudioService
   */
  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  /**
   * Load and play the menu theme music on loop
   */
  public playMenuTheme(): void {
    if (!this.themeMusic) {
      this.themeMusic = new Audio('/assets/sounds/theme_menu.mp3');
      this.themeMusic.loop = true;
      this.themeMusic.volume = 0.4;
      
      // Add error handling for missing audio file
      this.themeMusic.onerror = () => {
        console.error('Failed to load menu theme audio');
        this.themeMusic = null;
      };
    }

    // Stop game music if it's playing
    this.stopGameTheme();

    // Only play if not already playing
    if (this.themeMusic && (this.themeMusic.paused || this.themeMusic.ended)) {
      this.themeMusic.currentTime = 0;
      const playPromise = this.themeMusic.play();
      
      // Handle play() promise to avoid uncaught promise errors
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('Play was prevented:', error);
        });
      }
    }
  }

  /**
   * Stop playing the menu theme music
   */
  public stopMenuTheme(): void {
    if (this.themeMusic && !this.themeMusic.paused) {
      this.themeMusic.pause();
      this.themeMusic.currentTime = 0;
    }
  }
  
  /**
   * Load and play the game background music on loop
   * At a lower volume to not distract from gameplay
   */
  public playGameTheme(): void {
    if (!this.gameMusic) {
      this.gameMusic = new Audio('/assets/sounds/theme_game.mp3');
      this.gameMusic.loop = true;
      this.gameMusic.volume = 0.1; // Lower volume for background music during gameplay
      
      // Add error handling for missing audio file
      this.gameMusic.onerror = () => {
        console.error('Failed to load game theme audio');
        this.gameMusic = null;
      };
    }

    // Stop menu music if it's playing
    this.stopMenuTheme();

    // Only play if not already playing
    if (this.gameMusic && (this.gameMusic.paused || this.gameMusic.ended)) {
      this.gameMusic.currentTime = 0;
      const playPromise = this.gameMusic.play();
      
      // Handle play() promise to avoid uncaught promise errors
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('Play was prevented:', error);
        });
      }
    }
  }

  /**
   * Stop playing the game background music
   */
  public stopGameTheme(): void {
    if (this.gameMusic && !this.gameMusic.paused) {
      this.gameMusic.pause();
      this.gameMusic.currentTime = 0;
    }
  }

  /**
   * Toggle mute state for all audio
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    
    if (this.themeMusic) {
      this.themeMusic.muted = this.isMuted;
    }
    
    if (this.gameMusic) {
      this.gameMusic.muted = this.isMuted;
    }

    return this.isMuted;
  }

  /**
   * Set the volume for the theme music
   * @param volume Volume level between 0 and 1
   */
  public setThemeVolume(volume: number): void {
    if (this.themeMusic) {
      this.themeMusic.volume = Math.max(0, Math.min(1, volume));
    }
  }
  
  /**
   * Set the volume for the game music
   * @param volume Volume level between 0 and 1
   */
  public setGameVolume(volume: number): void {
    if (this.gameMusic) {
      this.gameMusic.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Check if audio is currently muted
   */
  public getMuteState(): boolean {
    return this.isMuted;
  }
}

export default AudioService.getInstance(); 