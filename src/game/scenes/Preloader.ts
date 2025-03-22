import Phaser from 'phaser'

export default class Preloader extends Phaser.Scene {
  private counter = 0

  constructor() {
    super('preloader')
  }

  preload() {
        // Load the tilemap and image assets
        this.load.tilemapTiledJSON('map', 'assets/json/final_map.json');
        this.load.image('floor', 'assets/tiles/floor.png');
        this.load.image('forest', 'assets/tiles/forest.png');
        this.load.image('office', 'assets/tiles/office.png');
        this.load.image('objects', 'assets/tiles/objects.png');
        this.load.image('scifi', 'assets/tiles/scifi.png');
        this.load.atlas('player', 'assets/tiles/chr.png', 'assets/json/char.json');
  }

  async create() {
    // create loading texts
    const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2
    const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 2
    this.add
      .text(screenCenterX, screenCenterY - 100, 'Virtoffice')
      .setOrigin(0.5)
      .setFontSize(50)
      .setFontStyle('bold')
      .setColor('#000000')
    const loadingText = this.add
      .text(screenCenterX, screenCenterY - 30, 'Loading...')
      .setOrigin(0.5)
      .setFontSize(30)
      .setColor('#000000')
    this.add
      .text(
        screenCenterX,
        screenCenterY + 40,
        'Please patiently wait for 10-15 seconds because it takes some time to wake the server up.'
      )
      .setOrigin(0.5)
      .setFontSize(18)
      .setColor('#000000')
    this.add
      .text(
        screenCenterX,
        screenCenterY + 60,
        "(Our server goes to sleep if the web doesn't receive any traffice in 1 hour)"
      )
      .setOrigin(0.5)
      .setFontSize(18)
      .setColor('#000000')

    this.time.addEvent({
      delay: 750,
      callback: () => {
        switch (this.counter % 3) {
          case 0:
            loadingText.setText('loading.')
            break

          case 1:
            loadingText.setText('loading..')
            break

          case 2:
            loadingText.setText('loading...')
            break
        }
        this.counter += 1
      },
      loop: true,
    })

    this.scene.run('Game')
  }
}

