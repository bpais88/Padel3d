import * as THREE from 'three';

// Default net height, can be overridden if passed in params or defined elsewhere
const NET_HEIGHT = 0.92;
const WALL_THICKNESS = 0.15; // Moved from original global scope

function createGameEnvironment(scene, renderer, courtWidth, courtLength, wallHeight) {

    // Create gradient sky
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x0077be) },
            bottomColor: { value: new THREE.Color(0xffffff) },
            offset: { value: 33 },
            exponent: { value: 0.6 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffd4a3, 1.5);
    sunLight.position.set(30, 40, 20);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -40;
    sunLight.shadow.camera.right = 40;
    sunLight.shadow.camera.top = 40;
    sunLight.shadow.camera.bottom = -40;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.mapSize.width = 4096; // High res shadows
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.5);
    fillLight.position.set(-20, 30, -10);
    scene.add(fillLight);

    // Court
    const courtGeometry = new THREE.BoxGeometry(courtWidth, 0.2, courtLength);
    const courtCanvas = document.createElement('canvas');
    courtCanvas.width = 1024;
    courtCanvas.height = 2048;
    const ctx = courtCanvas.getContext('2d');

    ctx.fillStyle = '#0066cc'; // Blue synthetic court base
    ctx.fillRect(0, 0, courtCanvas.width, courtCanvas.height);

    for(let i = 0; i < 20000; i++) { // Texture pattern
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
        ctx.fillRect(Math.random() * courtCanvas.width, Math.random() * courtCanvas.height, 2, 2);
    }

    ctx.strokeStyle = '#ffffff'; // Court lines
    ctx.lineWidth = 10;

    const serviceLineZ = courtCanvas.height * 0.35; // 3m from center (relative to texture)
    ctx.beginPath();
    ctx.moveTo(0, serviceLineZ);
    ctx.lineTo(courtCanvas.width, serviceLineZ);
    ctx.moveTo(0, courtCanvas.height - serviceLineZ);
    ctx.lineTo(courtCanvas.width, courtCanvas.height - serviceLineZ);
    ctx.stroke();

    ctx.beginPath(); // Center line
    ctx.moveTo(courtCanvas.width / 2, serviceLineZ);
    ctx.lineTo(courtCanvas.width / 2, courtCanvas.height - serviceLineZ);
    ctx.stroke();

    ctx.lineWidth = 8; // Side lines
    ctx.beginPath();
    ctx.moveTo(50, 0); ctx.lineTo(50, courtCanvas.height);
    ctx.moveTo(courtCanvas.width - 50, 0); ctx.lineTo(courtCanvas.width - 50, courtCanvas.height);
    ctx.stroke();

    const courtTexture = new THREE.CanvasTexture(courtCanvas);
    if (renderer && renderer.capabilities) { // Check if renderer is available for anisotropy
         courtTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }

    const courtMaterial = new THREE.MeshStandardMaterial({
        map: courtTexture,
        roughness: 0.8,
        metalness: 0.05,
        bumpScale: 0.001 // Requires a bump map, if you have one
    });
    const court = new THREE.Mesh(courtGeometry, courtMaterial);
    court.receiveShadow = true;
    scene.add(court);

    // Materials for walls and frames
    const wallSolidMaterial = new THREE.MeshStandardMaterial({ // Renamed from wallMaterial to avoid conflict
        color: 0x1a1a1a, // Darker, less reflective for solid parts
        roughness: 0.7,
        metalness: 0.3
    });

    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x0a0a0a, // Very dark grey for frames
        roughness: 0.4,
        metalness: 0.8
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x88ccff, // Light blue tint
        metalness: 0.1,
        roughness: 0.05, // Smoother for glass
        transmission: 0.9, // High transmission
        thickness: 0.3, // Affects refraction
        transparent: true,
        opacity: 0.3, // More subtle opacity
        ior: 1.5, // Index of refraction for glass
        reflectivity: 0.6, // Higher reflectivity for glass
        side: THREE.DoubleSide
    });

    // Helper to create wall segments (using frameMaterial by default now for structure)
    const createWallSegment = (width, height, depth, x, y, z, material = frameMaterial) => {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        return mesh;
    };

    // --- Create Walls and Frames ---
    const glassHeight = 3.5; // Height of the glass panels
    const bottomFrameHeight = 0.3; // Height of the bottom solid frame part

    // Bottom frame around court (using frameMaterial)
    createWallSegment(courtWidth + WALL_THICKNESS * 2, bottomFrameHeight, WALL_THICKNESS, 0, bottomFrameHeight/2, -courtLength/2);
    createWallSegment(courtWidth + WALL_THICKNESS * 2, bottomFrameHeight, WALL_THICKNESS, 0, bottomFrameHeight/2, courtLength/2);
    createWallSegment(WALL_THICKNESS, bottomFrameHeight, courtLength, -courtWidth/2 - WALL_THICKNESS/2, bottomFrameHeight/2, 0);
    createWallSegment(WALL_THICKNESS, bottomFrameHeight, courtLength, courtWidth/2 + WALL_THICKNESS/2, bottomFrameHeight/2, 0);

    // Back glass walls
    const backGlass1 = new THREE.Mesh(new THREE.BoxGeometry(courtWidth, glassHeight, 0.05), glassMaterial);
    backGlass1.position.set(0, glassHeight/2 + bottomFrameHeight, -courtLength/2);
    backGlass1.castShadow = false; // Glass usually doesn't cast strong shadows
    backGlass1.receiveShadow = true;
    scene.add(backGlass1);

    const backGlass2 = new THREE.Mesh(new THREE.BoxGeometry(courtWidth, glassHeight, 0.05), glassMaterial);
    backGlass2.position.set(0, glassHeight/2 + bottomFrameHeight, courtLength/2);
    backGlass2.castShadow = false;
    backGlass2.receiveShadow = true;
    scene.add(backGlass2);

    // Helper to create metal grid for side walls
    const createMetalGrid = (width, height, x, z) => {
        const gridGroup = new THREE.Group();
        const barRadius = 0.01;
        const barMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a, roughness: 0.5, metalness: 0.8
        });

        // Vertical bars
        const vBarGeometry = new THREE.CylinderGeometry(barRadius, barRadius, height);
        for(let i = 0; i <= width; i += 0.2) { // Use <= to include the last bar
            const bar = new THREE.Mesh(vBarGeometry, barMaterial);
            bar.position.set(x, height/2 + bottomFrameHeight, z - width/2 + i);
            bar.castShadow = true;
            gridGroup.add(bar);
        }
        // Horizontal bars
        const hBarGeometry = new THREE.CylinderGeometry(barRadius, barRadius, width);
        for(let i = 0; i <= height; i += 0.2) {
            const bar = new THREE.Mesh(hBarGeometry, barMaterial);
            bar.rotation.z = Math.PI / 2;
            bar.position.set(x, i + bottomFrameHeight, z);
            bar.castShadow = true;
            gridGroup.add(bar);
        }
        scene.add(gridGroup);
        return gridGroup;
    };

    // Add side grids (assuming courtLength is the width for the grid here)
    createMetalGrid(courtLength, glassHeight, -courtWidth/2, 0);
    createMetalGrid(courtLength, glassHeight, courtWidth/2, 0);

    // --- Net ---
    const netActualHeight = NET_HEIGHT; // Use the constant
    const netGeometry = new THREE.PlaneGeometry(courtWidth, netActualHeight, 40, 10); // Fewer segments for sag
    const netPositions = netGeometry.attributes.position;
    for(let i = 0; i < netPositions.count; i++) {
        const xPos = netPositions.getX(i);
        // Apply sag: more sag in the middle, less at the posts
        const sagFactor = Math.sin((xPos / courtWidth + 0.5) * Math.PI);
        netPositions.setY(i, netPositions.getY(i) - sagFactor * 0.05); // 0.05 is sag amount
    }
    netGeometry.attributes.position.needsUpdate = true; // Important after manual modification

    const netMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        alphaTest: 0.1, // For sharper edges if using a texture with alpha
        roughness: 0.8,
        metalness: 0.1 // Slightly metallic
    });
    const net = new THREE.Mesh(netGeometry, netMaterial);
    net.position.y = netActualHeight / 2;
    // net.rotation.x = Math.PI / 2; // This would make it flat on the ground. Plane is XY by default.
    // For a vertical net, it should be fine, or rotate around Y if it's created along Z.
    // Assuming PlaneGeometry is XZ and we want it vertical along X axis:
    // No rotation needed if it's width (X) and height (Y)
    net.castShadow = true;
    scene.add(net);

    // Net posts
    const postHeight = netActualHeight + 0.1; // Slightly taller than net
    const postGeometry = new THREE.CylinderGeometry(0.05, 0.05, postHeight, 12);
    const postMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222, roughness: 0.3, metalness: 0.8
    });

    const post1 = new THREE.Mesh(postGeometry, postMaterial);
    post1.position.set(-courtWidth/2 - 0.05, postHeight/2, 0);
    post1.castShadow = true;
    scene.add(post1);

    const post2 = new THREE.Mesh(postGeometry, postMaterial);
    post2.position.set(courtWidth/2 + 0.05, postHeight/2, 0);
    post2.castShadow = true;
    scene.add(post2);

    // Return any objects that might need to be referenced later, e.g., the court itself
    return {
        court,
        net,
        // Lights and sky are usually not referenced directly after creation
    };
}

export { createGameEnvironment, NET_HEIGHT, WALL_THICKNESS }; // Export constants if they are fixed here
