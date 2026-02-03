import { useParams } from 'react-router-dom';
import CallInterface from '../components/CallInterface';

/**
 * Page component for displaying a specific simulator by slug.
 * Extracts the slug from URL params and passes it to CallInterface.
 */
export default function SimulatorPage() {
  const { slug } = useParams<{ slug: string }>();

  return <CallInterface slug={slug} />;
}
