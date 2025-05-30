/**
 * Initializes keyboard and mouse event listeners.
 * @param {Document} doc - The document object to attach event listeners to.
 * @param {object} keysState - An object to store the state of keyboard keys.
 * @param {object} cameraState - An object to store camera control states (mouseX, mouseY, cameraDistance, cameraHeight).
 */
function initEventListeners(doc, keysState, cameraState) {
    // Keyboard controls
    doc.addEventListener('keydown', (e) => {
        keysState[e.key.toLowerCase()] = true;
        // e.preventDefault(); // Prevent default only if necessary, might interfere with other inputs
    });
    doc.addEventListener('keyup', (e) => {
        keysState[e.key.toLowerCase()] = false;
        // e.preventDefault();
    });

    // Mouse controls for camera
    doc.addEventListener('mousemove', (e) => {
        // Normalize mouse position from -1 to 1
        cameraState.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        cameraState.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    doc.addEventListener('wheel', (e) => {
        cameraState.cameraDistance += e.deltaY * 0.01;
        // Clamp cameraDistance to a reasonable range
        cameraState.cameraDistance = Math.max(5, Math.min(30, cameraState.cameraDistance)); // Adjusted min slightly
    });
}

/**
 * Updates the score display on the screen.
 * @param {HTMLElement} scoreElement - The DOM element for the score.
 * @param {number} playerScore - The player's current score.
 * @param {number} aiScore - The AI's current score.
 * @param {string} currentServer - Who is currently serving ('player' or 'ai').
 */
function updateScoreDisplay(scoreElement, playerScore, aiScore, currentServer) {
    if (scoreElement) {
        const playerServeIndicator = currentServer === 'player' ? ' 🎾' : '';
        const aiServeIndicator = currentServer === 'ai' ? ' 🎾' : '';
        scoreElement.innerHTML = `Player ${playerServeIndicator}: ${playerScore} | AI ${aiServeIndicator}: ${aiScore}`;
    }
}

/**
 * Updates the info display panel (controls, serve hints).
 * @param {HTMLElement} infoElement - The DOM element for the info panel.
 * @param {boolean} serving - Is it currently the serve phase.
 * @param {string} currentServer - Who is currently serving ('player' or 'ai').
 * @param {boolean} showServeWarning - Whether to show the "move behind service line" warning.
 */
function updateInfoDisplay(infoElement, serving, currentServer, showServeWarning = false) {
    if (infoElement) {
        let htmlContent = `
            <strong>CONTROLS:</strong><br>
            <span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> - Move<br>
            <span class="key">SPACE</span> - Swing / Serve<br>
            <span class="key">SHIFT</span> - Sprint<br>
            Mouse - Look Around`;

        if (serving && currentServer === 'player' && showServeWarning) {
            htmlContent += `<br><br><strong style="color: #ffff00;">⚠️ SERVE: Move behind the service line!</strong>`;
        } else if (serving && currentServer === 'player') {
             htmlContent += `<br><br><strong style="color: #aaffaa;">YOUR SERVE</strong>`;
        } else if (serving && currentServer === 'ai') {
             htmlContent += `<br><br><strong style="color: #ffaaaa;">AI SERVE</strong>`;
        }
        infoElement.innerHTML = htmlContent;
    }
}

export { initEventListeners, updateScoreDisplay, updateInfoDisplay };
