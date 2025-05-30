import * as THREE from 'three';

// --- Ball Object and Materials ---
let ball;
let ballMaterial; // To allow modification in checkPaddleCollision
let ballGlow;
let ballTrails = [];

// --- Ball Physics Variables (will be part of a physicsConstants object) ---
const defaultPhysicsConstants = {
    gravity: -9.81,
    bounceDamping: 0.75,
    airResistance: 0.99,
    spinEffect: 0.001,
    maxBallSpeed: 25 // This was defined but not used in the original updateBall, will keep for now
};

// --- Ball State (managed by main.js, passed around or accessed via gameState object) ---
// let ballVelocity = { x: 0, y: 0, z: -5 }; // Initial value, will be set by resetBall
// let ballSpin = { x: 0, y: 0, z: 0 }; // Initial value, will be set by resetBall

// --- Initialization Functions ---

function initBall(scene, initialPosition = { x: 0, y: 1, z: 0 }) {
    const ballGeometry = new THREE.SphereGeometry(0.1, 32, 32);
    ballMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        roughness: 0.2,
        metalness: 0.0,
        emissive: 0x00ff00,
        emissiveIntensity: 0.3
    });
    ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.castShadow = true;
    ball.receiveShadow = true;
    ball.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
    scene.add(ball);

    // Add glowing outline to ball
    const glowGeometry = new THREE.SphereGeometry(0.12, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide
    });
    ballGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    ball.add(ballGlow);
    return ball; // Return the ball mesh
}

function createBallTrail(scene) {
    const trailGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    const trailBaseMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.6
    });
    for(let i = 0; i < 10; i++) {
        const trail = new THREE.Mesh(trailGeometry, trailBaseMaterial.clone());
        trail.visible = false;
        scene.add(trail);
        ballTrails.push(trail);
    }
    return ballTrails;
}

// --- Effect Functions ---

function createWallHitEffect(x, y, z, scene) {
    const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const particleMat = new THREE.MeshBasicMaterial({ // Renamed from particleMaterial to avoid conflict
        color: 0xffffff,
        transparent: true,
        opacity: 0.5
    });

    for(let i = 0; i < 5; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMat.clone());
        particle.position.set(x, y, z);
        scene.add(particle);

        const particleVelocity = { // Renamed from velocity
            x: (Math.random() - 0.5) * 2,
            y: Math.random() * 2,
            z: (Math.random() - 0.5) * 2
        };

        const animateParticle = () => {
            particle.position.x += particleVelocity.x * 0.02;
            particle.position.y += particleVelocity.y * 0.02;
            particle.position.z += particleVelocity.z * 0.02;
            particle.material.opacity -= 0.02;

            if (particle.material.opacity > 0) {
                requestAnimationFrame(animateParticle);
            } else {
                scene.remove(particle);
                particle.geometry.dispose(); // Dispose geometry
                particle.material.dispose(); // Dispose material
            }
        };
        animateParticle();
    }
}

// --- Core Logic Functions ---

function checkPaddleCollision(playerObj, playerType, ball, currentBallVelocity, currentBallSpin, gameState, courtConfig) {
    const paddleWorldPos = new THREE.Vector3();
    playerObj.paddle.getWorldPosition(paddleWorldPos);

    const horizontalDistance = Math.sqrt(
        Math.pow(ball.position.x - paddleWorldPos.x, 2) +
        Math.pow(ball.position.z - paddleWorldPos.z, 2)
    );

    const verticalRange = Math.abs(ball.position.y - paddleWorldPos.y) < 1.5;

    if (horizontalDistance < 1.5 && verticalRange && playerObj.swinging && playerObj.canHit) {
        let targetZ = playerObj.isAI ? courtConfig.courtLength / 2 -1 : -courtConfig.courtLength / 2 + 1; // Hit towards opponent's deep side
        let targetX = 0;

        if (paddleWorldPos.x < ball.position.x) {
            targetX = 2;
        } else if (paddleWorldPos.x > ball.position.x) {
            targetX = -2;
        }

        const power = 10;
        const direction = new THREE.Vector3(
            targetX - ball.position.x,
            0.5,
            targetZ - ball.position.z
        ).normalize();

        currentBallVelocity.x = direction.x * power;
        currentBallVelocity.y = direction.y * power + 3;
        currentBallVelocity.z = direction.z * power;

        currentBallSpin.x = (Math.random() - 0.5) * 5;
        currentBallSpin.y = (Math.random() - 0.5) * 3;
        currentBallSpin.z = (Math.random() - 0.5) * 5;

        gameState.ballBounces = 0;
        gameState.lastHitBy = playerType;

        if (ballMaterial) { // Ensure ballMaterial is accessible
            ballMaterial.emissiveIntensity = 0.8;
            setTimeout(() => {
                if (ballMaterial) ballMaterial.emissiveIntensity = 0.3;
            }, 200);
        }

        playerObj.canHit = false;
        setTimeout(() => {
            playerObj.canHit = true;
        }, 300); // Reduced delay a bit
    }
}

