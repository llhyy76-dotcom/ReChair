import Hero from '@/components/Hero';
import ProductList from '@/components/ProductList';
import ConsultationForm from '@/components/ConsultationForm';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main>
      <Hero />
      <ProductList />
      <ConsultationForm />
      <Footer />
    </main>
  );
}
