Okay, let's add a virtual joystick for mobile users using the popular `rexVirtualJoystickPlugin` for Phaser 3.

**1. Install the Plugin**

If you haven't already, add the rex plugins library to your project:

```bash
npm install phaser3-rex-plugins
# or
yarn add phaser3-rex-plugins
```

**2. Configure Phaser to Load the Plugin**

Modify your main Phaser game configuration to include the plugin globally.

*   **File:** `src/game/main.ts`

```typescript
import { AUTO, Game } from 'phaser';
import Preloader from './scenes/Preloader';
import { Game as MainGame } from './Game'; // Rename import to avoid conflict

// Import the plugin
import RexVirtualJoystickPlugin from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin.js';

// Find out more information about the Game Config at:
// https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024, // Consider dynamic sizing or scaling for mobile later
    height: 768,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scene: [
        Preloader,
        MainGame, // Use the renamed import
    ],
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            // debug: true, // Enable for debugging joystick/physics issues
        },
    },
    // Add the plugins configuration
    plugins: {
        global: [{
            key: 'rexVirtualJoystick', // Key to access the plugin instance
            plugin: RexVirtualJoystickPlugin,
            start: true // Start the plugin automatically
        }]
    }
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;
```

**3. Create the Joystick in the Game Scene**

In your main game scene, detect if the game is running on a touch device and create the joystick if it is.

*   **File:** `src/game/Game.ts`

