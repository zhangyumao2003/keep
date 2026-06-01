import { Hand, HandLandmark } from './hand-detector'

export enum GestureType {
  PALM_OPEN = 'palm_open',
  FIST_CLOSED = 'fist_closed',
  PINCH = 'pinch',
  POINT = 'point',
  OK_SIGN = 'ok_sign',
  GRAB = 'grab'
}

export interface Gesture {
  type: GestureType
  confidence: number
  hand: 'Left' | 'Right'
}

// Hand landmark indices
const THUMB_TIP = 4
const INDEX_TIP = 8
const MIDDLE_TIP = 12
const RING_TIP = 16
const PINKY_TIP = 20
const PALM_CENTER = 9
const WRIST = 0

function distance(p1: HandLandmark, p2: HandLandmark): number {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  const dz = p1.z - p2.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function isFingerOpen(tip: HandLandmark, pip: HandLandmark): boolean {
  return tip.y < pip.y // tip is higher than pip = finger is open
}

export function recognizeGesture(hand: Hand): Gesture {
  const landmarks = hand.landmarks

  if (landmarks.length < 21) {
    return { type: GestureType.PALM_OPEN, confidence: 0, hand: hand.handedness as 'Left' | 'Right' }
  }

  const thumbOpen = isFingerOpen(landmarks[THUMB_TIP], landmarks[3])
  const indexOpen = isFingerOpen(landmarks[INDEX_TIP], landmarks[6])
  const middleOpen = isFingerOpen(landmarks[MIDDLE_TIP], landmarks[10])
  const ringOpen = isFingerOpen(landmarks[RING_TIP], landmarks[14])
  const pinkyOpen = isFingerOpen(landmarks[PINKY_TIP], landmarks[18])

  const fingersOpen = [indexOpen, middleOpen, ringOpen, pinkyOpen].filter(x => x).length

  // Pinch detection
  const thumbIndexDist = distance(landmarks[THUMB_TIP], landmarks[INDEX_TIP])
  if (thumbIndexDist < 0.05) {
    return { type: GestureType.PINCH, confidence: 0.9, hand: hand.handedness as 'Left' | 'Right' }
  }

  // Fist (all fingers closed)
  if (!indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
    return { type: GestureType.FIST_CLOSED, confidence: 0.95, hand: hand.handedness as 'Left' | 'Right' }
  }

  // Open palm (all fingers open)
  if (indexOpen && middleOpen && ringOpen && pinkyOpen) {
    return { type: GestureType.PALM_OPEN, confidence: 0.9, hand: hand.handedness as 'Left' | 'Right' }
  }

  // Point (index open, others closed)
  if (indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
    return { type: GestureType.POINT, confidence: 0.85, hand: hand.handedness as 'Left' | 'Right' }
  }

  // OK sign (thumb-index pinch + other fingers open)
  if (thumbIndexDist < 0.08 && middleOpen && ringOpen && pinkyOpen) {
    return { type: GestureType.OK_SIGN, confidence: 0.85, hand: hand.handedness as 'Left' | 'Right' }
  }

  // Default grab
  return { type: GestureType.GRAB, confidence: 0.5, hand: hand.handedness as 'Left' | 'Right' }
}

export function recognizeGestures(hands: Hand[]): Gesture[] {
  return hands.map(hand => recognizeGesture(hand))
}
