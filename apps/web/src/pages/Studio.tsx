// M0 placeholder — replaced in M4.
import { useParams } from 'react-router-dom';

export function Studio() {
  const { id } = useParams();
  return (
    <div style={{ padding: 40 }}>
      <h1>Studio</h1>
      <p>Artifact: {id}</p>
    </div>
  );
}
