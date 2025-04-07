Okay, let's integrate the username feature into your React+Phaser+Colyseus application.

Here's a breakdown of the steps involved:

1.  **Server:** Modify the `Player` schema to include a `name` field and update the `onJoin` logic to accept and store the name.
2.  **Client (Types):** Update the client-side `IPlayer` interface.
3.  **Client (React - `App.tsx`):** Add state to manage name input visibility and the username itself. Create a simple input form.
4.  **Client (Phaser - `Preloader.ts`):** Modify it to signal React when loading is complete, instead of directly starting the `Game` scene.
5.  **Client (Phaser - `Game.ts`):**
    *   Receive the username during initialization.
    *   Send the username when joining the Colyseus room.
    *   Create and manage `Phaser.GameObjects.Text` for player names (self and others).
    *   Handle name display updates and cleanup.
6.  **Client (Phaser - Player Classes):** Add logic to hold and update the position of the name text associated with each player sprite.
7.  **Client (Networking - `Network.ts`):** Modify the `join` method to send the username.

---

**1. Server Changes (`server/`)**

*   **`src/types/IOfficeState.ts`:**
    ```typescript
    import { Schema, MapSchema } from '@colyseus/schema'

    export interface IPlayer extends Schema {
      x: number
      y: number
      anim: string
      name: string // <-- Add this line
    }

    export interface IOfficeState extends Schema {
      players: MapSchema<IPlayer>
    }
    ```

*   **`src/rooms/schema/OfficeState.ts`:**
    ```typescript
    import { Schema, MapSchema, Context, type } from '@colyseus/schema'
    import { IPlayer, IOfficeState } from '../../types/IOfficeState' // Ensure path is correct

    export class Player extends Schema implements IPlayer {
      @type('number') x = 705
      @type('number') y = 500
      @type('string') anim = 'idle_front' // Default animation adjusted based on client code
      @type('string') name = 'Anonymous' // <-- Add name field with a default
    }

    // Keep OfficeState class as is
    export class OfficeState extends Schema implements IOfficeState {
      @type({ map: Player })
      players = new MapSchema<Player>()
    }
    ```

*   **`src/rooms/MyOffice.ts`:**
    ```typescript
    import { Room, Client } from 'colyseus'
    import { Dispatcher } from '@colyseus/command'
    import { Player, OfficeState } from './schema/OfficeState'
    import { Message } from '../types/Messages'
    import PlayerUpdateCommand from './commands/PlayerUpdateCommand' // Adjusted path

    export class MyOffice extends Room<OfficeState> {
      private dispatcher = new Dispatcher(this)

      onCreate(options: any) {
        this.setState(new OfficeState())

        // Listen for the UPDATE_PLAYER message from clients
        this.onMessage(
          Message.UPDATE_PLAYER,
          (client, message: { x: number; y: number; anim: string }) => {
            // Dispatch the PlayerUpdateCommand to update the player's state
            this.dispatcher.dispatch(new PlayerUpdateCommand(), {
              client,
              x: message.x,
              y: message.y,
              anim: message.anim,
            })
          }
        )
        // Listen for the READY_TO_CONNECT message from clients
        this.onMessage(
          Message.READY_TO_CONNECT,(client)=>{
            // Broadcast the READY_TO_CONNECT message to all other clients except the sender
            // Pass the client's name along with the sessionId
            const player = this.state.players.get(client.sessionId);
            this.broadcast(Message.READY_TO_CONNECT, { clientId: client.sessionId, name: player?.name }, {except:client})
          }
        )
      }

      onJoin(client: Client, options: any) {
        // Create a new player
        const player = new Player();

        // Set the player's name from options, defaulting to 'Anonymous'
        player.name = options?.playerName || 'Anonymous'; // <-- Get name from options

        // Add the player to the room state
        this.state.players.set(client.sessionId, player);
        console.log(client.sessionId, "joined with name:", player.name); // Optional logging
      }

      onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "left!"); // Optional logging
        // Remove the player from the room state
        if (this.state.players.has(client.sessionId)) {
          this.state.players.delete(client.sessionId)
        }
      }

      onDispose() {
        console.log('room', this.roomId, 'disposing...');
      }
    }
    ```

**Remember to rebuild your server (`npm run build` or similar) and restart it after these changes.**

---

**2. Client (Types)**

*   **`src/types/IOfficeState.ts`:**
    ```typescript
    import { Schema, MapSchema } from '@colyseus/schema'

    export interface IPlayer extends Schema {
      x: number
      y: number
      anim: string
      name: string // <-- Add this line
    }

    export interface IOfficeState extends Schema {
      players: MapSchema<IPlayer>
    }
    ```

---

**3. Client (React - `App.tsx`)**

```typescript
import React, { useRef, useState, useEffect, useCallback } from 'react'; // Added React import
import { IRefPhaserGame, PhaserGame } from './game/PhaserGame';
// import { MainMenu } from './game/scenes/MainMenu'; // Not used directly here anymore
import './App.css'; // Optional: for styling the input

function App()
{
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [showNameInput, setShowNameInput] = useState(false);
    const [username, setUsername] = useState('');
    const [gameStarted, setGameStarted] = useState(false); // Track if the main game scene has started

    // Callback when a scene becomes ready in Phaser
    const currentScene = (scene: Phaser.Scene) => {
        console.log("Scene ready:", scene.scene.key);
        if (scene.scene.key === 'preloader' && !gameStarted) {
             // Only show input if preloader is ready AND game hasn't started
            setShowNameInput(true);
        }
    }

    const handleNameSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const nameInput = (event.target as HTMLFormElement).elements.namedItem('username') as HTMLInputElement;
        const enteredName = nameInput.value.trim();

        if (enteredName && phaserRef.current?.game) {
            setUsername(enteredName);
            setShowNameInput(false);
            setGameStarted(true); // Mark game as started

            // Start the main Game scene in Phaser, passing the username
            console.log(`Starting Game scene with username: ${enteredName}`);
            phaserRef.current.game.scene.start('Game', { username: enteredName });
        } else {
            alert('Please enter a valid name.');
        }
    };

    // Use useCallback to memoize the function passed to PhaserGame
    const memoizedCurrentScene = useCallback(currentScene, [gameStarted]);

    return (
        <div id="app">
            {/* Phaser Game Canvas */}
            <PhaserGame ref={phaserRef} currentActiveScene={memoizedCurrentScene} />

            {/* Name Input Overlay */}
            {showNameInput && (
                <div className="name-input-overlay">
                    <form onSubmit={handleNameSubmit} className="name-input-form">
                        <h2>Enter Your Name</h2>
                        <input
                            type="text"
                            name="username"
                            placeholder="Your Name"
                            maxLength={16} // Optional: limit name length
                            required
                            autoFocus
                        />
                        <button type="submit">Enter Office</button>
                    </form>
                </div>
            )}

            {/* Keep existing video/button grids if needed */}
            <div className="video-grid"></div>
            <div className="button-grid"></div>
        </div>
    )
}

export default App;

```

