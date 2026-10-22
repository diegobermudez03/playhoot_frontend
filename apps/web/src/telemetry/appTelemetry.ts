import type { TelemetryReporter } from '@playhoot/communication';
import type { JoinTelemetry } from '@playhoot/feature-session-join';
import type { SessionPlayTelemetry } from '@playhoot/feature-session-play';
import type { ClientTelemetryEvent } from '@playhoot/protocol';

import { joinEvents, playEvents, presentationError } from './classify';

// What the features and the presentation report; classified here and sent to the backend.
export interface AppTelemetry {
  join(event: JoinTelemetry): void;
  play(event: SessionPlayTelemetry): void;
  // A render failed into the route error boundary.
  presentationFailed(): void;
  // Sends what is queued; `leaving` when the page is going away.
  flush(leaving: boolean): void;
}

export function createAppTelemetry(
  reporter: TelemetryReporter,
  // Development builds also print every event to the console.
  devLog?: (event: ClientTelemetryEvent) => void,
): AppTelemetry {
  const record = (events: ClientTelemetryEvent[]) => {
    for (const event of events) {
      devLog?.(event);
      reporter.record(event);
    }
  };
  return {
    join: (event) => record(joinEvents(event)),
    play: (event) => record(playEvents(event)),
    presentationFailed: () => record([presentationError()]),
    flush: (leaving) => void reporter.flush({ leaving }),
  };
}
