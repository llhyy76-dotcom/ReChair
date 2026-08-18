import RentalContractCustomer from '@/components/RentalContractCustomer';

export const dynamic='force-dynamic';
export const metadata={
  title:'ReChair 전자 렌탈 계약',
  robots:{index:false,follow:false,noarchive:true},
  referrer:'no-referrer' as const,
};

export default async function RentalContractPage({
  params,
}:{
  params:Promise<{token:string}>;
}){
  const {token}=await params;
  return <RentalContractCustomer token={token}/>;
}