```typescript
import Phaser from 'phaser';
import { createCharacterAnims } from './animation/Animation';
import Network from '../services/Network.ts';
import { IPlayer } from '../types/IOfficeState.ts';
import './character/MyPlayer.ts';
import './character/OtherPlayer.ts';
import MyPlayer from './character/MyPlayer.ts';
import OtherPlayer from './character/OtherPlayer.ts';

// Import the Joystick type for type safety
import VirtualJoystick from 'phaser3-rex-plugins/plugins/virtualjoystick.js'; // Use .js extension

const PROXIMITY_THRESHOLD = 200;

export class Game extends Phaser.Scene {
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null; // Allow null
    private myPlayer!: MyPlayer;
    private network!: Network;
    private otherPlayers!: Phaser.Physics.Arcade.Group;
    private otherPlayerMap = new Map<string, { player: OtherPlayer, nameText: Phaser.GameObjects.Text }>();
    private myPlayerNameText!: Phaser.GameObjects.Text;
    private username: string = 'Anonymous';
    private joyStick: VirtualJoystick | null = null; // Declare joystick property

    // Keep constructor, init, preload as they are, but ensure preload handles cursors possibly being null
     preload() {
        // Only create cursor keys if not on a touch device (optional, but good practice)
        if (!this.sys.game.device.input.touch) {
            this.cursors = this.input.keyboard.createCursorKeys();
        }
        console.log("Game scene preload done.");
    }


    async create() {
        console.log("Game scene create starting...");
        if (!this.network) {
            throw new Error('Network instance missing');
        }

        // --- Network Join ---
        // ... (keep existing network join logic) ...
        try {
            console.log(`Attempting to join network with username: ${this.username}`);
            await this.network.join(this.username);
            console.log(`Successfully joined network. My session ID: ${this.network.mySessionId}`);
        } catch (error) {
            console.error("Failed to join network:", error);
            return;
        }

        // --- Scene Setup (Map, Tilesets, Layers) ---
        // ... (keep existing map/layer creation logic) ...
        createCharacterAnims(this.anims);
        const map = this.make.tilemap({ key: 'map' });
        // ... add tilesets, create layers ...
        const tileset1 = map.addTilesetImage('floor', 'floor');
        const tileset2 = map.addTilesetImage('forest', 'forest');
        const tileset3 = map.addTilesetImage('office', 'office');
        const tileset4 = map.addTilesetImage('objects', 'objects');
        const tileset5 = map.addTilesetImage('scifi', 'scifi');
        const allTilesets = [tileset1, tileset2, tileset3, tileset4, tileset5].filter(ts => ts !== null);
        map.createLayer('floor', allTilesets, 0, 0);
        map.createLayer('wall_projection', allTilesets, 0, 0);
        const wallLayer = map.createLayer('walls', allTilesets, 0, 0);
        const objectLayer = map.createLayer('objects', allTilesets, 0, 0);
        map.createLayer('superpose', allTilesets, 0, 0);


        // --- Physics and Camera ---
        // ... (keep existing physics/camera setup) ...
         this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.zoom = 1.5; // Adjust zoom for mobile if needed
        this.cameras.main.backgroundColor.setTo(0, 0, 0);


        // --- Player Creation ---
        // ... (keep existing player creation logic) ...
        const startX = 800;
        const startY = 800;
        this.myPlayer = this.add.myPlayer(startX, startY, 'player', this.network.mySessionId);
        this.myPlayerNameText = this.add.text(startX, startY - this.myPlayer.height, this.username, {
             fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 1);
        this.myPlayer.setNameText(this.myPlayerNameText);
        this.otherPlayers = this.physics.add.group({ classType: OtherPlayer, runChildUpdate: true });
        this.cameras.main.startFollow(this.myPlayer);


        // --- Collisions ---
        // ... (keep existing collision setup) ...
        wallLayer?.setCollisionByProperty({ collides: true });
        objectLayer?.setCollisionByProperty({ collides: true });
        this.physics.add.collider(this.myPlayer, wallLayer);
        this.physics.add.collider(this.myPlayer, objectLayer);
        this.physics.add.collider(this.myPlayer, this.otherPlayers);
        this.physics.add.collider(this.otherPlayers, wallLayer);
        this.physics.add.collider(this.otherPlayers, objectLayer);
        this.myPlayer.setCollideWorldBounds(true);


        // --- Create Virtual Joystick for Touch Devices ---
        if (this.sys.game.device.input.touch) {
             console.log("Touch device detected, creating virtual joystick.");
            // Get the plugin instance using the key defined in the config
            const joystickPlugin = this.plugins.get('rexVirtualJoystick') as typeof RexVirtualJoystickPlugin;

            this.joyStick = joystickPlugin.add(this, {
                x: 120, // Adjust position as needed (e.g., from left edge)
                y: this.cameras.main.height - 120, // Adjust position (e.g., from bottom edge)
                radius: 60, // Size of the joystick base
                base: this.add.circle(0, 0, 60, 0x888888, 0.6), // Visual for the base
                thumb: this.add.circle(0, 0, 30, 0xcccccc, 0.8), // Visual for the stick/thumb
                dir: '8dir', // 8 directions ('4dir', 'horizontal', 'vertical')
                forceMin: 10, // Minimum force threshold to trigger movement
                fixed: true, // Keep joystick in a fixed position
                // enable: true // Enabled by default
            })
            .on('update', this.dumpJoyStickState, this); // Optional: Log joystick state for debugging

            this.dumpJoyStickState(); // Log initial state
        } else {
            console.log("Non-touch device detected, using keyboard controls.");
        }


        // --- Network Event Handlers ---
        // ... (keep existing network handlers: onPlayerJoined, onPlayerLeft, etc.) ...
        this.network.onPlayerJoined(this.handlePlayerJoined, this);
        this.network.onPlayerLeft(this.handlePlayerLeft, this);
        this.network.onPlayerUpdated(this.handlePlayerUpdated, this);
        this.network.onOtherClientReady(this.handleOtherClientReady, this);

        console.log("Game scene create finished.");
    }

    // Optional debug function for joystick state
    dumpJoyStickState() {
        if (!this.joyStick) return;
        const cursorKeys = this.joyStick.createCursorKeys();
        let state = `Force: ${Math.floor(this.joyStick.force)}, Angle: ${Math.floor(this.joyStick.angle)}, `;
        let direction = '';
        if (cursorKeys.up?.isDown) direction += 'U';
        if (cursorKeys.down?.isDown) direction += 'D';
        if (cursorKeys.left?.isDown) direction += 'L';
        if (cursorKeys.right?.isDown) direction += 'R';
        // console.log("Joystick State:", state, "Dir:", direction); // Uncomment to log frequently
    }


    // --- Network Handlers ---
    // ... (keep handlePlayerJoined, handlePlayerLeft, handlePlayerUpdated, handleOtherClientReady) ...
     private handlePlayerJoined(newPlayer: IPlayer, id: string) { /* ... existing code ... */
        console.log(`Handling player joined: ${id}, Name: ${newPlayer.name}`);
        if (this.otherPlayerMap.has(id)) return;
        const otherPlayer = this.add.otherPlayer(newPlayer.x, newPlayer.y, 'player', id);
        this.otherPlayers.add(otherPlayer);
        const nameText = this.add.text(newPlayer.x, newPlayer.y - otherPlayer.height, newPlayer.name, {
            fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 1);
        otherPlayer.setNameText(nameText);
        this.otherPlayerMap.set(id, { player: otherPlayer, nameText: nameText });
        if(this.network.webRTC) {
           this.network.webRTC.connectToUser(id);
        }
     }
    private handlePlayerLeft(id: string) { /* ... existing code ... */
        console.log(`Handling player left: ${id}`);
        if (this.otherPlayerMap.has(id)) {
            const entry = this.otherPlayerMap.get(id);
            entry?.player.destroy();
            this.otherPlayerMap.delete(id);
            this.network?.webRTC?.deleteVideoStream(id);
        }
     }
    private handlePlayerUpdated(field: string, value: number | string, id: string) { /* ... existing code ... */
        const entry = this.otherPlayerMap.get(id);
        if (!entry) return;
        entry.player.updateOtherPlayer(field, value);
        if (field === 'name' && typeof value === 'string') {
             entry.nameText.setText(value);
        }
     }
    private handleOtherClientReady(data: { clientId: string, name?: string }) { /* ... existing code ... */
       console.log(`Client ${data.clientId} (${data.name || 'N/A'}) is ready for WebRTC connection.`);
       this.network?.webRTC?.connectToUser(data.clientId);
     }


    // --- Game Loop ---
    update(time: number, delta: number) {
        if (!this.myPlayer || !this.network || !this.network.mySessionId) {
            return;
        }

        // Pass BOTH cursors and joystick state to the player update method
        this.myPlayer.update(this.cursors, this.network, this.joyStick);

        // --- Other Players and Proximity ---
        // ... (keep existing other player depth/name updates and proximity checks) ...
         this.otherPlayerMap.forEach((entry) => {
             entry.player.setDepth(entry.player.y);
             entry.nameText.setDepth(entry.player.y + 1);
        });
         this.myPlayerNameText.setDepth(this.myPlayer.y + 1);

        this.otherPlayerMap.forEach((entry, id) => {
            const distance = Phaser.Math.Distance.Between(
                this.myPlayer.x, this.myPlayer.y, entry.player.x, entry.player.y
            );
            if (distance <= PROXIMITY_THRESHOLD) {
                 if (!this.network?.webRTC?.isConnectedOrConnecting(id)) {
                    this.network?.webRTC?.connectToUser(id);
                 }
            } else {
                 if (this.network?.webRTC?.isConnected(id)) {
                    this.network?.webRTC?.disconnectFromUser(id);
                 }
            }
        });
    }
}
```

