import Phaser from 'phaser'

declare global {
  namespace Phaser.GameObjects {
    interface GameObjectFactory {
      player(x: number, y: number, texture: string,id:string, frame?: string | number): Player
    }
  }
}

export default class Player extends Phaser.Physics.Arcade.Sprite {
  playerId: string
  constructor(scene: Phaser.Scene, x: number, y: number,id:string, texture: string, frame?: string | number) {
    super(scene, x, y, texture, frame)
    this.playerId = id

  }
}

  