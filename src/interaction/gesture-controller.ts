import * as THREE from 'three'
import { Hand, HandLandmark } from '../core/hand-detector'
import { Gesture, GestureType } from '../core/gesture-recognizer'

export class GestureController {
  private raycaster: THREE.Raycaster
  private selectedObject: THREE.Object3D | null = null
  private dragOffset: THREE.Vector3 = new THREE.Vector3()
  private camera: THREE.Camera
  private scene: THREE.Scene

  constructor(camera: THREE.Camera, scene: THREE.Scene) {
    this.camera = camera
    this.scene = scene
    this.raycaster = new THREE.Raycaster()
  }

  handleGesture(gesture: Gesture, hand: Hand, scene: THREE.Scene) {
    const indexTip = hand.landmarks[8]
    const palmCenter = hand.landmarks[9]

    switch (gesture.type) {
      case GestureType.PINCH:
        this.handlePinch(indexTip, palmCenter, scene)
        break
      case GestureType.FIST_CLOSED:
        this.handleFist(indexTip, palmCenter, scene)
        break
      case GestureType.PALM_OPEN:
        this.handlePalmOpen(scene)
        break
      case GestureType.GRAB:
        this.handleGrab(indexTip, palmCenter, scene)
        break
      default:
        break
    }
  }

  private handlePinch(indexTip: HandLandmark, palmCenter: HandLandmark, scene: THREE.Scene) {
    const mousePos = new THREE.Vector2(
      (indexTip.x - 0.5) * 2,
      -(indexTip.y - 0.5) * 2
    )

    this.raycaster.setFromCamera(mousePos, this.camera)
    const objects = scene.children.filter(obj => obj instanceof THREE.Mesh && obj.geometry)
    const intersects = this.raycaster.intersectObjects(objects)

    if (intersects.length > 0) {
      this.selectedObject = intersects[0].object
      const point = intersects[0].point
      this.dragOffset.subVectors(this.selectedObject.position, point)
    }
  }

  private handleFist(indexTip: HandLandmark, palmCenter: HandLandmark, scene: THREE.Scene) {
    if (this.selectedObject) {
      const mousePos = new THREE.Vector2(
        (indexTip.x - 0.5) * 2,
        -(indexTip.y - 0.5) * 2
      )

      this.raycaster.setFromCamera(mousePos, this.camera)
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.5)
      const target = new THREE.Vector3()
      this.raycaster.ray.intersectPlane(plane, target)

      this.selectedObject.position.copy(target.add(this.dragOffset))
    }
  }

  private handlePalmOpen(scene: THREE.Scene) {
    this.selectedObject = null
  }

  private handleGrab(indexTip: HandLandmark, palmCenter: HandLandmark, scene: THREE.Scene) {
    // Similar to pinch but with different interaction
    this.handlePinch(indexTip, palmCenter, scene)
  }

  updateObjectPosition(hand: Hand, scene: THREE.Scene) {
    if (!this.selectedObject) return

    const indexTip = hand.landmarks[8]
    const mousePos = new THREE.Vector2(
      (indexTip.x - 0.5) * 2,
      -(indexTip.y - 0.5) * 2
    )

    this.raycaster.setFromCamera(mousePos, this.camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.5)
    const target = new THREE.Vector3()
    this.raycaster.ray.intersectPlane(plane, target)

    this.selectedObject.position.copy(target.add(this.dragOffset))
  }

  getSelectedObject() {
    return this.selectedObject
  }

  setSelectedObject(object: THREE.Object3D | null) {
    this.selectedObject = object
  }
}
