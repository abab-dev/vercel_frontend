import Phaser from 'phaser';
import { createCharacterAnims } from './animation/Animation';
import Network from '../services/Network.ts';
import { IPlayer } from '../types/IOfficeState.ts';
import './character/MyPlayer.ts'
import './character/OtherPlayer.ts'
import MyPlayer from './character/MyPlayer.ts';
import OtherPlayer from './character/OtherPlayer.ts';
const PROXIMITY_THRESHOLD = 200;


export class Game extends Phaser.Scene {
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private myPlayer!: MyPlayer
    private network?:Network
    private otherPlayers!:Phaser.Physics.Arcade.Group
    private otherPlayerMap = new Map<string,OtherPlayer>()

    constructor() {
        super('Game');
    }
    init (){
        this.network = new Network()
    }
    preload(){

    this.cursors = this.input.keyboard.createCursorKeys()
    }

    // preload() {
    //
    //     // Load the tilemap and image assets
    //     this.load.tilemapTiledJSON('map', 'assets/json/final_map.json');
    //     this.load.image('floor', 'assets/tiles/floor.png');
    //     this.load.image('forest', 'assets/tiles/forest.png');
    //     this.load.image('office', 'assets/tiles/office.png');
    //     this.load.image('objects', 'assets/tiles/objects.png');
    //     this.load.image('scifi', 'assets/tiles/scifi.png');
    //     this.load.atlas('player', 'assets/tiles/chr.png', 'assets/json/char.json');
    //     this.cursors = this.input.keyboard.createCursorKeys();
    // }
    //
    async create() {
        if(!this.network){
            throw new Error('server instance missing')
        }
        await this.network.join()
        this.scene.stop('preloader')
        createCharacterAnims(this.anims)
        console.log(this.anims)
        const map = this.make.tilemap({ key: 'map' });


        // Add the tilesets and create layers
        const tileset1 = map.addTilesetImage('floor', 'floor');
        const tileset2 = map.addTilesetImage('forest', 'forest');
        const tileset3 = map.addTilesetImage('office', 'office');
        const tileset4 = map.addTilesetImage('objects', 'objects');
        const tileset5 = map.addTilesetImage('scifi', 'scifi');

        const floorLayer = map.createLayer('floor', [tileset1, tileset2, tileset3], 0, 0);
        const wall_projection_layer = map.createLayer('wall_projection', [tileset1, tileset3], 0, 0);
        const wallLayer = map.createLayer('walls', [tileset1, tileset3, tileset4], 0, 0);
        const objectLayer = map.createLayer('objects', [tileset1, tileset2, tileset3, tileset4, tileset5], 0, 0);
        const superposeLayer = map.createLayer('superpose', [tileset4, tileset5], 0, 0);

        // Set camera and physics bounds based on the map size
        // this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

        // Optional: Set a background color for debugging
        this.cameras.main.backgroundColor.setTo(0, 0, 0);
        
        this.myPlayer = this.add.myPlayer(800,800,'player',this.network.mySessionId)
        this.otherPlayers = this.physics.add.group({ classType: OtherPlayer })
        this.cameras.main.zoom = 1.5;
        this.cameras.main.startFollow(this.myPlayer);

        // Create colliders for objects that can collide
        const collideLayer = map.getObjectLayer('collidelayer');
        collideLayer.objects.forEach((object) => {
            const collidesProperty = object.properties.find((prop) => prop.name === 'collides');
            if (collidesProperty && collidesProperty.value) {
                const collider = this.physics.add.existing(
                    new Phaser.GameObjects.Rectangle(this, object.x + object.width / 2, object.y + object.height / 2, object.width, object.height)
                );
                collider.setOrigin(0.5);
                if (collider.body){

                    collider.body.moves = false;
                }
                this.physics.add.collider(this.myPlayer, collider);
            }
        });
        // if (process.env.NODE_ENV !== 'production') {
        //     if (this.physics.world.debugGraphic) {
        //         this.physics.world.debugGraphic.clear();
        //     }
        //     this.physics.world.createDebugGraphic();
        // }
        // const debugGraphics = this.add.graphics().setAlpha(0.75);

        // Set camera and player physics properties
        this.myPlayer.setCollideWorldBounds(true);
        this.network.onPlayerJoined(this.handlePlayerJoined, this)
        this.network.onPlayerLeft(this.handlePlayerLeft, this)
        this.network.onPlayerUpdated(this.handlePlayerUpdated, this)
    }

    private handlePlayerJoined(newPlayer: IPlayer, id: string) {
        const otherPlayer = this.add.otherPlayer(newPlayer.x, newPlayer.y, 'player', id)
        // this.otherPlayers.get(newPlayer.x, newPlayer.y, 'player') as OtherPlayer
        this.otherPlayers.add(otherPlayer)
        this.otherPlayerMap.set(id, otherPlayer)
    }
    
    private handlePlayerLeft(id: string) {
        if (this.otherPlayerMap.has(id)) {
            const otherPlayer = this.otherPlayerMap.get(id)
            if (!otherPlayer) return
            this.otherPlayers.remove(otherPlayer, true, true)
            this.otherPlayerMap.delete(id)
          }
        }
        private handlePlayerUpdated(field: string, value: number | string, id: string) {
            const otherPlayer = this.otherPlayerMap.get(id)
            if (!otherPlayer) return
            otherPlayer.updateOtherPlayer(field, value)
        }

    update() {
        if (!this.myPlayer || !this.network) return;

        this.myPlayer.update(this.cursors, this.network);

        this.otherPlayerMap.forEach((otherPlayer, id) => {
            const distance = Phaser.Math.Distance.Between(
                this.myPlayer.x,
                this.myPlayer.y,
                otherPlayer.x,
                otherPlayer.y
            );

            if (distance <= PROXIMITY_THRESHOLD) {
                this.network?.webRTC?.connectToUser(id);
            } else {
                this.network?.webRTC?.disconnectFromUser(id);
            }
        });
    }
}