**4. Update Player Controller to Handle Joystick**

Modify the `MyPlayer` class to accept the joystick state and use it for movement and animation if available.

*   **File:** `src/game/character/MyPlayer.ts`

```typescript
import Phaser from 'phaser'
import Network from '../../services/Network'
import Player from './Player'
import VirtualJoystick from 'phaser3-rex-plugins/plugins/virtualjoystick.js'; // Import type

// Keep factory registration
declare global {
  namespace Phaser.GameObjects {
    interface GameObjectFactory {
     myPlayer(x: number, y: number, texture: string, id: string, frame?: string | number): MyPlayer
    }
  }
}

export default class MyPlayer extends Player {
  private lastUpdateSentTime: number = 0;
  private updateInterval: number = 100;
  private readonly moveSpeed = 200; // Define speed constant

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, id: string, frame?: string | number) {
    super(scene, x, y, texture, id, frame);
    this.anims.play('idle_front', true);
    // Adjust collision box - tailor these values to your sprite
    const bodyWidth = this.width * 0.4;
    const bodyHeight = this.height * 0.3;
    this.setBodySize(bodyWidth, bodyHeight);
    this.setOffset( (this.width - bodyWidth) / 2, this.height - bodyHeight - (this.height * 0.1) ); // Center horizontally, place near bottom
  }

  // Update signature to accept joystick (can be null)
  update(
      cursors: Phaser.Types.Input.Keyboard.CursorKeys | null,
      network: Network,
      joyStick: VirtualJoystick | null
  ) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0); // Reset velocity

    let targetVelocity = new Phaser.Math.Vector2(0, 0);
    let requestedAnimation = this.anims.currentAnim?.key.replace('walk', 'idle') || 'idle_front';
    let moving = false;

    // --- Determine Movement Input ---
    // Prioritize Joystick if it exists and is active
    if (joyStick && joyStick.force > joyStick.forceMin) { // Use forceMin threshold
        moving = true;
        // Use physics helper to get velocity from angle and force
        // Adjust the multiplier (joyStick.force * 2.5) to control max speed from joystick
        this.scene.physics.velocityFromAngle(joyStick.angle, joyStick.force * 2.5, targetVelocity);

        // Determine animation based on angle - More robust than flags for 8 directions
        const angleDeg = Phaser.Math.RadToDeg(joyStick.angle);
        if (angleDeg > -22.5 && angleDeg <= 22.5) {        // Right
             requestedAnimation = 'walk_right';
        } else if (angleDeg > 22.5 && angleDeg <= 67.5) {  // Down-Right
             requestedAnimation = 'walk_front'; // Or create diagonal anims
        } else if (angleDeg > 67.5 && angleDeg <= 112.5) { // Down
             requestedAnimation = 'walk_front';
        } else if (angleDeg > 112.5 && angleDeg <= 157.5) {// Down-Left
             requestedAnimation = 'walk_front'; // Or create diagonal anims
        } else if (angleDeg > 157.5 || angleDeg <= -157.5) { // Left
            requestedAnimation = 'walk_left';
        } else if (angleDeg > -157.5 && angleDeg <= -112.5) {// Up-Left
            requestedAnimation = 'walk_back'; // Or create diagonal anims
        } else if (angleDeg > -112.5 && angleDeg <= -67.5) { // Up
            requestedAnimation = 'walk_back';
        } else if (angleDeg > -67.5 && angleDeg <= -22.5) { // Up-Right
            requestedAnimation = 'walk_back'; // Or create diagonal anims
        }

    } else if (cursors) { // Fallback to Keyboard
        let dx = 0;
        let dy = 0;
        if (cursors.left?.isDown) dx = -1;
        else if (cursors.right?.isDown) dx = 1;
        if (cursors.up?.isDown) dy = -1;
        else if (cursors.down?.isDown) dy = 1;

        if (dx !== 0 || dy !== 0) {
            moving = true;
            targetVelocity.set(dx, dy).normalize().scale(this.moveSpeed);

            // Determine keyboard animation
            if (dx < 0) requestedAnimation = 'walk_left';
            else if (dx > 0) requestedAnimation = 'walk_right';
            else if (dy < 0) requestedAnimation = 'walk_back';
            else if (dy > 0) requestedAnimation = 'walk_front';
        }
    }

    // --- Apply Velocity and Animation ---
    body.setVelocity(targetVelocity.x, targetVelocity.y);

    if (moving) {
        this.anims.play(requestedAnimation, true);
    } else {
        const idleAnimation = this.anims.currentAnim?.key.replace('walk', 'idle') || 'idle_front';
        this.anims.play(idleAnimation, true);
    }

    // --- Network Update (Throttled) ---
    const now = this.scene.time.now;
    // Send update if moving or if enough time has passed since last idle update
    if (moving || now - this.lastUpdateSentTime > this.updateInterval * 5) { // Send idle less frequently
        network.updatePlayer(this.x, this.y, this.anims.currentAnim?.key || 'idle_front');
        this.lastUpdateSentTime = now;
    }

    // --- Update Name Position and Depth ---
    this.updateNamePosition();
    this.setDepth(this.y);
  }
}

// --- Factory Registration (keep as is) ---
Phaser.GameObjects.GameObjectFactory.register(
    'myPlayer',
    function (
      this: Phaser.GameObjects.GameObjectFactory,
      x: number, y: number, texture: string, id: string, frame?: string | number
    ) {
      const sprite = new MyPlayer(this.scene, x, y, texture, id, frame);
      sprite.setScale(2);
      return sprite;
    }
);
```

