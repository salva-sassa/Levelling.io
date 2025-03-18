# Levelling.io

An experimental real-time multiplayer game development project exploring WebSockets, concurrency management, and state synchronization.

<div style="display: flex; gap: 20px; justify-content: space-between;">
  <img src="https://github.com/user-attachments/assets/31155813-d3fd-4724-8126-afba36806272" width="35%" />
  <img src="https://github.com/user-attachments/assets/10ce8040-6220-4a7d-a539-df2c3a0ae80d" width="49%" />
</div>


## About

Levelling.io demonstrates practical applications of real-time multiplayer game development concepts. The project showcases how to implement reliable WebSocket communication, manage concurrent user interactions, synchronize game state across multiple clients, and optimize data structures for performant gameplay.

## Architecture

The project employs a dual-architecture approach:

- **Frontend**: Next.js and React power the UI layer
- **Game Engine**: Phaser handles game rendering and physics
- **Backend**: Express server with Socket.io for WebSocket communication
- **Language**: TypeScript for type safety throughout the codebase

This architecture enables efficient state management and seamless synchronization between players, creating a responsive and consistent gaming experience.

## Key Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| Real-time communication | Implemented Socket.io for reliable WebSocket connections |
| State synchronization | Developed custom state management system to ensure consistency across devices |
| Concurrent user interactions | Created conflict resolution mechanisms to handle simultaneous player actions |
| Performance optimization | Designed efficient data structures to maintain smooth gameplay with multiple users |

## Game Assets

All visual elements were designed using Figma, focusing on clean geometric UI components and collectible items that maintain visual consistency across the game environment.
![levelling_figma](https://github.com/user-attachments/assets/e11aad05-1ae1-4e44-91b3-c03879cc4387)

## Technologies Used

- Next.js
- React
- Express
- WebSockets
- Socket.io
- Phaser
- TypeScript
- Figma

## Portfolio resume
[Levelling.io](https://salvasassa.vercel.app/craft/levellingio)

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/levelling.io.git

# Navigate to the frontend and backend directories, separately
cd frontend
cd backend

# Install dependencies
npm install

# Start the development server for both directories
npm run dev
