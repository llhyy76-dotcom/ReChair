import type {MetadataRoute} from 'next';

export default function manifest():MetadataRoute.Manifest{
  return {
    name:'ReChair Field',
    short_name:'ReChair 현장',
    description:'ReChair 현장 기사 일정 및 작업보고 앱',
    start_url:'/technician',
    display:'standalone',
    background_color:'#f3f6fb',
    theme_color:'#183b74',
    orientation:'portrait',
    icons:[
      {src:'/rechair-chair-balanced.png',sizes:'any',type:'image/png'},
    ],
  };
}
