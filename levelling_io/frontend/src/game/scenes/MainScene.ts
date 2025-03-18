import Phaser from 'phaser';
import { Socket } from 'socket.io-client';

interface Player {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  nameText: Phaser.GameObjects.Text;
  color: number;
  name: string;
  energy: number;
  maxEnergy: number;
  velocity: { x: number, y: number }; // Add velocity to track player momentum
  score: number;
  isAlive: boolean;
}

interface PlayerState {
  name: string;
  position: { x: number, y: number };
  velocity: { x: number, y: number };
  color?: number;
  score: number;
  isAlive: boolean;
}

interface FarmObject {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  type: string;
  value: number;
}

interface Obstacle {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
}

// Constants for physics
const PLAYER_SPEED = 200;
const DASH_MULTIPLIER = 2.5;
const ENERGY_RECOVERY_RATE = 0.5;

export default class MainScene extends Phaser.Scene {
  private players: Map<string, Player> = new Map();
  private playersGroup!: Phaser.Physics.Arcade.Group;
  private boxes!: Phaser.Physics.Arcade.Group;
  private obstacles: Map<string, Obstacle> = new Map();
  private currentPlayer: Player | null = null;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private roomId: string;
  private socket: Socket;
  private playerName: string;
  private lastPosition = { x: 0, y: 0 };
  private mapBounds: { width: number; height: number } = { width: 2000, height: 1500 };
  private energyText!: Phaser.GameObjects.Text; // UI element for energy display
  private dashActive: boolean = false; // flag to track if a dash is currently active
  private onStateUpdate: (players: { [key: string]: PlayerState }) => void;
  
  // Shooting mechanics
  private bullets!: Phaser.Physics.Arcade.Group;
  private lastShot: number = 0;
  private shootKey!: Phaser.Input.Keyboard.Key;
  private shootCooldown: number = 300; // ms between shots
  
  // Farm objects
  private farmObjects: Map<string, FarmObject> = new Map();
  private farmObjectsGroup!: Phaser.Physics.Arcade.Group;

  constructor(
    roomId: string, 
    socket: Socket, 
    playerName: string,
    onStateUpdate: (players: { [key: string]: PlayerState }) => void
  ) {
    super('MainScene');
    this.roomId = roomId;
    this.socket = socket;
    this.playerName = playerName;
    this.onStateUpdate = onStateUpdate;
  }

  preload() {
    // Load assets from files - use consistent paths with leading slash
    this.load.image('player', '/assets/player.png');
    this.load.image('bullet', '/assets/bullet.png');
    this.load.image('crystal', '/assets/crystal.png');
    this.load.image('coin', '/assets/coin.png');
    this.load.image('gem', '/assets/gem.png');
    this.load.image('box', '/assets/obstacle.png');
    
    // Load sound effects
    this.load.audio('collect_coin', '/assets/sounds/coin.mp3');
    this.load.audio('collect_crystal', '/assets/sounds/crystal.mp3');
    this.load.audio('collect_gem', '/assets/sounds/gem.mp3');
    this.load.audio('kill', '/assets/sounds/kill.mp3');
    this.load.audio('shoot', '/assets/sounds/pop.mp3');
    this.load.audio('bullet_impact', '/assets/sounds/pop2.mp3');
    
    // Set up fallback textures in case image loading fails
    this.load.once('loaderror', () => {
      console.warn('Asset loading failed, using fallback graphics');
      this.createFallbackTextures();
    });
  }
  
  private createFallbackTextures() {
    // Create textures programmatically as fallback
    const graphics = this.add.graphics();
    
    // Create circular player texture
    graphics.clear();
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(16, 16, 16);
    graphics.generateTexture('player', 32, 32);
    graphics.clear();
    
    // Create box texture
    graphics.fillStyle(0xffffff);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture('box', 32, 32);
    
    // Create bullet texture
    graphics.clear();
    graphics.generateTexture('bullet', 28, 11);
    
    // Create farm object textures
    // Crystal
    graphics.clear();
    graphics.fillStyle(0x00ffff);
    graphics.fillRect(0, 0, 16, 24);
    graphics.generateTexture('crystal', 16, 24);
    
    // Coin
    graphics.clear();
    graphics.fillStyle(0xffcc00);
    graphics.fillCircle(8, 8, 8);
    graphics.generateTexture('coin', 43, 43);
    
    // Gem
    graphics.clear();
    graphics.fillStyle(0xff00ff);
    graphics.beginPath();
    graphics.moveTo(10, 0);
    graphics.lineTo(20, 15);
    graphics.lineTo(10, 30);
    graphics.lineTo(0, 15);
    graphics.closePath();
    graphics.fill();
    graphics.generateTexture('gem', 20, 30);
    
    graphics.destroy();
  }

