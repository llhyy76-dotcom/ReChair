import Hero from '@/components/Hero';
import Services from '@/components/Services';
import ProductList from '@/components/ProductList';
import ConsultationForm from '@/components/ConsultationForm';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main>
      <Hero />
      <Services />
      <ProductList />
      <ConsultationForm />
      <Footer />
    </main>
  );
}
