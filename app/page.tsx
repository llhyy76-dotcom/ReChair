import Header from '@/components/Header';
import Hero from '@/components/Hero';
import ServiceCards from '@/components/ServiceCards';
import ProductList from '@/components/ProductList';
import ConsultationForm from '@/components/ConsultationForm';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <main>
      <Header />
      <Hero />
      <ServiceCards />
      <ProductList />
      <ConsultationForm />
      <Footer />
    </main>
  );
}