  create() {
    // Draw a darker background and grid
    const graphics = this.add.graphics();
    graphics.fillStyle(0xE7ECEF);
    graphics.fillRect(0, 0, this.mapBounds.width, this.mapBounds.height);
    this.createGrid();

    // Make sure we have textures for everything
    this.generateMissingTextures();
    
    // Create a group for players to enable collisions
    this.playersGroup = this.physics.add.group({
      collideWorldBounds: true
    });

    // Create bullets group
    this.bullets = this.physics.add.group({
      defaultKey: 'bullet',
      maxSize: 20,
      visible: true,
      active: true
    });
    
    // Make sure bullet texture is properly loaded
    console.log('Available textures:', this.textures.getTextureKeys());
    
    // Create farm objects group
    this.farmObjectsGroup = this.physics.add.group();
    
    // Create obstacles group - will be populated from server data
    this.boxes = this.physics.add.group();
    
    // Set up world bounds
    this.physics.world.setBounds(0, 0, this.mapBounds.width, this.mapBounds.height);
    
    // Set up collisions
    this.setupCollisions();
    
    // Set up input with proper null checks
    if (this.input && this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.shootKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    }
    
    // Set up socket handlers for player management
    this.setupSocketHandlers();
    
    // Immediately update React state to ensure UI reflects initial state
    this.updateReactState();
  }

