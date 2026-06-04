import * as THREE from 'three'
import { Hand } from '../core/hand-detector'
import { Gesture, GestureType } from '../core/gesture-recognizer'
import { SceneManager } from '../rendering/scene-manager'

const INDEX_TIP = 8

interface SingleHandGrab {
  handId: 'Left' | 'Right'
  isActive: boolean
  selectedObject: THREE.Object3D | null
  grabFingerWorld: THREE.Vector3
  grabObjectPosition: THREE.Vector3
}

interface TwoHandGrab {
  isActive: boolean
  selectedObject: THREE.Object3D | null
  initialMidpointWorld: THREE.Vector3
  initialObjectPosition: THREE.Vector3
  initialFingerDistance: number
  initialObjectScale: THREE.Vector3
  initialFingerAngleRad: number
  initialObjectRotation: THREE.Euler
}

export class ManipulationController {
  private leftGrab: SingleHandGrab
  private rightGrab: SingleHandGrab
  private twoHand: TwoHandGrab

  // EMA smoothed finger positions to reduce jitter
  private smoothedFingerLeft: THREE.Vector3 | null = null
  private smoothedFingerRight: THREE.Vector3 | null = null
  private readonly SMOOTHING_FACTOR = 0.3

  constructor() {
    this.leftGrab = this._createSingleGrab('Left')
    this.rightGrab = this._createSingleGrab('Right')
    this.twoHand = this._createTwoHandGrab()
  }

  /**
   * Called every frame for each hand. Drives the entire pinch-to-manipulate state machine.
   */
  update(gesture: Gesture | undefined, hand: Hand, sceneManager: SceneManager): void {
    if (!gesture) return

    const handId = hand.handedness as 'Left' | 'Right'
    const grab = handId === 'Left' ? this.leftGrab : this.rightGrab
    const isPinching = gesture.type === GestureType.PINCH

    // Initialize smoothed position on first frame
    const initDepth = SceneManager.estimateHandDepth(hand)
    if (handId === 'Left' && !this.smoothedFingerLeft) {
      this.smoothedFingerLeft = SceneManager.landmarkToWorld(hand.landmarks[INDEX_TIP], initDepth)
    }
    if (handId === 'Right' && !this.smoothedFingerRight) {
      this.smoothedFingerRight = SceneManager.landmarkToWorld(hand.landmarks[INDEX_TIP], initDepth)
    }

    // --- State transitions ---
    if (isPinching && !grab.isActive) {
      this._onPinchStart(hand, grab, sceneManager)
    } else if (isPinching && grab.isActive && grab.selectedObject) {
      this._onPinchContinue(hand, grab)
    } else if (!isPinching && grab.isActive) {
      this._onPinchEnd(grab)
    }

    grab.isActive = isPinching && grab.selectedObject !== null

    // Check two-hand condition
    this._syncTwoHandState()

    // Update proximity glow on nearby objects
    this._updateProximityGlow(hand, sceneManager)
  }

  private readonly GRAB_DISTANCE = 0.25

  private _onPinchStart(hand: Hand, grab: SingleHandGrab, sceneManager: SceneManager): void {
    const depth = SceneManager.estimateHandDepth(hand)
    const fingerWorld = SceneManager.landmarkToWorld(hand.landmarks[INDEX_TIP], depth)

    // Initialize smoothed position
    if (grab.handId === 'Left') {
      this.smoothedFingerLeft = fingerWorld.clone()
    } else {
      this.smoothedFingerRight = fingerWorld.clone()
    }

    // 3D proximity grab: find closest object within reach
    let closest: THREE.Object3D | null = null
    let closestDist = Infinity

    for (const obj of sceneManager.getObjects()) {
      const dist = fingerWorld.distanceTo(obj.position)
      if (dist < this.GRAB_DISTANCE && dist < closestDist) {
        closest = obj
        closestDist = dist
      }
    }

    if (closest) {
      grab.selectedObject = closest
      grab.grabFingerWorld.copy(fingerWorld)
      grab.grabObjectPosition.copy(closest.position.clone())
    }
  }

  private _onPinchContinue(hand: Hand, grab: SingleHandGrab): void {
    const depth = SceneManager.estimateHandDepth(hand)
    const rawFinger = SceneManager.landmarkToWorld(hand.landmarks[INDEX_TIP], depth)

    // Apply EMA smoothing
    const smoothed =
      grab.handId === 'Left' ? this.smoothedFingerLeft! : this.smoothedFingerRight!
    smoothed.lerp(rawFinger, this.SMOOTHING_FACTOR)

    if (!this.twoHand.isActive && grab.selectedObject) {
      // Single-hand mode: translate in 3D
      const delta = new THREE.Vector3().subVectors(smoothed, grab.grabFingerWorld)
      grab.selectedObject.position.copy(
        new THREE.Vector3().addVectors(grab.grabObjectPosition, delta)
      )
    }
  }

  private _onPinchEnd(grab: SingleHandGrab): void {
    grab.selectedObject = null

    // If the other hand is still pinching, re-snapshot its state
    // to prevent the object from jumping when two-hand mode ends
    const other = grab.handId === 'Left' ? this.rightGrab : this.leftGrab
    if (other.isActive && other.selectedObject) {
      const otherSmoothed =
        other.handId === 'Left' ? this.smoothedFingerLeft! : this.smoothedFingerRight!
      other.grabFingerWorld.copy(otherSmoothed)
      other.grabObjectPosition.copy(other.selectedObject.position.clone())
    }

    // Reset two-hand state
    this.twoHand = this._createTwoHandGrab()
  }

