import * as THREE from 'three'; // Assuming 'three' is the correct import path

class Player {
    constructor(x, z, isAI = false, scene, courtWidth, courtLength) { // Added scene, courtWidth, courtLength
        this.group = new THREE.Group();

        // More realistic body proportions
        const skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xffdbac,
            roughness: 0.7,
            metalness: 0.0
        });

        const shirtMaterial = new THREE.MeshStandardMaterial({
            color: isAI ? 0xcc0000 : 0x0066cc,
            roughness: 0.8,
            metalness: 0.0
        });

        const shortsMaterial = new THREE.MeshStandardMaterial({
            color: isAI ? 0x660000 : 0x003366,
            roughness: 0.9,
            metalness: 0.0
        });

        // Torso
        const torsoGeometry = new THREE.CylinderGeometry(0.35, 0.3, 1.0, 12);
        this.torso = new THREE.Mesh(torsoGeometry, shirtMaterial);
        this.torso.position.y = 1.2;
        this.torso.castShadow = true;
        this.torso.receiveShadow = true;
        this.group.add(this.torso);

        // Shorts
        const shortsGeometry = new THREE.CylinderGeometry(0.3, 0.25, 0.4, 12);
        this.shorts = new THREE.Mesh(shortsGeometry, shortsMaterial);
        this.shorts.position.y = 0.5;
        this.shorts.castShadow = true;
        this.group.add(this.shorts);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        this.head = new THREE.Mesh(headGeometry, skinMaterial);
        this.head.position.y = 1.9;
        this.head.castShadow = true;
        this.group.add(this.head);

        // Arms
        const armGeometry = new THREE.CylinderGeometry(0.08, 0.06, 0.8, 8);

        this.leftArm = new THREE.Mesh(armGeometry, skinMaterial);
        this.leftArm.position.set(-0.35, 1.2, 0);
        this.leftArm.rotation.z = 0.2;
        this.leftArm.castShadow = true;
        this.group.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeometry, skinMaterial);
        this.rightArm.position.set(0.35, 1.2, 0);
        this.rightArm.rotation.z = -0.2;
        this.rightArm.castShadow = true;
        this.group.add(this.rightArm);

        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.1, 0.08, 1.0, 8);

        this.leftLeg = new THREE.Mesh(legGeometry, skinMaterial);
        this.leftLeg.position.set(-0.15, -0.2, 0);
        this.leftLeg.castShadow = true;
        this.group.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(legGeometry, skinMaterial);
        this.rightLeg.position.set(0.15, -0.2, 0);
        this.rightLeg.castShadow = true;
        this.group.add(this.rightLeg);

        // Shoes
        const shoeMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.6,
            metalness: 0.0
        });

        const shoeGeometry = new THREE.BoxGeometry(0.12, 0.08, 0.25);

        this.leftShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
        this.leftShoe.position.set(-0.15, -0.74, 0.05);
        this.leftShoe.castShadow = true;
        this.group.add(this.leftShoe);

        this.rightShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
        this.rightShoe.position.set(0.15, -0.74, 0.05);
        this.rightShoe.castShadow = true;
        this.group.add(this.rightShoe);

        // Enhanced paddle with realistic materials
        const paddleGroup = new THREE.Group();

        // Paddle face
        const paddleFaceGeometry = new THREE.BoxGeometry(0.45, 0.02, 0.5);
        const paddleFaceMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.2,
            metalness: 0.1
        });
        const paddleFace = new THREE.Mesh(paddleFaceGeometry, paddleFaceMaterial);
        paddleFace.castShadow = true;
        paddleGroup.add(paddleFace);

        // Paddle edge
        const paddleEdgeGeometry = new THREE.TorusGeometry(0.24, 0.02, 4, 20);
        const paddleEdgeMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6600,
            roughness: 0.3,
            metalness: 0.2
        });
        const paddleEdge = new THREE.Mesh(paddleEdgeGeometry, paddleEdgeMaterial);
        paddleEdge.rotation.x = Math.PI / 2;
        paddleGroup.add(paddleEdge);

        // Handle
        const handleGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.3, 12);
        const handleMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a4a4a,
            roughness: 0.7,
            metalness: 0.1
        });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.y = -0.25;
        handle.castShadow = true;
        paddleGroup.add(handle);

        // Grip
        const gripGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8);
        const gripMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.9,
            metalness: 0.0
        });
        const grip = new THREE.Mesh(gripGeometry, gripMaterial);
        grip.position.y = -0.3;
        paddleGroup.add(grip);

        this.paddle = paddleGroup;
        this.paddle.position.set(0.5, 1.2, 0);
        this.group.add(this.paddle);

        // Set initial position
        this.group.position.set(x, 0.7, z);
        if (scene) { // Add to scene if provided
            scene.add(this.group);
        }

        // Store court dimensions
        this.courtWidth = courtWidth;
        this.courtLength = courtLength;

        // Movement properties
        this.velocity = { x: 0, z: 0 };
        this.targetRotation = 0;
        this.swinging = false;
        this.swingTimer = 0;
        this.isAI = isAI;
        this.speed = 5;
        this.sprintMultiplier = 1.8;
        this.isSprinting = false;
        this.canHit = true;

        // Animation properties
        this.walkCycle = 0;
        this.armSwing = 0;
    }

    update(deltaTime) {
        // Smooth movement
        const moveSpeed = this.speed * (this.isSprinting ? this.sprintMultiplier : 1);

        this.group.position.x += this.velocity.x * moveSpeed * deltaTime;
        this.group.position.z += this.velocity.z * moveSpeed * deltaTime;

        // Keep within court bounds - prevent crossing net
        const minZ = this.isAI ? -this.courtLength/2 + 0.5 : 0.5;
        const maxZ = this.isAI ? -0.5 : this.courtLength/2 - 0.5;

        this.group.position.x = Math.max(-this.courtWidth/2 + 0.5, Math.min(this.courtWidth/2 - 0.5, this.group.position.x));
        this.group.position.z = Math.max(minZ, Math.min(maxZ, this.group.position.z));

        // Rotate player based on movement direction
        if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
            this.targetRotation = Math.atan2(this.velocity.x, this.velocity.z);

            // Walking animation
            this.walkCycle += deltaTime * 10 * moveSpeed / this.speed;
            const walkAmplitude = 0.1;

            // Leg animation
            this.leftLeg.rotation.x = Math.sin(this.walkCycle) * walkAmplitude;
            this.rightLeg.rotation.x = -Math.sin(this.walkCycle) * walkAmplitude;

            // Subtle body bob
            this.group.position.y = 0.7 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.02;

            // Arm swing when not holding paddle ready
            if (!this.swinging) {
                this.leftArm.rotation.x = -Math.sin(this.walkCycle) * walkAmplitude * 0.5;
            }
        } else {
            // Idle animation
            this.walkCycle += deltaTime * 2;
            this.group.position.y = 0.7 + Math.sin(this.walkCycle) * 0.01;
        }

        // Smooth rotation
        const rotationDiff = this.targetRotation - this.group.rotation.y;
        this.group.rotation.y += rotationDiff * deltaTime * 10;

        // Swing mechanics
        if (this.swinging) {
            this.swingTimer += deltaTime * 8; // Slower swing for better timing
            const swingProgress = this.swingTimer / Math.PI;

            // Wider swing motion
            const swingAngle = Math.sin(this.swingTimer) * Math.PI / 1.5;
            const liftAngle = Math.sin(this.swingTimer * 0.5) * Math.PI / 6;

            this.rightArm.rotation.x = -liftAngle - 0.3;
            this.rightArm.rotation.z = -0.2 - swingAngle * 0.5;

            this.paddle.rotation.y = swingAngle;
            this.paddle.rotation.z = liftAngle * 0.3;
            this.paddle.position.x = 0.5 + Math.sin(swingAngle) * 0.5;
            this.paddle.position.y = 1.2 + Math.sin(liftAngle) * 0.1;

            // Body rotation during swing
            this.torso.rotation.y = swingAngle * 0.3;

            if (this.swingTimer > Math.PI) {
                this.swinging = false;
                this.swingTimer = 0;
                this.paddle.rotation.y = 0;
                this.paddle.rotation.z = 0;
                this.rightArm.rotation.x = 0;
                this.rightArm.rotation.z = -0.2;
                this.torso.rotation.y = 0;
            }
        } else {
            // Ready position - paddle in front
            this.paddle.position.x = 0.7;
            this.paddle.position.y = 1.2;
            this.paddle.position.z = -0.3 * Math.sign(this.group.position.z);
            this.rightArm.rotation.x = -0.3;
        }
    }

    swing() {
        if (!this.swinging) {
            this.swinging = true;
            this.swingTimer = 0;
        }
    }
}

export { Player };
