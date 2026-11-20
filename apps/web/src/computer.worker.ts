/** Web Worker that runs the computer's search off the page's main thread (see `thinkMove`). */
import { answer, type MoveRequest } from "./computer";

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<MoveRequest>) => void) | null;
  postMessage(message: unknown): void;
};
scope.onmessage = (e) => scope.postMessage(answer(e.data));