  private _syncTwoHandState(): void {
    const bothPinchingSameObject =
      this.leftGrab.isActive &&
      this.rightGrab.isActive &&
      this.leftGrab.selectedObject &&
      this.rightGrab.selectedObject &&
      this.leftGrab.selectedObject === this.rightGrab.selectedObject

    if (bothPinchingSameObject) {
      if (!this.twoHand.isActive) {
        // Enter two-hand mode — snapshot current state
        const obj = this.leftGrab.selectedObject!
        const lf = this.smoothedFingerLeft!
        const rf = this.smoothedFingerRight!

        this.twoHand.isActive = true
        this.twoHand.selectedObject = obj
        this.twoHand.initialObjectPosition.copy(obj.position.clone())
        this.twoHand.initialObjectScale.copy(obj.scale.clone())
        this.twoHand.initialObjectRotation.copy(obj.rotation.clone())

        this.twoHand.initialMidpointWorld = new THREE.Vector3()
          .addVectors(lf, rf)
          .multiplyScalar(0.5)

        this.twoHand.initialFingerDistance = lf.distanceTo(rf)

        this.twoHand.initialFingerAngleRad = Math.atan2(
          rf.y - lf.y,
          rf.x - lf.x
        )
      } else {
        // Update two-hand manipulation
        const obj = this.twoHand.selectedObject!
        const lf = this.smoothedFingerLeft!
        const rf = this.smoothedFingerRight!

        // --- Translation (midpoint tracking) ---
        const currentMidpoint = new THREE.Vector3()
          .addVectors(lf, rf)
          .multiplyScalar(0.5)
        const delta = new THREE.Vector3().subVectors(
          currentMidpoint,
          this.twoHand.initialMidpointWorld
        )
        obj.position.copy(
          new THREE.Vector3().addVectors(
            this.twoHand.initialObjectPosition,
            delta
          )
        )

        // --- Scale (fingertip distance ratio) ---
        const currentDist = lf.distanceTo(rf)
        const scaleFactor = THREE.MathUtils.clamp(
          currentDist / Math.max(this.twoHand.initialFingerDistance, 0.001),
          0.2,
          5.0
        )
        obj.scale.set(
          this.twoHand.initialObjectScale.x * scaleFactor,
          this.twoHand.initialObjectScale.y * scaleFactor,
          this.twoHand.initialObjectScale.z * scaleFactor
        )

        // --- Rotation (hand-pair angle change around Z axis) ---
        const currentAngle = Math.atan2(rf.y - lf.y, rf.x - lf.x)
        const angleDelta = currentAngle - this.twoHand.initialFingerAngleRad
        obj.rotation.z = this.twoHand.initialObjectRotation.z + angleDelta
      }
    } else if (this.twoHand.isActive) {
      // Two-hand mode ended
      this.twoHand = this._createTwoHandGrab()
    }
  }

  private readonly PROXIMITY_THRESHOLD = 0.15
  private readonly DEFAULT_EMISSIVE = 0.5
  private readonly GLOW_EMISSIVE = 1.2

  /** Highlight objects that are close to the fingertip */
  private _updateProximityGlow(hand: Hand, sceneManager: SceneManager): void {
    const depth = SceneManager.estimateHandDepth(hand)
    const fingerWorld = SceneManager.landmarkToWorld(hand.landmarks[INDEX_TIP], depth)

    for (const obj of sceneManager.getObjects()) {
      if (!(obj instanceof THREE.Mesh)) continue
      const mat = obj.material as THREE.MeshStandardMaterial
      if (!mat.emissiveIntensity) continue

      const dist = fingerWorld.distanceTo(obj.position)

      if (dist < this.PROXIMITY_THRESHOLD && obj !== this.getSelectedObject()) {
        mat.emissiveIntensity = this.GLOW_EMISSIVE
      } else if (obj !== this.getSelectedObject()) {
        mat.emissiveIntensity = this.DEFAULT_EMISSIVE
      }
    }
  }

  private _createSingleGrab(handId: 'Left' | 'Right'): SingleHandGrab {
    return {
      handId,
      isActive: false,
      selectedObject: null,
      grabFingerWorld: new THREE.Vector3(),
      grabObjectPosition: new THREE.Vector3()
    }
  }

  private _createTwoHandGrab(): TwoHandGrab {
    return {
      isActive: false,
      selectedObject: null,
      initialMidpointWorld: new THREE.Vector3(),
      initialObjectPosition: new THREE.Vector3(),
      initialFingerDistance: 0,
      initialObjectScale: new THREE.Vector3(1, 1, 1),
      initialFingerAngleRad: 0,
      initialObjectRotation: new THREE.Euler()
    }
  }

  getSelectedObject(): THREE.Object3D | null {
    if (this.twoHand.isActive) return this.twoHand.selectedObject
    return this.leftGrab.selectedObject ?? this.rightGrab.selectedObject
  }

  /** Check if any grab is currently active */
  isManipulating(): boolean {
    return this.leftGrab.isActive || this.rightGrab.isActive
  }
}
