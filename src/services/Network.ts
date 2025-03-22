import { Client,Room} from "colyseus.js";
import Phaser from 'phaser'
import { IOfficeState, IPlayer } from '../types/IOfficeState'
import { Message } from '../types/Messages'
import WebRTC from '../web/Webrtc'
enum Event {
  PLAYER_JOINED='player_joined',
  PLAYER_UPDATED='player_updated',
  PLAYER_LEFT='player_left'
}

export default class Network {
  private client: Client
  private room?: Room<IOfficeState>
  private events= new Phaser.Events.EventEmitter()
  webRTC?:WebRTC


  mySessionId!:string

  

  constructor() {
    // const endpoint = 'ws://localhost:2567'
    const protocol = window.location.protocol.replace('http', 'ws')
    // const endpoint = 'wss://render-server-h04y.onrender.com'
    const endpoint =
      process.env.NODE_ENV === 'production'
        ? 'wss://render-server-h04y.onrender.com'
        : `${protocol}//${window.location.hostname}:2567`
    this.client = new Client(endpoint)
  }

  async join() {
    this.room = await this.client.joinOrCreate('myoffice')
    this.mySessionId = this.room.sessionId
    this.webRTC= new WebRTC(this.mySessionId,this)

    // this.room.state.players.onChange = (player, key) => {
    //   console.log(player, 'have changes at', key)
    // }
    console.log(this.room.state)
    this.room.state.players.onAdd((player: IPlayer, key: string) => {
      if (key === this.mySessionId) return;
    
      console.log(`Player joined: ${key}`);
      this.events.emit(Event.PLAYER_JOINED, player, key);
      if (this.webRTC) this.webRTC.connectToNewUser(key)
    
      const propertiesToListen = ['x', 'y', 'anim'];
    
      propertiesToListen.forEach((property) => {
        player.listen(property, (value, previousValue) => {
          this.events.emit(Event.PLAYER_UPDATED, property, value, key);
        });
      });
    });

    

    this.room.state.players.onRemove ( (player: IPlayer, key: string) => {
      console.log(`player removed ${player}`)
      this.events.emit(Event.PLAYER_LEFT,key)
      this.webRTC?.deleteVideoStream(key)
    })
    this.room.onMessage(Message.READY_TO_CONNECT,(clientId)=>{
      this.webRTC?.connectToNewUser(clientId)
    })
  }

  onPlayerJoined(callback: (Player: IPlayer, key: string) => void, context?: any) {
    console.log('inside on player jjoined callback')
    this.events.on(Event.PLAYER_JOINED,callback, context)
  }
  onPlayerUpdated(
    callback: (field: string, value: number | string, key: string) => void,
    context?: any
  ) {
    console.log('inside on player updated callback')
    this.events.on(Event.PLAYER_UPDATED, callback, context)
  }

  onPlayerLeft(callback: (key: string) => void, context?: any) {
    console.log('inside on player left callbacak')
    this.events.on(Event.PLAYER_LEFT,callback, context)
  }
  updatePlayer(currentX: number, currentY: number, currentAnim: string) {
    if (!this.room) return
    this.room.send(Message.UPDATE_PLAYER, { x: currentX, y: currentY, anim: currentAnim })
  }
  readyToConnect(){
    this.room?.send(Message.READY_TO_CONNECT)
  }
}
