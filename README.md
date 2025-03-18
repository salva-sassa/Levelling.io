# Levelling.io

An experimental real-time multiplayer game development project exploring WebSockets, concurrency management, and state synchronization.

<div style="display: flex; gap: 20px; justify-content: space-between;">
  <img src="https://github.com/user-attachments/assets/d5d6be2c-6807-4895-83d9-c1def8a4fda9" width="49%" />
  <img src="https://github.com/user-attachments/assets/689c8741-47c2-4d78-9799-3b4fdd9812f6" width="39%" />


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

![image](https://github.com/user-attachments/assets/3ba566b3-feda-41bc-afb7-e1db097626e2)


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
