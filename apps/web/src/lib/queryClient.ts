export async function withErrorBoundary<T>(promise: Promise<T>, fallbackMessage: string): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : fallbackMessage;
    throw new Error(message);
  }
}
