import React, {createContext,useCallback,useContext,useEffect,useRef,useState} from "react";
import Icon from "./Icon";
export const IS_UI_PREVIEW = process.env.REACT_APP_UI_PREVIEW === "true";
const Context=createContext(null);
export function useUi(){return useContext(Context);}
export function UiProvider({children}) {
 const [dialog,setDialog]=useState(null); const [toast,setToast]=useState("");
 const timer=useRef(); const trigger=useRef(); const panel=useRef();
 const close=useCallback(()=>{setDialog(null);requestAnimationFrame(()=>trigger.current?.focus?.());},[]);
 const show=useCallback((content)=>{trigger.current=document.activeElement;setDialog(content);},[]);
 const notify=useCallback((message)=>{clearTimeout(timer.current);setToast(message);timer.current=setTimeout(()=>setToast(""),4500);},[]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  if(!dialog)return;const before=document.body.style.overflow;document.body.style.overflow="hidden";
  const frame=requestAnimationFrame(()=>panel.current?.querySelector('button, input, a[href]')?.focus());
  const key=(e)=>{
   if(e.key==='Escape'){e.preventDefault();close();}
   if(e.key==='Tab'){
    const nodes=[...panel.current.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]')].filter(n=>n.offsetParent!==null);
    if(!nodes.length){e.preventDefault();return;}
    if(e.shiftKey && document.activeElement===nodes[0]){e.preventDefault();nodes[nodes.length-1].focus();}
    else if(!e.shiftKey && document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0].focus();}
   }
  };
  document.addEventListener('keydown',key);
  return()=>{cancelAnimationFrame(frame);document.body.style.overflow=before;document.removeEventListener('keydown',key);};
 },[dialog,close]);
 const previewAction=useCallback((label="Wallet action")=>show({eyebrow:"DESIGN PREVIEW",title:"A preview, not a transaction.",body:<><p>You selected <strong>{label}</strong>. Explore the interface without connecting a wallet, approving tokens, or sending a transaction.</p><p className="jr-note">Network configuration and contract verification are a separate step.</p></>}),[show]);
 function guard(e){const action=e.target.closest?.('[data-transaction]');if(IS_UI_PREVIEW && action){e.preventDefault();e.stopPropagation();previewAction(action.dataset.transaction || action.textContent.trim());}}
 return <Context.Provider value={{show,close,notify,previewAction}}>
  <div onClickCapture={guard}>{children}</div>
  {toast&&<div className="jr-toast" role="status"><Icon name="check"/>{toast}</div>}
  {dialog&&<div className="jr-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}>
   <section ref={panel} className="jr-dialog" role="dialog" aria-modal="true" aria-labelledby="jr-dialog-title">
    <div className="jr-dialog-top"><span className="jr-eyebrow">{dialog.eyebrow || "THE BURROW"}</span><button type="button" className="jr-icon-btn" onClick={close} aria-label="Close dialog"><Icon name="close"/></button></div>
    <h2 id="jr-dialog-title">{dialog.title}</h2><div className="jr-dialog-body">{dialog.body}</div>
    <div className="jr-dialog-actions">{dialog.actions || <button type="button" className="jr-btn jr-btn-dark" onClick={close}>Got it <Icon name="check"/></button>}</div>
   </section>
  </div>}
 </Context.Provider>;
}
export function PreviewNotice(){
 const [hidden,setHidden]=useState(false);
 if(!IS_UI_PREVIEW||hidden)return null;
 return <div className="jr-preview-strip"><Icon name="info" size={15}/><span><strong>Interface preview</strong><span className="jr-preview-long"> — explore the design. Wallet transactions are disabled.</span></span><button onClick={()=>setHidden(true)} aria-label="Dismiss preview notice"><Icon name="close" size={14}/></button></div>;
}
export function DataNotice({children}) {
 return <div className="jr-data-note"><Icon name="info" size={17}/><span>{children || "Sample data for interface review. No real balances or rewards are shown."}</span></div>;
}
export function EmptyState({icon="wallet",title="Nothing here yet",children,action}){
 return <div className="jr-empty"><span className="jr-empty-icon"><Icon name={icon} size={29}/></span><h3>{title}</h3><p>{children}</p>{action}</div>;
}
export function PageHeading({eyebrow,title,description,action}){
 return <div className="jr-page-heading"><div><span className="jr-eyebrow">{eyebrow || "JACK RABBIT ECOSYSTEM"}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
