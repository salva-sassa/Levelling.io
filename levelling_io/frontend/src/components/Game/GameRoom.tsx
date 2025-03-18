import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Phaser from 'phaser';
import audioService from '../../services/AudioService';

// Import game scenes with dynamic type assertion to prevent TypeScript errors
// @ts-ignore - Ignore the import error as we know this file exists
import MainScene from '../../game/scenes/MainScene';

// Player position display component
const PlayerPositionDisplay = ({ 
  playerId, 
  playerName, 
  position, 
  velocity,
  isCurrentPlayer,
  isAlive
}: { 
  playerId: string, 
  playerName: string, 
  position: { x: number, y: number } | null,
  velocity?: { x: number, y: number },
  isCurrentPlayer: boolean,
  isAlive: boolean
}) => {
  if (!position) return null;
  
  // Calculate speed for display
  const speed = velocity ? Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y) : 0;
  const roundedSpeed = Math.round(speed * 10) / 10;
  
  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${isCurrentPlayer ? 'bg-blue-600/30' : 'bg-gray-800/50'} ${!isAlive ? 'opacity-50' : ''}`}>
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${isAlive ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="font-medium text-white">{playerName}</span>
        {isCurrentPlayer && <span className="text-xs bg-blue-500 px-1.5 py-0.5 rounded-full text-white">You</span>}
        {!isAlive && <span className="text-xs bg-red-500 px-1.5 py-0.5 rounded-full text-white">Dead</span>}
      </div>
      <div className="text-xs text-gray-300">
        {position && `(${Math.round(position.x)}, ${Math.round(position.y)})`}
        {velocity && <span className="ml-1">• {roundedSpeed} px/s</span>}
      </div>
    </div>
  );
};

// Leaderboard component
const Leaderboard = ({ 
  players,
  currentPlayerId 
}: { 
  players: {
    [key: string]: { 
      name: string; 
      score: number;
      isAlive: boolean;
    }
  },
  currentPlayerId: string | undefined
}) => {
  // Sort players by score in descending order
  const sortedPlayers = Object.entries(players)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 10); // Show top 10 players
  
  return (
    <div className="pointer-events-auto absolute bottom-20 right-6 w-80">
      <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></div>
          <h3 className="text-lg font-semibold text-white">Leaderboard</h3>
        </div>
        <div className="space-y-2">
          {sortedPlayers.map(([id, player], index) => (
            <div key={id} className={`flex justify-between items-center p-2 rounded-lg ${id === currentPlayerId ? 'bg-blue-600/30' : 'bg-gray-800/50'} ${!player.isAlive ? 'opacity-50' : ''}`}>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 flex items-center justify-center bg-gray-700 rounded-full text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className={`font-medium ${!player.isAlive ? 'text-gray-400' : 'text-white'}`}>
                  {player.name}
                </span>
                {id === currentPlayerId && (
                  <span className="text-xs bg-blue-500 px-1.5 py-0.5 rounded-full text-white">You</span>
                )}
              </div>
              <div className="text-yellow-400 font-bold">
                {player.score}
              </div>
            </div>
          ))}
          
          {sortedPlayers.length === 0 && (
            <div className="text-center text-gray-400 py-2">
              No players yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const GameRoom = () => {
  const { roomId = 'default' } = useParams<{ roomId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMuted, setIsMuted] = useState<boolean>(audioService.getMuteState());
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  
  // Extract name from URL query params or use default
  const [playerName, setPlayerName] = useState<string>(() => {
    const queryParams = new URLSearchParams(location.search);
    const nameFromURL = queryParams.get('name');
    return nameFromURL || `Player-${Math.floor(Math.random() * 1000)}`;
  });
  
  const gameRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  
  // State to track player positions
  const [playerPositions, setPlayerPositions] = useState<{
    [key: string]: { 
      name: string; 
      position: { x: number, y: number }; 
      velocity: { x: number, y: number };
      color?: number;
      score: number;
      isAlive: boolean;
    }
  }>({});

  // Start playing game theme when component mounts
  useEffect(() => {
    // Play game background music
    audioService.playGameTheme();
    
    // Cleanup function to stop the music when component unmounts
    return () => {
      audioService.stopGameTheme();
    };
  }, []);
  
  useEffect(() => {
    // Initialize socket connection with reconnection options
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    console.log('Connecting to socket server at:', socketUrl);
    
    // Enhanced socket configuration
    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      forceNew: true
    });
    socketRef.current = socket;

    // Add error handling for socket connection
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      console.log('Connection details:', {
        url: socketUrl,
        transport: socket.io.engine.transport.name,
        connected: socket.connected,
        id: socket.id
      });
    });

    socket.on('connect', () => {
      console.log('Connected to game server, socket ID:', socket.id);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      navigate('/');
    });

    // Initialize Phaser game with state update callback
    if (gameRef.current && !gameInstanceRef.current) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        scale: {
          mode: Phaser.Scale.RESIZE,
          parent: gameRef.current,
          width: '100%',
          height: '100%'
        },
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
          }
        },
        scene: [new MainScene(roomId, socket, playerName, (players) => {
          setPlayerPositions(players);
        })]
      };

      gameInstanceRef.current = new Phaser.Game(config);
    }

    // Cleanup
    return () => {
      if (socket) socket.disconnect();
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }
    };
  }, [roomId, playerName, navigate]);

  // Event listener for the Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowExitModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Toggle mute for audio
  const toggleMute = () => {
    const muteState = audioService.toggleMute();
    setIsMuted(muteState);
  };

  // Exit game and return to main menu
  const handleExitGame = () => {
    navigate('/');
  };

  // Debug log when player state changes
  useEffect(() => {
    console.log('Player positions updated:', Object.keys(playerPositions).length, 'players');
  }, [playerPositions]);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden">
      {/* Game Container - Full Screen */}
      <div className="absolute inset-0 w-full h-full bg-gray-900" ref={gameRef}></div>
      
      {/* UI Overlay Layer */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top Bar */}
        <div className="pointer-events-auto absolute top-0 left-0 w-full px-6 py-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex justify-between items-center max-w-7xl mx-auto">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-white">Room: {roomId}</h2>

            </div>
            
            {/* Sound Control */}
            <button 
              onClick={toggleMute}
              className="p-3 rounded-full bg-gray-800/70 hover:bg-gray-700/70 transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Right Side - Player List */}
        <div className="pointer-events-auto absolute top-20 right-4 w-80">
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
              
              <h3 className="text-lg font-semibold text-white">Players Online <span className="text-xs text-gray-400">{Object.keys(playerPositions).length}</span></h3>
            </div>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
              {Object.entries(playerPositions).length > 0 ? (
                Object.entries(playerPositions).map(([id, data]) => (
                  <PlayerPositionDisplay 
                    key={id}
                    playerId={id}
                    playerName={data.name}
                    position={data.position}
                    velocity={data.velocity}
                    isCurrentPlayer={id === socketRef.current?.id}
                    isAlive={data.isAlive}
                  />
                ))
              ) : (
                <div className="text-center text-gray-400 py-2">
                  Waiting for players...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <Leaderboard 
          players={playerPositions} 
          currentPlayerId={socketRef.current?.id}
        />

        {/* Bottom Bar - Game Controls Info */}
        <div className="pointer-events-auto absolute bottom-0 left-0 right-0">
          <div className="bg-gradient-to-t from-black/50 to-transparent px-6 py-4">
            <div className="flex justify-center items-center max-w-7xl mx-auto">
              <div className="text-white/70 text-sm flex space-x-6">
                <div className="flex items-center space-x-2">
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Arrow Keys</kbd>
                  <span>Move</span>
                </div>
                <div className="flex items-center space-x-2">
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Space</kbd>
                  <span>Shoot</span>
                </div>
                <div className="flex items-center space-x-2">
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Mouse</kbd>
                  <span>Aim</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Exit Modal */}
        {showExitModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-sm pointer-events-auto">
            <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-blue-500/30 shadow-lg shadow-blue-500/20">
              <div className="flex flex-col items-center text-center">
                <h2 className="text-2xl font-bold text-blue-400 mb-4">Exit Game?</h2>
                <p className="text-gray-300 mb-6">Are you sure you want to exit and return to the main menu? Your progress will be lost.</p>
                
                <div className="flex space-x-4">
                  <button 
                    onClick={() => setShowExitModal(false)}
                    className="py-2 px-6 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleExitGame}
                    className="py-2 px-6 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Exit Game
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameRoom; 