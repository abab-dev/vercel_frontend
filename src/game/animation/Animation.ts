import Phaser from 'phaser'

export const createCharacterAnims = (anims: Phaser.Animations.AnimationManager) => {
  const Frate = 10;
        anims.create({
            key: 'idle_left',
            frames: anims.generateFrameNames('player', { start: 1, end: 8, prefix: 'idle_left_', suffix: '' }),
            frameRate: Frate,
            repeat: -1,
        });
        anims.create({
            key: 'idle_right',
            frames: anims.generateFrameNames('player', { start: 1, end: 8, prefix: 'idle_right_', suffix: '' }),
            frameRate: Frate,
            repeat: -1,
        });
        anims.create({
            key: 'idle_front',
            frames: anims.generateFrameNames('player', { start: 1, end: 8, prefix: 'idle_front_', suffix: '' }),
            frameRate: Frate,
            repeat: -1,
        });
        anims.create({
            key: 'idle_back',
            frames: anims.generateFrameNames('player', { start: 1, end: 8, prefix: 'idle_back_', suffix: '' }),
            frameRate: Frate,
            repeat: -1,
        });
        anims.create({
            key: 'walk_left',
            frames: anims.generateFrameNames('player', { start: 8, end: 1, prefix: 'walk_left_', suffix: '' }),
            frameRate: Frate,
            repeat: -1,
        });
        anims.create({
            key: 'walk_back',
            frames: anims.generateFrameNames('player', { start: 1, end: 8, prefix: 'walk_back_', suffix: '' }),
            frameRate: Frate,
            repeat: -1,
        });
        anims.create({
            key: 'walk_right',
            frames: anims.generateFrameNames('player', { start: 8, end: 1, prefix: 'walk_right_', suffix: '' }),
            frameRate: Frate,
            repeat: -1,
        });
        anims.create({
            key: 'walk_front',
            frames: anims.generateFrameNames('player', { start: 1, end: 8, prefix: 'walk_front_', suffix: '' }),
            frameRate: Frate,
            repeat: -1,
        });
}