*   **Add some basic CSS for the overlay (e.g., in `index.html`'s `<style>` or a separate CSS file like `App.css` imported into `App.tsx`):**

```css
/* Example CSS for name input overlay */
.name-input-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7); /* Semi-transparent background */
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100; /* Ensure it's above the game canvas */
}

.name-input-form {
    background-color: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    text-align: center;
}

.name-input-form h2 {
    margin-top: 0;
    margin-bottom: 20px;
    color: #333;
}

.name-input-form input[type="text"] {
    width: 100%;
    padding: 10px;
    margin-bottom: 20px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 16px;
}

.name-input-form button {
    padding: 10px 20px;
    background-color: #028af8; /* Match game background */
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.name-input-form button:hover {
    background-color: #026dbf;
}
```

---

**4. Client (Phaser - `Preloader.ts`)**

```typescript
import Phaser from 'phaser'
import { EventBus } from '../EventBus'; // Import EventBus

export default class Preloader extends Phaser.Scene {
  private counter = 0

  constructor() {
    super('preloader')
  }

  preload() {
        // Keep preload logic the same
        this.load.tilemapTiledJSON('map', 'assets/json/final_map.json');
        this.load.image('floor', 'assets/tiles/floor.png');
        this.load.image('forest', 'assets/tiles/forest.png');
        this.load.image('office', 'assets/tiles/office.png');
        this.load.image('objects', 'assets/tiles/objects.png');
        this.load.image('scifi', 'assets/tiles/scifi.png');
        this.load.atlas('player', 'assets/tiles/chr.png', 'assets/json/char.json');
  }

  create() {
    // Keep loading text creation the same
    const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2
    const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 2
    this.add
      .text(screenCenterX, screenCenterY - 100, 'Virtoffice')
      .setOrigin(0.5)
      .setFontSize(50)
      .setFontStyle('bold')
      .setColor('#000000') // Ensure text is visible on blue background
    const loadingText = this.add
      .text(screenCenterX, screenCenterY - 30, 'Loading...')
      .setOrigin(0.5)
      .setFontSize(30)
      .setColor('#000000')
    this.add
      .text(
        screenCenterX,
        screenCenterY + 40,
        'Server starting (can take up to 1 min)...' // Adjusted text
      )
      .setOrigin(0.5)
      .setFontSize(18)
      .setColor('#000000')
    // Removed second message for brevity

    // Keep the loading animation timer
    this.time.addEvent({
      delay: 750,
      callback: () => {
        switch (this.counter % 3) {
          case 0: loadingText.setText('Loading.'); break;
          case 1: loadingText.setText('Loading..'); break;
          case 2: loadingText.setText('Loading...'); break;
        }
        this.counter += 1;
      },
      loop: true,
    });

    // *** CHANGE HERE ***
    // Instead of starting 'Game', emit an event to signal React that preloading is done
    console.log("Preloader finished, emitting ready event.");
    EventBus.emit('current-scene-ready', this);

    // DO NOT start the game scene here anymore. React will do it.
    // this.scene.run('Game') // REMOVED
  }
}
```

---

**5. Client (Phaser - `Game.ts`)**

```typescript
import Phaser from 'phaser';
import { createCharacterAnims } from './animation/Animation';
import Network from '../services/Network.ts';
import { IPlayer } from '../types/IOfficeState.ts';
import './character/MyPlayer.ts' // Register MyPlayer factory
import './character/OtherPlayer.ts' // Register OtherPlayer factory
import MyPlayer from './character/MyPlayer.ts';
import OtherPlayer from './character/OtherPlayer.ts';

const PROXIMITY_THRESHOLD = 200;

export class Game extends Phaser.Scene {
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private myPlayer!: MyPlayer;
    private network!: Network; // Initialize in init
    private otherPlayers!: Phaser.Physics.Arcade.Group;
    // Store both player and their name text together
    private otherPlayerMap = new Map<string, { player: OtherPlayer, nameText: Phaser.GameObjects.Text }>();
    private myPlayerNameText!: Phaser.GameObjects.Text;
    private username: string = 'Anonymous'; // Store username received from init

    constructor() {
        super('Game');
    }

    // Receive data when the scene starts (including username)
    init(data: { username?: string }) {
        this.username = data.username || 'Anonymous'; // Get username passed from React
        console.log(`Game scene initialized with username: ${this.username}`);
        this.network = new Network(); // Initialize network here
        // Reset map for fresh start if scene restarts
        this.otherPlayerMap.clear();
    }

    preload() {
        // Preload is now primarily in Preloader.ts
        // We just need cursor keys here
        this.cursors = this.input.keyboard.createCursorKeys();
        console.log("Game scene preload done.");
    }

    async create() {
        console.log("Game scene create starting...");
        if (!this.network) {
            throw new Error('Network instance missing');
        }

        // --- Join Network with Username ---
        try {
            console.log(`Attempting to join network with username: ${this.username}`);
            await this.network.join(this.username); // Pass username to network join
            console.log(`Successfully joined network. My session ID: ${this.network.mySessionId}`);
        } catch (error) {
            console.error("Failed to join network:", error);
            // Handle error appropriately, maybe show a message and return to menu
            return;
        }
        // --- Scene Setup ---
        // Stop Preloader if it's somehow still running (it shouldn't be)
        if (this.scene.isActive('preloader')) {
            this.scene.stop('preloader');
        }

        createCharacterAnims(this.anims);
        const map = this.make.tilemap({ key: 'map' });

        const tileset1 = map.addTilesetImage('floor', 'floor');
        const tileset2 = map.addTilesetImage('forest', 'forest');
        const tileset3 = map.addTilesetImage('office', 'office');
        const tileset4 = map.addTilesetImage('objects', 'objects');
        const tileset5 = map.addTilesetImage('scifi', 'scifi');

        // Create layers (ensure tilesets cover all used tiles)
        const allTilesets = [tileset1, tileset2, tileset3, tileset4, tileset5].filter(ts => ts !== null); // Filter out nulls if any failed to load
        map.createLayer('floor', allTilesets, 0, 0);
        map.createLayer('wall_projection', allTilesets, 0, 0);
        const wallLayer = map.createLayer('walls', allTilesets, 0, 0);
        const objectLayer = map.createLayer('objects', allTilesets, 0, 0);
        const superposeLayer = map.createLayer('superpose', allTilesets, 0, 0);

        // --- Physics and Camera ---
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.zoom = 1.5;
        this.cameras.main.backgroundColor.setTo(0, 0, 0); // Black background

        // --- Player Creation ---
        const startX = 800; // Example start position
        const startY = 800;
        this.myPlayer = this.add.myPlayer(startX, startY, 'player', this.network.mySessionId); // Factory defined in MyPlayer.ts
        this.myPlayerNameText = this.add.text(startX, startY - this.myPlayer.height, this.username, {
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            // backgroundColor: 'rgba(0,0,0,0.5)', // Optional background
            // padding: { x: 2, y: 1 } // Optional padding
        }).setOrigin(0.5, 1); // Origin at bottom-center for positioning above player
        this.myPlayer.setNameText(this.myPlayerNameText); // Link text to player

        this.otherPlayers = this.physics.add.group({ classType: OtherPlayer, runChildUpdate: true }); // runChildUpdate for preUpdate in OtherPlayer

        this.cameras.main.startFollow(this.myPlayer);

        // --- Collisions ---
        // Set collision on relevant layers
        wallLayer?.setCollisionByProperty({ collides: true });
        objectLayer?.setCollisionByProperty({ collides: true });

        // Add colliders
        this.physics.add.collider(this.myPlayer, wallLayer);
        this.physics.add.collider(this.myPlayer, objectLayer);
        this.physics.add.collider(this.myPlayer, this.otherPlayers); // Players can collide with each other
        this.physics.add.collider(this.otherPlayers, wallLayer);
        this.physics.add.collider(this.otherPlayers, objectLayer);

        this.myPlayer.setCollideWorldBounds(true);

        // --- Network Event Handlers ---
        this.network.onPlayerJoined(this.handlePlayerJoined, this);
        this.network.onPlayerLeft(this.handlePlayerLeft, this);
        this.network.onPlayerUpdated(this.handlePlayerUpdated, this);
        this.network.onOtherClientReady(this.handleOtherClientReady, this); // Listen for WebRTC ready messages


        console.log("Game scene create finished.");
    }

    // --- Network Handler Methods ---

    private handlePlayerJoined(newPlayer: IPlayer, id: string) {
        console.log(`Handling player joined: ${id}, Name: ${newPlayer.name}`);
        if (this.otherPlayerMap.has(id)) {
          console.warn(`Player ${id} already exists. Ignoring join event.`);
          return; // Avoid duplicates
        }
        // Create player sprite
        const otherPlayer = this.add.otherPlayer(newPlayer.x, newPlayer.y, 'player', id); // Use factory
        this.otherPlayers.add(otherPlayer);

        // Create name text for the other player
        const nameText = this.add.text(newPlayer.x, newPlayer.y - otherPlayer.height, newPlayer.name, {
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 1);
        otherPlayer.setNameText(nameText); // Link text to the player object

        // Store both player and name text
        this.otherPlayerMap.set(id, { player: otherPlayer, nameText: nameText });

        // IMPORTANT: If this player joined *after* the WebRTC setup, try connecting immediately
        if(this.network.webRTC) {
           console.log(`New player ${id} joined, attempting WebRTC connection.`);
           this.network.webRTC.connectToUser(id);
        }
    }

    private handlePlayerLeft(id: string) {
        console.log(`Handling player left: ${id}`);
        if (this.otherPlayerMap.has(id)) {
            const entry = this.otherPlayerMap.get(id);
            if (entry) {
                entry.player.destroy(); // Destroy player sprite (should trigger name text destroy)
                // entry.nameText.destroy(); // Usually handled by player.destroy() if linked correctly
            }
            this.otherPlayerMap.delete(id);
            this.network?.webRTC?.deleteVideoStream(id); // Clean up WebRTC connection
        } else {
            console.warn(`Tried to remove player ${id}, but they were not found.`);
        }
    }

    private handlePlayerUpdated(field: string, value: number | string, id: string) {
        const entry = this.otherPlayerMap.get(id);
        if (!entry) return;
        entry.player.updateOtherPlayer(field, value);

        // If name changes (though not implemented on server update yet), update text
        if (field === 'name' && typeof value === 'string') {
             entry.nameText.setText(value);
        }
    }

    private handleOtherClientReady(data: { clientId: string, name?: string }) {
      console.log(`Client ${data.clientId} (${data.name || 'N/A'}) is ready for WebRTC connection.`);
      this.network?.webRTC?.connectToUser(data.clientId);
    }

    // --- Game Loop ---

    update(time: number, delta: number) {
        if (!this.myPlayer || !this.network || !this.network.mySessionId) {
            // console.log("Update skipped: Player or network not ready.");
            return;
        };

        // Update my player based on input and send updates
        this.myPlayer.update(this.cursors, this.network);

        // Update name text positions (MyPlayer's text updated within its own update/postUpdate)
        this.otherPlayerMap.forEach((entry) => {
             // OtherPlayer updates its name text position in its preUpdate
             entry.player.setDepth(entry.player.y); // Ensure depth sorting for overlap
             entry.nameText.setDepth(entry.player.y + 1); // Keep text slightly above player depth
        });
         this.myPlayerNameText.setDepth(this.myPlayer.y + 1); // Ensure my name text depth is updated

        // Update WebRTC connections based on proximity
        this.otherPlayerMap.forEach((entry, id) => {
            const distance = Phaser.Math.Distance.Between(
                this.myPlayer.x,
                this.myPlayer.y,
                entry.player.x,
                entry.player.y
            );

            if (distance <= PROXIMITY_THRESHOLD) {
                 // Only connect if not already connected or trying to connect
                 if (!this.network?.webRTC?.isConnectedOrConnecting(id)) {
                    // console.log(`Connecting to ${id} (proximity: ${distance.toFixed(0)})`);
                    this.network?.webRTC?.connectToUser(id);
                 }
            } else {
                 // Only disconnect if currently connected
                 if (this.network?.webRTC?.isConnected(id)) {
                    // console.log(`Disconnecting from ${id} (proximity: ${distance.toFixed(0)})`);
                    this.network?.webRTC?.disconnectFromUser(id);
                 }
            }
        });
    }
}

```

---

**6. Client (Phaser - Player Classes)**

*   **`src/game/character/Player.ts`:**
    ```typescript
    import Phaser from 'phaser'

    // Keep global declaration for factory if needed, though might become redundant
    // declare global {
    //   namespace Phaser.GameObjects {
    //     interface GameObjectFactory {
    //       player(x: number, y: number, texture: string, id: string, frame?: string | number): Player
    //     }
    //   }
    // }

    export default abstract class Player extends Phaser.Physics.Arcade.Sprite {
      playerId: string;
      playerNameText: Phaser.GameObjects.Text | null = null; // Add reference for name text

      constructor(scene: Phaser.Scene, x: number, y: number, texture: string, id: string, frame?: string | number) {
        super(scene, x, y, texture, frame);
        this.playerId = id;
        this.scene.add.existing(this); // Add to scene
        this.scene.physics.add.existing(this); // Add to physics engine
      }

      // Method to link the name text object
      setNameText(textObject: Phaser.GameObjects.Text) {
          this.playerNameText = textObject;
          this.updateNamePosition(); // Initial position update
      }

      // Method to update the name text position relative to the sprite
      updateNamePosition() {
          if (this.playerNameText) {
              this.playerNameText.setPosition(this.x, this.y - this.displayHeight * 0.6); // Position above the sprite center
              this.playerNameText.setOrigin(0.5, 1); // Ensure origin is bottom-center
          }
      }

      // Override destroy to clean up the name text
      destroy(fromScene?: boolean) {
          if (this.playerNameText) {
              this.playerNameText.destroy();
              this.playerNameText = null;
          }
          super.destroy(fromScene);
      }

      // postUpdate can be useful for things that should happen *after* physics/movement
      // postUpdate(time: number, delta: number) {
         // If using postUpdate, call super.postUpdate(time, delta); if extending a class that uses it.
         // this.updateNamePosition();
      // }
    }
    ```

*   **`src/game/character/MyPlayer.ts`:**
    ```typescript
    import Phaser from 'phaser'
    import Network from '../../services/Network'
    import Player from './Player' // Base class

    // Keep factory registration if using `this.add.myPlayer(...)`
    declare global {
      namespace Phaser.GameObjects {
        interface GameObjectFactory {
         myPlayer(x: number, y: number, texture: string, id: string, frame?: string | number): MyPlayer
        }
      }
    }

    export default class MyPlayer extends Player {
      private lastUpdateSentTime: number = 0; // Throttle updates
      private updateInterval: number = 100; // ms between updates

      constructor(scene: Phaser.Scene, x: number, y: number, texture: string, id: string, frame?: string | number) {
        // Pass texture and id correctly to the base class constructor
        super(scene, x, y, texture, id, frame);
        // Initialization specific to MyPlayer
        this.anims.play('idle_front', true); // Default animation
        this.setBodySize(this.width * 0.5, this.height * 0.3); // Adjust collision box (example)
        this.setOffset(this.width * 0.25, this.height * 0.6); // Adjust offset for the new body size
      }

      update(cursors: Phaser.Types.Input.Keyboard.CursorKeys, network: Network) {
        if (!cursors) {
          return;
        }

        const speed = 200;
        const body = this.body as Phaser.Physics.Arcade.Body; // Type assertion for Body
        body.setVelocity(0); // Reset velocity each frame

        let requestedAnimation = this.anims.currentAnim?.key.replace('walk', 'idle') || 'idle_front'; // Default to idle version of current
        let moving = false;

        // --- Determine Movement and Animation ---
        // Use diagonal movement check for better feel
        if (cursors.left?.isDown) {
            body.setVelocityX(-speed);
            requestedAnimation = 'walk_left';
            moving = true;
        } else if (cursors.right?.isDown) {
            body.setVelocityX(speed);
            requestedAnimation = 'walk_right';
            moving = true;
        }

        if (cursors.up?.isDown) {
            body.setVelocityY(-speed);
            // Prioritize side animation if moving diagonally
            if (!moving) requestedAnimation = 'walk_back';
            moving = true;
        } else if (cursors.down?.isDown) {
            body.setVelocityY(speed);
            // Prioritize side animation if moving diagonally
            if (!moving) requestedAnimation = 'walk_front';
            moving = true;
        }

        // Normalize speed for diagonal movement
        body.velocity.normalize().scale(speed);

        // --- Play Animation ---
        if (moving) {
            this.anims.play(requestedAnimation, true);
        } else {
            // Play corresponding idle animation
            const idleAnimation = this.anims.currentAnim?.key.replace('walk', 'idle') || 'idle_front';
            this.anims.play(idleAnimation, true);
        }

        // --- Send Network Update (Throttled) ---
        const now = this.scene.time.now;
        if (now - this.lastUpdateSentTime > this.updateInterval) {
          // Check if position or animation actually changed significantly
           // Add a small check here if needed to avoid sending redundant data
           network.updatePlayer(this.x, this.y, this.anims.currentAnim?.key || 'idle_front');
           this.lastUpdateSentTime = now;
        }

        // --- Update Name Position and Depth ---
        this.updateNamePosition();
        this.setDepth(this.y); // Depth sorting based on Y
      }
    }

    // --- Factory Registration ---
    Phaser.GameObjects.GameObjectFactory.register(
        'myPlayer',
        function (
          this: Phaser.GameObjects.GameObjectFactory,
          x: number,
          y: number,
          texture: string, // Correct order from Game.ts add.myPlayer call
          id: string,
          frame?: string | number
        ) {
          // Pass texture and id correctly
          const sprite = new MyPlayer(this.scene, x, y, texture, id, frame);

          // No need to add sprite to display/update list here, Player constructor handles it
          // No need to enable physics here, Player constructor handles it

          sprite.setScale(2); // Set scale if needed (adjust body/offset accordingly)
          // Size/Offset adjustments are now in the MyPlayer constructor

          return sprite;
        }
    );
    ```

*   **`src/game/character/OtherPlayer.ts`:**
    ```typescript
    import Phaser from 'phaser'
    import Player from './Player' // Base class

    // Keep factory registration if using `this.add.otherPlayer(...)`
    declare global {
      namespace Phaser.GameObjects {
        interface GameObjectFactory {
          otherPlayer(
            x: number,
            y: number,
            texture: string,
            id: string,
            frame?: string | number
          ): OtherPlayer
        }
      }
    }

    export default class OtherPlayer extends Player {
      private targetPosition: Phaser.Math.Vector2; // Use Vector2 for target
      private lastUpdateTimestamp?: number;
      private interpolationSpeed = 0.15; // Adjust for smoother or snappier movement (lower is smoother)

      constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        texture: string,
        id: string,
        frame?: string | number
      ) {
        super(scene, x, y, texture, id, frame); // Pass id correctly
        this.targetPosition = new Phaser.Math.Vector2(x, y);
        this.setBodySize(this.width * 0.5, this.height * 0.3); // Match MyPlayer collision box (example)
        this.setOffset(this.width * 0.25, this.height * 0.6);
      }

      updateOtherPlayer(field: string, value: number | string) {
        switch (field) {
          case 'x':
            if (typeof value === 'number') {
              this.targetPosition.x = value;
            }
            break;

          case 'y':
            if (typeof value === 'number') {
              this.targetPosition.y = value;
            }
            break;

          case 'anim':
            if (typeof value === 'string' && this.anims) { // Check if anims exists
                // Prevent playing the same animation repeatedly if it's already playing
                if (this.anims.currentAnim?.key !== value) {
                    this.anims.play(value, true);
                }
            }
            break;

          // Handle name update if implemented later
          case 'name':
             if (typeof value === 'string' && this.playerNameText) {
                 this.playerNameText.setText(value);
             }
             break;
        }
      }

      /** preUpdate is called every frame for every game object. */
      preUpdate(t: number, dt: number) {
        super.preUpdate(t, dt); // Call base class preUpdate if it exists

        const body = this.body as Phaser.Physics.Arcade.Body;

        // --- Interpolation ---
        // Snap if inactive for too long (tabbed out)
        if (this.lastUpdateTimestamp && t - this.lastUpdateTimestamp > 1000) {
          this.setPosition(this.targetPosition.x, this.targetPosition.y);
          body.reset(this.targetPosition.x, this.targetPosition.y); // Reset physics body too
          console.warn(`Snapping player ${this.playerId} due to inactivity.`);
          this.lastUpdateTimestamp = t;
          this.updateNamePosition(); // Update name pos after snapping
          this.setDepth(this.y);
          return; // Skip further interpolation logic
        }
        this.lastUpdateTimestamp = t;

        // Smoothly interpolate position towards the target
        const lerpFactor = 1 - Math.exp(-this.interpolationSpeed * dt * 0.06); // dt correction factor (approx)
        this.x = Phaser.Math.Linear(this.x, this.targetPosition.x, lerpFactor);
        this.y = Phaser.Math.Linear(this.y, this.targetPosition.y, lerpFactor);

        // Update physics body position to match visual position for collision detection
        // This is important if interpolation makes visual/physics diverge too much
         body.reset(this.x, this.y);

        // --- Update Name Position and Depth ---
        this.updateNamePosition(); // Update name text position each frame
        this.setDepth(this.y); // Depth sorting based on Y
      }
    }

    // --- Factory Registration ---
    Phaser.GameObjects.GameObjectFactory.register(
      'otherPlayer',
      function (
        this: Phaser.GameObjects.GameObjectFactory,
        x: number,
        y: number,
        texture: string, // Correct order
        id: string,
        frame?: string | number
      ) {
        // Pass texture and id correctly
        const sprite = new OtherPlayer(this.scene, x, y, texture, id, frame);

        // No need to add sprite to display/update list here, Player constructor handles it
        // No need to enable physics here, Player constructor handles it

        sprite.setScale(2); // Set scale if needed

        return sprite;
      }
    );
    ```

---

**7. Client (Networking - `Network.ts`)**

```typescript
import { Client, Room } from "colyseus.js";
import Phaser from 'phaser';
import { IOfficeState, IPlayer } from '../types/IOfficeState';
import { Message } from '../types/Messages';
import WebRTC from '../web/Webrtc';

// Define clearer event names
enum NetworkEvent {
    PLAYER_JOINED = 'player-joined',
    PLAYER_UPDATED = 'player-updated',
    PLAYER_LEFT = 'player-left',
    MY_PLAYER_JOINED = 'my-player-joined', // Optional: For when local player data is ready
    OTHER_CLIENT_READY = 'other-client-ready', // For WebRTC signaling
}


export default class Network {
    private client: Client;
    private room?: Room<IOfficeState>;
    private events = new Phaser.Events.EventEmitter();
    webRTC?: WebRTC;

    mySessionId!: string;
    private _isConnected = false; // Track connection status

    constructor() {
        const protocol = window.location.protocol.replace('http', 'ws');
        const endpoint =
            // Use environment variable or fallback for flexibility
            process.env.REACT_APP_SERVER_URL || // Create React App standard
            (process.env.NODE_ENV === 'production'
                ? 'wss://render-server-h04y.onrender.com' // Your production Render URL
                : `${protocol}//${window.location.hostname}:2567`); // Local dev

        console.log(`Connecting to Colyseus server at: ${endpoint}`);
        this.client = new Client(endpoint);
    }

    // --- Public Accessors ---
    get isConnected(): boolean {
        return this._isConnected && !!this.room && !!this.mySessionId;
    }


    // --- Connection Logic ---
    async join(username: string) { // Accept username
        if (this.room) {
            console.warn("Already joined a room. Leaving previous room...");
            await this.leave(); // Ensure leaving previous room if any
        }
        try {
            console.log(`Joining room 'myoffice' with username: ${username}`);
            // Pass username in options object
            this.room = await this.client.joinOrCreate<IOfficeState>('myoffice', { playerName: username });
            this._isConnected = true;
            this.mySessionId = this.room.sessionId;
            console.log(`Joined successfully! My session ID: ${this.mySessionId}`);

            // Initialize WebRTC *after* getting session ID
            this.webRTC = new WebRTC(this.mySessionId, this);

            this.registerRoomEvents(); // Setup listeners after room is joined

            // Optional: Emit an event when the local player is fully initialized
            this.events.emit(NetworkEvent.MY_PLAYER_JOINED, this.mySessionId);

        } catch (error) {
            this._isConnected = false;
            console.error(`Failed to join room:`, error);
            // Re-throw or handle the error (e.g., show error message to user)
            throw error; // Propagate the error
        }
    }

    async leave() {
        if (this.room) {
            console.log("Leaving room...");
            await this.room.leave();
            this.room = undefined;
        }
        this.webRTC?.destroy(); // Clean up WebRTC instance
        this.webRTC = undefined;
        this.events.removeAllListeners(); // Clean up listeners
        this._isConnected = false;
        this.mySessionId = ''; // Reset session ID
        console.log("Left room and cleaned up resources.");
    }


    // --- Event Registration (Called after joining) ---
    private registerRoomEvents() {
        if (!this.room) return;

        // --- Player State Changes ---
        this.room.state.players.onAdd((player: IPlayer, key: string) => {
            if (key === this.mySessionId) return; // Ignore self join event

            console.log(`Network: Player joined - ID: ${key}, Name: ${player.name}`);
            this.events.emit(NetworkEvent.PLAYER_JOINED, player, key);

            // Listen for changes on the *newly added* player
            this.listenToPlayerChanges(player, key);

            // If WebRTC is ready, try connecting (might receive READY_TO_CONNECT later too)
            // if (this.webRTC?.isReady) { // Assuming WebRTC has an isReady flag
            //     console.log(`Attempting initial WebRTC connection to new player ${key}`);
            //     this.webRTC.connectToUser(key);
            // }
        });

        this.room.state.players.onRemove((player: IPlayer, key: string) => {
            console.log(`Network: Player left - ID: ${key}`);
            this.events.emit(NetworkEvent.PLAYER_LEFT, key);
            this.webRTC?.deleteVideoStream(key); // Clean up WebRTC stream for this player
            this.webRTC?.disconnectFromUser(key); // Ensure PeerJS connection is closed
        });

         // Initial players already in the room when *we* join
         this.room.state.players.forEach((player, key) => {
            if (key === this.mySessionId) return; // Skip self
             console.log(`Network: Found existing player - ID: ${key}, Name: ${player.name}`);
            this.events.emit(NetworkEvent.PLAYER_JOINED, player, key); // Treat existing players as joins
            this.listenToPlayerChanges(player, key); // Listen to updates for existing players
        });

        // --- Messages ---
        this.room.onMessage(Message.READY_TO_CONNECT, (data: { clientId: string, name?: string }) => {
            if (!data || !data.clientId || data.clientId === this.mySessionId) return; // Ignore invalid or self messages
            console.log(`Network: Received READY_TO_CONNECT from ${data.clientId} (${data.name || 'N/A'})`);
            this.events.emit(NetworkEvent.OTHER_CLIENT_READY, data); // Forward the data object
            // WebRTC connection logic moved to Game.ts handler for this event
        });

        // Optional: Error and Leave handlers
        this.room.onError((code, message) => {
            console.error(`Colyseus room error (${code}): ${message}`);
            // Handle error, maybe disconnect or show message
        });
        this.room.onLeave((code) => {
            console.log(`Left Colyseus room (code: ${code})`);
            this._isConnected = false;
            // Handle cleanup if needed, though `leave()` method is preferred
        });
    }


    // Helper to attach listeners to a player's properties
    private listenToPlayerChanges(player: IPlayer, key: string) {
        // Properties to synchronize
        const propertiesToListen: (keyof IPlayer)[] = ['x', 'y', 'anim', 'name'];

        propertiesToListen.forEach((property) => {
             // Use `.listen` for specific property changes
             player.listen(property, (value: any, previousValue: any) => {
                 // console.log(`Player ${key} updated ${property}: ${previousValue} -> ${value}`); // Debug log
                 this.events.emit(NetworkEvent.PLAYER_UPDATED, property, value, key);
             });
        });
    }

    // --- Event Emitter Wrappers ---
    onPlayerJoined(callback: (player: IPlayer, key: string) => void, context?: any) {
        this.events.on(NetworkEvent.PLAYER_JOINED, callback, context);
    }
    onPlayerUpdated(
        callback: (field: string, value: number | string, key: string) => void,
        context?: any
    ) {
        this.events.on(NetworkEvent.PLAYER_UPDATED, callback, context);
    }
    onPlayerLeft(callback: (key: string) => void, context?: any) {
        this.events.on(NetworkEvent.PLAYER_LEFT, callback, context);
    }
     onOtherClientReady(callback: (data: { clientId: string, name?: string }) => void, context?: any) {
        this.events.on(NetworkEvent.OTHER_CLIENT_READY, callback, context);
    }


    // --- Actions ---
    updatePlayer(currentX: number, currentY: number, currentAnim: string) {
        if (!this.room || !this.isConnected) return;
        // console.log(`Sending player update: x=${currentX.toFixed(1)}, y=${currentY.toFixed(1)}, anim=${currentAnim}`); // Debug log
        this.room.send(Message.UPDATE_PLAYER, { x: currentX, y: currentY, anim: currentAnim });
    }

    // Called by WebRTC when it's ready for signaling
    readyToConnect() {
        if (!this.room || !this.isConnected) return;
        console.log("Network: Sending READY_TO_CONNECT message to server.");
        this.room.send(Message.READY_TO_CONNECT);
    }
}
```

*   **`src/web/Webrtc.ts`:** Add methods to check connection status and destroy the PeerJS instance.

```typescript
import Peer from 'peerjs'
import Network from '../services/Network'

