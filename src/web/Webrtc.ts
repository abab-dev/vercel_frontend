import Peer from 'peerjs'
import Network from '../services/Network'
export default class WebRTC {
    private myPeer: Peer
    private peers = new Map<string, Peer.MediaConnection>()
    private videoGrid = document.querySelector('.video-grid')
    private buttonGrid = document.querySelector('.button-grid')
    private myVideo = document.createElement('video')
    private myStream?: MediaStream

    constructor(userId: string, network: Network) {
        console.log(this.videoGrid)
        console.log(this.buttonGrid)
        console.log(this.myVideo)
        this.myPeer = new Peer(userId)
        this.myVideo.muted = true
        navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        }).then((stream) => {
            this.myStream = stream
            this.addVideoStream(this.myVideo, this.myStream)
            this.myPeer.on('call', (call) => {
                call.answer(this.myStream)
                const video = document.createElement('video')
                call.on('stream', (userVideoStream) => {
                    this.addVideoStream(video, userVideoStream)
                })
                call.on('close', () => {
                    video.remove()
                })
                this.peers.set(call.peer, call)
            })
            this.setUpButtons()
            network.readyToConnect()
        })

    }
    addVideoStream(video: HTMLVideoElement, stream: MediaStream) {
        video.srcObject = stream
        video.addEventListener('loadedmetadata', () => {
            video.play()
        })
        if (this.videoGrid) this.videoGrid.append(video)
    }
    deleteVideoStream(userId: string) {
        if (this.peers.has(userId)) {
            const peer = this.peers.get(userId)
            if (!peer) return
            peer.close()
            this.peers.delete(userId)
        }
    }
    connectToUser(userId: string) {
        if (this.peers.has(userId)) return;
        if (!this.myStream) return
        const call = this.myPeer.call(userId, this.myStream)
        const video = document.createElement('video')
        call.on('stream', (userVideoStream) => {
            this.addVideoStream(video, userVideoStream)
        })
        call.on('close', () => {
            video.remove()
        })

        this.peers.set(userId, call)
    }

    disconnectFromUser(userId: string) {
        if (!this.peers.has(userId)) return;

        const call = this.peers.get(userId);
        if (call) {
            call.close();
            this.peers.delete(userId);
        }
    }
    setUpButtons() {
        const audioButton = document.createElement('button')
        audioButton.innerText = 'Mute'
        audioButton.addEventListener('click', () => {
            if (this.myStream) {
                const audioTrack = this.myStream.getAudioTracks()[0]
                if (audioTrack.enabled) {
                    audioTrack.enabled = false
                    audioButton.innerText = "Unmute"
                } else {
                    audioTrack.enabled = true
                    audioButton.innerText = "Mute"
                }
            }
        })
        const videoButton = document.createElement('button')
        videoButton.innerText = 'Video off'
        videoButton.addEventListener('click', () => {
            if (this.myStream) {
                const videoTrack = this.myStream.getVideoTracks()[0]
                if (videoTrack.enabled) {
                    videoTrack.enabled = false
                    videoButton.innerText = 'Video on'
                } else {
                    videoTrack.enabled = true
                    videoButton.innerText = "Video off"
                }
            }
        })
        this.buttonGrid?.append(audioButton)
        this.buttonGrid?.append(videoButton)
    }
}
