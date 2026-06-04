import { Hand } from './hand-detector'

export interface SwipeState {
  phase: 'idle' | 'entering' | 'visible' | 'hiding'
  /** 0 to 1 — progress of the entering or hiding animation */
  progress: number
  /** Whether the panel should currently be rendered */
  shouldShowPanel: boolean
  /** Normalized x coordinate of the active hand's index tip, or null */
  activeHandX: number | null
}

const INDEX_TIP = 8
const LEFT_ENTER_THRESHOLD = 0.1   // x < 0.10 = finger is in the left trigger zone
const LEFT_EXIT_THRESHOLD = 0.25   // x > 0.25 = finger has definitely left the zone
const ACTIVATION_MS = 500           // time finger must stay in zone before panel shows
const DEACTIVATION_MS = 300         // time finger must be outside zone before panel hides

export class SwipeDetector {
  private phase: SwipeState['phase'] = 'idle'
  private enterTime = 0
  private exitTime = 0
  private currentProgress = 0
  private activeHandX: number | null = null

  /**
   * Call every frame. Returns the current swipe detection state.
   * @param hands — detected hands for this frame
   * @param now — current timestamp from performance.now()
   */
  update(hands: Hand[], now: number): SwipeState {
    // Check if any hand's index tip is in the left edge zone
    let inZone = false
    let handX: number | null = null

    for (const hand of hands) {
      const rawX = hand.landmarks[INDEX_TIP]?.x
      // Mirror x to screen-space (matching landmarkToWorld mirror fix)
      const x = rawX !== undefined ? 1 - rawX : undefined
      if (x !== undefined && x < LEFT_ENTER_THRESHOLD) {
        inZone = true
        handX = x
        break
      }
    }

    switch (this.phase) {
      case 'idle':
        if (inZone) {
          this.phase = 'entering'
          this.enterTime = now
          this.activeHandX = handX
          this.currentProgress = 0
        }
        break

      case 'entering':
        if (!inZone) {
          // Finger left before activation threshold
          this.phase = 'idle'
          this.currentProgress = 0
          this.activeHandX = null
        } else {
          this.activeHandX = handX
          const elapsed = now - this.enterTime
          this.currentProgress = Math.min(1, elapsed / ACTIVATION_MS)
          if (elapsed >= ACTIVATION_MS) {
            this.phase = 'visible'
            this.currentProgress = 1
          }
        }
        break

      case 'visible':
        if (!inZone) {
          // Check if all hands are definitely outside the exit zone
          const allOutside = hands.every(
            h =>
              h.landmarks[INDEX_TIP]?.x === undefined ||
              (1 - h.landmarks[INDEX_TIP].x) > LEFT_EXIT_THRESHOLD
          )
          if (allOutside) {
            this.phase = 'hiding'
            this.exitTime = now
          }
          // else: hand is still near the edge, stay visible
        } else {
          this.activeHandX = handX
          this.exitTime = 0 // reset exit timer
        }
        break

      case 'hiding':
        if (inZone) {
          // Hand came back before deactivation — re-show
          this.phase = 'visible'
          this.activeHandX = handX
          this.currentProgress = 1
        } else {
          const elapsed = now - this.exitTime
          this.currentProgress = Math.max(0, 1 - elapsed / DEACTIVATION_MS)
          if (elapsed >= DEACTIVATION_MS) {
            this.phase = 'idle'
            this.currentProgress = 0
            this.activeHandX = null
          }
        }
        break
    }

    return {
      phase: this.phase,
      progress: this.currentProgress,
      shouldShowPanel:
        this.phase === 'visible' ||
        this.phase === 'entering' ||
        this.phase === 'hiding',
      activeHandX: this.activeHandX
    }
  }

  reset(): void {
    this.phase = 'idle'
    this.currentProgress = 0
    this.activeHandX = null
  }
}
