import { Landing } from '@/components/landing/Landing';
import './landing.css';

export const metadata = {
  title: 'Mobee — Os planos mudam. O Mobee adapta-se.',
  description: 'O teu dia muda; o Mobee ajusta os transportes e o resto do plano contigo. Piloto em Lisboa, com dados reais.',
};

export default function Home() {
  return <Landing />;
}