function resetBall(gameState, currentBallVelocity, currentBallSpin, courtConfig) {
    gameState.serving = true;
    currentBallVelocity.x = 0;
    currentBallVelocity.y = 0;
    currentBallVelocity.z = (gameState.currentServer === 'player' || gameState.currentServer === undefined) ? -5 : 5; // Initial serve direction based on server
    currentBallSpin.x = 0;
    currentBallSpin.y = 0;
    currentBallSpin.z = 0;
    gameState.ballBounces = 0;
    gameState.lastHitBy = null;
    // gameState.servePosition = gameState.servePosition === 'right' ? 'left' : 'right'; // This should be handled by game logic in main.js
}


function updateBall(deltaTime, gameState, gameElements, physicsConstants, courtConfig, scene) {
    const { ball, player, aiPlayer, ballTrails } = gameElements;
    const { gravity, bounceDamping, airResistance, spinEffect } = physicsConstants;
    const { courtWidth, courtLength, serviceLine, netHeight } = courtConfig;
    let { currentBallVelocity, currentBallSpin } = gameState; // these are objects, so they are passed by reference

    if (gameState.serving) {
        const serverPlayer = gameState.currentServer === 'player' ? player : aiPlayer;
        const serveX = gameState.servePosition === 'right' ? courtWidth / 4 : -courtWidth / 4; // Adjusted for typical service box
        let serveZ;

        if (gameState.currentServer === 'player') {
            serveZ = courtLength / 2 - serviceLine - 0.5;
             ball.position.set(
                serverPlayer.group.position.x, // Ball follows player for serve prep
                1.5,
                Math.min(serverPlayer.group.position.z - 0.3, serveZ + 0.2) // Ensure behind line
            );
        } else { // AI Serving
            serveZ = -courtLength / 2 + serviceLine + 0.5;
             ball.position.set(
                serverPlayer.group.position.x,
                1.5,
                Math.max(serverPlayer.group.position.z + 0.3, serveZ - 0.2) // Ensure behind line
            );
        }

        ballTrails.forEach(trail => trail.visible = false);
        return; // gameState modifications will be returned if it's an object and modified directly
    }

    currentBallVelocity.y += gravity * deltaTime;
    currentBallVelocity.x *= Math.pow(airResistance, deltaTime * 60);
    currentBallVelocity.z *= Math.pow(airResistance, deltaTime * 60);

    currentBallVelocity.x += currentBallSpin.y * spinEffect;
    currentBallVelocity.z -= currentBallSpin.x * spinEffect; // Magnus effect direction depends on spin and velocity component

    const prevPos = ball.position.clone();
    ball.position.x += currentBallVelocity.x * deltaTime;
    ball.position.y += currentBallVelocity.y * deltaTime;
    ball.position.z += currentBallVelocity.z * deltaTime;

    for(let i = ballTrails.length - 1; i > 0; i--) {
        if (ballTrails[i-1]) ballTrails[i].position.copy(ballTrails[i-1].position);
        ballTrails[i].material.opacity = 0.3 * (1 - i / ballTrails.length);
        ballTrails[i].visible = true;
    }
    if (ballTrails[0]) ballTrails[0].position.copy(prevPos);

    ball.rotation.x += currentBallSpin.x * deltaTime;
    ball.rotation.y += currentBallSpin.y * deltaTime;
    ball.rotation.z += currentBallSpin.z * deltaTime;

    // Ground bounce
    if (ball.position.y <= ball.geometry.parameters.radius) { // Use ball radius
        ball.position.y = ball.geometry.parameters.radius;
        currentBallVelocity.y = Math.abs(currentBallVelocity.y) * bounceDamping;
        gameState.ballBounces++;

        currentBallSpin.x *= 0.8;
        currentBallSpin.y *= 0.8;
        currentBallSpin.z *= 0.8;

        if (gameState.ballBounces > 1) {
            if (ball.position.z > 0) gameState.aiScore++; else gameState.playerScore++;
            // gameState.serveCount++; // Handled in main.js
            // if (gameState.serveCount >= 2) { // Handled in main.js
            //     gameState.currentServer = gameState.currentServer === 'player' ? 'ai' : 'player';
            //     gameState.serveCount = 0;
            // }
            gameState.triggerReset = true; // Signal main.js to handle reset sequence
        }
    }

    // Wall bounces (simplified logic for Padel - ball can hit walls and stay in play)
    const wallOffset = ball.geometry.parameters.radius + 0.1; // Ball radius + small offset

    // Back walls
    if (ball.position.z >= courtLength/2 - wallOffset) {
        ball.position.z = courtLength/2 - wallOffset;
        currentBallVelocity.z *= -0.8; // Padel walls are somewhat bouncy
        createWallHitEffect(ball.position.x, ball.position.y, ball.position.z, scene);
    }
    if (ball.position.z <= -courtLength/2 + wallOffset) {
        ball.position.z = -courtLength/2 + wallOffset;
        currentBallVelocity.z *= -0.8;
        createWallHitEffect(ball.position.x, ball.position.y, ball.position.z, scene);
    }

    // Side walls (Mesh/Grid part - less bouncy or different interaction if desired)
    if (Math.abs(ball.position.x) >= courtWidth/2 - wallOffset) {
        currentBallVelocity.x *= -0.7; // Slightly less bounce from side
        ball.position.x = Math.sign(ball.position.x) * (courtWidth/2 - wallOffset);
        createWallHitEffect(ball.position.x, ball.position.y, ball.position.z, scene);
    }

    // Net collision
    const netCheckDistance = ball.geometry.parameters.radius + 0.1;
    if (Math.abs(ball.position.z) < netCheckDistance && ball.position.y < netHeight && ball.position.y > 0) {
        if (Math.abs(currentBallVelocity.z) > 0.5) { // Min speed to consider it a 'hit'
            currentBallVelocity.z *= -0.3; // Net absorbs a lot of energy
            currentBallVelocity.y *= 0.5;
            ball.position.z = Math.sign(ball.position.z) * netCheckDistance;
        } else { // Ball just touches or rolls over
            currentBallVelocity.z *= 0.1;
            currentBallVelocity.y = Math.max(currentBallVelocity.y, -0.5); // Prevent sticking
        }
        // Fault logic for net hit (if ball was going towards opponent)
        // This depends on lastHitBy and direction, more complex game rule
        // For now, just bounce off, point scoring is based on bounces
    }

    // Ball out of play (e.g., over the top of walls, or wide)
    if (ball.position.y < -2 || ball.position.y > wallHeight + 2 || Math.abs(ball.position.x) > courtWidth/2 + 2 || Math.abs(ball.position.z) > courtLength/2 + 2) {
         if(gameState.lastHitBy === 'player') gameState.aiScore++; else gameState.playerScore++;
         gameState.triggerReset = true; // Signal main.js
    }

    if (!gameState.serving) {
        checkPaddleCollision(player, 'player', ball, currentBallVelocity, currentBallSpin, gameState, courtConfig);
        checkPaddleCollision(aiPlayer, 'ai', ball, currentBallVelocity, currentBallSpin, gameState, courtConfig);
    }
}

export {
    ball, // The mesh itself, might be useful for direct access if needed
    ballMaterial, // Export if main needs to change its properties directly
    // ballVelocity, // Managed via gameState
    // ballSpin, // Managed via gameState
    ballTrails,
    defaultPhysicsConstants,
    initBall,
    createBallTrail,
    updateBall,
    checkPaddleCollision, // May not be needed if only called by updateBall
    resetBall,
    createWallHitEffect
};
