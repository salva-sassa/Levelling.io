import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import audioService from '../../services/AudioService';

// Generate background stars for a space theme
const generateParticles = (count: number) => {
  return Array.from({ length: count }).map(() => ({
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 3 + 3, // Larger size (3-6px)
  }));
};

const MainMenu = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [showRoomInput, setShowRoomInput] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(audioService.getMuteState());
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  
  // Memoize particles to prevent re-rendering
  const backgroundStars = useMemo(() => generateParticles(100), []);

  // Start playing theme music when component mounts
  useEffect(() => {
    audioService.playMenuTheme();
    
    // Cleanup function to stop the music when component unmounts
    return () => {
      audioService.stopMenuTheme();
    };
  }, []);

  const handleJoinGame = () => {
    if (!showNameInput) {
      setShowNameInput(true);
      return;
    }
    
    if (!playerName.trim()) {
      alert('Please enter your name to continue.');
      return;
    }
    
    if (showRoomInput && roomId.trim()) {
      navigate(`/game/${roomId}?name=${encodeURIComponent(playerName)}`);
    } else {
      setShowRoomInput(true);
    }
  };

  const toggleMute = () => {
    const muteState = audioService.toggleMute();
    setIsMuted(muteState);
  };

  // Object information for the "How to Play" section
  const gameObjects = [
    { 
      type: "coin", 
      points: 1, 
      description: "Collect coins for 1 point each",
      image: "/assets/coin.png"
    },
    { 
      type: "crystal", 
      points: 5, 
      description: "Crystals are worth 5 points",
      image: "/assets/crystal.png"
    },
    { 
      type: "gem", 
      points: 10, 
      description: "Gems are the most valuable at 10 points each",
      image: "/assets/gem.png"
    },
    { 
      type: "player", 
      points: "50%", 
      description: "Defeat other players to steal 50% of their points",
      image: "/assets/player.png"
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Background stars */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {backgroundStars.map((star, i) => (
          <div 
            key={i}
            style={{
              position: 'absolute',
              top: star.top,
              left: star.left,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: '#8BB4EE',
              borderRadius: '50%',
              opacity: Math.random() * 0.5 + 0.1,
              boxShadow: '0 0 10px 2px rgba(30, 64, 175, 0.4)',
            }}
            className="animate-twinkle"
          />
        ))}
      </div>
      
      {/* Game Logo/Title */}
      <div className="relative mb-10 text-center">
        <h1 className="text-6xl font-bold pb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
          Levelling.io
        </h1>
        <p className="text-xl text-blue-300">2D Multiplayer Battle Game</p>
      </div>
      
      <div className="relative z-10 bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl border border-blue-500/30 shadow-lg shadow-blue-500/20 min-w-[400px]">
        <div className="flex flex-col gap-5">
          <button 
            className="py-3 px-6 text-lg bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all hover:shadow-md hover:shadow-purple-500/30 font-medium"
            onClick={() => setShowHowToPlay(true)}
          >
            How to Play
          </button>
          
          {showNameInput && !showRoomInput ? (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="p-3 text-base border-2 border-blue-500/50 rounded-lg bg-gray-900/80 text-white focus:outline-none focus:border-blue-400 transition-colors"
                autoFocus
              />
              <button 
                className={`py-3 px-6 text-lg bg-blue-600 text-white rounded-lg transition-all ${
                  !playerName.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/30'
                }`}
                onClick={handleJoinGame}
                disabled={!playerName.trim()}
              >
                Continue
              </button>
            </div>
          ) : showRoomInput ? (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter Room ID"
                className="p-3 text-base border-2 border-blue-500/50 rounded-lg bg-gray-900/80 text-white focus:outline-none focus:border-blue-400 transition-colors"
                autoFocus
              />
              <button 
                className={`py-3 px-6 text-lg bg-blue-600 text-white rounded-lg transition-all ${
                  !roomId.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/30'
                }`}
                onClick={handleJoinGame}
                disabled={!roomId.trim()}
              >
                Join Room
              </button>
            </div>
          ) : (
            <button 
              className="py-3 px-6 text-lg bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:shadow-md hover:shadow-blue-500/30 font-medium"
              onClick={handleJoinGame}
            >
              Join Game
            </button>
          )}
        </div>
      </div>
      
      {/* Sound toggle button */}
      <button 
        onClick={toggleMute}
        className="absolute top-6 right-6 p-3 rounded-full bg-gray-800/80 hover:bg-gray-700/80 transition-colors border border-white/10"
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
      
      {/* How to Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-4xl w-full max-h-[85vh] overflow-y-auto custom-scrollbar border border-blue-500/30 shadow-lg shadow-blue-500/20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-blue-400">How to Play</h2>
              <button 
                onClick={() => setShowHowToPlay(false)}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Controls Section */}
              <div>
                <h3 className="text-xl font-semibold text-blue-300 mb-3">Controls</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white">
                  <div className="bg-gray-700/50 p-4 rounded-lg flex items-center">
                    <div className="mr-4">
                      <div className="flex gap-1">
                        <kbd className="px-2 py-1 bg-gray-600 rounded text-sm">W</kbd>
                        <kbd className="px-2 py-1 bg-gray-600 rounded text-sm">↑</kbd>
                      </div>
                      <div className="flex gap-1 my-1">
                        <kbd className="px-2 py-1 bg-gray-600 rounded text-sm">A</kbd>
                        <kbd className="px-2 py-1 bg-gray-600 rounded text-sm">←</kbd>
                      </div>
                      <div className="flex gap-1 my-1">
                        <kbd className="px-2 py-1 bg-gray-600 rounded text-sm">S</kbd>
                        <kbd className="px-2 py-1 bg-gray-600 rounded text-sm">↓</kbd>
                      </div>
                      <div className="flex gap-1">
                        <kbd className="px-2 py-1 bg-gray-600 rounded text-sm">D</kbd>
                        <kbd className="px-2 py-1 bg-gray-600 rounded text-sm">→</kbd>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm">Movement</span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-700/50 p-4 rounded-lg flex items-center gap-4">
                    <kbd className="px-4 py-1 bg-gray-600 rounded text-sm">Space</kbd>
                    <span className="text-sm">Shoot</span>
                  </div>
                </div>
              </div>
              
              {/* Game Objects Section */}
              <div>
                <h3 className="text-xl font-semibold text-blue-300 mb-3">Game Objects</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {gameObjects.map((object, index) => (
                    <div key={index} className="bg-gray-700/50 p-3 rounded-lg flex items-center">
                      <div className="mr-4 flex items-center justify-center">
                        <img 
                          src={object.image} 
                          alt={object.type}
                          className="w-10 h-10 object-contain drop-shadow-glow"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium capitalize">{object.type}</div>
                        <div className="text-xs text-gray-300">{object.description}</div>
                      </div>
                      <div className="text-lg font-bold ml-2">
                        {typeof object.points === 'number' ? `+${object.points}` : object.points}
                        <span className="text-xs font-normal ml-1">
                          {typeof object.points === 'number' ? 'pts' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Game Strategy */}
              <div>
                <h3 className="text-xl font-semibold text-blue-300 mb-3">Game Strategy</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-gray-700/50 p-3 rounded-lg">
                    <ul className="space-y-2 text-white text-sm">
                      <li className="flex items-start">
                        <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
                        Collect objects to earn points
                      </li>
                      <li className="flex items-start">
                        <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
                        Avoid enemy fire and stay alive
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-700/50 p-3 rounded-lg">
                    <ul className="space-y-2 text-white text-sm">
                      <li className="flex items-start">
                        <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
                        Hunt down players with high scores
                      </li>
                      <li className="flex items-start">
                        <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
                        The player with the most points wins!
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowHowToPlay(false)}
              className="w-full mt-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
      
      {/* CSS for animations, glow effects, and custom scrollbar */}
      <style>{`
        @keyframes twinkle {
          0%, 100% {
            opacity: 0.1;
          }
          50% {
            opacity: 0.7;
          }
        }
        
        .animate-twinkle {
          animation: twinkle 3s infinite ease-in-out;
          animation-delay: calc(var(--tw-translate-x, 0) * 0.1s);
        }
        
        .drop-shadow-glow {
          filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5));
        }
        
        /* Custom scrollbar styling */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background-color: rgba(31, 41, 55, 0.2);
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(59, 130, 246, 0.5);
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(59, 130, 246, 0.7);
        }
        
        /* For Firefox */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(59, 130, 246, 0.5) rgba(31, 41, 55, 0.2);
        }
      `}</style>
    </div>
  );
};

export default MainMenu; 