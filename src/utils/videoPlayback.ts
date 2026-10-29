/**
 * Utilidades seguras para reproducción y pausa de videos HTML5.
 * Evita el error "The play() request was interrupted by a call to pause(). https://goo.gl/LdLk22"
 * asegurando que las llamadas a pause() respeten las promesas de play() en curso.
 */

const pendingPlayPromises = new WeakMap<HTMLVideoElement, Promise<void>>();

export const safePlayVideo = (
  video: HTMLVideoElement | null | undefined,
  onSuccess?: () => void,
  onError?: (err: any) => void
): Promise<void> => {
  if (!video) return Promise.resolve();

  try {
    const playPromise = video.play();
    if (playPromise !== undefined) {
      pendingPlayPromises.set(video, playPromise);
      return playPromise
        .then(() => {
          onSuccess?.();
        })
        .catch((err) => {
          onError?.(err);
        })
        .finally(() => {
          if (pendingPlayPromises.get(video) === playPromise) {
            pendingPlayPromises.delete(video);
          }
        });
    } else {
      onSuccess?.();
    }
  } catch (e) {
    onError?.(e);
  }

  return Promise.resolve();
};

export const safePauseVideo = (
  video: HTMLVideoElement | null | undefined,
  onPaused?: () => void
): void => {
  if (!video) return;

  const pendingPromise = pendingPlayPromises.get(video);
  if (pendingPromise) {
    pendingPromise
      .then(() => {
        try {
          if (!video.paused) {
            video.pause();
            onPaused?.();
          }
        } catch {}
      })
      .catch(() => {});
  } else {
    try {
      if (!video.paused) {
        video.pause();
        onPaused?.();
      }
    } catch {}
  }
};