  createGrid() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333333, 0.8);
    
    // Draw vertical lines
    for (let x = 0; x < this.mapBounds.width; x += 100) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, this.mapBounds.height);
    }
    
    // Draw horizontal lines
    for (let y = 0; y < this.mapBounds.height; y += 100) {
      graphics.moveTo(0, y);
      graphics.lineTo(this.mapBounds.width, y);
    }
    
    graphics.strokePath();
  }

  update(time: number, delta: number) {
    // Skip update if no current player
    if (!this.currentPlayer) return;
    
    // Skip update if player is dead
    if (!this.currentPlayer.isAlive) return;
    
    // Handle player movement
    const speed = this.dashActive ? PLAYER_SPEED * DASH_MULTIPLIER : PLAYER_SPEED;
    let velocityX = 0;
    let velocityY = 0;
    
    // Check horizontal movement (left/right or A/D)
    if ((this.cursors && this.cursors.left.isDown) || this.keyA.isDown) {
      velocityX = -speed;
    } else if ((this.cursors && this.cursors.right.isDown) || this.keyD.isDown) {
      velocityX = speed;
    }
    
    // Check vertical movement (up/down or W/S)
    if ((this.cursors && this.cursors.up.isDown) || this.keyW.isDown) {
      velocityY = -speed;
    } else if ((this.cursors && this.cursors.down.isDown) || this.keyS.isDown) {
      velocityY = speed;
    }
    
    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      const normalizer = 1 / Math.sqrt(2);
      velocityX *= normalizer;
      velocityY *= normalizer;
    }
    
    // Apply velocity
    this.currentPlayer.sprite.setVelocity(velocityX, velocityY);
    this.currentPlayer.velocity = { x: velocityX, y: velocityY };
    
    // Handle dash cooldown and energy recovery
    if (!this.dashActive && this.currentPlayer.energy < this.currentPlayer.maxEnergy) {
      this.currentPlayer.energy = Math.min(
        this.currentPlayer.maxEnergy,
        this.currentPlayer.energy + ENERGY_RECOVERY_RATE * (delta / 16)
      );
      this.updateEnergyUI();
    }
    
    // Handle shooting with space key
    if (this.shootKey && this.shootKey.isDown && time > this.lastShot + this.shootCooldown) {
      this.shoot();
      this.lastShot = time;
    }
    
    // Update player name position
    this.updateNamePosition(this.currentPlayer);
    
    // Send position update to server if moved
    const position = {
      x: this.currentPlayer.sprite.x,
      y: this.currentPlayer.sprite.y
    };
    
    if (
      Math.abs(position.x - this.lastPosition.x) > 1 ||
      Math.abs(position.y - this.lastPosition.y) > 1
    ) {
      this.socket.emit('playerMove', {
        gameId: this.roomId,
        position,
        velocity: this.currentPlayer.velocity
      });
      this.lastPosition = position;
      this.updateReactState();
    }
  }

  private updateNamePosition(player: Player) {
    player.nameText.setPosition(player.sprite.x, player.sprite.y - 40);
  }

  private createPlayer(id: string, x: number, y: number, name: string, color: number, score: number = 0, isAlive: boolean = true) {
    // Create the player sprite
    const sprite = this.physics.add.sprite(x, y, 'player');
    
    // Only apply tint to enemy players
    const isLocalPlayer = id === this.socket.id;
    if (!isLocalPlayer) {
      // Apply a reddish tint to enemy players
      sprite.setTint(0xff6666); // Light red color for enemies
    } else {
      // Keep original color for local player if specified
      if (color) {
        sprite.setTint(color);
      }
    }
    
    // Set physics properties
    sprite.setCollideWorldBounds(true);
    sprite.setCircle(sprite.width / 2.5, sprite.width / 8, sprite.height / 8); // Adjust circle hitbox for better collision
    
    // Add player to physics group
    this.playersGroup.add(sprite);
    
    // Add player name above sprite with different color for local vs enemy
    const textColor = isLocalPlayer ? '#0000ff' : '#ff0000'; // Blue for local, red for enemies
    const nameText = this.add.text(x, y - 40, name, {
      fontSize: '18px',
      color: textColor,
      stroke: '#ffffff',
      strokeThickness: 3,
      fontStyle: isLocalPlayer ? 'bold' : 'normal'
    });
    nameText.setOrigin(0.5);
    
    // Initialize the player with full energy and other properties
    const player: Player = { 
      id, 
      sprite, 
      nameText, 
      color, 
      name, 
      energy: 100, 
      maxEnergy: 100, 
      velocity: { x: 0, y: 0 }, 
      score, 
      isAlive 
    };
    
    // Add to player collection and physics group
    this.players.set(id, player);
    
    // If this is the local player, set up camera and extra properties
    if (id === this.socket.id) {
      this.currentPlayer = player;
      this.cameras.main.startFollow(sprite);
      this.currentPlayer.sprite.setCollideWorldBounds(true);
      this.lastPosition = { x: this.currentPlayer.sprite.x, y: this.currentPlayer.sprite.y };
    }
    
    return player;
  }

  private createObstacle(id: string, x: number, y: number) {
    const sprite = this.physics.add.sprite(x, y, 'box');
    
    // Make obstacles larger by default
    sprite.setScale(1.5, 1.5);
    
    // Make the obstacle completely static and immovable
    sprite.setImmovable(true);
    sprite.body.moves = false;
    sprite.body.allowGravity = false;
    sprite.body.pushable = false;
    
    // Set appearance based on obstacle type
    if (id.includes('obstacle-L')) {
      // Make L-shaped obstacles larger and with a distinct color
      
      // Check which part of the L-shape this is
      if (id.includes('part') && id.includes('stem')) {
        // Vertical parts of the L
        sprite.setTint(0x8e44ad); // Purple for L stems
      } else {
        // Horizontal parts of the L
        sprite.setTint(0x9b59b6); // Lighter purple for L feet
      }
    } else if (id.includes('obstacle-center')) {
      // Central obstacles
      sprite.setTint(0xe74c3c); // Red for center pieces
      sprite.setScale(1.7, 1.7); // Slightly larger
    } else {
      // Any other obstacles
      sprite.setTint(0x3498db); // Default blue
    }
    
    // Add to the static physics group
    this.boxes.add(sprite);
    
    // Add to obstacles map
    const obstacle: Obstacle = {
      id,
      sprite
    };
    this.obstacles.set(id, obstacle);
    
    return obstacle;
  }

  private updateReactState() {
    const state: { [key: string]: PlayerState } = {};
    this.players.forEach((player, id) => {
      state[id] = {
        name: player.name,
        position: { x: player.sprite.x, y: player.sprite.y },
        velocity: player.velocity,
        color: player.color,
        score: player.score,
        isAlive: player.isAlive
      };
    });
    this.onStateUpdate(state);
  }

  private setupSocketHandlers() {
    // Join the game room once the scene is ready
    this.socket.emit('joinGame', { 
      gameId: this.roomId,
      name: this.playerName
    });

    // Handle obstacles update from server
    this.socket.on('obstaclesUpdate', (obstaclesData) => {
      console.log('Received obstacles from server:', obstaclesData);
      
      // Clear any existing obstacles
      this.obstacles.forEach(obstacle => {
        obstacle.sprite.destroy();
      });
      this.obstacles.clear();
      this.boxes.clear(true, true);
      
      // Create obstacles from server data
      obstaclesData.forEach((obstacleData: any) => {
        this.createObstacle(obstacleData.id, obstacleData.x, obstacleData.y);
      });
      
      // Connect L-shaped obstacles for better visualization
      this.connectLShapedObstacles(obstaclesData);
      
      // Set up all collisions
      this.setupCollisions();
    });

    // Handle initial current players
    this.socket.on('currentPlayers', (players) => {
      console.log('Received current players:', players);
      
      // Clear any existing players first
      this.players.forEach(player => {
        player.sprite.destroy();
        player.nameText.destroy();
      });
      this.players.clear();
      
      // Create all players including current player
      players.forEach((playerData: any) => {
        this.createPlayer(
          playerData.id,
          playerData.position.x,
          playerData.position.y,
          playerData.name,
          playerData.color,
          playerData.score,
          playerData.isAlive
        );
        
        // Set velocity if provided
        const player = this.players.get(playerData.id);
        if (player && playerData.velocity) {
          player.velocity = playerData.velocity;
          player.sprite.setVelocity(playerData.velocity.x, playerData.velocity.y);
        }
      });
      
      // Update React state with all players
      this.updateReactState();
    });
    
    // Handle new player joining
    this.socket.on('playerJoined', (data) => {
      if (!this.players.has(data.playerId)) {
        this.createPlayer(
          data.playerId,
          data.position?.x || 400,
          data.position?.y || 300,
          data.name,
          data.color,
          data.score,
          data.isAlive
        );
        this.updateReactState();
      }
    });
    
    // Handle player movement updates
    this.socket.on('playerMoved', (data) => {
      const player = this.players.get(data.playerId);
      if (player) {
        player.sprite.setPosition(data.position.x, data.position.y);
        
        if (data.velocity) {
          player.velocity = data.velocity;
          player.sprite.setVelocity(data.velocity.x, data.velocity.y);
        }
        this.updateNamePosition(player);
        this.updateReactState();
      }
    });
    
    // Handle player leaving
    this.socket.on('playerLeft', (data) => {
      const player = this.players.get(data.playerId);
      if (player) {
        player.sprite.destroy();
        player.nameText.destroy();
        this.players.delete(data.playerId);
        this.updateReactState();
      }
    });
    
    // Handle player shot
    this.socket.on('playerShot', (data) => {
      // Verify shooter exists in players map
      if (!data.playerId || !this.players.has(data.playerId)) {
        console.error('Received bullet from unknown player:', data.playerId);
        return;
      }
      
      const player = this.players.get(data.playerId);
      if (player) {
        console.log(`Creating remote bullet for player ${data.playerId}`);
        this.createBullet(
          data.position.x,
          data.position.y,
          data.direction.x,
          data.direction.y,
          data.playerId
        );
      }
    });
    
    // Handle player killed
    this.socket.on('playerKilled', (data) => {
      const target = this.players.get(data.targetId);
      const killer = this.players.get(data.killerId);
      
      if (target) {
        // Add kill effect at the target's position
        this.addKillEffect(target.sprite.x, target.sprite.y, data.pointsStolen || 0);
        
        target.isAlive = false;
        target.sprite.setAlpha(0.5);
        target.sprite.setVelocity(0, 0);
        
        // Update target score if provided
        if (data.targetScore !== undefined) {
          target.score = data.targetScore;
        }
      }
      
      if (killer) {
        // Update killer score
        killer.score = data.killerScore;
      }
      
      // Immediately update React state to reflect score changes
      this.updateReactState();
      
      // Show kill message
      if (target && killer) {
        this.showKillMessage(killer.name, target.name, data.pointsStolen || 0);
      }
    });
    
    // Handle player respawn
    this.socket.on('playerRespawned', (data) => {
      const player = this.players.get(data.playerId);
      if (player) {
        player.isAlive = true;
        player.sprite.setAlpha(1);
        player.sprite.setPosition(data.position.x, data.position.y);
        player.sprite.setVelocity(0, 0);
        this.updateReactState();
      }
    });
    
    // Handle farm objects update
    this.socket.on('farmObjectsUpdate', (objects) => {
      console.log('Received farm objects from server:', objects);
      
      // Clear existing farm objects
      this.farmObjects.forEach(obj => {
        obj.sprite.destroy();
      });
      this.farmObjects.clear();
      this.farmObjectsGroup.clear(true, true);
      
      // Create new farm objects
      objects.forEach((obj: any) => {
        this.createFarmObject(obj.id, obj.position.x, obj.position.y, obj.type, obj.value);
      });
      
      // Set up collisions with farm objects
      this.physics.add.collider(
        this.bullets, 
        this.farmObjectsGroup, 
        (bullet, farmObj) => this.handleBulletFarmObjectCollision(
          bullet as Phaser.GameObjects.GameObject, 
          farmObj as Phaser.GameObjects.GameObject
        ), 
        undefined, 
        this
      );
    });
    
    // Handle farm object destroyed
    this.socket.on('farmObjectDestroyed', (data) => {
      const farmObject = this.farmObjects.get(data.objectId);
      if (farmObject) {
        farmObject.sprite.destroy();
        this.farmObjects.delete(data.objectId);
      }
      
      // Update player score
      const player = this.players.get(data.playerId);
      if (player) {
        player.score = data.playerScore;
        this.updateReactState();
      }
    });
  }
  
  private shoot() {
    if (!this.currentPlayer || !this.currentPlayer.isAlive) return;
    
    console.log("Attempting to shoot with player:", {
      id: this.currentPlayer.id,
      position: { x: this.currentPlayer.sprite.x, y: this.currentPlayer.sprite.y },
      isAlive: this.currentPlayer.isAlive
    });
    
    // Get pointer position relative to camera
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    
    // Calculate direction vector from player to pointer
    const dirX = worldPoint.x - this.currentPlayer.sprite.x;
    const dirY = worldPoint.y - this.currentPlayer.sprite.y;
    
    // Normalize direction vector
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    const normalizedDirX = dirX / length;
    const normalizedDirY = dirY / length;
    
    console.log("Shooting direction:", { 
      from: { x: this.currentPlayer.sprite.x, y: this.currentPlayer.sprite.y },
      to: { x: worldPoint.x, y: worldPoint.y },
      normalized: { x: normalizedDirX, y: normalizedDirY } 
    });
    
    // Create bullet
    this.createBullet(
      this.currentPlayer.sprite.x,
      this.currentPlayer.sprite.y,
      normalizedDirX,
      normalizedDirY,
      this.currentPlayer.id
    );
    
    // Play shooting sound
    if (this.sound && this.sound.add) {
      try {
        const sound = this.sound.add("shoot", { volume: 0.2 });
        sound.play();
      } catch (e) {
        console.warn('Could not play shooting sound', e);
      }
    }
    
    // Calculate offset bullet position (same as in createBullet method)
    const spawnOffset = 25;
    const offsetX = this.currentPlayer.sprite.x + (normalizedDirX * spawnOffset);
    const offsetY = this.currentPlayer.sprite.y + (normalizedDirY * spawnOffset);
    
    // Emit shot event with offset bullet position
    this.socket.emit('playerShoot', {
      gameId: this.roomId,
      position: {
        x: offsetX,
        y: offsetY
      },
      direction: {
        x: normalizedDirX,
        y: normalizedDirY
      }
    });
    
    console.log("Shot fired!", {
      position: { x: this.currentPlayer.sprite.x, y: this.currentPlayer.sprite.y },
      direction: { x: normalizedDirX, y: normalizedDirY }
    });
  }
  
  private createBullet(x: number, y: number, dirX: number, dirY: number, playerId: string) {
    // Offset the bullet spawn position slightly in the direction of firing
    // This prevents the bullet from immediately colliding with the player who fired it
    const spawnOffset = 25; // pixels away from player center
    const spawnX = x + (dirX * spawnOffset);
    const spawnY = y + (dirY * spawnOffset);
    
    const bullet = this.bullets.get(spawnX, spawnY, 'bullet');
    if (bullet) {
      // Debug the bullet creation
      console.log('Creating bullet:', { x: spawnX, y: spawnY, dirX, dirY, playerId });
      
      // Store original shooter ID
      bullet.setData('playerId', playerId);
      
      // Ensure bullet is visible and active
      bullet.setActive(true);
      bullet.setVisible(true);
      
      
      // Make sure the bullet has a texture
      if (!bullet.texture || bullet.texture.key === '__MISSING') {
        console.warn('Bullet texture is missing, using fallback');
        // Create a small visible circle as fallback
        const graphics = this.add.graphics();
        graphics.fillStyle(0xff0000);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('bullet_fallback', 8, 8);
        graphics.destroy();
        bullet.setTexture('bullet_fallback');
      }
      
      // Set bullet scale (bigger to make it more visible)
      bullet.setScale(0.5);
      
      // Different tint based on whether it's the local player's bullet
      const isLocalPlayerBullet = playerId === this.socket.id;
      if (isLocalPlayerBullet) {
        // Blue color for local player's bullets
        bullet.setTint(0x00aaff);
      } else {
        // Red color for enemy bullets
        bullet.setTint(0xff0000);
      }
      
      // Set bullet velocity
      const bulletSpeed = 500;
      bullet.setVelocity(dirX * bulletSpeed, dirY * bulletSpeed);
      
      // Set bullet rotation to match direction
      bullet.setRotation(Math.atan2(dirY, dirX));
      
      // Remove the pipeline call which might be causing issues
      // bullet.setPipeline('Light2D');
      
      // Destroy bullet after 10 second
      this.time.delayedCall(10000, () => {
        bullet.setActive(false);
        bullet.setVisible(false);
      });
    } else {
      console.error('Failed to create bullet - no bullet object returned from group');
    }
  }
  
  private handleBulletPlayerCollision(bullet: Phaser.GameObjects.GameObject, playerObj: Phaser.GameObjects.GameObject) {
    const bulletObj = bullet as Phaser.Physics.Arcade.Sprite;
    const playerSprite = playerObj as Phaser.Physics.Arcade.Sprite;
    
    // Find player from sprite
    let targetPlayer: Player | undefined;
    let targetId: string = '';
    
    this.players.forEach(player => {
      if (player.sprite === playerSprite) {
        targetPlayer = player;
        targetId = player.id;
      }
    });
    
    // Skip if player is already dead
    if (!targetPlayer || !targetPlayer.isAlive) return;
    
    // Get the ID of the player who fired this bullet
    const shooterId = bulletObj.getData('playerId');
    
    // ENHANCED SAFETY: Multiple checks to prevent self-hit
    // 1. Skip if bullet is from the same player
    if (shooterId === targetId) {
      console.log('Prevented self-hit: bullet and target player have same ID');
      return;
    }
    
    // 2. Extra check: Skip if the bullet was fired by the current player and target is also current player
    if (shooterId === this.socket.id && targetId === this.socket.id) {
      console.log('Prevented self-hit: current player bullet hitting current player');
      return;
    }
    
    // Verify that the shooter exists in our players map
    const shooterExists = this.players.has(shooterId);
    if (!shooterExists) {
      console.error(`Bullet has invalid shooter ID: ${shooterId}`);
      return;
    }
    
    // Log the valid bullet hit
    console.log(`Valid hit: Bullet from ${shooterId} hit player ${targetId}`);
    
    // Deactivate bullet
    bulletObj.setActive(false);
    bulletObj.setVisible(false);
    
    // Emit hit event WITH the correct shooter ID
    this.socket.emit('playerHit', {
      gameId: this.roomId,
      shooterId: shooterId, // Include the ID of the player who fired the bullet
      targetId: targetId
    });
  }
  
  private handleBulletObstacleCollision(bullet: Phaser.GameObjects.GameObject) {
    const bulletObj = bullet as Phaser.Physics.Arcade.Sprite;
    bulletObj.setActive(false);
    bulletObj.setVisible(false);

    // Play bullet impact sound
    if (this.sound && this.sound.add) {
      try {
        const sound = this.sound.add("bullet_impact", { volume: 0.1 });
        sound.play();
      } catch (e) {
        console.warn('Could not play bullet impact sound', e);
      }
    }
  }
  
  private handleBulletFarmObjectCollision(bullet: Phaser.GameObjects.GameObject, farmObjectObj: Phaser.GameObjects.GameObject) {
    const bulletObj = bullet as Phaser.Physics.Arcade.Sprite;
    const farmObjectSprite = farmObjectObj as Phaser.Physics.Arcade.Sprite;
    
    // Find farm object from sprite
    let targetObject: FarmObject | undefined;
    let targetId: string = '';
    
    this.farmObjects.forEach(obj => {
      if (obj.sprite === farmObjectSprite) {
        targetObject = obj;
        targetId = obj.id;
      }
    });
    
    if (!targetObject) return;
    
    // Skip if bullet is not from current player
    const bulletPlayerId = bulletObj.getData('playerId');
    if (bulletPlayerId !== this.socket.id) return;
    
    // Add visual hit effect
    this.addCollectionEffect(
      farmObjectSprite.x, 
      farmObjectSprite.y, 
      targetObject.type, 
      true // More intense effect for shooting
    );
    
    // Play sound if available
    if (this.sound && this.sound.add) {
      // Different sounds based on resource type
      const soundKey = targetObject.type === 'gem' ? 'collect_gem' : 
                     targetObject.type === 'crystal' ? 'collect_crystal' : 'collect_coin';
      
      try {
        const sound = this.sound.add(soundKey, { volume: 0.4 });
        sound.play();
      } catch (e) {
        console.warn('Could not play collection sound', e);
      }
    }
    
    // Deactivate bullet
    bulletObj.setActive(false);
    bulletObj.setVisible(false);
    
    // Emit farm object hit event
    this.socket.emit('farmObjectHit', {
      gameId: this.roomId,
      objectId: targetId
    });
  }
  
  private createFarmObject(id: string, x: number, y: number, type: string, value: number) {
    const sprite = this.physics.add.sprite(x, y, type);
    sprite.setScale(1);
    
    // Add to farm objects group for collision detection
    this.farmObjectsGroup.add(sprite);
    
    // Add some visual effects based on the resource type
    if (type === 'crystal') {
      sprite.setScale(0.7);
    } else if (type === 'coin') {
      sprite.setTint(0xffcc00);
      sprite.setScale(1);
    } else if (type === 'gem') {
      sprite.setScale(0.5);
    }
    
    // Add floating animation
    this.tweens.add({
      targets: sprite,
      y: y - 10,
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
    
    // Add some rotation for certain resources
    if (type === 'coin') {
      this.tweens.add({
        targets: sprite,
        angle: 360,
        duration: 3000,
        ease: 'Linear',
        repeat: -1
      });
    }
    
    // Create the farm object
    const farmObject: FarmObject = {
      id,
      sprite,
      type,
      value
    };
    
    this.farmObjects.set(id, farmObject);
    return farmObject;
  }
  
  private showKillMessage(killerName: string, targetName: string, pointsStolen: number) {
    // Create a container for the kill message
    const container = this.add.container(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 100
    );
    
    // Set container to respect the camera scroll
    container.setScrollFactor(0);
    container.setDepth(100);
    
    // Create kill text
    const killText = this.add.text(
      0,
      0,
      `${killerName} eliminated ${targetName}!`,
      {
        fontSize: '24px',
        color: '#ff0000',
        stroke: '#000000',
        strokeThickness: 4
      }
    );
    killText.setOrigin(0.5);
    
    // Create points stolen text
    const pointsText = this.add.text(
      0,
      30,
      `+${pointsStolen} points stolen!`,
      {
        fontSize: '20px',
        color: '#ffff00',
        stroke: '#000000',
        strokeThickness: 3
      }
    );
    pointsText.setOrigin(0.5);
    
    // Add texts to container
    container.add([killText, pointsText]);
    
    // Hide points text if no points were stolen
    if (pointsStolen <= 0) {
      pointsText.setVisible(false);
    }
    
    // Fade out and destroy after 3 seconds
    this.tweens.add({
      targets: container,
      alpha: 0,
      duration: 3000,
      ease: 'Power2',
      onComplete: () => {
        container.destroy();
      }
    });
    
    // Add a small animation to make it more dynamic
    this.tweens.add({
      targets: container,
      y: container.y - 20,
      duration: 300,
      ease: 'Bounce',
      yoyo: true
    });
  }
  
  private updateEnergyUI() {
    if (this.currentPlayer) {
      this.energyText.setText(`Energy: ${Math.floor(this.currentPlayer.energy)}`);
    }
  }

  private setupCollisions() {
    // Set up player-to-obstacle collisions
    this.physics.add.collider(this.playersGroup, this.boxes, undefined, undefined, this);
    
    // Set up bullet-to-obstacle collisions
    this.physics.add.collider(
      this.bullets, 
      this.boxes, 
      (bullet, box) => this.handleBulletObstacleCollision(bullet as Phaser.GameObjects.GameObject), 
      undefined, 
      this
    );
    
    // Set up player-to-player collisions
    this.physics.add.collider(this.playersGroup, this.playersGroup);
    
    // Set up bullet-to-player collisions with a collision filter
    this.physics.add.collider(
      this.bullets, 
      this.playersGroup, 
      (bullet, playerObj) => this.handleBulletPlayerCollision(
        bullet as Phaser.GameObjects.GameObject, 
        playerObj as Phaser.GameObjects.GameObject
      ), 
      // Add a collision filter function to prevent self-shooting
      (bullet, playerObj) => {
        // Get the player ID from the sprite
        let playerId = '';
        this.players.forEach((player) => {
          if (player.sprite === playerObj) {
            playerId = player.id;
          }
        });
        
        // Get the bullet's shooter ID
        const shooterId = (bullet as Phaser.Physics.Arcade.Sprite).getData('playerId');
        
        // Only allow collision if bullet was NOT fired by this player
        return shooterId !== playerId;
      },
      this
    );
    
    // Set up player-to-farm-object collisions
    this.physics.add.overlap(
      this.playersGroup,
      this.farmObjectsGroup,
      (playerObj, farmObj) => this.handlePlayerFarmObjectCollision(
        playerObj as Phaser.GameObjects.GameObject, 
        farmObj as Phaser.GameObjects.GameObject
      ),
      undefined,
      this
    );
  }

  private generateMissingTextures() {
    const graphics = this.add.graphics();
    
    // Check if bullet texture exists and create fallback if not
    if (!this.textures.exists('bullet')) {
      console.warn('Bullet texture not found, creating fallback');
      graphics.clear();
      graphics.fillStyle(0xff0000);
      graphics.fillCircle(8, 8, 8);
      graphics.generateTexture('bullet', 16, 16);
    }
    
    // Check if player texture exists and create fallback if not
    if (!this.textures.exists('player')) {
      console.warn('Player texture not found, creating fallback');
      graphics.clear();
      graphics.fillStyle(0xffffff);
      graphics.fillCircle(16, 16, 16);
      graphics.generateTexture('player', 32, 32);
    }
    
    // Check if box texture exists and create fallback if not
    if (!this.textures.exists('box')) {
      console.warn('Box texture not found, creating fallback');
      graphics.clear();
      graphics.fillStyle(0x3498db);
      graphics.fillRect(0, 0, 32, 32);
      graphics.generateTexture('box', 32, 32);
    }
    
    // Check if farm object textures exist and create fallbacks if not
    if (!this.textures.exists('crystal')) {
      console.warn('Crystal texture not found, creating fallback');
      graphics.clear();
      graphics.fillStyle(0x00ffff);
      graphics.fillRect(0, 0, 16, 24);
      graphics.generateTexture('crystal', 16, 24);
    }
    
    if (!this.textures.exists('coin')) {
      console.warn('Coin texture not found, creating fallback');
      graphics.clear();
      graphics.fillStyle(0xffcc00);
      graphics.fillCircle(8, 8, 8);
      graphics.generateTexture('coin', 43, 43);
    }
    
    if (!this.textures.exists('gem')) {
      console.warn('Gem texture not found, creating fallback');
      graphics.clear();
      graphics.fillStyle(0xff00ff);
      graphics.beginPath();
      graphics.moveTo(10, 0);
      graphics.lineTo(20, 15);
      graphics.lineTo(10, 30);
      graphics.lineTo(0, 15);
      graphics.closePath();
      graphics.fill();
      graphics.generateTexture('gem', 20, 30);
    }
    
    graphics.destroy();
  }

  // Connect L-shaped obstacles with visual lines to make them look more connected
  private connectLShapedObstacles(obstaclesData: any[]) {
    // Group obstacles by their base coordinates (part of the ID for L-shapes)
    const lShapeGroups = new Map<string, {obstacles: any[], baseX: number, baseY: number}>();
    
    obstaclesData.forEach(obstacle => {
      if (obstacle.id.includes('obstacle-L')) {
        // Extract the base coordinates from the ID
        const match = obstacle.id.match(/obstacle-L-(\d+)-(\d+)/);
        if (match && match.length === 3) {
          const baseX = parseInt(match[1]);
          const baseY = parseInt(match[2]);
          const key = `${baseX}-${baseY}`;
          
          if (!lShapeGroups.has(key)) {
            lShapeGroups.set(key, {
              obstacles: [],
              baseX,
              baseY
            });
          }
          
          lShapeGroups.get(key)!.obstacles.push(obstacle);
        }
      }
    });
    
    // For each L-shape group, draw connecting graphics between blocks
    lShapeGroups.forEach(group => {
      if (group.obstacles.length >= 2) {
        const graphics = this.add.graphics();
        graphics.lineStyle(4, 0x6c3483, 0.7); // Darker purple, semi-transparent
        
        // Sort obstacles by position to connect them in order
        const sortedObstacles = group.obstacles.sort((a, b) => {
          // First sort by Y, then by X
          if (a.y !== b.y) return a.y - b.y;
          return a.x - b.x;
        });
        
        // Connect the dots by drawing lines
        for (let i = 0; i < sortedObstacles.length - 1; i++) {
          // Draw line from center of current obstacle to center of next obstacle
          graphics.beginPath();
          graphics.moveTo(sortedObstacles[i].x, sortedObstacles[i].y);
          graphics.lineTo(sortedObstacles[i+1].x, sortedObstacles[i+1].y);
          graphics.closePath();
          graphics.strokePath();
        }
      }
    });
  }

  // Handle player collecting a farm object by colliding with it
  private handlePlayerFarmObjectCollision(playerObj: Phaser.GameObjects.GameObject, farmObjectObj: Phaser.GameObjects.GameObject) {
    const player = playerObj as Phaser.Physics.Arcade.Sprite;
    const farmObject = farmObjectObj as Phaser.Physics.Arcade.Sprite;
    
    // Find the player from the sprite
    let currentPlayer: Player | undefined;
    
    this.players.forEach(p => {
      if (p.sprite === player) {
        currentPlayer = p;
      }
    });
    
    // Skip if not the current player
    if (currentPlayer?.id !== this.currentPlayer?.id) return;
    
    // Find farm object from sprite
    let targetFarmObject: FarmObject | undefined;
    let farmObjectId: string = '';
    
    this.farmObjects.forEach(fo => {
      if (fo.sprite === farmObject) {
        targetFarmObject = fo;
        farmObjectId = fo.id;
      }
    });
    
    if (!targetFarmObject) return;
    
    // Add visual collection effect
    this.addCollectionEffect(farmObject.x, farmObject.y, targetFarmObject.type);
    
    // Play sound if available
    if (this.sound && this.sound.add) {
      // Different sounds based on resource type
      const soundKey = targetFarmObject.type === 'gem' ? 'collect_gem' : 
                     targetFarmObject.type === 'crystal' ? 'collect_crystal' : 'collect_coin';
      
      try {
        const sound = this.sound.add(soundKey, { volume: 0.4 });
        sound.play();
      } catch (e) {
        console.warn('Could not play collection sound', e);
      }
    }
    
    // Emit collect event
    this.socket.emit('collectResource', {
      gameId: this.roomId,
      resourceId: farmObjectId
    });
  }
  
  // Add visual effect when collecting resources
  private addCollectionEffect(x: number, y: number, type: string, intense: boolean = false) {
    // Create a particle effect based on the type of resource
    const particles = this.add.particles(x, y, type, {
      speed: { min: intense ? 80 : 30, max: intense ? 90 : 40 },
      scale: { start: intense ? 0.6 : 0.4, end: 0 },
      lifespan: intense ? 800 : 600,
      blendMode: 'ADD',
      quantity: intense ? 3 : 2
    });
    
    // Add floating score text
    let pointValue = 1;
    let color = '#ffff00'; // Default yellow
    
    if (type === 'crystal') {
      pointValue = 5;
      color = '#00ffff'; // Cyan
    } else if (type === 'gem') {
      pointValue = 10;
      color = '#ff00ff'; // Magenta
    }
    
    const scoreText = this.add.text(x, y - 20, `+${pointValue}`, {
      fontSize: intense ? '28px' : '24px',
      color: color,
      stroke: '#000000',
      strokeThickness: 3
    });
    scoreText.setOrigin(0.5, 0.5);
    
    // Animate the score text upward and fade it out
    this.tweens.add({
      targets: scoreText,
      y: y - (intense ? 80 : 60),
      alpha: 0,
      duration: intense ? 1200 : 1000,
      ease: 'Power1',
      onComplete: () => {
        scoreText.destroy();
      }
    });
    
    // Auto-destroy the particles after they're done
    this.time.delayedCall(intense ? 1200 : 800, () => {
      particles.destroy();
    });
  }

  // Add a kill effect at player position
  private addKillEffect(x: number, y: number, pointsStolen: number) {
    // Blood splatter effect
    const particles = this.add.particles(x, y, 'player', {
      speed: { min: 70, max: 80 },
      scale: { start: 0.4, end: 0 },
      lifespan: 600,
      blendMode: 'ADD',
      tint: 0xff0000, // Red for blood
      quantity: 3
    });
    // Play kill sound
    if (this.sound && this.sound.add) {
      try {
        const sound = this.sound.add('kill', { volume: 0.7 });
        sound.play();
      } catch (e) {
        console.warn('Could not play kill sound', e);
      }
    }
    
    // Score popup for points stolen
    if (pointsStolen > 0) {
      const scoreText = this.add.text(x, y - 30, `+${pointsStolen}`, {
        fontSize: '32px',
        color: '#ff9900', // Orange
        stroke: '#000000',
        strokeThickness: 4
      });
      scoreText.setOrigin(0.5, 0.5);
      
      // Animate the score text
      this.tweens.add({
        targets: scoreText,
        y: y - 100,
        alpha: 0,
        duration: 1500,
        ease: 'Power1',
        onComplete: () => {
          scoreText.destroy();
        }
      });
    }
    
    // Auto-destroy the particles after they're done
    this.time.delayedCall(1500, () => {
      particles.destroy();
    });
  }
}
