import { Socket } from 'socket.io';

interface PlayerData {
  id: string;
  name: string;
  color: number;
  position: { x: number, y: number };
  velocity: { x: number, y: number };
  score: number;
  isAlive: boolean;
  respawnTime?: number;
}

// Track farmable objects in each room
interface FarmObject {
  id: string;
  position: { x: number, y: number };
  type: string;
  value: number;
}

// Track rooms with connected players
const rooms = new Map<string, Map<string, PlayerData>>();
const globalFarmObjects = new Map<string, Map<string, FarmObject>>();
const obstacles = new Map<string, Array<{id: string, x: number, y: number}>>();

// Debug logging function
const logServerState = () => {
  console.log('\n=== Server State Debug Log ===');
  console.log('Total Rooms:', rooms.size);
  
  rooms.forEach((players, roomId) => {
    console.log(`\nRoom: ${roomId}`);
    console.log('Players:', players.size);
    players.forEach(player => {
      console.log(`- ${player.name} (${player.id}): pos(${Math.round(player.position.x)}, ${Math.round(player.position.y)}), score=${player.score}, alive=${player.isAlive}`);
    });
    const roomFarmObjects = globalFarmObjects.get(roomId);
    if (roomFarmObjects) {
      console.log(`Farm objects: ${roomFarmObjects.size}`);
    }
    const roomObstacles = obstacles.get(roomId);
    if (roomObstacles) {
      console.log(`Obstacles: ${roomObstacles.length}`);
    }
  });
  console.log('\n=========================\n');
};

// Start periodic logging
const logInterval = setInterval(logServerState, 5000);

