// Project-wide ambient typings
interface HTMLElement {
  /** internal counter animation control attached at runtime */
  __countAnim?: { stopped: boolean; cancel: () => void };
}

interface Window {
  /** reseed helper wired by reflect canvas module */
  __reseedReflection?: () => void;
  /** Safari/WebKit legacy prefixed audio context */
  webkitAudioContext?: typeof AudioContext;
}