export default class WebRTC {
    private myPeer: Peer | null = null; // Allow null for destruction
    private peers = new Map<string, Peer.MediaConnection | Peer.DataConnection>(); // Store connections
    private videoGrid = document.querySelector('.video-grid');
    private buttonGrid = document.querySelector('.button-grid');
    private myVideo = document.createElement('video');
    private myStream?: MediaStream;
    private network: Network;
    private userId: string;
    private isReady = false; // Track if getUserMedia was successful

    constructor(userId: string, network: Network) {
        this.userId = userId;
        this.network = network;
        console.log("WebRTC: Initializing PeerJS for user:", userId);

        try {
            this.myPeer = new Peer(userId, {
                // Add configuration if needed (e.g., STUN/TURN servers for production)
                 host: '/', // Use the same host as the app for PeerServer
                 port: 9000, // Default PeerServer port (ensure it's running or adjust)
                 path: '/myapp', // Match PeerServer path if customized
                // debug: 2 // 0 (none) to 3 (verbose) for debugging
            });

            this.myPeer.on('open', (id) => {
                console.log('WebRTC: My PeerJS ID is:', id);
                // Now get media stream
                this.initializeMediaStream();
            });

            this.myPeer.on('error', (err) => {
                console.error('WebRTC: PeerJS error:', err);
                // Handle specific errors (e.g., 'disconnected', 'network')
            });

            this.myPeer.on('disconnected', () => {
                 console.warn('WebRTC: PeerJS disconnected. Attempting to reconnect...');
                 // PeerJS attempts reconnection automatically by default
            });

            this.myPeer.on('close', () => {
                 console.log('WebRTC: PeerJS connection closed.');
                 this.myPeer = null; // Mark as closed
            });

            this.myVideo.muted = true; // Mute self video locally

            // Handle incoming calls (video/audio)
            this.myPeer.on('call', (call) => {
                console.log(`WebRTC: Incoming call from ${call.peer}`);
                if (!this.myStream) {
                    console.warn("WebRTC: Received call but no local stream available yet.");
                    // Maybe wait or reject call? For now, attempt answer when stream is ready
                    this.waitForStream().then(() => {
                        console.log(`WebRTC: Answering call from ${call.peer} after stream ready.`);
                        call.answer(this.myStream);
                        this.setupCallListeners(call);
                    }).catch(err => {
                        console.error("WebRTC: Failed to get stream for incoming call.", err);
                        call.close(); // Close call if stream fails
                    });
                } else {
                    call.answer(this.myStream);
                    this.setupCallListeners(call);
                }
            });

        } catch (error) {
            console.error("WebRTC: Failed to initialize PeerJS:", error);
        }
    }