export const handleSocketConnection = (socket: Socket) => {
    console.log('\n=== New Connection ===');
    console.log('User connected:', socket.id);
    console.log('Total connections:', rooms.size);
    console.log('====================\n');

    // Generate obstacles for a room
    const generateObstacles = (gameId: string, count: number = 8) => {
      if (!obstacles.has(gameId)) {
        const roomObstacles = [];
        
        // Create a few larger L-shaped obstacles instead of many small ones
        // Each L-shape consists of multiple connected obstacle points
        
        // L-shape in top-left area
        const createLShape = (baseX: number, baseY: number, rotation: number = 0) => {
          const lShapePoints = [];
          
          // The stem of the L (vertical part)
          for (let i = 0; i < 3; i++) {
            let x = baseX;
            let y = baseY + (i * 60);
            
            // Apply rotation if needed (rotate around baseX, baseY)
            if (rotation === 1) { // 90 degrees
              const tempX = x - baseX;
              const tempY = y - baseY;
              x = baseX - tempY;
              y = baseY + tempX;
            } else if (rotation === 2) { // 180 degrees
              x = baseX - (x - baseX);
              y = baseY - (y - baseY);
            } else if (rotation === 3) { // 270 degrees
              const tempX = x - baseX;
              const tempY = y - baseY;
              x = baseX + tempY;
              y = baseY - tempX;
            }
            
            lShapePoints.push({
              id: `obstacle-L-${baseX}-${baseY}-${i}`,
              x,
              y,
              part: 'stem'
            });
          }
          
          // The foot of the L (horizontal part)
          for (let i = 1; i < 3; i++) {
            let x = baseX + (i * 60);
            let y = baseY + (2 * 60);
            
            // Apply rotation if needed
            if (rotation === 1) { // 90 degrees
              const tempX = x - baseX;
              const tempY = y - baseY;
              x = baseX - tempY;
              y = baseY + tempX;
            } else if (rotation === 2) { // 180 degrees
              x = baseX - (x - baseX);
              y = baseY - (y - baseY);
            } else if (rotation === 3) { // 270 degrees
              const tempX = x - baseX;
              const tempY = y - baseY;
              x = baseX + tempY;
              y = baseY - tempX;
            }
            
            lShapePoints.push({
              id: `obstacle-L-${baseX}-${baseY}-${i+3}`,
              x,
              y,
              part: 'foot'
            });
          }
          
          return lShapePoints;
        };
        
        // Create 4 L-shapes, one in each quadrant of the map, with different rotations
        roomObstacles.push(...createLShape(300, 300, 0)); // Top-left, normal L
        roomObstacles.push(...createLShape(1700, 300, 1)); // Top-right, rotated 90°
        roomObstacles.push(...createLShape(300, 1100, 3)); // Bottom-left, rotated 270°
        roomObstacles.push(...createLShape(1700, 1100, 2)); // Bottom-right, rotated 180°
        
        // Add a few strategic individual blocks in the center area
        const centerObstacles = [
          { x: 1000, y: 750 },
          { x: 1000, y: 650 },
          { x: 1000, y: 850 },
          { x: 900, y: 750 },
          { x: 1100, y: 750 }
        ];
        
        centerObstacles.forEach((pos, i) => {
          roomObstacles.push({
            id: `obstacle-center-${i}`,
            x: pos.x,
            y: pos.y,
            part: 'center'
          });
        });
        
        obstacles.set(gameId, roomObstacles);
        console.log(`Generated ${roomObstacles.length} obstacle blocks for room ${gameId}`);
      }
      
      return obstacles.get(gameId) || [];
    };
    
    // Generate random farmable objects
    const generateFarmObjects = (gameId: string, count: number = 10) => {
      if (!globalFarmObjects.has(gameId)) {
        globalFarmObjects.set(gameId, new Map<string, FarmObject>());
      }
      
      const roomFarmObjects = globalFarmObjects.get(gameId)!;
      
      // Generate new objects only if we have fewer than the desired count
      if (roomFarmObjects.size < count) {
        const typesAndValues = [
          { type: 'crystal', value: 5 },
          { type: 'coin', value: 1 },
          { type: 'gem', value: 10 }
        ];
        
        const toCreate = count - roomFarmObjects.size;
        
        for (let i = 0; i < toCreate; i++) {
          const id = `farm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const type = typesAndValues[Math.floor(Math.random() * typesAndValues.length)];
          
          // Make sure farm objects don't overlap with obstacles
          let validPosition = false;
          let x = 0, y = 0;
          const roomObstacles = obstacles.get(gameId) || [];
          
          while (!validPosition) {
            x = Math.random() * 1800 + 100;
            y = Math.random() * 1300 + 100;
            
            // Check distance from all obstacles
            validPosition = roomObstacles.every(obstacle => {
              const dx = x - obstacle.x;
              const dy = y - obstacle.y;
              return Math.sqrt(dx * dx + dy * dy) > 120; // Increased minimum distance for larger obstacles
            });
          }
          
          roomFarmObjects.set(id, {
            id,
            position: { x, y },
            type: type.type,
            value: type.value
          });
        }
        
        // Notify all players of the new objects
        if (toCreate > 0) {
          const room = rooms.get(gameId);
          if (room) {
            socket.to(gameId).emit('farmObjectsUpdate', Array.from(roomFarmObjects.values()));
            socket.emit('farmObjectsUpdate', Array.from(roomFarmObjects.values()));
          }
        }
      }
    };
    
    // Respawn a player after they've been killed
    const respawnPlayer = (gameId: string, playerId: string) => {
      const roomPlayers = rooms.get(gameId);
      if (roomPlayers && roomPlayers.has(playerId)) {
        const player = roomPlayers.get(playerId)!;
        
        // Update player status
        player.isAlive = true;
        player.position = {
          x: Math.random() * 1800 + 100,
          y: Math.random() * 1300 + 100
        };
        player.velocity = { x: 0, y: 0 };
        
        // Notify all players of respawn
        socket.to(gameId).emit('playerRespawned', {
          playerId,
          position: player.position
        });
        socket.emit('playerRespawned', {
          playerId,
          position: player.position
        });
      }
    };

    // Handle player joining a game room
    socket.on('joinGame', (data) => {
      const { gameId, name = `Player-${Math.floor(Math.random() * 1000)}`, color = 0x1a75ff } = data;
      console.log(`Player ${name} (${socket.id}) joining game: ${gameId}`);
      
      // Create a new room if it doesn't exist
      if (!rooms.has(gameId)) {
        rooms.set(gameId, new Map());
        console.log(`Created new room: ${gameId}`);
      }
      
      // Add player to room
      const roomPlayers = rooms.get(gameId);
      if (roomPlayers) {
        if (!roomPlayers.has(socket.id)) {
          roomPlayers.set(socket.id, {
            id: socket.id,
            name,
            color,
            position: { x: 400, y: 300 },
            velocity: { x: 0, y: 0 },
            score: 0,
            isAlive: true
          });
          console.log(`Added player ${name} to room ${gameId}. Total players in room: ${roomPlayers.size}`);
        }
        
        socket.join(gameId);
        
        // Generate obstacles if needed
        const roomObstacles = generateObstacles(gameId);
        
        // Generate initial farm objects if needed
        generateFarmObjects(gameId);
        
        // Send existing players to new player
        const existingPlayers = Array.from(roomPlayers?.values() || []);
        socket.emit('currentPlayers', existingPlayers);
        
        // Send obstacles
        socket.emit('obstaclesUpdate', roomObstacles);
        
        // Send current farm objects
        if (globalFarmObjects.has(gameId)) {
          socket.emit('farmObjectsUpdate', Array.from(globalFarmObjects.get(gameId)!.values()));
        }
        
        // Notify other players in the room
        socket.to(gameId).emit('playerJoined', {
          playerId: socket.id,
          name,
          color,
          position: { x: 400, y: 300 },
          velocity: { x: 0, y: 0 },
          score: 0,
          isAlive: true
        });
      }
    });

    // Handle player movement
    socket.on('playerMove', (data) => {
        const { gameId, position, velocity } = data;
        
        // Update player position and velocity in room
        const roomPlayers = rooms.get(gameId);
        if (roomPlayers) {
            const player = roomPlayers.get(socket.id);
            if (player) {
                player.position = position;
                // Update velocity if provided
                if (velocity) {
                    player.velocity = velocity;
                }
            }
        }
        
        // Broadcast player movement to all other players in the room
        socket.to(gameId).emit('playerMoved', {
            playerId: socket.id,
            position,
            velocity
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Find which rooms this player was in
        rooms.forEach((roomPlayers, roomId) => {
            if (roomPlayers.has(socket.id)) {
                // Remove player from room data
                roomPlayers.delete(socket.id);
                
                // Delete room if empty
                if (roomPlayers.size === 0) {
                    rooms.delete(roomId);
                }
                
                // Notify all other players in the room
                socket.to(roomId).emit('playerLeft', {
                    playerId: socket.id,
                    name: roomPlayers.get(socket.id)?.name
                });
            }
        });
        
        // Clear the log interval
        clearInterval(logInterval);
    });

    // Handle player shooting
    socket.on('playerShoot', (data) => {
        const { gameId, direction, position } = data;
        
        // Broadcast the shot to other players
        socket.to(gameId).emit('playerShot', {
            playerId: socket.id,
            direction,
            position
        });
    });
    
    // Handle player hit
    socket.on('playerHit', (data) => {
        const { gameId, shooterId, targetId } = data;
        console.log(`Player ${shooterId} hit player ${targetId}`);
        
        // Prevent self-killing - skip if shooter and target are the same player
        if (shooterId === targetId) {
            console.log(`Prevented self-kill attempt by player ${shooterId}`);
            return;
        }
        
        const roomPlayers = rooms.get(gameId);
        
        if (roomPlayers) {
            // Use the shooterId from the event instead of socket.id
            const shooter = roomPlayers.get(shooterId);
            const target = roomPlayers.get(targetId);
            
            if (shooter && target && target.isAlive) {
                // Calculate points to steal (50% of target's score)
                const pointsToSteal = Math.floor(target.score * 0.5);
                
                // Add stolen points to shooter's score, plus the kill bonus
                shooter.score += 20 + pointsToSteal;
                
                // Deduct stolen points from target's score
                target.score -= pointsToSteal;
                
                // Ensure target doesn't have negative score
                if (target.score < 0) target.score = 0;
                
                // Mark target as dead
                target.isAlive = false;
                target.respawnTime = Date.now() + 3000; // Respawn after 3 seconds
                
                console.log(`Player ${shooter.name} killed ${target.name}, stole ${pointsToSteal} points, shooter score: ${shooter.score}, target score: ${target.score}`);
                
                // Schedule respawn
                setTimeout(() => {
                    const respawnPlayer = () => {
                        const roomPlayers = rooms.get(gameId);
                        if (roomPlayers && roomPlayers.has(targetId)) {
                            const player = roomPlayers.get(targetId)!;
                            
                            // Update player status
                            player.isAlive = true;
                            player.position = {
                                x: Math.random() * 1800 + 100,
                                y: Math.random() * 1300 + 100
                            };
                            player.velocity = { x: 0, y: 0 };
                            
                            console.log(`Player ${player.name} respawned`);
                            
                            // Notify all players of respawn
                            socket.to(gameId).emit('playerRespawned', {
                                playerId: targetId,
                                position: player.position
                            });
                            socket.emit('playerRespawned', {
                                playerId: targetId,
                                position: player.position
                            });
                        }
                    };
                    
                    respawnPlayer();
                }, 3000);
                
                // Notify all players about the kill and updated scores
                socket.to(gameId).emit('playerKilled', {
                    killerId: shooterId,
                    targetId,
                    killerScore: shooter.score,
                    targetScore: target.score,
                    pointsStolen: pointsToSteal
                });
                socket.emit('playerKilled', {
                    killerId: shooterId,
                    targetId,
                    killerScore: shooter.score,
                    targetScore: target.score,
                    pointsStolen: pointsToSteal
                });
            }
        }
    });
    
    // Handle farm object hit
    socket.on('farmObjectHit', (data) => {
        const { gameId, objectId } = data;
        
        if (globalFarmObjects.has(gameId)) {
            const roomFarmObjects = globalFarmObjects.get(gameId)!;
            const farmObject = roomFarmObjects.get(objectId);
            
            if (farmObject) {
                // Give points to the player
                const roomPlayers = rooms.get(gameId);
                if (roomPlayers) {
                    const player = roomPlayers.get(socket.id);
                    if (player) {
                        player.score += farmObject.value;
                        console.log(`Player ${player.name} earned ${farmObject.value} points, total: ${player.score}`);
                        
                        // Remove the farm object
                        roomFarmObjects.delete(objectId);
                        
                        // Notify all players
                        socket.to(gameId).emit('farmObjectDestroyed', {
                            objectId,
                            playerId: socket.id,
                            playerScore: player.score
                        });
                        socket.emit('farmObjectDestroyed', {
                            objectId,
                            playerId: socket.id,
                            playerScore: player.score
                        });
                        
                        // Generate a new farm object
                        setTimeout(() => generateFarmObjects(gameId), 2000);
                    }
                }
            }
        }
    });
    
    // Handle direct collection of farm objects (by colliding with them)
    socket.on('collectResource', (data) => {
        const { gameId, resourceId } = data;
        
        if (globalFarmObjects.has(gameId)) {
            const roomFarmObjects = globalFarmObjects.get(gameId)!;
            const farmObject = roomFarmObjects.get(resourceId);
            
            if (farmObject) {
                // Give points to the player
                const roomPlayers = rooms.get(gameId);
                if (roomPlayers) {
                    const player = roomPlayers.get(socket.id);
                    if (player) {
                        player.score += farmObject.value;
                        console.log(`Player ${player.name} collected ${farmObject.value} points by touching resource, total: ${player.score}`);
                        
                        // Remove the farm object
                        roomFarmObjects.delete(resourceId);
                        
                        // Notify all players
                        socket.to(gameId).emit('farmObjectDestroyed', {
                            objectId: resourceId,
                            playerId: socket.id,
                            playerScore: player.score
                        });
                        socket.emit('farmObjectDestroyed', {
                            objectId: resourceId,
                            playerId: socket.id,
                            playerScore: player.score
                        });
                        
                        // Generate a new farm object
                        setTimeout(() => generateFarmObjects(gameId), 2000);
                    }
                }
            }
        }
    });
}; 