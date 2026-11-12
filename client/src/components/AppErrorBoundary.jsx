import {Component} from 'react';
import {t} from '../i18n/runtime';
export default class AppErrorBoundary extends Component{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){console.error('UI_ERROR: RENDER_FAILED');}
 render(){return this.state.failed?<div role="alert" style={{maxWidth:600,margin:'80px auto',padding:24,fontFamily:'sans-serif'}}><h1>{t('This page could not be opened.')}</h1><p>{t('Reload the page. If the problem continues, contact support.')}</p><button onClick={()=>window.location.reload()}>{t('Reload')}</button> <a href="/support">{t('Support')}</a></div>:this.props.children;}
}
