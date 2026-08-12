import AdminConsultationsCRM from '@/components/AdminConsultationsCRM';
import '../consultations/consultations.css';
import '../consultations/rental-crm-v079.css';
import '../consultations/save-feedback-v0811.css';

export default function AdminRentalPage(){
  return <main className="crm-page">
    <AdminConsultationsCRM initialService="렌탈 전체"/>
  </main>;
}
