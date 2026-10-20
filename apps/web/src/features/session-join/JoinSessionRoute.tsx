import { useParams } from 'react-router';

// Web presentation of the Join Session feature. Placeholder until the feature state exists
// (@playhoot/feature-session-join).
export function JoinSessionRoute() {
  const { joinCode } = useParams();
  return (
    <main>
      <h1>Join session</h1>
      <p>Join code: {joinCode}</p>
    </main>
  );
}
