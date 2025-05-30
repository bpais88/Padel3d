import * as THREE from 'three';
import { Player } from './player.js';
import {
    initBall,
    createBallTrail,
    updateBall,
    // checkPaddleCollision, // Called within updateBall, might not be needed here directly
    resetBall as resetBallPhysics, // Alias to avoid conflict if we have a local resetBall orchestrator
    defaultPhysicsConstants
} from './ball.js';
import { createGameEnvironment, NET_HEIGHT, WALL_THICKNESS } from './gameObjects.js';
import { initEventListeners, updateScoreDisplay, updateInfoDisplay } from './utils.js';

let scene, camera, renderer;
let gameElements = {}; // To store player, aiPlayer, ball, ballTrails, court, net etc.
let gameState = {};    // To store scores, serving state, ball physics state etc.
let keys = {};         // For keyboard input state
let cameraControls = { // For mouse/camera state
    mouseX: 0,
    mouseY: 0,
    cameraDistance: 12, // Initial distance
    cameraHeight: 8     // Initial height
};

// DOM Elements
let scoreElement, infoElement, loadingElement;

// Court Configuration (can be adjusted)
const courtConfig = {
    courtWidth: 10,
    courtLength: 20,
    wallHeight: 4,
    netHeight: NET_HEIGHT, // from gameObjects.js
    wallThickness: WALL_THICKNESS, // from gameObjects.js
    serviceLineLength: 3 // The 3 meters distance for service line from net
};

function initGame() {
    loadingElement = document.getElementById('loading');
    scoreElement = document.getElementById('score');
    infoElement = document.getElementById('info');

    // Scene setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x226699, 0.008);

    // Camera setup
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Initial camera position will be set in animate or after player is created

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);

    // Create Game Environment
    const environmentElements = createGameEnvironment(scene, renderer, courtConfig.courtWidth, courtConfig.courtLength, courtConfig.wallHeight);
    gameElements.court = environmentElements.court;
    gameElements.net = environmentElements.net;

    // Create Players
    // Pass scene, courtWidth, courtLength for constructor internal use (boundaries, adding to scene)
    gameElements.player = new Player(0, courtConfig.courtLength / 2 - 2, false, scene, courtConfig.courtWidth, courtConfig.courtLength);
    gameElements.aiPlayer = new Player(0, -courtConfig.courtLength / 2 + 2, true, scene, courtConfig.courtWidth, courtConfig.courtLength);

    // Initialize Ball
    gameElements.ball = initBall(scene, { x: 0, y: 1, z: 0 }); // ball mesh is returned
    gameElements.ballTrails = createBallTrail(scene); // returns ballTrails array

    // Initialize Game State
    gameState.playerScore = 0;
    gameState.aiScore = 0;
    gameState.serving = true;
    gameState.servePosition = 'right'; // 'left' or 'right'
    gameState.lastHitBy = null;    // 'player' or 'ai'
    gameState.currentServer = 'player'; // 'player' or 'ai'
    gameState.serveCount = 0;      // To alternate server every 2 points
    gameState.ballBounces = 0;
    gameState.ballVelocity = { x: 0, y: 0, z: -5 }; // Initial velocity for first serve
    gameState.ballSpin = { x: 0, y: 0, z: 0 };
    gameState.triggerReset = false; // Flag to signal a reset
    gameState.showServeWarning = false; // For UI hint

    // Initialize Event Listeners
    initEventListeners(document, keys, cameraControls);

    // Hide loading, show UI
    if(loadingElement) loadingElement.style.display = 'none';
    if(infoElement) infoElement.style.display = 'block';
    if(scoreElement) scoreElement.style.display = 'block';

    // Start the animation loop
    animate();
}

function predictBallPosition() {
    let futurePos = gameElements.ball.position.clone();
    // Important: Clone the velocity and spin so we don't modify the actual game state during prediction
    let futureVel = { ...gameState.ballVelocity };
    // let futureSpin = { ...gameState.ballSpin }; // Spin effect on trajectory is minor for simple prediction

    const timeStep = 0.05; // Accuracy of prediction
    const maxTime = 1.5;   // How far into the future to predict

    for (let t = 0; t < maxTime; t += timeStep) {
        futureVel.y += defaultPhysicsConstants.gravity * timeStep;
        futurePos.x += futureVel.x * timeStep;
        futurePos.y += futureVel.y * timeStep;
        futurePos.z += futureVel.z * timeStep;

        // Simplified bounce prediction (off walls)
        if (Math.abs(futurePos.z) >= courtConfig.courtLength / 2 - 0.15) {
            futureVel.z *= -defaultPhysicsConstants.bounceDamping; // Use damping from constants
        }
        if (Math.abs(futurePos.x) >= courtConfig.courtWidth / 2 - 0.15) {
            futureVel.x *= -defaultPhysicsConstants.bounceDamping;
        }

        // Stop prediction if ball is at a reasonable hitting height on AI's side
        if (futurePos.y <= (gameElements.aiPlayer.head.position.y + 0.5) && futurePos.z < 0) { // Approximate hitting height
            break;
        }
    }
    return futurePos;
}