**Explanation of Changes:**

1.  **Plugin Installation & Config:** Added `phaser3-rex-plugins` and configured Phaser to load `rexVirtualJoystickPlugin`.
2.  **Joystick Creation (`Game.ts`):**
    *   Added a `joyStick` property to the `Game` scene.
    *   In `create()`, it checks `this.sys.game.device.input.touch`.
    *   If true, it uses `this.plugins.get('rexVirtualJoystick').add(...)` to create the joystick instance.
    *   Configured the joystick's position (`x`, `y`), size (`radius`), appearance (`base`, `thumb`), and behavior (`dir`, `forceMin`, `fixed`).
    *   Added an optional `on('update', ...)` listener for debugging.
3.  **Player Update (`MyPlayer.ts`):**
    *   The `update` method now accepts `joyStick: VirtualJoystick | null` as an argument.
    *   It first checks if the `joyStick` exists and its `force` is above the minimum threshold (`forceMin`).
    *   If the joystick is active, it calculates velocity using `this.scene.physics.velocityFromAngle` based on the joystick's `angle` and `force`. The `force` multiplier scales the speed.
    *   It determines the animation based on the `angle` for smoother 8-directional animation.
    *   If the joystick is *not* active, it falls back to the existing keyboard (`cursors`) logic.
    *   The rest of the logic (applying velocity, animation, network updates, depth sorting) remains similar but uses the derived `targetVelocity` and `requestedAnimation`.
4.  **Passing Joystick to Player:** The main `Game` scene's `update` loop now passes `this.joyStick` to `this.myPlayer.update(...)`.

**To Test:**

1.  Run `npm install` or `yarn install` again to get the new plugin dependency.
2.  Run your development server (`npm run dev`).
3.  Open the game in your desktop browser (joystick shouldn't appear, keyboard should work).
4.  Open the game on a mobile device OR use your browser's Developer Tools (usually F12) and toggle the "Device Toolbar" (often looks like a phone/tablet icon) to simulate a touch device. Refresh the page.
5.  The joystick should appear in the bottom-left corner (or wherever you positioned it). Drag the thumbstick to move your player.
