import Phaser from 'phaser'
import Network from '../../services/Network'
import Player from './Player'

declare global {
  namespace Phaser.GameObjects {
    interface GameObjectFactory {
     myPlayer(x: number, y: number, texture: string,id:string, frame?: string | number): MyPlayer
    }
  }
}

export default class MyPlayer extends Player{
  constructor(scene: Phaser.Scene, x: number, y: number,id:string, texture: string, frame?: string | number) {
    super(scene, x, y, texture,id, frame)
    this.playerId = id

    this.anims.play('idle_front', true)
  }

  update(cursors: Phaser.Types.Input.Keyboard.CursorKeys,network:Network) {
    if (!cursors) {
      return
    }

    const speed = 200
    const velocity = { x: 0, y: 0 }
    let animation = 'idle_front_1' // Default idle animation

    // Determine movement and animation
    if (cursors.left?.isDown) {
      velocity.x = -speed
      animation = 'walk_left'
    } else if (cursors.right?.isDown) {
      velocity.x = speed
      animation = 'walk_right'
    } else if (cursors.up?.isDown) {
      velocity.y = -speed
      animation = 'walk_back'
    } else if (cursors.down?.isDown) {
      velocity.y = speed
      animation = 'walk_front'
    }

    // Apply velocity and animation
    this.setVelocity(velocity.x, velocity.y)

    if (velocity.x !== 0 || velocity.y !== 0) {
      this.play(animation, true) // Play walking animation
      network.updatePlayer(this.x, this.y, this.anims.currentAnim.key)
    } else {
      // Play idle animation based on the last played direction
      const currentAnim = this.anims.currentAnim?.key || ''
      const idleAnimation = currentAnim.replace('walk', 'idle') // Derive idle animation
      this.play(idleAnimation, true)
      network.updatePlayer(this.x, this.y, this.anims.currentAnim.key)
    }
  }
}

Phaser.GameObjects.GameObjectFactory.register(
    'myPlayer',
    function (
      this: Phaser.GameObjects.GameObjectFactory,
      x: number,
      y: number,
      id:string,
      texture: string,
      frame?: string | number
    ) {
      var sprite = new MyPlayer(this.scene, x, y, texture,id, frame)
  
      this.displayList.add(sprite)
      this.updateList.add(sprite)
  
      this.scene.physics.world.enableBody(sprite, Phaser.Physics.Arcade.DYNAMIC_BODY)
    //   console.log(sprite.width,sprite.height)
    //   console.log(sprite.texture,sprite.frame)
  
      sprite.setScale(2)
      sprite.setSize(10,10)
  
      return sprite
    }
)