function updateAI(deltaTime) {
    const ballPrediction = predictBallPosition(); // Predict where the ball will go

    if (gameState.currentServer === 'ai' && gameState.serving) {
        const serveX = gameState.servePosition === 'right' ? courtConfig.courtWidth / 4 : -courtConfig.courtWidth / 4;
        // AI serves from slightly behind its service line
        const serveZ = -courtConfig.courtLength / 2 + courtConfig.serviceLineLength + 0.5;

        gameElements.aiPlayer.velocity.x = (serveX - gameElements.aiPlayer.group.position.x) * 0.1;
        gameElements.aiPlayer.velocity.z = (serveZ - gameElements.aiPlayer.group.position.z) * 0.1;

        if (Math.abs(gameElements.aiPlayer.group.position.x - serveX) < 0.5 &&
            Math.abs(gameElements.aiPlayer.group.position.z - serveZ) < 0.5 &&
            !gameElements.aiPlayer.swinging) {

            gameElements.aiPlayer.swing();
            gameState.serving = false;
            const serveDirectionX = gameState.servePosition === 'right' ? -1 : 1; // Cross-court
            gameState.ballVelocity = { x: serveDirectionX * (2 + Math.random()*1), y: 4 + Math.random()*1, z: 8 + Math.random()*2 };
            gameState.ballSpin = { x: (Math.random() - 0.5) * 10, y: serveDirectionX * 3, z: (Math.random() - 0.5) * 5 };
            gameState.lastHitBy = 'ai';
        }
        return;
    }

    // AI movement and positioning logic (simplified)
    if (gameElements.ball.position.z < 0 || ballPrediction.z < 0) { // If ball is on AI's side or coming to AI's side
        const targetX = ballPrediction.x * 0.85; // Try to intercept slightly towards center
        const optimalZ = -courtConfig.courtLength / 2 + 2.5; // Base position
        const targetZ = Math.max(ballPrediction.z + 0.5, optimalZ); // Move towards ball but not too close to net unless necessary

        const dx = targetX - gameElements.aiPlayer.group.position.x;
        const dz = targetZ - gameElements.aiPlayer.group.position.z;

        const maxSpeed = gameElements.aiPlayer.speed * 0.8; // AI is a bit slower than its max potential
        const acceleration = 0.15;

        if (Math.abs(dx) > 0.2) gameElements.aiPlayer.velocity.x += Math.sign(dx) * acceleration;
        else gameElements.aiPlayer.velocity.x *= 0.8;

        if (Math.abs(dz) > 0.2) gameElements.aiPlayer.velocity.z += Math.sign(dz) * acceleration;
        else gameElements.aiPlayer.velocity.z *= 0.8;

        const currentSpeed = Math.sqrt(gameElements.aiPlayer.velocity.x ** 2 + gameElements.aiPlayer.velocity.z ** 2);
        if (currentSpeed > maxSpeed) {
            gameElements.aiPlayer.velocity.x = (gameElements.aiPlayer.velocity.x / currentSpeed) * maxSpeed;
            gameElements.aiPlayer.velocity.z = (gameElements.aiPlayer.velocity.z / currentSpeed) * maxSpeed;
        }

        // AI Swing decision
        const ballDistance = gameElements.ball.position.distanceTo(gameElements.aiPlayer.paddle.getWorldPosition(new THREE.Vector3()));
        if (ballDistance < 1.8 && !gameElements.aiPlayer.swinging && gameElements.aiPlayer.canHit &&
            gameElements.ball.position.y < (gameElements.aiPlayer.head.position.y + 1) && gameElements.ball.position.y > 0.1 && // Ball at reasonable height
            gameElements.ball.position.z < -0.2 && // Ball clearly on AI's side of net
            gameState.ballVelocity.z < 5) { // Ball not moving away too fast (or is coming towards AI)
            gameElements.aiPlayer.swing();
        }
    } else { // Ball on player's side, AI returns to a neutral position
        const centerX = 0;
        const centerZ = -courtConfig.courtLength / 2 + 2; // Ready position
        gameElements.aiPlayer.velocity.x = (centerX - gameElements.aiPlayer.group.position.x) * 0.05;
        gameElements.aiPlayer.velocity.z = (centerZ - gameElements.aiPlayer.group.position.z) * 0.05;
    }
}

