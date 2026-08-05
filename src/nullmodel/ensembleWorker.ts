import { runEnsemble, type EnsembleJob, type EnsembleMessage } from './ensemble';

self.onmessage = (e: MessageEvent<EnsembleJob>) => {
  const post = (m: EnsembleMessage) => (self as unknown as Worker).postMessage(m);
  try {
    const every = Math.max(1, Math.floor(Math.min(1000, e.data.count) / 20));
    const { stats } = runEnsemble(e.data, (done, total) => {
      if (done % every === 0 || done === total) post({ type: 'progress', done, total });
    });
    post({ type: 'result', stats });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
