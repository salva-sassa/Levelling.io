import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainMenu from './components/Menu/MainMenu';
import GameRoom from './components/Game/GameRoom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/game/:roomId" element={<GameRoom />} />
      </Routes>
    </Router>
  );
}

export default App;