    // Helper to wait for the media stream
    private waitForStream(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.myStream) {
                resolve();
                return;
            }
            // Wait a bit for getUserMedia to complete
            const interval = setInterval(() => {
                if (this.myStream) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
            // Timeout after a reasonable period
            setTimeout(() => {
                if (!this.myStream) {
                    clearInterval(interval);
                    reject(new Error("Timeout waiting for media stream"));
                }
            }, 10000); // 10 seconds timeout
        });
    }


    private initializeMediaStream() {
        console.log("WebRTC: Requesting user media (video/audio)...");
        navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true // Request audio
        }).then((stream) => {
            console.log("WebRTC: User media stream obtained.");
            this.myStream = stream;
            this.isReady = true; // Mark as ready
            this.addVideoStream(this.myVideo, this.myStream); // Display self video
            this.setUpButtons(); // Add mute/video buttons
            this.network.readyToConnect(); // Signal network readiness *after* stream is ready
        }).catch((err) => {
            console.error("WebRTC: Failed to get user media:", err);
            // Handle error - maybe disable video chat features
            alert("Could not access camera/microphone. Video chat will be disabled.");
        });
    }

    private setupCallListeners(call: Peer.MediaConnection) {
        const video = document.createElement('video');
        call.on('stream', (userVideoStream) => {
            console.log(`WebRTC: Received stream from ${call.peer}`);
            this.addVideoStream(video, userVideoStream);
        });
        call.on('close', () => {
            console.log(`WebRTC: Call with ${call.peer} closed.`);
            video.remove();
            this.peers.delete(call.peer); // Remove from map on close
        });
        call.on('error', (err) => {
            console.error(`WebRTC: Call error with ${call.peer}:`, err);
            video.remove();
            this.peers.delete(call.peer); // Remove from map on error
        });
        this.peers.set(call.peer, call); // Add to map when listeners are set up
    }


    addVideoStream(video: HTMLVideoElement, stream: MediaStream) {
        video.srcObject = stream;
        video.playsInline = true; // Important for mobile browsers
        video.addEventListener('loadedmetadata', () => {
            video.play().catch(e => console.error("Video play failed:", e));
        });
        if (this.videoGrid) {
             this.videoGrid.append(video);
        } else {
             console.warn("WebRTC: videoGrid element not found.");
        }
    }

    // --- Connection Management ---

    connectToUser(userId: string) {
        if (!this.myPeer || this.peers.has(userId) || userId === this.userId || !this.myStream || !this.isReady) {
            if (!this.myStream || !this.isReady) console.warn(`WebRTC: Cannot connect to ${userId}, local stream not ready.`);
            else if(this.peers.has(userId)) console.log(`WebRTC: Already connected/connecting to ${userId}.`);
            else if (!this.myPeer) console.warn("WebRTC: Cannot connect, PeerJS not initialized.");
            return;
        }

        console.log(`WebRTC: Attempting to call user ${userId}`);
        const call = this.myPeer.call(userId, this.myStream);
        if (call) {
             console.log(`WebRTC: Call initiated to ${userId}`);
             this.setupCallListeners(call); // Set up listeners immediately
        } else {
            console.error(`WebRTC: Failed to initiate call to ${userId}`);
        }
    }

    disconnectFromUser(userId: string) {
        if (this.peers.has(userId)) {
            console.log(`WebRTC: Closing connection to ${userId}`);
            const conn = this.peers.get(userId);
            conn?.close(); // Triggers 'close' event handled in setupCallListeners
            this.peers.delete(userId); // Explicitly remove here as well
        }
    }

     // Check if actively connected
    isConnected(userId: string): boolean {
        const conn = this.peers.get(userId);
        // PeerJS 'open' property indicates an active media connection
        return !!conn && conn.open;
    }

    // Check if we have an entry, even if not fully 'open' yet
    isConnectedOrConnecting(userId: string): boolean {
        return this.peers.has(userId);
    }

    // --- UI Buttons ---
    setUpButtons() {
        if (!this.buttonGrid) return; // Don't add if grid doesn't exist

        // Clear existing buttons if any
        this.buttonGrid.innerHTML = '';

        // Audio Toggle
        const audioButton = document.createElement('button');
        audioButton.innerText = 'Mute';
        audioButton.addEventListener('click', () => {
            if (this.myStream) {
                const audioTracks = this.myStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    audioTracks[0].enabled = !audioTracks[0].enabled; // Toggle
                    audioButton.innerText = audioTracks[0].enabled ? "Mute" : "Unmute";
                }
            }
        });

        // Video Toggle
        const videoButton = document.createElement('button');
        videoButton.innerText = 'Cam Off';
        videoButton.addEventListener('click', () => {
            if (this.myStream) {
                const videoTracks = this.myStream.getVideoTracks();
                if (videoTracks.length > 0) {
                    videoTracks[0].enabled = !videoTracks[0].enabled; // Toggle
                    videoButton.innerText = videoTracks[0].enabled ? "Cam Off" : "Cam On";
                }
            }
        });

        this.buttonGrid.append(audioButton);
        this.buttonGrid.append(videoButton);
    }

    // --- Cleanup ---
    destroy() {
        console.log("WebRTC: Destroying instance...");
        // Stop media tracks
        this.myStream?.getTracks().forEach(track => track.stop());
        this.myStream = undefined;

        // Close all peer connections
        this.peers.forEach(conn => conn.close());
        this.peers.clear();

        // Destroy PeerJS instance
        if (this.myPeer) {
            if (!this.myPeer.destroyed) {
                 this.myPeer.destroy();
            }
            this.myPeer = null;
        }

        // Remove UI elements
        this.myVideo.remove();
        this.buttonGrid?.remove(); // Remove button container too
         // Optionally clear video grid if desired
         // if (this.videoGrid) this.videoGrid.innerHTML = '';

        console.log("WebRTC: Instance destroyed.");
    }
}

```

---

**Final Steps:**

1.  **Install Dependencies:** If you haven't already, make sure `peerjs` is installed in your client project: `npm install peerjs` or `yarn add peerjs`.
2.  **Run PeerJS Server:** For local development, you need a PeerJS server running. Install it globally (`npm install -g peer`) and run `peerjs --port 9000 --path /myapp` (adjust port/path to match `WebRTC.ts` config). For production, you'll need to host this server or use a paid service.
3.  **Build & Run:**
    *   Rebuild the server code.
    *   Restart the server.
    *   Run the client development server (`npm run dev`).
4.  **Test:** Open two browser windows/tabs to `http://localhost:8080`.
    *   You should see the loading screen.
    *   Then, the name input should appear. Enter names in both.
    *   The game should start, and you should see your player with your name above it.
    *   The other player should appear with their name above them.
    *   Names should follow the players.
    *   Video streams should appear in the top right.

This comprehensive set of changes should implement the username feature correctly across your client and server. Remember to test thoroughly!
