import AdminConsultationsCRM from '@/components/AdminConsultationsCRM';
import '../consultations/consultations.css';
import '../consultations/rental-crm-v079.css';

export default function AdminRentalPage(){
  return <main className="crm-page">
    <AdminConsultationsCRM initialService="렌탈 전체"/>
  </main>;
}