function resetGameLogic() {
    // Call the physics reset for the ball
    resetBallPhysics(gameState, gameState.ballVelocity, gameState.ballSpin, courtConfig);

    // Alternate server
    gameState.serveCount++;
    if (gameState.serveCount >= 2) {
        gameState.currentServer = gameState.currentServer === 'player' ? 'ai' : 'player';
        gameState.serveCount = 0;
    }
    // Alternate serve position
    gameState.servePosition = gameState.servePosition === 'right' ? 'left' : 'right';
    gameState.triggerReset = false; // Clear the flag
    gameState.ballBounces = 0; // Ensure bounces are reset here too
    gameState.lastHitBy = null; // Clear last hit

    // Reset player positions slightly (optional)
    // gameElements.player.group.position.set(0, 0.7, courtConfig.courtLength / 2 - 2);
    // gameElements.aiPlayer.group.position.set(0, 0.7, -courtConfig.courtLength / 2 + 2);
}

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.05); // Cap delta time to prevent large jumps

    // Player controls
    gameElements.player.velocity.x = 0;
    gameElements.player.velocity.z = 0;
    if (keys['w']) gameElements.player.velocity.z = -1;
    if (keys['s']) gameElements.player.velocity.z = 1;
    if (keys['a']) gameElements.player.velocity.x = -1;
    if (keys['d']) gameElements.player.velocity.x = 1;

    if (gameElements.player.velocity.x !== 0 && gameElements.player.velocity.z !== 0) {
        gameElements.player.velocity.x *= 0.7071; // Normalize diagonal
        gameElements.player.velocity.z *= 0.7071;
    }
    gameElements.player.isSprinting = keys['shift'] || false;

    // Player Swing and Serve Logic
    gameState.showServeWarning = false; // Reset warning
    if (keys[' ']) {
        if (gameState.currentServer === 'player') {
            gameElements.player.swing();
            if (gameState.serving) {
                // Player must be behind their service line to serve
                // Service line is at courtLength/2 - serviceLineLength from origin on player side
                const playerServiceLineZ = courtConfig.courtLength / 2 - courtConfig.serviceLineLength;
                if (gameElements.player.group.position.z > playerServiceLineZ) { // Player is behind (further from net)
                    gameState.serving = false;
                    const serveDirectionX = gameState.servePosition === 'right' ? 1 : -1; // Serve cross-court
                    gameState.ballVelocity = { x: serveDirectionX * (2 + Math.random()*2), y: 5 + Math.random()*2, z: -10 - Math.random()*3 };
                    gameState.ballSpin = { x: (Math.random() - 0.5) * 15, y: serveDirectionX * 5, z: (Math.random() - 0.5) * 10 };
                    gameState.lastHitBy = 'player';
                } else {
                    gameState.showServeWarning = true; // Show warning if trying to serve from wrong position
                }
            }
        } else { // Not player's serve, but player can still swing
            gameElements.player.swing();
        }
        keys[' '] = false; // Consume spacebar press
    }

    // Update game objects
    gameElements.player.update(deltaTime);
    gameElements.aiPlayer.update(deltaTime);
    updateAI(deltaTime);

    // Update ball physics and check collisions
    // Pass scene for createWallHitEffect, if it's still called from within updateBall
    updateBall(deltaTime, gameState, gameElements, defaultPhysicsConstants, courtConfig, scene);

    // Check if ball logic signaled a reset
    if (gameState.triggerReset) {
        resetGameLogic();
    }

    // Camera dynamics
    const targetCameraLookAt = new THREE.Vector3(gameElements.player.group.position.x, gameElements.player.group.position.y + 0.5, gameElements.player.group.position.z - 2);
    camera.position.x += (gameElements.player.group.position.x + cameraControls.mouseX * 3 - camera.position.x) * deltaTime * 3;
    camera.position.y += (cameraControls.cameraHeight - cameraControls.mouseY * 2 - camera.position.y) * deltaTime * 3;
    camera.position.z += (gameElements.player.group.position.z + cameraControls.cameraDistance - camera.position.z) * deltaTime * 3;
    camera.lookAt(targetCameraLookAt);

    // UI Updates
    updateScoreDisplay(scoreElement, gameState.playerScore, gameState.aiScore, gameState.currentServer);
    // Determine if player is behind service line for the warning, only if it's their serve turn and they are currently serving
    const isPlayerBehindLine = gameElements.player.group.position.z > (courtConfig.courtLength / 2 - courtConfig.serviceLineLength);
    const showActualWarning = gameState.serving && gameState.currentServer === 'player' && gameState.showServeWarning && !isPlayerBehindLine;
    updateInfoDisplay(infoElement, gameState.serving, gameState.currentServer, showActualWarning);

    renderer.render(scene, camera);
}

// Event Listeners
window.addEventListener('load', initGame);
window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});
