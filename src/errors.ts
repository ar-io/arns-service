import { EVALUATION_TIMEOUT_MS } from './constants';

// TODO: we could put a prometheus metric here to help fine tune what our evaluation limit should be
export class EvaluationTimeoutError extends Error {
  constructor() {
    super(`State evaluation exceeded limit of ${EVALUATION_TIMEOUT_MS}ms.`);
  }
}
